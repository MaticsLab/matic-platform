package main

import (
	"fmt"
	"log"
	"os"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env from parent directory
	if err := godotenv.Load("../.env"); err != nil {
		log.Fatal("Error loading .env file")
	}

	url := os.Getenv("DATABASE_URL")
	if err := database.InitDB(url); err != nil {
		log.Fatal(err)
	}

	var count int64
	database.DB.Model(&models.Row{}).Count(&count)
	fmt.Printf("Total rows in database: %d\n", count)

	var forms []models.Table
	database.DB.Where("icon = ?", "form").Find(&forms)
	fmt.Printf("Total forms: %d\n", len(forms))

	for _, form := range forms {
		var rowCount int64
		database.DB.Model(&models.Row{}).Where("table_id = ?", form.ID).Count(&rowCount)
		fmt.Printf("- Form: %s (ID: %s) has %d submissions\n", form.Name, form.ID, rowCount)
	}
}
