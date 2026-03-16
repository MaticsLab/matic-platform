package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Response DTOs ────────────────────────────────────────────────────────────

type FormAnalyticsOverview struct {
	Total             int     `json:"total"`
	Submitted         int     `json:"submitted"`
	InProgress        int     `json:"in_progress"`
	Draft             int     `json:"draft"`
	AvgCompletionPct  float64 `json:"avg_completion_pct"`
	CompletedToday    int     `json:"completed_today"`
	NewLast7Days      int     `json:"new_last_7_days"`
	ActiveLast24Hours int     `json:"active_last_24_hours"`
}

type DailyVolume struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type CompletionBucket struct {
	Range string `json:"range"`
	Count int    `json:"count"`
	Min   int    `json:"min"`
	Max   int    `json:"max"`
}

type FunnelStage struct {
	Stage string  `json:"stage"`
	Count int     `json:"count"`
	Pct   float64 `json:"pct"`
}

type LastActiveUser struct {
	UserID        string `json:"user_id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	CompletionPct int    `json:"completion_pct"`
	Status        string `json:"status"`
	LastSeen      string `json:"last_seen"`
	SubmissionID  string `json:"submission_id"`
	DaysInactive  int    `json:"days_inactive"`
}

type CheckInRecommendation struct {
	UserID        string `json:"user_id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	CompletionPct int    `json:"completion_pct"`
	Status        string `json:"status"`
	LastSeen      string `json:"last_seen"`
	SubmissionID  string `json:"submission_id"`
	DaysInactive  int    `json:"days_inactive"`
	Reason        string `json:"reason"`
}

type HeatmapCell struct {
	Day   int `json:"day"`  // 0=Sun … 6=Sat
	Hour  int `json:"hour"` // 0-23
	Count int `json:"count"`
}

type FieldAnswerBreakdown struct {
	FieldID    string              `json:"field_id"`
	FieldLabel string              `json:"field_label"`
	FieldType  string              `json:"field_type"`
	Answers    []FieldAnswerOption `json:"answers"`
	Total      int                 `json:"total"`
}

type FieldAnswerOption struct {
	Value string  `json:"value"`
	Count int     `json:"count"`
	Pct   float64 `json:"pct"`
}

