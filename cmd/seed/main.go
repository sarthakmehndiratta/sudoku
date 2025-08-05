package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"sudoku/internal/models"
	"sudoku/internal/sudoku"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file:", err)
	}

	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate models
	if err := db.AutoMigrate(&models.User{}, &models.Puzzle{}, &models.GameResult{}); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	sudokuService := sudoku.NewService(db)

	// Generate and insert puzzles
	difficulties := []models.Difficulty{models.Easy, models.Medium, models.Hard}
	for _, difficulty := range difficulties {
		for i := 0; i < 5; i++ { // Generate 5 puzzles per difficulty
			puzzle, solution, err := sudokuService.GeneratePuzzle(difficulty)
			if err != nil {
				log.Printf("Failed to generate puzzle: %v", err)
				continue
			}

			newPuzzle := models.Puzzle{
				Difficulty:   difficulty,
				StartingGrid: sudoku.BoardToString(puzzle),
				Solution:     sudoku.BoardToString(solution),
			}

			if err := db.Create(&newPuzzle).Error; err != nil {
				log.Printf("Failed to save puzzle: %v", err)
			} else {
				log.Printf("Generated puzzle with ID: %d, Difficulty: %s", newPuzzle.ID, difficulty)
			}
		}
	}

	log.Println("Database seeding completed!")
}
