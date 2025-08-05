package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"gorm.io/gorm"

	"sudoku/internal/auth"
	"sudoku/internal/models"
	"sudoku/internal/sudoku"
)

type GameHandler struct {
	db            *gorm.DB
	sudokuService *sudoku.Service
}

type StartGameRequest struct {
	Difficulty string `json:"difficulty"`
	Mode       string `json:"mode"`
}

type SubmitGameRequest struct {
	GameResultID  uint   `json:"game_result_id"`
	FinalGrid     string `json:"final_grid"`
	TimeSeconds   int    `json:"time_seconds"`
	UsedHints     bool   `json:"used_hints"`
	UsedAutoSolve bool   `json:"used_auto_solve"`
}

func NewGameHandler(db *gorm.DB, sudokuService *sudoku.Service) *GameHandler {
	return &GameHandler{
		db:            db,
		sudokuService: sudokuService,
	}
}

func (h *GameHandler) StartGame(w http.ResponseWriter, r *http.Request) {
	var req StartGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(auth.UserIDKey).(uint)
	log.Printf("StartGame called - UserID: %d, Difficulty: %s, Mode: %s", userID, req.Difficulty, req.Mode)

	// Validate difficulty
	var difficulty models.Difficulty
	switch req.Difficulty {
	case "easy":
		difficulty = models.Easy
	case "medium":
		difficulty = models.Medium
	case "hard":
		difficulty = models.Hard
	default:
		http.Error(w, "Invalid difficulty level", http.StatusBadRequest)
		return
	}

	// Validate mode
	var mode models.GameMode
	switch req.Mode {
	case "play":
		mode = models.PlayMode
	case "learn":
		mode = models.LearnMode
	default:
		http.Error(w, "Invalid game mode", http.StatusBadRequest)
		return
	}

	// Generate a new puzzle dynamically
	puzzleBoard, solutionBoard, err := h.sudokuService.GeneratePuzzle(difficulty)
	if err != nil {
		http.Error(w, "Failed to generate puzzle", http.StatusInternalServerError)
		return
	}

	// Save the generated puzzle to the database
	puzzle := &models.Puzzle{
		Difficulty:   difficulty,
		StartingGrid: sudoku.BoardToString(puzzleBoard),
		Solution:     sudoku.BoardToString(solutionBoard),
	}
	if err := h.db.Create(puzzle).Error; err != nil {
		http.Error(w, "Failed to save generated puzzle", http.StatusInternalServerError)
		return
	}

	// Create game result
	gameResult := &models.GameResult{
		UserID:    userID,
		PuzzleID:  puzzle.ID,
		Mode:      mode,
		StartedAt: time.Now(),
		FinalGrid: puzzle.StartingGrid,
	}

	if err := h.db.Create(gameResult).Error; err != nil {
		http.Error(w, "Failed to create game session", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"game_result_id": gameResult.ID,
		"puzzle":         puzzle,
		"started_at":     gameResult.StartedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *GameHandler) SubmitGame(w http.ResponseWriter, r *http.Request) {
	var req SubmitGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(auth.UserIDKey).(uint)

	// Get game result
	var gameResult models.GameResult
	if err := h.db.Preload("Puzzle").First(&gameResult, req.GameResultID).Error; err != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if gameResult.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Update game result
	now := time.Now()
	gameResult.FinalGrid = req.FinalGrid
	gameResult.TimeSeconds = req.TimeSeconds
	gameResult.UsedHints = req.UsedHints
	gameResult.UsedAutoSolve = req.UsedAutoSolve
	gameResult.CompletedAt = &now

	// Validate solution
	board := sudoku.StringToBoard(req.FinalGrid)
	if h.sudokuService.ValidateSolution(board) {
		gameResult.Completed = true

		// Calculate score for play mode
		if gameResult.Mode == models.PlayMode && !req.UsedHints && !req.UsedAutoSolve {
			initialBoard := sudoku.StringToBoard(gameResult.Puzzle.StartingGrid)
			gameResult.Score = h.sudokuService.CalculateScore(initialBoard, board)

			// Update user stats
			h.db.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
				"total_points": gorm.Expr("total_points + ?", gameResult.Score),
				"games_played": gorm.Expr("games_played + 1"),
			})
		}
	}

	// Disqualify if hints or auto-solve used in play mode
	if gameResult.Mode == models.PlayMode && (req.UsedHints || req.UsedAutoSolve) {
		gameResult.Disqualified = true
	}

	if err := h.db.Save(&gameResult).Error; err != nil {
		http.Error(w, "Failed to save game result", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"completed":    gameResult.Completed,
		"score":        gameResult.Score,
		"disqualified": gameResult.Disqualified,
		"time_seconds": gameResult.TimeSeconds,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *GameHandler) GetHint(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameResultID uint   `json:"game_result_id"`
		Mode         string `json:"mode"` // "find_cell" or "fill_cell"
		Row          *int   `json:"row,omitempty"`
		Col          *int   `json:"col,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(auth.UserIDKey).(uint)

	// Get game result
	var gameResult models.GameResult
	if err := h.db.Preload("Puzzle").First(&gameResult, req.GameResultID).Error; err != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if gameResult.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	board := sudoku.StringToBoard(gameResult.FinalGrid)
	var hint *sudoku.Move
	var err error

	if req.Mode == "find_cell" {
		// Find a solvable cell to highlight
		hint, err = h.sudokuService.FindSolvableCell(board)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else if req.Mode == "fill_cell" {
		// Fill the specified cell with the correct value
		if req.Row == nil || req.Col == nil {
			http.Error(w, "Row and Col are required for fill_cell mode", http.StatusBadRequest)
			return
		}
		
		hint, err = h.sudokuService.GetHint(board, *req.Row, *req.Col)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Mark that hints were used and update the board state
		board[*req.Row][*req.Col] = hint.Value
		gameResult.FinalGrid = sudoku.BoardToString(board)
		gameResult.UsedHints = true
		h.db.Save(&gameResult)
	} else {
		http.Error(w, "Invalid mode. Use 'find_cell' or 'fill_cell'", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hint)
}

func (h *GameHandler) SolvePuzzle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameResultID uint `json:"game_result_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(auth.UserIDKey).(uint)

	// Get game result
	var gameResult models.GameResult
	if err := h.db.Preload("Puzzle").First(&gameResult, req.GameResultID).Error; err != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if gameResult.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Solve puzzle
	board := sudoku.StringToBoard(gameResult.FinalGrid)
	solvedBoard, success := h.sudokuService.SolvePuzzle(board)

	if !success {
		http.Error(w, "Puzzle cannot be solved", http.StatusBadRequest)
		return
	}

	// Mark that auto-solve was used
	gameResult.UsedAutoSolve = true
	h.db.Save(&gameResult)

	response := map[string]interface{}{
		"solved_grid": sudoku.BoardToString(solvedBoard),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *GameHandler) GetGameHistory(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(auth.UserIDKey).(uint)
	limitStr := r.URL.Query().Get("limit")

	limit := 20 // default limit
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	var gameResults []models.GameResult
	if err := h.db.Preload("Puzzle").Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&gameResults).Error; err != nil {
		http.Error(w, "Failed to fetch game history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(gameResults)
}

func (h *GameHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	difficulty := r.URL.Query().Get("difficulty")
	sortBy := r.URL.Query().Get("sort_by") // "score" or "time"

	if sortBy == "" {
		sortBy = "score"
	}

	var query *gorm.DB
	if difficulty != "" {
		query = h.db.Table("game_results").
			Select("users.username, game_results.score, game_results.time_seconds, game_results.completed_at").
			Joins("JOIN users ON game_results.user_id = users.id").
			Joins("JOIN puzzles ON game_results.puzzle_id = puzzles.id").
			Where("game_results.mode = ? AND puzzles.difficulty = ? AND game_results.completed = ? AND game_results.disqualified = ?", models.PlayMode, difficulty, true, false)
	} else {
		query = h.db.Table("game_results").
			Select("users.username, game_results.score, game_results.time_seconds, game_results.completed_at").
			Joins("JOIN users ON game_results.user_id = users.id").
			Where("game_results.mode = ? AND game_results.completed = ? AND game_results.disqualified = ?", models.PlayMode, true, false)
	}

	var results []map[string]interface{}
	if sortBy == "time" {
		query.Order("game_results.time_seconds ASC").Limit(10).Find(&results)
	} else {
		query.Order("game_results.score DESC").Limit(10).Find(&results)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