type IncompleteSubmission struct {
	SubmissionID  string `json:"submission_id"`
	UserID        string `json:"user_id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	CompletionPct int    `json:"completion_pct"`
	Status        string `json:"status"`
	LastSeen      string `json:"last_seen"`
	StartedAt     string `json:"started_at"`
	DaysInactive  int    `json:"days_inactive"`
}

type FormAnalyticsResponse struct {
	Overview              FormAnalyticsOverview   `json:"overview"`
	DailyVolume           []DailyVolume           `json:"daily_volume"`
	CompletionBuckets     []CompletionBucket      `json:"completion_buckets"`
	Funnel                []FunnelStage           `json:"funnel"`
	LastActiveUsers       []LastActiveUser        `json:"last_active_users"`
	CheckIns              []CheckInRecommendation `json:"check_ins"`
	Heatmap               []HeatmapCell           `json:"heatmap"`
	FieldBreakdowns       []FieldAnswerBreakdown  `json:"field_breakdowns"`
	Submissions           []IncompleteSubmission  `json:"submissions"`
	IncompleteSubmissions []IncompleteSubmission  `json:"incomplete_submissions"`
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

// GetFormAnalytics returns comprehensive analytics for a form.
// Works with both the new form_submissions schema and the legacy table_rows schema.
func GetFormAnalytics(c *gin.Context) {
	formIDStr := c.Param("id")

	// Authenticate
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	parsedID, err := uuid.Parse(formIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	// ── Resolve the form (new or legacy) ──────────────────────────────────────
	var newForm models.Form
	usingNewSchema := false
	tableID := parsedID

	if err := database.DB.Where("id = ?", parsedID).First(&newForm).Error; err == nil {
		usingNewSchema = true
		if newForm.LegacyTableID != nil {
			tableID = *newForm.LegacyTableID
		}
	} else if err := database.DB.Where("legacy_table_id = ?", parsedID).First(&newForm).Error; err == nil {
		usingNewSchema = true
		tableID = parsedID
	}

	// Verify workspace membership
	var table models.Table
	var wsID uuid.UUID
	if usingNewSchema && newForm.LegacyTableID != nil {
		if err := database.DB.First(&table, "id = ?", newForm.LegacyTableID).Error; err == nil {
			wsID = table.WorkspaceID
		}
	} else {
		if err := database.DB.First(&table, "id = ?", tableID).Error; err == nil {
			wsID = table.WorkspaceID
		}
	}

	if wsID == uuid.Nil {
		// Fallback: find table
		if err := database.DB.First(&table, "id = ?", parsedID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
			return
		}
		wsID = table.WorkspaceID
	}

	if _, memberExists := checkWorkspaceMembership(wsID, userID); !memberExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is not a member of this workspace"})
		return
	}

	fmt.Printf("📊 GetFormAnalytics: formID=%s usingNewSchema=%v tableID=%s\n", formIDStr, usingNewSchema, tableID)

	if usingNewSchema {
		c.JSON(http.StatusOK, buildAnalyticsNewSchema(newForm))
		return
	}

	c.JSON(http.StatusOK, buildAnalyticsLegacy(tableID, parsedID))
}

// ─── New Schema Analytics ─────────────────────────────────────────────────────

func buildAnalyticsNewSchema(form models.Form) FormAnalyticsResponse {
	formID := form.ID

	// ── Fetch all submissions ─────────────────────────────────────────────────
	type subRow struct {
		ID                   uuid.UUID
		UserID               string
		Status               string
		CompletionPercentage int
		RawData              []byte
		StartedAt            time.Time
		LastSavedAt          time.Time
		SubmittedAt          *time.Time
		CreatedAt            time.Time
		UpdatedAt            time.Time
		Email                *string
		UserName             *string
	}

	var rows []subRow
	database.DB.Raw(`
		SELECT fs.id, fs.user_id, fs.status, fs.completion_percentage,
		       fs.raw_data, fs.started_at, fs.last_saved_at, fs.submitted_at,
		       fs.created_at, fs.updated_at,
		       bu.email, bu.name as user_name
		FROM form_submissions fs
		LEFT JOIN ba_users bu ON fs.user_id = bu.id
		WHERE fs.form_id = ?
		ORDER BY fs.updated_at DESC
	`, formID).Scan(&rows)

	return computeAnalytics(rows, form.ID.String(), formID)
}

// ─── Legacy Schema Analytics ──────────────────────────────────────────────────

func buildAnalyticsLegacy(tableID uuid.UUID, queryID uuid.UUID) FormAnalyticsResponse {
	type legacyRow struct {
		ID          uuid.UUID
		UserID      *string
		Status      string
		RawData     []byte
		StartedAt   time.Time
		LastSavedAt time.Time
		SubmittedAt *time.Time
		CreatedAt   time.Time
		UpdatedAt   time.Time
		Email       *string
		UserName    *string
	}

	var rows []legacyRow
	database.DB.Raw(`
		SELECT 
			tr.id,
			tr.ba_created_by as user_id,
			COALESCE(tr.metadata->>'status', 'submitted') as status,
			tr.data as raw_data,
			tr.created_at as started_at,
			tr.updated_at as last_saved_at,
			CASE WHEN COALESCE(tr.metadata->>'status','submitted') = 'submitted'
			     THEN tr.updated_at ELSE NULL END as submitted_at,
			tr.created_at,
			tr.updated_at,
			bu.email,
			bu.name as user_name
		FROM table_rows tr
		LEFT JOIN ba_users bu ON tr.ba_created_by = bu.id
		WHERE tr.table_id = ?
		ORDER BY tr.updated_at DESC
	`, tableID).Scan(&rows)

	// Convert to unified schema row shape
	type subRow struct {
		ID                   uuid.UUID
		UserID               string
		Status               string
		CompletionPercentage int
		RawData              []byte
		StartedAt            time.Time
		LastSavedAt          time.Time
		SubmittedAt          *time.Time
		CreatedAt            time.Time
		UpdatedAt            time.Time
		Email                *string
		UserName             *string
	}

	// Get field list for completion computation
	var fields []models.Field
	database.DB.Where("table_id = ?", tableID).Find(&fields)
	fieldCount := 0
	for _, f := range fields {
		if f.Type != "" {
			fieldCount++
		}
	}
	if fieldCount == 0 {
		fieldCount = 1
	}

	unified := make([]subRow, len(rows))
	for i, r := range rows {
		uid := ""
		if r.UserID != nil {
			uid = *r.UserID
		}

		// Estimate completion
		completion := 0
		if len(r.RawData) > 2 {
			var data map[string]interface{}
			if err := json.Unmarshal(r.RawData, &data); err == nil {
				// Count non-meta keys
				filled := 0
				for k, v := range data {
					if len(k) > 0 && k[0] != '_' && v != nil && v != "" {
						filled++
					}
				}
				if fieldCount > 0 {
					completion = (filled * 100) / fieldCount
					if completion > 100 {
						completion = 100
					}
				}
			}
		}
		if r.Status == "submitted" {
			completion = 100
		}

		unified[i] = subRow{
			ID:                   r.ID,
			UserID:               uid,
			Status:               r.Status,
			CompletionPercentage: completion,
			RawData:              r.RawData,
			StartedAt:            r.StartedAt,
			LastSavedAt:          r.LastSavedAt,
			SubmittedAt:          r.SubmittedAt,
			CreatedAt:            r.CreatedAt,
			UpdatedAt:            r.UpdatedAt,
			Email:                r.Email,
			UserName:             r.UserName,
		}
	}

	_ = unified
	return computeAnalyticsLegacy(unified, tableID.String(), tableID)
}

// ─── Analytics computation helpers ───────────────────────────────────────────

type analyticsRow struct {
	ID                   uuid.UUID
	UserID               string
	Status               string
	CompletionPercentage int
	RawData              []byte
	StartedAt            time.Time
	LastSavedAt          time.Time
	SubmittedAt          *time.Time
	CreatedAt            time.Time
	UpdatedAt            time.Time
	Email                *string
	UserName             *string
}

func computeAnalytics(rows interface{}, formIDStr string, formUUID uuid.UUID) FormAnalyticsResponse {
	// Marshal rows to JSON and back to get unified slice
	b, _ := json.Marshal(rows)
	var unified []analyticsRow
	json.Unmarshal(b, &unified)
	return buildResponse(unified, formUUID)
}

func computeAnalyticsLegacy(rows interface{}, tableIDStr string, tableUUID uuid.UUID) FormAnalyticsResponse {
	b, _ := json.Marshal(rows)
	var unified []analyticsRow
	json.Unmarshal(b, &unified)

	// Load field breakdown for legacy schema
	resp := buildResponse(unified, tableUUID)

	// Augment with field breakdowns from table_rows
	resp.FieldBreakdowns = buildFieldBreakdownsLegacy(tableUUID, unified)
	return resp
}

func buildResponse(rows []analyticsRow, formUUID uuid.UUID) FormAnalyticsResponse {
	now := time.Now()

	// ── Overview ──────────────────────────────────────────────────────────────
	total := len(rows)
	submitted, inProgress, draft := 0, 0, 0
	totalCompletion := 0
	completedToday := 0
	newLast7 := 0
	activeLast24 := 0

	for _, r := range rows {
		switch r.Status {
		case "submitted":
			submitted++
		case "in_progress":
			inProgress++
		default:
			draft++
		}
		totalCompletion += r.CompletionPercentage

		if r.SubmittedAt != nil && sameDay(*r.SubmittedAt, now) {
			completedToday++
		}
		if r.CreatedAt.After(now.AddDate(0, 0, -7)) {
			newLast7++
		}
		if r.UpdatedAt.After(now.Add(-24 * time.Hour)) {
			activeLast24++
		}
	}

	avgCompletion := 0.0
	if total > 0 {
		avgCompletion = float64(totalCompletion) / float64(total)
	}

	overview := FormAnalyticsOverview{
		Total:             total,
		Submitted:         submitted,
		InProgress:        inProgress,
		Draft:             draft,
		AvgCompletionPct:  roundFloat(avgCompletion, 1),
		CompletedToday:    completedToday,
		NewLast7Days:      newLast7,
		ActiveLast24Hours: activeLast24,
	}

	// ── Daily Volume (last 30 days) ───────────────────────────────────────────
	dailyMap := map[string]int{}
	for d := 29; d >= 0; d-- {
		day := now.AddDate(0, 0, -d)
		dailyMap[day.Format("2006-01-02")] = 0
	}
	for _, r := range rows {
		key := r.CreatedAt.Format("2006-01-02")
		if _, ok := dailyMap[key]; ok {
			dailyMap[key]++
		}
	}
	dates := make([]string, 0, 30)
	for k := range dailyMap {
		dates = append(dates, k)
	}
	sort.Strings(dates)
	dailyVolume := make([]DailyVolume, len(dates))
	for i, d := range dates {
		dailyVolume[i] = DailyVolume{Date: d, Count: dailyMap[d]}
	}

	// ── Completion Buckets ────────────────────────────────────────────────────
	buckets := []CompletionBucket{
		{Range: "Not started", Count: 0, Min: 0, Max: 0},
		{Range: "1–25%", Count: 0, Min: 1, Max: 25},
		{Range: "26–50%", Count: 0, Min: 26, Max: 50},
		{Range: "51–75%", Count: 0, Min: 51, Max: 75},
		{Range: "76–99%", Count: 0, Min: 76, Max: 99},
		{Range: "Complete", Count: 0, Min: 100, Max: 100},
	}
	for _, r := range rows {
		pct := r.CompletionPercentage
		switch {
		case pct == 0:
			buckets[0].Count++
		case pct <= 25:
			buckets[1].Count++
		case pct <= 50:
			buckets[2].Count++
		case pct <= 75:
			buckets[3].Count++
		case pct <= 99:
			buckets[4].Count++
		default:
			buckets[5].Count++
		}
	}

	// ── Funnel ────────────────────────────────────────────────────────────────
	funnel := []FunnelStage{
		{Stage: "Started", Count: total},
		{Stage: "In Progress", Count: inProgress},
		{Stage: "Submitted", Count: submitted},
	}
	for i := range funnel {
		if total > 0 {
			funnel[i].Pct = roundFloat(float64(funnel[i].Count)/float64(total)*100, 1)
		}
	}

	// ── Last Active Users (most recent 20) ───────────────────────────────────
	lastActive := make([]LastActiveUser, 0, 20)
	for i, r := range rows {
		if i >= 20 {
			break
		}
		email := ""
		name := ""
		if r.Email != nil {
			email = *r.Email
		}
		if r.UserName != nil {
			name = *r.UserName
		}
		days := int(now.Sub(r.UpdatedAt).Hours() / 24)
		lastActive = append(lastActive, LastActiveUser{
			UserID:        r.UserID,
			Email:         email,
			Name:          name,
			CompletionPct: r.CompletionPercentage,
			Status:        r.Status,
			LastSeen:      r.UpdatedAt.Format(time.RFC3339),
			SubmissionID:  r.ID.String(),
			DaysInactive:  days,
		})
	}

	// ── Check-in Recommendations (draft/in_progress, inactive 7+ days) ────────
	checkIns := make([]CheckInRecommendation, 0)
	for _, r := range rows {
		if r.Status == "submitted" {
			continue
		}
		days := int(now.Sub(r.UpdatedAt).Hours() / 24)
		if days < 3 {
			continue
		}
		email := ""
		name := ""
		if r.Email != nil {
			email = *r.Email
		}
		if r.UserName != nil {
			name = *r.UserName
		}

		reason := "Inactive for over a week"
		if days >= 14 {
			reason = "Inactive for 2+ weeks — high risk of abandon"
		} else if days >= 7 {
			reason = "Inactive for 7+ days"
		} else {
			reason = "No activity in 3–6 days"
		}

		checkIns = append(checkIns, CheckInRecommendation{
			UserID:        r.UserID,
			Email:         email,
			Name:          name,
			CompletionPct: r.CompletionPercentage,
			Status:        r.Status,
			LastSeen:      r.UpdatedAt.Format(time.RFC3339),
			SubmissionID:  r.ID.String(),
			DaysInactive:  days,
			Reason:        reason,
		})
	}
	// Sort by most urgently inactive
	sort.Slice(checkIns, func(i, j int) bool {
		return checkIns[i].DaysInactive > checkIns[j].DaysInactive
	})
	if len(checkIns) > 50 {
		checkIns = checkIns[:50]
	}

	// ── Heatmap (day × hour) ──────────────────────────────────────────────────
	heatmap := map[[2]int]int{}
	for _, r := range rows {
		key := [2]int{int(r.CreatedAt.Weekday()), r.CreatedAt.Hour()}
		heatmap[key]++
	}
	heatmapSlice := make([]HeatmapCell, 0, len(heatmap))
	for k, v := range heatmap {
		heatmapSlice = append(heatmapSlice, HeatmapCell{Day: k[0], Hour: k[1], Count: v})
	}

	// ── Submissions (all) + Incomplete Submissions (not submitted) ───────────
	allSubmissions := make([]IncompleteSubmission, 0, len(rows))
	incompletes := make([]IncompleteSubmission, 0)
	for _, r := range rows {
		email := ""
		name := ""
		if r.Email != nil {
			email = *r.Email
		}
		if r.UserName != nil {
			name = *r.UserName
		}
		days := int(now.Sub(r.UpdatedAt).Hours() / 24)
		submission := IncompleteSubmission{
			SubmissionID:  r.ID.String(),
			UserID:        r.UserID,
			Email:         email,
			Name:          name,
			CompletionPct: r.CompletionPercentage,
			Status:        r.Status,
			LastSeen:      r.UpdatedAt.Format(time.RFC3339),
			StartedAt:     r.StartedAt.Format(time.RFC3339),
			DaysInactive:  days,
		}
		allSubmissions = append(allSubmissions, submission)
		if r.Status != "submitted" {
			incompletes = append(incompletes, submission)
		}
	}

	// ── Field Breakdowns (new schema) ─────────────────────────────────────────
	fieldBreakdowns := buildFieldBreakdownsNewSchema(formUUID, rows)

	return FormAnalyticsResponse{
		Overview:              overview,
		DailyVolume:           dailyVolume,
		CompletionBuckets:     buckets,
		Funnel:                funnel,
		LastActiveUsers:       lastActive,
		CheckIns:              checkIns,
		Heatmap:               heatmapSlice,
		FieldBreakdowns:       fieldBreakdowns,
		Submissions:           allSubmissions,
		IncompleteSubmissions: incompletes,
	}
}

// ─── Field Breakdown helpers ──────────────────────────────────────────────────

var selectFieldTypes = map[string]bool{
	"select": true, "multi_select": true, "radio": true, "checkbox": true,
	"yes_no": true, "rating": true, "dropdown": true,
}

func buildFieldBreakdownsNewSchema(formID uuid.UUID, rows []analyticsRow) []FieldAnswerBreakdown {
	var fields []models.FormField
	database.DB.Where("form_id = ?", formID).Order("sort_order ASC").Find(&fields)

	breakdowns := make([]FieldAnswerBreakdown, 0)
	for _, field := range fields {
		if !selectFieldTypes[field.FieldType] {
			continue
		}

		valueCounts := map[string]int{}
		total := 0
		for _, row := range rows {
			if len(row.RawData) < 2 {
				continue
			}
			var data map[string]interface{}
			if err := json.Unmarshal(row.RawData, &data); err != nil {
				continue
			}
			val, ok := data[field.ID.String()]
			if !ok {
				continue
			}
			collectValues(val, valueCounts)
			total++
		}
		if total == 0 {
			continue
		}

		answers := valuesToAnswers(valueCounts, total)
		breakdowns = append(breakdowns, FieldAnswerBreakdown{
			FieldID:    field.ID.String(),
			FieldLabel: field.Label,
			FieldType:  field.FieldType,
			Answers:    answers,
			Total:      total,
		})
	}
	return breakdowns
}

func buildFieldBreakdownsLegacy(tableID uuid.UUID, rows []analyticsRow) []FieldAnswerBreakdown {
	var fields []models.Field
	database.DB.Where("table_id = ?", tableID).Order("position ASC").Find(&fields)

	breakdowns := make([]FieldAnswerBreakdown, 0)
	for _, field := range fields {
		if !selectFieldTypes[field.Type] {
			continue
		}

		valueCounts := map[string]int{}
		total := 0
		for _, row := range rows {
			if len(row.RawData) < 2 {
				continue
			}
			var data map[string]interface{}
			if err := json.Unmarshal(row.RawData, &data); err != nil {
				continue
			}
			val, ok := data[field.ID.String()]
			if !ok {
				val, ok = data[field.Name]
			}
			if !ok {
				continue
			}
			collectValues(val, valueCounts)
			total++
		}
		if total == 0 {
			continue
		}

		answers := valuesToAnswers(valueCounts, total)
		breakdowns = append(breakdowns, FieldAnswerBreakdown{
			FieldID:    field.ID.String(),
			FieldLabel: field.Name,
			FieldType:  field.Type,
			Answers:    answers,
			Total:      total,
		})
	}
	return breakdowns
}

func collectValues(val interface{}, counts map[string]int) {
	switch v := val.(type) {
	case string:
		if v != "" {
			counts[v]++
		}
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok && s != "" {
				counts[s]++
			}
		}
	case bool:
		if v {
			counts["Yes"]++
		} else {
			counts["No"]++
		}
	case float64:
		counts[fmt.Sprintf("%.0f", v)]++
	}
}

func valuesToAnswers(counts map[string]int, total int) []FieldAnswerOption {
	answers := make([]FieldAnswerOption, 0, len(counts))
	for value, count := range counts {
		pct := 0.0
		if total > 0 {
			pct = roundFloat(float64(count)/float64(total)*100, 1)
		}
		answers = append(answers, FieldAnswerOption{Value: value, Count: count, Pct: pct})
	}
	sort.Slice(answers, func(i, j int) bool {
		return answers[i].Count > answers[j].Count
	})
	if len(answers) > 10 {
		answers = answers[:10]
	}
	return answers
}

// ─── Utilities ────────────────────────────────────────────────────────────────

func sameDay(t1, t2 time.Time) bool {
	y1, m1, d1 := t1.Date()
	y2, m2, d2 := t2.Date()
	return y1 == y2 && m1 == m2 && d1 == d2
}

func roundFloat(val float64, precision int) float64 {
	factor := 1.0
	for i := 0; i < precision; i++ {
		factor *= 10
	}
	return float64(int(val*factor+0.5)) / factor
}
