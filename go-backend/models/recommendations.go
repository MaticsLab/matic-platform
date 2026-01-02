package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// RecommendationRequest represents a request for a letter of recommendation
type RecommendationRequest struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	SubmissionID uuid.UUID `json:"submission_id" gorm:"type:uuid;not null"`
	FormID       uuid.UUID `json:"form_id" gorm:"type:uuid;not null"`
	FieldID      string    `json:"field_id" gorm:"not null"`

	// Recommender info
	RecommenderName         string `json:"recommender_name" gorm:"not null"`
	RecommenderEmail        string `json:"recommender_email" gorm:"not null"`
	RecommenderRelationship string `json:"recommender_relationship"`
	RecommenderOrganization string `json:"recommender_organization"`

	// Request tracking
	Token         string `json:"token" gorm:"uniqueIndex;not null"`
	Status        string `json:"status" gorm:"default:pending"` // pending, submitted, expired, cancelled
	ReminderCount int    `json:"reminder_count" gorm:"default:0"`

	// Timestamps
	RequestedAt time.Time  `json:"requested_at" gorm:"default:CURRENT_TIMESTAMP"`
	RemindedAt  *time.Time `json:"reminded_at"`
	SubmittedAt *time.Time `json:"submitted_at"`
	ExpiresAt   *time.Time `json:"expires_at"`

	// Response data
	Response datatypes.JSON `json:"response" gorm:"type:jsonb"`

	// Standard timestamps
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (RecommendationRequest) TableName() string {
	return "recommendation_requests"
}

// RecommendationFieldConfig represents the configuration for a recommendation field
type RecommendationFieldConfig struct {
	MinRecommenders int                      `json:"min_recommenders"`
	MaxRecommenders int                      `json:"max_recommenders"`
	NumRecommenders int                      `json:"numRecommenders"` // Frontend uses this name
	DeadlineDays    int                      `json:"deadline_days"`   // Days after request to expire
	DeadlineDaysFE  int                      `json:"deadlineDays"`    // Frontend uses this name
	AllowWaiver     bool                     `json:"allow_waiver"`    // Allow applicant to waive right to see
	Questions       []RecommendationQuestion `json:"questions"`
	EmailTemplate   RecommendationEmail      `json:"email_template"`
	EmailSubject    string                   `json:"emailSubject"`  // Frontend uses this name
	EmailMessage    string                   `json:"emailMessage"`  // Frontend uses this name
	ReminderDays    []int                    `json:"reminder_days"` // Days after request to send reminders
	Instructions    string                   `json:"instructions"`  // Instructions shown to applicant
}

// RecommendationQuestion represents a question in the recommendation form
type RecommendationQuestion struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"` // text, textarea, rating, select, checkbox
	Label       string   `json:"label"`
	Description string   `json:"description,omitempty"`
	Required    bool     `json:"required"`
	Options     []string `json:"options,omitempty"`    // For select/checkbox types
	MaxRating   int      `json:"max_rating,omitempty"` // For rating type
}

// RecommendationEmail represents the email template configuration
type RecommendationEmail struct {
	Subject         string `json:"subject"`
	Body            string `json:"body"` // Supports merge tags: {{applicant_name}}, {{recommender_name}}, {{deadline}}, {{link}}
	ReminderSubject string `json:"reminder_subject"`
	ReminderBody    string `json:"reminder_body"`
}

// CreateRecommendationRequestInput represents the input for creating a recommendation request
type CreateRecommendationRequestInput struct {
	SubmissionID            string `json:"submission_id" binding:"required"`
	FormID                  string `json:"form_id" binding:"required"`
	FieldID                 string `json:"field_id" binding:"required"`
	RecommenderName         string `json:"recommender_name" binding:"required"`
	RecommenderEmail        string `json:"recommender_email" binding:"required"`
	RecommenderRelationship string `json:"recommender_relationship"`
	RecommenderOrganization string `json:"recommender_organization"`
}

// SubmitRecommendationInput represents the input for submitting a recommendation
type SubmitRecommendationInput struct {
	Token    string                 `json:"token" binding:"required"`
	Response map[string]interface{} `json:"response" binding:"required"`
}
