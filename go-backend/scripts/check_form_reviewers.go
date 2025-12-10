package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Load config
	cfg := config.LoadConfig()

	// Connect to database
	if err := database.InitDB(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	var tables []models.Table
	if err := database.DB.Where("icon = ?", "form").Find(&tables).Error; err != nil {
		log.Fatalf("Failed to list forms: %v", err)
	}

	fmt.Printf("Found %d forms\n", len(tables))
	fmt.Println("--------------------------------------------------")

	for _, table := range tables {
		var settings map[string]interface{}
		if err := json.Unmarshal(table.Settings, &settings); err != nil {
			fmt.Printf("❌ Form: %s (ID: %s) - Failed to unmarshal settings\n", table.Name, table.ID)
			continue
		}

		reviewers, hasReviewers := settings["reviewers"]
		
		status := "❌ No reviewers"
		if hasReviewers {
			r, ok := reviewers.([]interface{})
			if ok && len(r) > 0 {
				status = fmt.Sprintf("✅ Has reviewers (%d reviewers)", len(r))
				// Print first reviewer details for debugging
				if len(r) > 0 {
					jsonBytes, _ := json.MarshalIndent(r, "", "  ")
					fmt.Println(string(jsonBytes))
				}
			} else {
				status = "⚠️ Empty reviewers array"
			}
		}

		fmt.Printf("Form: %-30s | Slug: %-20s | %s\n", table.Name, table.Slug, status)
	}
}
