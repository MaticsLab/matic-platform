package main

import (
	"fmt"
	"log"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
)

// Seed script for Matic Platform
// Note: Legacy form seeding removed after forms tables were dropped in migration 005
// This can be used to seed sample data for testing

func main() {
	dsn := "postgresql://postgres:Alfredo5710s674011@db.bpvdnphvunezonyrjwub.supabase.co:5432/postgres"
	if err := database.InitDB(dsn); err != nil {
		log.Fatal(err)
	}

	// Get first workspace
	var workspace models.Workspace
	if err := database.DB.First(&workspace).Error; err != nil {
		log.Fatal("No workspace found. Please create one first.")
	}
	fmt.Printf("Using workspace: %s (%s)\n", workspace.Name, workspace.ID)

	// Count existing tables
	var tableCount int64
	database.DB.Model(&models.Table{}).Where("workspace_id = ?", workspace.ID).Count(&tableCount)
	fmt.Printf("Found %d tables in workspace\n", tableCount)

	// Count search index entries
	var searchIndexCount int64
	database.DB.Model(&models.SearchIndex{}).Where("workspace_id = ?", workspace.ID).Count(&searchIndexCount)
	fmt.Printf("Found %d search index entries\n", searchIndexCount)

	// Rebuild search index
	log.Println("🔄 Rebuilding search index...")
	var result int
	database.DB.Raw("SELECT rebuild_search_index()").Scan(&result)
	fmt.Printf("✅ Search index rebuilt: %d entries\n", result)

	fmt.Println("✅ Seed script completed!")
}
