package sudoku

import (
	"errors"
	"math/rand"
	"time"

	"gorm.io/gorm"

	"sudoku/internal/models"
)

type Service struct {
	db *gorm.DB
}

type Board [9][9]int

type Move struct {
	Row    int    `json:"row"`
	Col    int    `json:"col"`
	Value  int    `json:"value"`
	Reason string `json:"reason"`
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// Convert string representation to Board
func StringToBoard(s string) Board {
	var board Board
	for i := 0; i < 81; i++ {
		row := i / 9
		col := i % 9
		board[row][col] = int(s[i] - '0')
	}
	return board
}

// Convert Board to string representation
func BoardToString(board Board) string {
	var s string
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			s += string(rune(board[i][j] + '0'))
		}
	}
	return s
}

// Validate if a move is valid
func (s *Service) IsValidMove(board Board, row, col, value int) bool {
	// Check row
	for j := 0; j < 9; j++ {
		if board[row][j] == value && j != col {
			return false
		}
	}

	// Check column
	for i := 0; i < 9; i++ {
		if board[i][col] == value && i != row {
			return false
		}
	}

	// Check 3x3 box
	boxRow := (row / 3) * 3
	boxCol := (col / 3) * 3
	for i := boxRow; i < boxRow+3; i++ {
		for j := boxCol; j < boxCol+3; j++ {
			if board[i][j] == value && (i != row || j != col) {
				return false
			}
		}
	}

	return true
}

// Get valid candidates for a cell
func (s *Service) GetCandidates(board Board, row, col int) []int {
	if board[row][col] != 0 {
		return []int{}
	}

	var candidates []int
	for value := 1; value <= 9; value++ {
		if s.IsValidMove(board, row, col, value) {
			candidates = append(candidates, value)
		}
	}
	return candidates
}

// Find naked singles (cells with only one candidate)
func (s *Service) FindNakedSingles(board Board) []Move {
	var moves []Move
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if board[i][j] == 0 {
				candidates := s.GetCandidates(board, i, j)
				if len(candidates) == 1 {
					moves = append(moves, Move{
						Row:    i,
						Col:    j,
						Value:  candidates[0],
						Reason: "Naked Single",
					})
				}
			}
		}
	}
	return moves
}

// Get hint for a specific cell
func (s *Service) GetHint(board Board, row, col int) (*Move, error) {
	if board[row][col] != 0 {
		return nil, errors.New("cell is already filled")
	}

	// Use the solver to find the correct value for the cell, ensuring the hint is always correct.
	solvedBoard, success := s.SolvePuzzle(board)
	if !success {
		return nil, errors.New("puzzle cannot be solved from current state")
	}

	correctValue := solvedBoard[row][col]

	// We can try to find a reason for the move.
	// This is not essential for correctness but provides better user feedback.
	step, err := s.SolveStep(board)
	if err == nil && step.Row == row && step.Col == col {
		// If SolveStep identifies the same cell, we can use its reason.
		return step, nil
	}

	// Otherwise, return the value with a generic reason.
	return &Move{
		Row:    row,
		Col:    col,
		Value:  correctValue,
		Reason: "Hint",
	}, nil
}

// Find a solvable cell for hint highlighting
func (s *Service) FindSolvableCell(board Board) (*Move, error) {
	// Use the same logic as SolveStep to ensure the hint is always a correct and logical next move.
	return s.SolveStep(board)
}

