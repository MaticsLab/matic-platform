package main

import (
	"fmt"
	"log"
	"os"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
)

func main() {
	// Initialize DB connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}
	if err := database.InitDB(dbURL); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	db := database.DB

	var applicants []models.PortalApplicant
	db.Find(&applicants)
	updated := 0

	for _, a := range applicants {
		if a.FullName == "" || a.FullName == a.Email {
			// Try to find Better Auth user by email
			var baUser models.BetterAuthUser
			err := db.Where("email = ?", a.Email).First(&baUser).Error
			if err == nil {
				if baUser.FullName != nil && *baUser.FullName != "" {
					a.FullName = *baUser.FullName
				} else if baUser.Name != "" {
					a.FullName = baUser.Name
				} else {
					a.FullName = a.Email
				}
			} else {
				a.FullName = a.Email
			}
			db.Model(&a).Update("full_name", a.FullName)
			updated++
		}
	}

	fmt.Printf("Updated %d applicants with missing names.\n", updated)
}
