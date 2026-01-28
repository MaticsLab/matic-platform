package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load("../.env"); err != nil {
		log.Fatal("Error loading .env file")
	}
	url := os.Getenv("DATABASE_URL")
	if err := database.InitDB(url); err != nil {
		log.Fatal(err)
	}

	var count, created, updated int

	// 1. Backfill from portal_applicants (if row_id and submission_data present)
	var applicants []models.PortalApplicant
	database.DB.Find(&applicants)
	for _, a := range applicants {
		if a.RowID == nil || len(a.SubmissionData) == 0 {
			continue
		}
		var row models.Row
		if err := database.DB.First(&row, "id = ?", *a.RowID).Error; err != nil {
			continue
		}
		userID := a.Email // Use email as user_id if no auth user id
		formID := a.FormID
		var appSub models.ApplicationSubmission
		err := database.DB.Where("form_id = ? AND user_id = ?", formID, userID).First(&appSub).Error
		if err == nil {
			// Update
			appSub.Data = a.SubmissionData
			appSub.UpdatedAt = time.Now()
			database.DB.Save(&appSub)
			updated++
		} else {
			// Create
			appSub = models.ApplicationSubmission{
				UserID:  userID,
				FormID:  formID,
				Status:  "submitted",
				Version: 1,
				Data:    a.SubmissionData,
			}
			database.DB.Create(&appSub)
			created++
		}
		count++
	}

	// 2. Backfill from table_rows (if not already present)
	var rows []models.Row
	database.DB.Find(&rows)
	for _, r := range rows {
		formID := r.TableID
		userID := "unknown"
		if r.BACreatedBy != nil && *r.BACreatedBy != "" {
			userID = *r.BACreatedBy
		}
		var appSub models.ApplicationSubmission
		err := database.DB.Where("form_id = ? AND user_id = ?", formID, userID).First(&appSub).Error
		if err == nil {
			continue // Already exists
		}
		// Create
		appSub = models.ApplicationSubmission{
			UserID:  userID,
			FormID:  formID,
			Status:  "submitted",
			Version: 1,
			Data:    r.Data,
		}
		database.DB.Create(&appSub)
		created++
		count++
	}

	fmt.Printf("Backfill complete. Total processed: %d, created: %d, updated: %d\n", count, created, updated)
}
