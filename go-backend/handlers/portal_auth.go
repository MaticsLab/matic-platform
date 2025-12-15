package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// PortalSignupRequest for creating a new portal applicant account
type PortalSignupRequest struct {
	FormID   string                 `json:"form_id" binding:"required"`
	Email    string                 `json:"email" binding:"required,email"`
	Password string                 `json:"password" binding:"required,min=8"`
	FullName string                 `json:"full_name"`
	Data     map[string]interface{} `json:"data"` // Additional signup form data
}

// PortalLoginRequest for logging into portal
type PortalLoginRequest struct {
	FormID   string `json:"form_id" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// PortalResetPasswordRequest for requesting password reset
type PortalResetPasswordRequest struct {
	FormID string `json:"form_id" binding:"required"`
	Email  string `json:"email" binding:"required,email"`
}

// PortalConfirmResetRequest for confirming password reset with token
type PortalConfirmResetRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// POST /api/v1/portal/signup
func PortalSignup(c *gin.Context) {
	var req PortalSignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email already exists for this form
	var existing models.PortalApplicant
	if err := database.DB.Where("form_id = ? AND email = ?", req.FormID, req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered for this form"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create applicant
	applicant := models.PortalApplicant{
		FormID:       uuid.MustParse(req.FormID),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FullName:     req.FullName,
	}

	// Store signup data if provided
	if req.Data != nil && len(req.Data) > 0 {
		applicant.SubmissionData = mapToJSON(req.Data)
	}

	if err := database.DB.Create(&applicant).Error; err != nil {
		// Log the actual error for debugging
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":    applicant.ID,
		"email": applicant.Email,
		"name":  applicant.FullName,
	})
}

// POST /api/v1/portal/login
func PortalLogin(c *gin.Context) {
	var req PortalLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find applicant - we need to handle multiple scenarios:
	// 1. form_id matches directly (portal_applicant.form_id = req.FormID)
	// 2. req.FormID is a table_id, applicant registered with view_id
	// 3. req.FormID is a view_id, applicant registered with table_id
	// 4. req.FormID is a view_id, applicant registered with different view_id (same table)

	var applicant models.PortalApplicant
	err := database.DB.Where("form_id = ? AND email = ?", req.FormID, req.Email).First(&applicant).Error

	// If not found, resolve the table_id and try all possible form_ids
	if err != nil {
		var tableID uuid.UUID

		// Parse req.FormID as UUID
		formUUID, parseErr := uuid.Parse(req.FormID)
		if parseErr != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

		// Check if req.FormID is a view_id - if so, get its table_id
		var view models.View
		if viewErr := database.DB.Where("id = ?", formUUID).First(&view).Error; viewErr == nil {
			tableID = view.TableID
		} else {
			// req.FormID might be a table_id directly
			tableID = formUUID
		}

		// Get all form views for this table
		var views []models.View
		database.DB.Where("table_id = ? AND type = ?", tableID, "form").Find(&views)

		// Build list of all possible form_ids (table_id + all view_ids)
		formIDs := []uuid.UUID{tableID}
		for _, v := range views {
			formIDs = append(formIDs, v.ID)
		}

		// Try to find applicant with any of these form_ids
		err = database.DB.Where("form_id IN ? AND email = ?", formIDs, req.Email).First(&applicant).Error
	}

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(applicant.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Update last login
	now := time.Now()
	applicant.LastLoginAt = &now
	database.DB.Save(&applicant)

	// Find the corresponding row to get row_id and status
	var rowID *string
	var status string = "draft" // Default to draft until we find a submitted row

	// Resolve the actual table_id from the view
	// applicant.FormID could be a view_id, so we need to look up the table_id
	tableID := applicant.FormID
	var view models.View
	if err := database.DB.Where("id = ?", applicant.FormID).First(&view).Error; err == nil {
		// Found a view, use its table_id
		tableID = view.TableID
	}

	// Try to find the submission row by email
	var row models.Row
	queries := []string{
		"table_id = ? AND data->>'_applicant_email' = ?",
		"table_id = ? AND data->'personal'->>'personalEmail' = ?",
		"table_id = ? AND data->>'email' = ?",
	}

	for _, query := range queries {
		if err := database.DB.Where(query, tableID, applicant.Email).First(&row).Error; err == nil {
			rowIDStr := row.ID.String()
			rowID = &rowIDStr

			// If we found a row, default to submitted (they've submitted at least once)
			status = "submitted"

			// Get status from metadata if available (could be under_review, approved, revision_requested, etc.)
			if row.Metadata != nil {
				var metadata map[string]interface{}
				if err := json.Unmarshal(row.Metadata, &metadata); err == nil {
					if s, ok := metadata["status"].(string); ok && s != "" {
						status = s
					}
				}
			}
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":              applicant.ID,
		"email":           applicant.Email,
		"name":            applicant.FullName,
		"submission_data": applicant.SubmissionData,
		"last_login_at":   applicant.LastLoginAt,
		"row_id":          rowID,
		"status":          status,
	})
}

// POST /api/v1/portal/request-reset
func PortalRequestReset(c *gin.Context) {
	var req PortalResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find applicant
	var applicant models.PortalApplicant
	if err := database.DB.Where("form_id = ? AND email = ?", req.FormID, req.Email).First(&applicant).Error; err != nil {
		// Return success even if not found (security best practice)
		c.JSON(http.StatusOK, gin.H{"message": "If an account exists, a reset link will be sent"})
		return
	}

	// Generate reset token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate reset token"})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Set token and expiry (24 hours)
	expiry := time.Now().Add(24 * time.Hour)
	applicant.ResetToken = &token
	applicant.ResetTokenExpiry = &expiry

	if err := database.DB.Save(&applicant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save reset token"})
		return
	}

	// TODO: Send email with reset link
	// For now, return the token (in production, this should be emailed)
	c.JSON(http.StatusOK, gin.H{
		"message": "Reset link sent to email",
		"token":   token, // Remove this in production
	})
}

// POST /api/v1/portal/reset-password
func PortalResetPassword(c *gin.Context) {
	var req PortalConfirmResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find applicant by reset token
	var applicant models.PortalApplicant
	if err := database.DB.Where("reset_token = ?", req.Token).First(&applicant).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	// Check if token is expired
	if applicant.ResetTokenExpiry == nil || time.Now().After(*applicant.ResetTokenExpiry) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reset token has expired"})
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Update password and clear reset token
	applicant.PasswordHash = string(hashedPassword)
	applicant.ResetToken = nil
	applicant.ResetTokenExpiry = nil

	if err := database.DB.Save(&applicant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}
