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

		translations, hasTranslations := settings["translations"]
		
		status := "❌ No translations"
		if hasTranslations {
			t, ok := translations.(map[string]interface{})
			if ok && len(t) > 0 {
				status = fmt.Sprintf("✅ Has translations (%d languages)", len(t))
			} else {
				status = "⚠️ Empty translations object"
			}
		}

		fmt.Printf("Form: %-30s | Slug: %-20s | %s\n", table.Name, table.Slug, status)
	}
}
