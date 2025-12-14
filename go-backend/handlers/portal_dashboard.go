package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ========== Dashboard Layout Handlers ==========

// DashboardLayoutDTO represents the dashboard configuration
type DashboardLayoutDTO struct {
	Sections []DashboardSection     `json:"sections"`
	Settings DashboardSettings      `json:"settings"`
	Theme    map[string]interface{} `json:"theme,omitempty"`
}

type DashboardSection struct {
	ID          string                   `json:"id"`
	Title       string                   `json:"title"`
	Type        string                   `json:"type"` // status, timeline, info, fields, chat, documents
	Description string                   `json:"description,omitempty"`
	Fields      []string                 `json:"fields,omitempty"`  // Field IDs to display
	Widgets     []map[string]interface{} `json:"widgets,omitempty"` // Custom widgets
	Settings    map[string]interface{}   `json:"settings,omitempty"`
}

type DashboardSettings struct {
	ShowStatus    bool   `json:"show_status"`
	ShowTimeline  bool   `json:"show_timeline"`
	ShowChat      bool   `json:"show_chat"`
	ShowDocuments bool   `json:"show_documents"`
	WelcomeTitle  string `json:"welcome_title,omitempty"`
	WelcomeText   string `json:"welcome_text,omitempty"`
}

// GetDashboardLayout - GET /api/v1/forms/:id/dashboard
// Returns the dashboard layout configuration for a form
func GetDashboardLayout(c *gin.Context) {
	formID := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var layout DashboardLayoutDTO
	if err := json.Unmarshal(table.DashboardLayout, &layout); err != nil {
		// Return default layout
		layout = getDefaultDashboardLayout()
	}

	c.JSON(http.StatusOK, layout)
}

// UpdateDashboardLayout - PUT /api/v1/forms/:id/dashboard
// Updates the dashboard layout configuration
func UpdateDashboardLayout(c *gin.Context) {
	formID := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var layout DashboardLayoutDTO
	if err := c.ShouldBindJSON(&layout); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid layout data"})
		return
	}

	layoutJSON, err := json.Marshal(layout)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize layout"})
		return
	}

	table.DashboardLayout = layoutJSON
	table.UpdatedAt = time.Now()

	if err := database.DB.Save(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update dashboard layout"})
		return
	}

	c.JSON(http.StatusOK, layout)
}

func getDefaultDashboardLayout() DashboardLayoutDTO {
	return DashboardLayoutDTO{
		Sections: []DashboardSection{
			{
				ID:    "status",
				Title: "Application Status",
				Type:  "status",
			},
			{
				ID:    "info",
				Title: "Your Information",
				Type:  "fields",
			},
			{
				ID:    "messages",
				Title: "Messages",
				Type:  "chat",
			},
		},
		Settings: DashboardSettings{
			ShowStatus:    true,
			ShowTimeline:  true,
			ShowChat:      true,
			ShowDocuments: true,
			WelcomeTitle:  "Welcome to your Application Dashboard",
			WelcomeText:   "Track your application status and communicate with our team.",
		},
	}
}

// ========== Applicant Dashboard Data Handlers ==========

// ApplicationDashboardDTO represents the applicant's view of their application
type ApplicationDashboardDTO struct {
	Application ApplicationInfo     `json:"application"`
	Layout      DashboardLayoutDTO  `json:"layout"`
	Activities  []PortalActivityDTO `json:"activities"`
	Timeline    []TimelineEvent     `json:"timeline"`
}

