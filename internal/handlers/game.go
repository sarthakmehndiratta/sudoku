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
		FinalGrid: puzzle.StartingGrid, // Initialize FinalGrid with the puzzle's starting state
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
	isCorrect := sudoku.IsSolved(sudoku.StringToBoard(req.FinalGrid), sudoku.StringToBoard(gameResult.Puzzle.Solution))
	gameResult.Completed = isCorrect

	if isCorrect {
		// Calculate score for play mode
		if gameResult.Mode == models.PlayMode && !req.UsedHints && !req.UsedAutoSolve {
			initialBoard := sudoku.StringToBoard(gameResult.Puzzle.StartingGrid)
			finalBoard := sudoku.StringToBoard(req.FinalGrid)
			solutionBoard := sudoku.StringToBoard(gameResult.Puzzle.Solution)
			gameResult.Score = h.sudokuService.CalculateScore(initialBoard, finalBoard, solutionBoard)

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
		"correct":      isCorrect,
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
		CurrentGrid  string `json:"current_grid"`
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

	board := sudoku.StringToBoard(req.CurrentGrid)
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

func (h *GameHandler) SolveStep(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameResultID uint   `json:"game_result_id"`
		CurrentGrid  string `json:"current_grid"`
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

	// Get next step
	board := sudoku.StringToBoard(req.CurrentGrid)
	move, err := h.sudokuService.SolveStep(board)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update board and save to DB
	board[move.Row][move.Col] = move.Value
	gameResult.FinalGrid = sudoku.BoardToString(board)
	h.db.Save(&gameResult)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(move)
}

func (h *GameHandler) SolvePuzzle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameResultID uint   `json:"game_result_id"`
		CurrentGrid  string `json:"current_grid"`
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
	board := sudoku.StringToBoard(req.CurrentGrid)
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
	sortBy := r.URL.Query().Get("type") // Frontend sends "type" parameter

	if sortBy == "" {
		sortBy = "score"
	}

	var query *gorm.DB
	if difficulty != "" {
		query = h.db.Table("game_results").
			Select("users.username, game_results.score, game_results.time_seconds, game_results.completed_at, puzzles.difficulty").
			Joins("JOIN users ON game_results.user_id = users.id").
			Joins("JOIN puzzles ON game_results.puzzle_id = puzzles.id").
			Where("game_results.mode = ? AND puzzles.difficulty = ? AND game_results.completed = ? AND game_results.disqualified = ?", models.PlayMode, difficulty, true, false)
	} else {
		query = h.db.Table("game_results").
			Select("users.username, game_results.score, game_results.time_seconds, game_results.completed_at, puzzles.difficulty").
			Joins("JOIN users ON game_results.user_id = users.id").
			Joins("JOIN puzzles ON game_results.puzzle_id = puzzles.id").
			Where("game_results.mode = ? AND game_results.completed = ? AND game_results.disqualified = ?", models.PlayMode, true, false)
	}

	var results []map[string]interface{}
	if sortBy == "time" {
		query.Order("game_results.time_seconds ASC").Limit(10).Find(&results)
	} else {
		query.Order("game_results.score DESC").Limit(10).Find(&results)
	}

	// Debug logging
	log.Printf("Leaderboard query returned %d results for difficulty=%s, sortBy=%s", len(results), difficulty, sortBy)
	
	// Always return an array, even if empty
	if results == nil {
		results = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *GameHandler) GetAllCompletedGames(w http.ResponseWriter, r *http.Request) {
	var results []map[string]interface{}
	h.db.Table("game_results").
		Select("users.username, game_results.score, game_results.time_seconds, game_results.completed, game_results.disqualified, game_results.mode, game_results.created_at, puzzles.difficulty").
		Joins("JOIN users ON game_results.user_id = users.id").
		Joins("JOIN puzzles ON game_results.puzzle_id = puzzles.id").
		Order("game_results.created_at DESC").
		Limit(20).
		Find(&results)

	// Debug logging
	log.Printf("GetAllCompletedGames returned %d results", len(results))

	// Always return an array, even if empty
	if results == nil {
		results = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *GameHandler) CreateDummyLeaderboardData(w http.ResponseWriter, r *http.Request) {
	// Check if we already have some completed games
	var count int64
	h.db.Table("game_results").Where("completed = ? AND disqualified = ? AND mode = ?", true, false, models.PlayMode).Count(&count)
	
	if count > 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Dummy data already exists"})
		return
	}

	// First, let's create some dummy users if they don't exist
	dummyUsers := []models.User{
		{Username: "SudokuMaster", Email: "master@example.com", Password: "hashed_password", TotalPoints: 950, GamesPlayed: 15},
		{Username: "PuzzleWiz", Email: "wizard@example.com", Password: "hashed_password", TotalPoints: 820, GamesPlayed: 12},
		{Username: "GridSolver", Email: "solver@example.com", Password: "hashed_password", TotalPoints: 780, GamesPlayed: 10},
		{Username: "NumberNinja", Email: "ninja@example.com", Password: "hashed_password", TotalPoints: 720, GamesPlayed: 9},
		{Username: "LogicLord", Email: "lord@example.com", Password: "hashed_password", TotalPoints: 680, GamesPlayed: 8},
	}

	for _, user := range dummyUsers {
		var existingUser models.User
		if err := h.db.Where("username = ?", user.Username).First(&existingUser).Error; err != nil {
			// User doesn't exist, create it
			h.db.Create(&user)
		}
	}

	// Create some dummy puzzles
	dummyPuzzles := []models.Puzzle{
		{
			Difficulty:   models.Easy,
			StartingGrid: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
			Solution:     "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
		},
		{
			Difficulty:   models.Medium,
			StartingGrid: "000000000904607000076804100309701080008000300040508702001370560000109800000000000",
			Solution:     "125439687934627815876854123369712458758961342241538769412376591683195274597248136",
		},
		{
			Difficulty:   models.Hard,
			StartingGrid: "800000000003600000070090200050007000000045700000100030001000068008500010090000400",
			Solution:     "812753649943682571576491283154367892369845721287194356431276985628539174795812463",
		},
	}

	for _, puzzle := range dummyPuzzles {
		h.db.Create(&puzzle)
	}

	// Create some dummy completed game results
	dummyGameResults := []models.GameResult{
		{UserID: 1, PuzzleID: 1, Mode: models.PlayMode, Score: 180, TimeSeconds: 245, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "534678912672195348198342567859761423426853791713924856961537284287419635345286179", StartedAt: time.Now().Add(-time.Hour * 24), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 23)}[0]},
		{UserID: 2, PuzzleID: 1, Mode: models.PlayMode, Score: 170, TimeSeconds: 298, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "534678912672195348198342567859761423426853791713924856961537284287419635345286179", StartedAt: time.Now().Add(-time.Hour * 20), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 19)}[0]},
		{UserID: 3, PuzzleID: 2, Mode: models.PlayMode, Score: 160, TimeSeconds: 387, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "125439687934627815876854123369712458758961342241538769412376591683195274597248136", StartedAt: time.Now().Add(-time.Hour * 18), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 17)}[0]},
		{UserID: 4, PuzzleID: 2, Mode: models.PlayMode, Score: 150, TimeSeconds: 456, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "125439687934627815876854123369712458758961342241538769412376591683195274597248136", StartedAt: time.Now().Add(-time.Hour * 15), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 14)}[0]},
		{UserID: 5, PuzzleID: 3, Mode: models.PlayMode, Score: 140, TimeSeconds: 523, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "812753649943682571576491283154367892369845721287194356431276985628539174795812463", StartedAt: time.Now().Add(-time.Hour * 12), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 11)}[0]},
		{UserID: 1, PuzzleID: 2, Mode: models.PlayMode, Score: 165, TimeSeconds: 312, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "125439687934627815876854123369712458758961342241538769412376591683195274597248136", StartedAt: time.Now().Add(-time.Hour * 10), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 9)}[0]},
		{UserID: 2, PuzzleID: 3, Mode: models.PlayMode, Score: 135, TimeSeconds: 445, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "812753649943682571576491283154367892369845721287194356431276985628539174795812463", StartedAt: time.Now().Add(-time.Hour * 8), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 7)}[0]},
		{UserID: 3, PuzzleID: 1, Mode: models.PlayMode, Score: 175, TimeSeconds: 267, Completed: true, UsedHints: false, UsedAutoSolve: false, Disqualified: false, FinalGrid: "534678912672195348198342567859761423426853791713924856961537284287419635345286179", StartedAt: time.Now().Add(-time.Hour * 6), CompletedAt: &[]time.Time{time.Now().Add(-time.Hour * 5)}[0]},
	}

	for _, gameResult := range dummyGameResults {
		h.db.Create(&gameResult)
	}

	log.Printf("Created %d dummy game results for leaderboard", len(dummyGameResults))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Dummy leaderboard data created successfully",
		"count":   len(dummyGameResults),
	})
}
