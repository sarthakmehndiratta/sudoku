package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"sudoku/internal/auth"
	"sudoku/internal/handlers"
	"sudoku/internal/models"
	"sudoku/internal/sudoku"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize database
	db, err := initDB()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.User{}, &models.Puzzle{}, &models.GameResult{}); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Initialize services
	authService := auth.NewService(db)
	sudokuService := sudoku.NewService(db)
	gameHandler := handlers.NewGameHandler(db, sudokuService)
	authHandler := handlers.NewAuthHandler(authService)
	puzzleHandler := handlers.NewPuzzleHandler(db)

	// Initialize router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public routes
	r.Group(func(r chi.Router) {
		r.Post("/auth/register", authHandler.Register)
		r.Post("/auth/login", authHandler.Login)
		r.Get("/puzzles", puzzleHandler.GetPuzzles)
		r.Get("/leaderboard", gameHandler.GetLeaderboard)
		r.Get("/debug/games", gameHandler.GetAllCompletedGames) // Debug endpoint
		r.Post("/debug/create-dummy-data", gameHandler.CreateDummyLeaderboardData) // Create dummy data
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(auth.AuthMiddleware(authService))

		r.Get("/profile", authHandler.GetProfile)
		r.Put("/profile", authHandler.UpdateProfile)

		r.Post("/game/start", gameHandler.StartGame)
		r.Post("/game/submit", gameHandler.SubmitGame)
		r.Get("/game/history", gameHandler.GetGameHistory)

		r.Post("/game/hint", gameHandler.GetHint)
		r.Post("/game/solve", gameHandler.SolvePuzzle)
		r.Post("/game/solve-step", gameHandler.SolveStep)
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func initDB() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=sudoku port=5432 sslmode=disable"
	}

	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}