type ApplicationInfo struct {
	ID          uuid.UUID              `json:"id"`
	FormID      uuid.UUID              `json:"form_id"`
	FormName    string                 `json:"form_name"`
	Status      string                 `json:"status"`
	StageName   string                 `json:"stage_name,omitempty"`
	StageColor  string                 `json:"stage_color,omitempty"`
	Data        map[string]interface{} `json:"data"`
	SubmittedAt *time.Time             `json:"submitted_at,omitempty"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type TimelineEvent struct {
	ID        uuid.UUID `json:"id"`
	Type      string    `json:"type"` // submitted, stage_change, message, status_update
	Title     string    `json:"title"`
	Content   string    `json:"content,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// GetApplicantDashboard - GET /api/v1/portal/applications/:id
// Returns the full dashboard data for an applicant viewing their application
func GetApplicantDashboard(c *gin.Context) {
	applicationID := c.Param("id")

	// Get applicant from context (set by portal auth middleware)
	// For now, allow unauthenticated access for testing
	// TODO: Add proper portal auth middleware
	applicantID, _ := c.Get("applicant_id")

	// Fetch the row (application)
	var row models.Row
	if err := database.DB.First(&row, "id = ?", applicationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	// Fetch the table (form) separately
	var table models.Table
	if err := database.DB.First(&table, "id = ?", row.TableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get row data
	var rowData map[string]interface{}
	json.Unmarshal(row.Data, &rowData)

	// Verify ownership if applicant_id is set
	if applicantID != nil {
		var applicant models.PortalApplicant
		if err := database.DB.First(&applicant, "id = ?", applicantID).Error; err == nil {
			if email, ok := rowData["email"].(string); ok && email != applicant.Email {
				c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this application"})
				return
			}
		}
	}

	// Get dashboard layout from table
	var layout DashboardLayoutDTO
	if err := json.Unmarshal(table.DashboardLayout, &layout); err != nil || len(layout.Sections) == 0 {
		layout = getDefaultDashboardLayout()
	}

	// Get activities (visible to applicant)
	var activities []models.PortalActivity
	database.DB.Where("row_id = ? AND visibility IN ?", applicationID, []string{"applicant", "both"}).
		Order("created_at DESC").
		Limit(50).
		Find(&activities)

	// Mark activities as read by applicant
	database.DB.Model(&models.PortalActivity{}).
		Where("row_id = ? AND visibility IN ? AND read_by_applicant = false", applicationID, []string{"applicant", "both"}).
		Update("read_by_applicant", true)

	// Get metadata for stage info
	var metadata map[string]interface{}
	json.Unmarshal(row.Metadata, &metadata)

	// Extract status and stage from metadata if present
	status := "submitted"
	var stageName, stageColor string
	if s, ok := metadata["status"].(string); ok {
		status = s
	}
	if stageID, ok := metadata["stage_id"].(string); ok && stageID != "" {
		var stage models.ApplicationStage
		if err := database.DB.First(&stage, "id = ?", stageID).Error; err == nil {
			stageName = stage.Name
			stageColor = stage.Color
		}
	}

	// Get submitted_at from metadata
	var submittedAt *time.Time
	if st, ok := metadata["submitted_at"].(string); ok {
		if t, err := time.Parse(time.RFC3339, st); err == nil {
			submittedAt = &t
		}
	}
	if submittedAt == nil {
		submittedAt = &row.CreatedAt
	}

	dashboard := ApplicationDashboardDTO{
		Application: ApplicationInfo{
			ID:          row.ID,
			FormID:      row.TableID,
			FormName:    table.Name,
			Status:      status,
			StageName:   stageName,
			StageColor:  stageColor,
			Data:        rowData,
			SubmittedAt: submittedAt,
			UpdatedAt:   row.UpdatedAt,
		},
		Layout:     layout,
		Activities: convertActivitiesToDTO(activities),
		Timeline:   buildTimelineFromActivities(row.CreatedAt, activities),
	}

	c.JSON(http.StatusOK, dashboard)
}

type PortalActivityDTO struct {
	ID           uuid.UUID              `json:"id"`
	RowID        uuid.UUID              `json:"row_id"`
	ActivityType string                 `json:"activity_type"`
	Content      string                 `json:"content"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	Visibility   string                 `json:"visibility"`
	SenderType   string                 `json:"sender_type"` // applicant, staff
	SenderName   string                 `json:"sender_name,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	IsRead       bool                   `json:"is_read"`
}

// ListPortalActivities - GET /api/v1/portal/applications/:id/activities
func ListPortalActivities(c *gin.Context) {
	applicationID := c.Param("id")
	visibility := c.DefaultQuery("visibility", "both") // both, applicant, internal

	var activities []models.PortalActivity
	query := database.DB.Where("row_id = ?", applicationID)

	if visibility != "all" {
		query = query.Where("visibility IN ?", []string{visibility, "both"})
	}

	if err := query.Order("created_at DESC").Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activities"})
		return
	}

	c.JSON(http.StatusOK, convertActivitiesToDTO(activities))
}

// CreatePortalActivity - POST /api/v1/portal/applications/:id/activities
func CreatePortalActivity(c *gin.Context) {
	applicationID := c.Param("id")

	var input struct {
		ActivityType string                 `json:"activity_type"`
		Content      string                 `json:"content"`
		Metadata     map[string]interface{} `json:"metadata,omitempty"`
		Visibility   string                 `json:"visibility"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get row to find form_id
	var row models.Row
	if err := database.DB.First(&row, "id = ?", applicationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	activity := models.PortalActivity{
		FormID:       row.TableID,
		RowID:        row.ID,
		ActivityType: input.ActivityType,
		Content:      input.Content,
		Visibility:   input.Visibility,
	}

	// Set sender based on auth context
	if applicantID, exists := c.Get("applicant_id"); exists {
		id := applicantID.(uuid.UUID)
		activity.ApplicantID = &id
	} else if userID, exists := c.Get("user_id"); exists {
		id := userID.(uuid.UUID)
		activity.UserID = &id
		activity.ReadByStaff = true
	}

	if input.Metadata != nil {
		metaJSON, _ := json.Marshal(input.Metadata)
		activity.Metadata = metaJSON
	}

	if err := database.DB.Create(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create activity"})
		return
	}

	c.JSON(http.StatusCreated, convertActivityToDTO(activity))
}

// MarkActivitiesRead - POST /api/v1/portal/applications/:id/activities/read
func MarkActivitiesRead(c *gin.Context) {
	applicationID := c.Param("id")

	var input struct {
		ActivityIDs []string `json:"activity_ids"`
		ReaderType  string   `json:"reader_type"` // applicant or staff
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updateField := "read_by_staff"
	if input.ReaderType == "applicant" {
		updateField = "read_by_applicant"
	}

	if len(input.ActivityIDs) > 0 {
		database.DB.Model(&models.PortalActivity{}).
			Where("id IN ? AND row_id = ?", input.ActivityIDs, applicationID).
			Update(updateField, true)
	} else {
		// Mark all as read
		database.DB.Model(&models.PortalActivity{}).
			Where("row_id = ?", applicationID).
			Update(updateField, true)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Activities marked as read"})
}

// Helper functions

func convertActivitiesToDTO(activities []models.PortalActivity) []PortalActivityDTO {
	result := make([]PortalActivityDTO, len(activities))
	for i, a := range activities {
		result[i] = convertActivityToDTO(a)
	}
	return result
}

func convertActivityToDTO(a models.PortalActivity) PortalActivityDTO {
	senderType := "staff"
	senderName := "Staff"
	isRead := a.ReadByStaff

	if a.ApplicantID != nil {
		senderType = "applicant"
		senderName = "Applicant"
		isRead = a.ReadByApplicant
	}

	var metadata map[string]interface{}
	json.Unmarshal(a.Metadata, &metadata)

	return PortalActivityDTO{
		ID:           a.ID,
		RowID:        a.RowID,
		ActivityType: a.ActivityType,
		Content:      a.Content,
		Metadata:     metadata,
		Visibility:   a.Visibility,
		SenderType:   senderType,
		SenderName:   senderName,
		CreatedAt:    a.CreatedAt,
		IsRead:       isRead,
	}
}

func buildTimelineFromActivities(submittedAt time.Time, activities []models.PortalActivity) []TimelineEvent {
	events := []TimelineEvent{}

	// Add submission event
	events = append(events, TimelineEvent{
		ID:        uuid.New(),
		Type:      "submitted",
		Title:     "Application Submitted",
		Timestamp: submittedAt,
	})

	// Add status updates and messages from activities
	for _, a := range activities {
		if a.ActivityType == "status_update" || a.ActivityType == "message" {
			events = append(events, TimelineEvent{
				ID:        a.ID,
				Type:      a.ActivityType,
				Title:     getActivityTitle(a),
				Content:   a.Content,
				Timestamp: a.CreatedAt,
			})
		}
	}

	return events
}

func getActivityTitle(a models.PortalActivity) string {
	switch a.ActivityType {
	case "message":
		if a.ApplicantID != nil {
			return "You sent a message"
		}
		return "New message from staff"
	case "status_update":
		return "Status Updated"
	case "file_request":
		return "Document Requested"
	default:
		return "Activity"
	}
}