// Find hidden singles (cells where a candidate is unique in a row, column, or box)
func (s *Service) FindHiddenSingles(board Board) []Move {
	var moves []Move
	// Check rows
	for r := 0; r < 9; r++ {
		for val := 1; val <= 9; val++ {
			count := 0
			colPos := -1
			for c := 0; c < 9; c++ {
				if board[r][c] == 0 {
					candidates := s.GetCandidates(board, r, c)
					for _, cand := range candidates {
						if cand == val {
							count++
							colPos = c
						}
					}
				}
			}
			if count == 1 {
				moves = append(moves, Move{
					Row:    r,
					Col:    colPos,
					Value:  val,
					Reason: "Hidden Single in Row",
				})
			}
		}
	}

	// Check columns
	for c := 0; c < 9; c++ {
		for val := 1; val <= 9; val++ {
			count := 0
			rowPos := -1
			for r := 0; r < 9; r++ {
				if board[r][c] == 0 {
					candidates := s.GetCandidates(board, r, c)
					for _, cand := range candidates {
						if cand == val {
							count++
							rowPos = r
						}
					}
				}
			}
			if count == 1 {
				moves = append(moves, Move{
					Row:    rowPos,
					Col:    c,
					Value:  val,
					Reason: "Hidden Single in Column",
				})
			}
		}
	}

	// Check boxes
	for boxRow := 0; boxRow < 9; boxRow += 3 {
		for boxCol := 0; boxCol < 9; boxCol += 3 {
			for val := 1; val <= 9; val++ {
				count := 0
				rowPos, colPos := -1, -1
				for r := boxRow; r < boxRow+3; r++ {
					for c := boxCol; c < boxCol+3; c++ {
						if board[r][c] == 0 {
							candidates := s.GetCandidates(board, r, c)
							for _, cand := range candidates {
								if cand == val {
									count++
									rowPos, colPos = r, c
								}
							}
						}
					}
				}
				if count == 1 {
					moves = append(moves, Move{
						Row:    rowPos,
						Col:    colPos,
						Value:  val,
						Reason: "Hidden Single in Box",
					})
				}
			}
		}
	}

	return moves
}

// Solve puzzle step-by-step
func (s *Service) SolveStep(board Board) (*Move, error) {
	// 1. Find Naked Singles
	nakedSingles := s.FindNakedSingles(board)
	if len(nakedSingles) > 0 {
		return &nakedSingles[0], nil
	}

	// 2. Find Hidden Singles
	hiddenSingles := s.FindHiddenSingles(board)
	if len(hiddenSingles) > 0 {
		return &hiddenSingles[0], nil
	}

	// 3. If no simple moves, use backtracking to find the next logical step
	solvedBoard, success := s.SolvePuzzle(board)
	if !success {
		return nil, errors.New("puzzle cannot be solved")
	}

	// Find the first empty cell and return the solved value
	for r := 0; r < 9; r++ {
		for c := 0; c < 9; c++ {
			if board[r][c] == 0 {
				return &Move{
					Row:    r,
					Col:    c,
					Value:  solvedBoard[r][c],
					Reason: "Advanced Step",
				}, nil
			}
		}
	}

	return nil, errors.New("could not fill any cell")
}

// Solve puzzle using backtracking
func (s *Service) SolvePuzzle(board Board) (Board, bool) {
	var solved Board
	copy(solved[:], board[:])

	if s.solve(&solved) {
		return solved, true
	}
	return board, false
}

func (s *Service) solve(board *Board) bool {
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if board[i][j] == 0 {
				for value := 1; value <= 9; value++ {
					if s.IsValidMove(*board, i, j, value) {
						board[i][j] = value
						if s.solve(board) {
							return true
						}
						board[i][j] = 0
					}
				}
				return false
			}
		}
	}
	return true
}

func (s *Service) solveRandom(board *Board) bool {
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if board[i][j] == 0 {
				numbers := []int{1, 2, 3, 4, 5, 6, 7, 8, 9}
				rand.Shuffle(len(numbers), func(i, j int) { numbers[i], numbers[j] = numbers[j], numbers[i] })
				for _, value := range numbers {
					if s.IsValidMove(*board, i, j, value) {
						board[i][j] = value
						if s.solveRandom(board) {
							return true
						}
						board[i][j] = 0
					}
				}
				return false
			}
		}
	}
	return true
}

// IsSolved checks if the final board matches the solution board.
func IsSolved(finalBoard, solutionBoard Board) bool {
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if finalBoard[i][j] != solutionBoard[i][j] {
				return false
			}
		}
	}
	return true
}

// Validate if a board is complete and correct
func (s *Service) ValidateSolution(board Board) bool {
	// Check if all cells are filled
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if board[i][j] == 0 {
				return false
			}
		}
	}

	// Check rows
	for i := 0; i < 9; i++ {
		seen := make(map[int]bool)
		for j := 0; j < 9; j++ {
			if seen[board[i][j]] {
				return false
			}
			seen[board[i][j]] = true
		}
	}

	// Check columns
	for j := 0; j < 9; j++ {
		seen := make(map[int]bool)
		for i := 0; i < 9; i++ {
			if seen[board[i][j]] {
				return false
			}
			seen[board[i][j]] = true
		}
	}

	// Check 3x3 boxes
	for boxRow := 0; boxRow < 9; boxRow += 3 {
		for boxCol := 0; boxCol < 9; boxCol += 3 {
			seen := make(map[int]bool)
			for i := boxRow; i < boxRow+3; i++ {
				for j := boxCol; j < boxCol+3; j++ {
					if seen[board[i][j]] {
						return false
					}
					seen[board[i][j]] = true
				}
			}
		}
	}

	return true
}

