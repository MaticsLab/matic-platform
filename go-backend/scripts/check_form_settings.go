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

	formID := "9fec1d59-9b92-4280-8630-b5b5ba8275d8"
	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		log.Fatalf("Form not found: %v", err)
	}

	var settings map[string]interface{}
	if err := json.Unmarshal(table.Settings, &settings); err != nil {
		log.Fatalf("Failed to unmarshal settings: %v", err)
	}

	fmt.Printf("Form Name: %s\n", table.Name)

	translations, ok := settings["translations"]
	if !ok {
		fmt.Println("❌ 'translations' key NOT found in settings")
	} else {
		fmt.Println("✅ 'translations' key FOUND in settings")
		jsonBytes, _ := json.MarshalIndent(translations, "", "  ")
		fmt.Println(string(jsonBytes))
	}
}
