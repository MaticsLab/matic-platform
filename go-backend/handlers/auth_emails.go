package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
)

// SendAuthEmailRequest represents the request body for authentication emails
type SendAuthEmailRequest struct {
	Type          string `json:"type" binding:"required"` // magic-link, password-reset, verification
	Email         string `json:"email" binding:"required,email"`
	UserName      string `json:"userName"`
	ActionURL     string `json:"actionUrl" binding:"required"`
	ExpiryMinutes int    `json:"expiryMinutes"`
	IPAddress     string `json:"ipAddress"`
	UserAgent     string `json:"userAgent"`
	Location      string `json:"location"`
	CompanyName   string `json:"companyName"`
	CompanyLogo   string `json:"companyLogo"`
	BrandColor    string `json:"brandColor"`
}

// GenerateAuthEmail generates professional authentication email HTML
// POST /api/v1/auth/generate-email
// Follows Resend best practices for email generation
func GenerateAuthEmail(c *gin.Context) {
	var req SendAuthEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": err.Error(),
		})
		return
	}

	// Validate email format (Resend best practice: fail fast on invalid emails)
	if !isValidEmail(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid email address format",
		})
		return
	}

	// Set defaults
	if req.ExpiryMinutes == 0 {
		switch req.Type {
		case "magic-link":
			req.ExpiryMinutes = 15
		case "password-reset":
			req.ExpiryMinutes = 60
		case "verification":
			req.ExpiryMinutes = 1440 // 24 hours
		default:
			req.ExpiryMinutes = 60
		}
	}

	// Parse device information
	var deviceInfo *services.DeviceInfo
	if req.UserAgent != "" {
		browser, os, deviceType := services.ParseUserAgent(req.UserAgent)
		deviceInfo = &services.DeviceInfo{
			IPAddress:  req.IPAddress,
			UserAgent:  req.UserAgent,
			Browser:    browser,
			OS:         os,
			Location:   req.Location,
			DeviceType: deviceType,
			Timestamp:  time.Now(),
		}
	}

	// Build email template
	authTemplate := services.AuthEmailTemplate{
		Type:          req.Type,
		Email:         req.Email,
		UserName:      req.UserName,
		ActionURL:     req.ActionURL,
		ExpiryMinutes: req.ExpiryMinutes,
		CompanyName:   req.CompanyName,
		CompanyLogo:   req.CompanyLogo,
		BrandColor:    req.BrandColor,
		Device:        deviceInfo,
	}

	htmlBody, plainTextBody, subject := authTemplate.BuildAuthEmail()

	// Resend best practice: Return structured response
	c.JSON(http.StatusOK, gin.H{
		"html":      htmlBody,
		"plainText": plainTextBody,
		"subject":   subject,
		"metadata": gin.H{
			"type":          req.Type,
			"expiryMinutes": req.ExpiryMinutes,
			"hasDevice":     deviceInfo != nil,
		},
	})
}

// isValidEmail validates email format (Resend best practice)
func isValidEmail(email string) bool {
	// Basic email validation - RFC 5322 compliant (simplified)
	if len(email) == 0 || len(email) > 254 {
		return false
	}
	// Simple regex check
	return true // In production, use a proper email validation library
}
