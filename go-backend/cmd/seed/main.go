package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type FieldInput struct {
	ID          string                 `json:"id"`
	Label       string                 `json:"label"`
	Type        string                 `json:"type"`
	Position    int                    `json:"position"`
	IsRequired  bool                   `json:"required"`
	Placeholder string                 `json:"placeholder"`
	Options     []string               `json:"options"`
	Width       string                 `json:"width"`
	Children    []FieldInput           `json:"children"`
	Validation  map[string]interface{} `json:"validation"`
}

type SectionInput struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Fields      []FieldInput `json:"fields"`
}

func main() {
	dsn := "postgresql://postgres:Alfredo5710s674011@db.bpvdnphvunezonyrjwub.supabase.co:5432/postgres"
	if err := database.InitDB(dsn); err != nil {
		log.Fatal(err)
	}

	// Update check constraint for field_type
	log.Println("🔄 Updating check constraint for field_type...")
	database.DB.Exec(`
		ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;
		ALTER TABLE form_fields ADD CONSTRAINT form_fields_field_type_check CHECK (field_type IN (
			'text', 'textarea', 'email', 'phone', 'number', 'url',
			'select', 'multiselect', 'radio', 'checkbox',
			'date', 'datetime', 'time',
			'file', 'image',
			'signature', 'rating',
			'divider', 'heading', 'paragraph',
			'group', 'repeater'
		));
	`)

	// Run migrations for Forms only to avoid issues with other tables
	log.Println("🔄 Running database migrations for Forms...")
	if err := database.DB.AutoMigrate(&models.Form{}, &models.FormField{}); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	} // Get first workspace
	var workspace models.Workspace
	if err := database.DB.First(&workspace).Error; err != nil {
		log.Fatal("No workspace found. Please create one first.")
	}
	fmt.Printf("Using workspace: %s (%s)\n", workspace.Name, workspace.ID)

	// Define the form structure
	sections := []SectionInput{
		{
			ID:    "personal",
			Title: "Personal Information",
			Fields: []FieldInput{
				{ID: "studentName", Label: "Student Name", Type: "text", IsRequired: true, Width: "half"},
				{ID: "preferredName", Label: "Preferred Name", Type: "text", Width: "half", Placeholder: "e.g. Alex"},
				{ID: "pronouns", Label: "Pronouns", Type: "select", Width: "half", Options: []string{"She/Her", "He/Him", "They/Them", "Other", "Prefer not to say"}},
				{ID: "dob", Label: "Date of Birth", Type: "date", Width: "half"},
				{ID: "studentId", Label: "Student ID", Type: "text", IsRequired: true, Width: "half"},
				{ID: "cpsEmail", Label: "CPS Email", Type: "email", IsRequired: true, Width: "half"},
				{ID: "personalEmail", Label: "Personal Email", Type: "email", IsRequired: true, Width: "half", Placeholder: "email@example.com"},
				{ID: "phone", Label: "Phone Number", Type: "phone", IsRequired: true, Width: "half", Placeholder: "(555) 555-5555"},
				{ID: "addressGroup", Label: "Address", Type: "group", Width: "full", Children: []FieldInput{
					{ID: "street", Label: "Street Address", Type: "text", Width: "full"},
					{ID: "city", Label: "City", Type: "text", Width: "half"},
					{ID: "state", Label: "State", Type: "text", Width: "quarter"},
					{ID: "zip", Label: "ZIP Code", Type: "text", Width: "quarter"},
				}},
			},
		},
		{
			ID:    "academic",
			Title: "Academic Info",
			Fields: []FieldInput{
				{ID: "gpa", Label: "GPA Unweighted", Type: "number", IsRequired: true, Width: "half", Placeholder: "0.00"},
				{ID: "testsTaken", Label: "I have taken the SAT or ACT", Type: "checkbox", Width: "full"},
				{ID: "testsRepeater", Label: "Standardized Tests", Type: "repeater", Width: "full", Children: []FieldInput{
					{ID: "testType", Label: "Test Type", Type: "select", Options: []string{"SAT", "ACT"}, Width: "half"},
					{ID: "score", Label: "Score", Type: "number", Width: "quarter"},
					{ID: "date", Label: "Test Date", Type: "date", Width: "quarter"},
				}},
				{ID: "fullTime", Label: "Are you planning to attend school full-time?", Type: "radio", IsRequired: true, Options: []string{"Yes", "No", "Not sure yet"}, Width: "full"},
				{ID: "universities", Label: "Universities Applied To", Type: "repeater", Width: "full", Children: []FieldInput{
					{ID: "name", Label: "University Name", Type: "text", Width: "full"},
				}},
				{ID: "top3", Label: "Top 3 Universities", Type: "group", Width: "full", Children: []FieldInput{
					{ID: "choice1", Label: "Choice #1", Type: "text", Width: "third"},
					{ID: "choice2", Label: "Choice #2", Type: "text", Width: "third"},
					{ID: "choice3", Label: "Choice #3", Type: "text", Width: "third"},
				}},
			},
		},
		{
			ID:    "financial",
			Title: "Financial Info",
			Fields: []FieldInput{
				{ID: "fafsaStatus", Label: "FAFSA Status", Type: "radio", IsRequired: true, Options: []string{"Completed", "In Progress", "Not Started"}, Width: "full"},
				{ID: "pellEligible", Label: "Are you eligible for Pell Grant?", Type: "select", Options: []string{"Yes", "No", "Not sure yet"}, Width: "half"},
				{ID: "efc", Label: "EFC / SAI", Type: "number", Width: "half", Placeholder: "0"},
				{ID: "universityOffers", Label: "University Financial Offers", Type: "repeater", Width: "full", Children: []FieldInput{
					{ID: "schoolName", Label: "School Name", Type: "text", Width: "full"},
					{ID: "coa", Label: "Cost of Attendance", Type: "number", Width: "half"},
					{ID: "grants", Label: "Grants/Scholarships", Type: "number", Width: "half"},
					{ID: "federalGrants", Label: "Federal/State Grants", Type: "number", Width: "half"},
					{ID: "loans", Label: "Loans Offered", Type: "number", Width: "half"},
				}},
				{ID: "bestFit", Label: "Best Financial Fit Reflection", Type: "textarea", Width: "full"},
				{ID: "familyContribution", Label: "Family Contribution per Year", Type: "number", Width: "half"},
			},
		},
		{
			ID:    "essays",
			Title: "Essays",
			Fields: []FieldInput{
				{ID: "whyScholarship", Label: "Why are you applying for the In The Game Scholarship?", Type: "textarea", IsRequired: true, Width: "full"},
				{ID: "challenge", Label: "Describe a challenge you've overcome and what you learned from it.", Type: "textarea", IsRequired: true, Width: "full"},
				{ID: "careerGoals", Label: "What are your career goals and how will this scholarship help you achieve them?", Type: "textarea", IsRequired: true, Width: "full"},
			},
		},
		{
			ID:    "activities",
			Title: "Activities",
			Fields: []FieldInput{
				{ID: "activitiesList", Label: "Activities & Involvement", Type: "repeater", Width: "full", Children: []FieldInput{
					{ID: "type", Label: "Activity Type", Type: "select", Options: []string{"School Club", "Sports", "Arts", "Volunteer", "Work", "Other"}, Width: "half"},
					{ID: "organization", Label: "Organization Name", Type: "text", Width: "half"},
					{ID: "role", Label: "Role / Position", Type: "text", Width: "half"},
					{ID: "dates", Label: "Dates", Type: "text", Width: "quarter"},
					{ID: "hours", Label: "Hours/Week", Type: "text", Width: "quarter"},
					{ID: "description", Label: "Description & Impact", Type: "textarea", Width: "full"},
				}},
			},
		},
		{
			ID:    "documents",
			Title: "Documents",
			Fields: []FieldInput{
				{ID: "recommendation", Label: "Letter of Recommendation", Type: "group", Width: "full", Children: []FieldInput{
					{ID: "status", Label: "Status", Type: "select", Options: []string{"Not Requested", "Requested", "Received"}, Width: "half"},
					{ID: "recommenderName", Label: "Recommender Name", Type: "text", Width: "half"},
					{ID: "recommenderEmail", Label: "Recommender Email", Type: "email", Width: "half"},
				}},
				{ID: "transcript", Label: "Official Transcript", Type: "file", Width: "full"},
			},
		},
	}

	// Disable triggers to avoid issues with auth.uid() and missing fields in generic triggers
	database.DB.Exec("ALTER TABLE forms DISABLE TRIGGER forms_activity_log")
	database.DB.Exec("ALTER TABLE form_fields DISABLE TRIGGER form_fields_activity_log")
	defer func() {
		database.DB.Exec("ALTER TABLE forms ENABLE TRIGGER forms_activity_log")
		database.DB.Exec("ALTER TABLE form_fields ENABLE TRIGGER form_fields_activity_log")
	}()

	// Check if form exists
	var form models.Form
	result := database.DB.Where("workspace_id = ? AND name = ?", workspace.ID, "Fall 2025 Scholarship").First(&form)

	if result.Error == nil {
		fmt.Println("Form exists, deleting old fields...")
		database.DB.Where("form_id = ?", form.ID).Delete(&models.FormField{})
	} else {
		fmt.Println("Creating new form...")
		form = models.Form{
			WorkspaceID: workspace.ID,
			Name:        "Fall 2025 Scholarship",
			Slug:        "fall-2025-scholarship",
			Description: "Scholarship Application Portal",
			IsPublished: true,
			CreatedBy:   workspace.CreatedBy,
			Settings:    datatypes.JSON([]byte(`{"themeColor": "#3B82F6", "name": "Fall 2025 Scholarship"}`)),
		}
		if err := database.DB.Create(&form).Error; err != nil {
			log.Fatal(err)
		}
	}

	// Update settings with sections metadata
	var sectionMeta []map[string]interface{}
	for _, s := range sections {
		sectionMeta = append(sectionMeta, map[string]interface{}{
			"id":          s.ID,
			"title":       s.Title,
			"description": s.Description,
		})
	}

	settingsMap := make(map[string]interface{})
	json.Unmarshal(form.Settings, &settingsMap)
	settingsMap["sections"] = sectionMeta

	newSettings, _ := json.Marshal(settingsMap)
	form.Settings = datatypes.JSON(newSettings)
	database.DB.Save(&form)

	// Create fields
	fmt.Println("Creating fields...")
	var newFields []models.FormField
	position := 0

	for _, section := range sections {
		for _, fieldInput := range section.Fields {
			optionsMap := make(map[string]interface{})
			if len(fieldInput.Options) > 0 {
				optionsMap["items"] = fieldInput.Options
			}
			if fieldInput.Width != "" {
				optionsMap["width"] = fieldInput.Width
			}
			optionsMap["section_id"] = section.ID

			if len(fieldInput.Children) > 0 {
				optionsMap["children"] = fieldInput.Children
			}

			optionsMap["key"] = fieldInput.ID // Store the readable ID as "key"
			optionsJSON, _ := json.Marshal(optionsMap)
			validationJSON, _ := json.Marshal(fieldInput.Validation)

			field := models.FormField{
				FormID:      form.ID,
				Name:        fieldInput.ID,
				Label:       fieldInput.Label,
				Type:        fieldInput.Type,
				FieldType:   fieldInput.Type,
				Position:    position,
				Width:       fieldInput.Width,
				IsRequired:  fieldInput.IsRequired,
				Placeholder: fieldInput.Placeholder,
				Options:     datatypes.JSON(optionsJSON),
				Validation:  datatypes.JSON(validationJSON),
			}

			// Use ID from input if possible (simple hash or just new UUID)
			field.ID = uuid.New()

			newFields = append(newFields, field)
			position++
		}
	}

	if err := database.DB.Create(&newFields).Error; err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Successfully seeded form '%s' with %d fields.\n", form.Name, len(newFields))
}

func mapToJSON(m map[string]interface{}) datatypes.JSON {
	b, _ := json.Marshal(m)
	return datatypes.JSON(b)
}