// Calculate score based on correct moves
func (s *Service) CalculateScore(initialBoard, finalBoard, solutionBoard Board) int {
	score := 0
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if initialBoard[i][j] == 0 && finalBoard[i][j] != 0 {
				// Check if the move is correct against the solution
				if finalBoard[i][j] == solutionBoard[i][j] {
					score += 10
				}
			}
		}
	}
	return score
}

// Get random puzzle by difficulty
func (s *Service) GetRandomPuzzle(difficulty models.Difficulty) (*models.Puzzle, error) {
	var puzzle models.Puzzle
	err := s.db.Where("difficulty = ?", difficulty).Order("RANDOM()").First(&puzzle).Error
	if err != nil {
		return nil, err
	}
	return &puzzle, nil
}

// Randomize a solved board by shuffling rows, columns, and boxes
func (s *Service) RandomizeBoard(board *Board) {
	rand.Seed(time.Now().UnixNano())

	// Shuffle rows within each 3x3 box
	for box := 0; box < 3; box++ {
		start := box * 3
		rows := rand.Perm(3)
		for i := 0; i < 3; i++ {
			board[start+i], board[start+rows[i]] = board[start+rows[i]], board[start+i]
		}
	}

	// Shuffle columns within each 3x3 box
	for box := 0; box < 3; box++ {
		start := box * 3
		cols := rand.Perm(3)
		for i := 0; i < 3; i++ {
			for row := 0; row < 9; row++ {
				board[row][start+i], board[row][start+cols[i]] = board[row][start+cols[i]], board[row][start+i]
			}
		}
	}

	// Shuffle entire 3x3 row boxes
	rowBoxes := rand.Perm(3)
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			board[i*3+j], board[rowBoxes[i]*3+j] = board[rowBoxes[i]*3+j], board[i*3+j]
		}
	}

	// Shuffle entire 3x3 column boxes
	colBoxes := rand.Perm(3)
	for i := 0; i < 3; i++ {
		for row := 0; row < 9; row++ {
			for j := 0; j < 3; j++ {
				board[row][i*3+j], board[row][colBoxes[i]*3+j] = board[row][colBoxes[i]*3+j], board[row][i*3+j]
			}
		}
	}
}

func (s *Service) GeneratePuzzle(difficulty models.Difficulty) (Board, Board, error) {
	var vacantTiles int
	switch difficulty {
	case models.Easy:
		vacantTiles = 35 // Fewer vacant tiles for easy puzzles
	case models.Medium:
		vacantTiles = 45 // Moderate vacant tiles for medium puzzles
	case models.Hard:
		vacantTiles = 54 // Most vacant tiles for hard puzzles
	default:
		return Board{}, Board{}, errors.New("invalid difficulty")
	}

	// Generate a fully solved board
	var solved Board
	rand.Seed(time.Now().UnixNano())
	if !s.solveRandom(&solved) {
		return Board{}, Board{}, errors.New("failed to generate solved board")
	}

	// Create a puzzle by removing tiles while ensuring a single solution
	puzzle := solved
	positions := rand.Perm(81) // Randomize cell positions
	for _, pos := range positions {
		if vacantTiles <= 0 {
			break
		}
		row, col := pos/9, pos%9
		backup := puzzle[row][col]
		puzzle[row][col] = 0

		// Check if the puzzle still has a unique solution
		temp := puzzle
		solutionCount := 0
		s.countSolutions(&temp, &solutionCount)
		if solutionCount != 1 {
			puzzle[row][col] = backup // Restore the cell if multiple solutions exist
		} else {
			vacantTiles--
		}
	}

	return puzzle, solved, nil
}

func (s *Service) countSolutions(board *Board, count *int) bool {
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if board[i][j] == 0 {
				for value := 1; value <= 9; value++ {
					if s.IsValidMove(*board, i, j, value) {
						board[i][j] = value
						// Recurse and then always backtrack
						finished := s.countSolutions(board, count)
						board[i][j] = 0

						if finished {
							return true // Propagate early exit
						}
					}
				}
				return false
			}
		}
	}
	*count++
	return *count > 1 // Stop if more than one solution is found
}
