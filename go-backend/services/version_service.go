package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// VersionService handles row version history and change tracking
type VersionService struct{}

// NewVersionService creates a new version service instance
func NewVersionService() *VersionService {
	return &VersionService{}
}

// ============================================================
// CREATE VERSION
// ============================================================

// CreateVersionInput represents input for creating a new version
type CreateVersionInput struct {
	RowID            uuid.UUID
	TableID          uuid.UUID
	Data             map[string]interface{}
	Metadata         map[string]interface{}
	ChangeType       string
	ChangeReason     string
	BAChangedBy      *string // Better Auth user ID (TEXT)
	BatchOperationID *uuid.UUID
	AIAssisted       bool
	AIConfidence     *float64
	AISuggestionID   *uuid.UUID
}

// CreateVersionResult represents the result of creating a version
type CreateVersionResult struct {
	VersionID     uuid.UUID
	VersionNumber int
	FieldChanges  []FieldChangeInfo
}

// FieldChangeInfo represents a single field change
type FieldChangeInfo struct {
	FieldName       string
	FieldType       string
	FieldLabel      string
	OldValue        interface{}
	NewValue        interface{}
	ChangeAction    string
	NestedPath      []string
	SimilarityScore *float64
}

// CreateVersion creates a new version for a row with change tracking
func (s *VersionService) CreateVersion(input CreateVersionInput) (*CreateVersionResult, error) {
	// Get current version number
	var currentVersion int
	database.DB.Raw("SELECT COALESCE(MAX(version_number), 0) FROM row_versions WHERE row_id = ?", input.RowID).Scan(&currentVersion)
	newVersionNumber := currentVersion + 1

	// Get previous data for diff calculation (if not create)
	var previousData map[string]interface{}
	if input.ChangeType != models.ChangeTypeCreate {
		var prevVersion models.RowVersion
		if err := database.DB.Where("row_id = ? AND version_number = ?", input.RowID, currentVersion).First(&prevVersion).Error; err == nil {
			json.Unmarshal(prevVersion.Data, &previousData)
		}
	}

	// Calculate field changes
	fieldChanges := s.calculateFieldChanges(previousData, input.Data, input.TableID)

	// Generate change summary
	changeSummary := s.generateChangeSummary(fieldChanges, input.ChangeReason)

	// Convert data to JSON
	dataJSON, _ := json.Marshal(input.Data)
	metadataJSON, _ := json.Marshal(input.Metadata)

	// Create the version
	version := models.RowVersion{
		ID:               uuid.New(),
		RowID:            input.RowID,
		TableID:          input.TableID,
		VersionNumber:    newVersionNumber,
		Data:             datatypes.JSON(dataJSON),
		Metadata:         datatypes.JSON(metadataJSON),
		ChangeType:       input.ChangeType,
		ChangeReason:     input.ChangeReason,
		ChangeSummary:    changeSummary,
		BatchOperationID: input.BatchOperationID,
		BAChangedBy:      input.BAChangedBy,
		AIAssisted:       input.AIAssisted,
		AIConfidence:     input.AIConfidence,
		AISuggestionID:   input.AISuggestionID,
	}

	if err := database.DB.Create(&version).Error; err != nil {
		return nil, fmt.Errorf("failed to create version: %w", err)
	}

	// Create field change records
	for _, fc := range fieldChanges {
		oldValueJSON, _ := json.Marshal(fc.OldValue)
		newValueJSON, _ := json.Marshal(fc.NewValue)

		fieldChange := models.FieldChange{
			ID:              uuid.New(),
			RowVersionID:    version.ID,
			RowID:           input.RowID,
			FieldName:       fc.FieldName,
			FieldType:       fc.FieldType,
			FieldLabel:      fc.FieldLabel,
			OldValue:        datatypes.JSON(oldValueJSON),
			NewValue:        datatypes.JSON(newValueJSON),
			ChangeAction:    fc.ChangeAction,
			NestedPath:      fc.NestedPath,
			SimilarityScore: fc.SimilarityScore,
		}

		// Check if field contains PII
		fieldChange.ContainsPII = s.checkIfPIIField(fc.FieldName, input.TableID)

		database.DB.Create(&fieldChange)
	}

	return &CreateVersionResult{
		VersionID:     version.ID,
		VersionNumber: newVersionNumber,
		FieldChanges:  fieldChanges,
	}, nil
}

// CreateVersionTx creates a new version within an existing transaction
// Use this when you need row creation and version creation in the same transaction
func (s *VersionService) CreateVersionTx(tx *gorm.DB, input CreateVersionInput) (*CreateVersionResult, error) {
	// Get current version number
	var currentVersion int
	tx.Raw("SELECT COALESCE(MAX(version_number), 0) FROM row_versions WHERE row_id = ?", input.RowID).Scan(&currentVersion)
	newVersionNumber := currentVersion + 1

	// Get previous data for diff calculation (if not create)
	var previousData map[string]interface{}
	if input.ChangeType != models.ChangeTypeCreate {
		var prevVersion models.RowVersion
		if err := tx.Where("row_id = ? AND version_number = ?", input.RowID, currentVersion).First(&prevVersion).Error; err == nil {
			json.Unmarshal(prevVersion.Data, &previousData)
		}
	}

	// Calculate field changes
	fieldChanges := s.calculateFieldChanges(previousData, input.Data, input.TableID)

	// Generate change summary
	changeSummary := s.generateChangeSummary(fieldChanges, input.ChangeReason)

	// Convert data to JSON
	dataJSON, _ := json.Marshal(input.Data)
	metadataJSON, _ := json.Marshal(input.Metadata)

	// Create the version
	version := models.RowVersion{
		ID:               uuid.New(),
		RowID:            input.RowID,
		TableID:          input.TableID,
		VersionNumber:    newVersionNumber,
		Data:             datatypes.JSON(dataJSON),
		Metadata:         datatypes.JSON(metadataJSON),
		ChangeType:       input.ChangeType,
		ChangeReason:     input.ChangeReason,
		ChangeSummary:    changeSummary,
		BatchOperationID: input.BatchOperationID,
		BAChangedBy:      input.BAChangedBy,
		AIAssisted:       input.AIAssisted,
		AIConfidence:     input.AIConfidence,
		AISuggestionID:   input.AISuggestionID,
	}

	if err := tx.Create(&version).Error; err != nil {
		return nil, fmt.Errorf("failed to create version: %w", err)
	}

	// Create field change records
	for _, fc := range fieldChanges {
		oldValueJSON, _ := json.Marshal(fc.OldValue)
		newValueJSON, _ := json.Marshal(fc.NewValue)

		fieldChange := models.FieldChange{
			ID:              uuid.New(),
			RowVersionID:    version.ID,
			RowID:           input.RowID,
			FieldName:       fc.FieldName,
			FieldType:       fc.FieldType,
			FieldLabel:      fc.FieldLabel,
			OldValue:        datatypes.JSON(oldValueJSON),
			NewValue:        datatypes.JSON(newValueJSON),
			ChangeAction:    fc.ChangeAction,
			NestedPath:      fc.NestedPath,
			SimilarityScore: fc.SimilarityScore,
		}

		// Check if field contains PII (uses main DB since registry is read-only)
		fieldChange.ContainsPII = s.checkIfPIIField(fc.FieldName, input.TableID)

		if err := tx.Create(&fieldChange).Error; err != nil {
			return nil, fmt.Errorf("failed to create field change: %w", err)
		}
	}

	return &CreateVersionResult{
		VersionID:     version.ID,
		VersionNumber: newVersionNumber,
		FieldChanges:  fieldChanges,
	}, nil
}

// ============================================================
// CALCULATE DIFFS
// ============================================================

// calculateFieldChanges computes the differences between old and new data
func (s *VersionService) calculateFieldChanges(oldData, newData map[string]interface{}, tableID uuid.UUID) []FieldChangeInfo {
	var changes []FieldChangeInfo

	// Get field metadata from table
	fieldMeta := s.getFieldMetadata(tableID)

	// Find added and updated fields
	for key, newVal := range newData {
		meta := fieldMeta[key]
		oldVal, exists := oldData[key]

		if !exists {
			// Field was added
			changes = append(changes, FieldChangeInfo{
				FieldName:    key,
				FieldType:    meta.Type,
				FieldLabel:   meta.Label,
				OldValue:     nil,
				NewValue:     newVal,
				ChangeAction: models.ChangeActionAdd,
			})
		} else if !s.deepEqual(oldVal, newVal) {
			// Field was updated
			similarity := s.calculateSimilarity(oldVal, newVal)

			// For container types, track nested changes
			if meta.Type == "repeater" || meta.Type == "group" {
				nestedChanges := s.calculateNestedChanges(key, oldVal, newVal, meta)
				changes = append(changes, nestedChanges...)
			} else {
				changes = append(changes, FieldChangeInfo{
					FieldName:       key,
					FieldType:       meta.Type,
					FieldLabel:      meta.Label,
					OldValue:        oldVal,
					NewValue:        newVal,
					ChangeAction:    models.ChangeActionUpdate,
					SimilarityScore: &similarity,
				})
			}
		}
	}

	// Find removed fields
	for key, oldVal := range oldData {
		if _, exists := newData[key]; !exists {
			meta := fieldMeta[key]
			changes = append(changes, FieldChangeInfo{
				FieldName:    key,
				FieldType:    meta.Type,
				FieldLabel:   meta.Label,
				OldValue:     oldVal,
				NewValue:     nil,
				ChangeAction: models.ChangeActionRemove,
			})
		}
	}

	return changes
}

// calculateNestedChanges handles changes in repeaters and groups
func (s *VersionService) calculateNestedChanges(fieldName string, oldVal, newVal interface{}, meta fieldMetaInfo) []FieldChangeInfo {
	var changes []FieldChangeInfo

	if meta.Type == "repeater" {
		oldArr, _ := oldVal.([]interface{})
		newArr, _ := newVal.([]interface{})

		// Track by index for simplicity (could be enhanced with ID matching)
		maxLen := len(oldArr)
		if len(newArr) > maxLen {
			maxLen = len(newArr)
		}

		for i := 0; i < maxLen; i++ {
			path := []string{fieldName, fmt.Sprintf("%d", i)}

			if i >= len(oldArr) {
				// Item added
				changes = append(changes, FieldChangeInfo{
					FieldName:    fieldName,
					FieldType:    "repeater",
					FieldLabel:   meta.Label,
					OldValue:     nil,
					NewValue:     newArr[i],
					ChangeAction: models.ChangeActionAdd,
					NestedPath:   path,
				})
			} else if i >= len(newArr) {
				// Item removed
				changes = append(changes, FieldChangeInfo{
					FieldName:    fieldName,
					FieldType:    "repeater",
					FieldLabel:   meta.Label,
					OldValue:     oldArr[i],
					NewValue:     nil,
					ChangeAction: models.ChangeActionRemove,
					NestedPath:   path,
				})
			} else if !s.deepEqual(oldArr[i], newArr[i]) {
				// Item updated
				similarity := s.calculateSimilarity(oldArr[i], newArr[i])
				changes = append(changes, FieldChangeInfo{
					FieldName:       fieldName,
					FieldType:       "repeater",
					FieldLabel:      meta.Label,
					OldValue:        oldArr[i],
					NewValue:        newArr[i],
					ChangeAction:    models.ChangeActionUpdate,
					NestedPath:      path,
					SimilarityScore: &similarity,
				})
			}
		}
	} else if meta.Type == "group" {
		oldObj, _ := oldVal.(map[string]interface{})
		newObj, _ := newVal.(map[string]interface{})

		// Compare each field in the group
		for key, newV := range newObj {
			path := []string{fieldName, key}
			oldV, exists := oldObj[key]

			if !exists {
				changes = append(changes, FieldChangeInfo{
					FieldName:    fieldName,
					FieldType:    "group",
					FieldLabel:   meta.Label,
					OldValue:     nil,
					NewValue:     newV,
					ChangeAction: models.ChangeActionAdd,
					NestedPath:   path,
				})
			} else if !s.deepEqual(oldV, newV) {
				similarity := s.calculateSimilarity(oldV, newV)
				changes = append(changes, FieldChangeInfo{
					FieldName:       fieldName,
					FieldType:       "group",
					FieldLabel:      meta.Label,
					OldValue:        oldV,
					NewValue:        newV,
					ChangeAction:    models.ChangeActionUpdate,
					NestedPath:      path,
					SimilarityScore: &similarity,
				})
			}
		}

		for key, oldV := range oldObj {
			if _, exists := newObj[key]; !exists {
				path := []string{fieldName, key}
				changes = append(changes, FieldChangeInfo{
					FieldName:    fieldName,
					FieldType:    "group",
					FieldLabel:   meta.Label,
					OldValue:     oldV,
					NewValue:     nil,
					ChangeAction: models.ChangeActionRemove,
					NestedPath:   path,
				})
			}
		}
	}

	return changes
}

// ============================================================
// GET HISTORY
// ============================================================

// GetRowHistoryInput represents input for getting row history
type GetRowHistoryInput struct {
	RowID           uuid.UUID
	RedactPII       bool
	IncludeArchived bool
	Limit           int
}

// RowHistoryEntry represents a single history entry
type RowHistoryEntry struct {
	VersionID     uuid.UUID              `json:"version_id"`
	VersionNumber int                    `json:"version_number"`
	Data          map[string]interface{} `json:"data"`
	ChangeType    string                 `json:"change_type"`
	ChangeReason  string                 `json:"change_reason,omitempty"`
	ChangeSummary string                 `json:"change_summary,omitempty"`
	BAChangedBy   *string                `json:"ba_changed_by,omitempty"`
	ChangedAt     time.Time              `json:"changed_at"`
	AIAssisted    bool                   `json:"ai_assisted"`
	IsArchived    bool                   `json:"is_archived"`
	FieldChanges  []FieldChangeInfo      `json:"field_changes,omitempty"`
}

// GetRowHistory retrieves version history for a row
func (s *VersionService) GetRowHistory(input GetRowHistoryInput) ([]RowHistoryEntry, error) {
	if input.Limit == 0 {
		input.Limit = 50
	}

	query := database.DB.Where("row_id = ?", input.RowID)
	if !input.IncludeArchived {
		query = query.Where("is_archived = ?", false)
	}

	var versions []models.RowVersion
	if err := query.Order("version_number DESC").Limit(input.Limit).Find(&versions).Error; err != nil {
		return nil, err
	}

	// Get PII field names if redaction is needed
	var piiFields []string
	if input.RedactPII && len(versions) > 0 {
		piiFields = s.getPIIFields(versions[0].TableID)
	}

	entries := make([]RowHistoryEntry, len(versions))
	for i, v := range versions {
		var data map[string]interface{}
		json.Unmarshal(v.Data, &data)

		// Redact PII fields if requested
		if input.RedactPII {
			data = s.redactPIIFields(data, piiFields)
		}

		// Get field changes for this version
		var fieldChanges []models.FieldChange
		database.DB.Where("row_version_id = ?", v.ID).Find(&fieldChanges)

		fcInfos := make([]FieldChangeInfo, len(fieldChanges))
		for j, fc := range fieldChanges {
			var oldVal, newVal interface{}
			json.Unmarshal(fc.OldValue, &oldVal)
			json.Unmarshal(fc.NewValue, &newVal)

			// Redact if PII
			if input.RedactPII && fc.ContainsPII {
				oldVal = "[REDACTED]"
				newVal = "[REDACTED]"
			}

			fcInfos[j] = FieldChangeInfo{
				FieldName:       fc.FieldName,
				FieldType:       fc.FieldType,
				FieldLabel:      fc.FieldLabel,
				OldValue:        oldVal,
				NewValue:        newVal,
				ChangeAction:    fc.ChangeAction,
				NestedPath:      fc.NestedPath,
				SimilarityScore: fc.SimilarityScore,
			}
		}

		entries[i] = RowHistoryEntry{
			VersionID:     v.ID,
			VersionNumber: v.VersionNumber,
			Data:          data,
			ChangeType:    v.ChangeType,
			ChangeReason:  v.ChangeReason,
			ChangeSummary: v.ChangeSummary,
			BAChangedBy:   v.BAChangedBy,
			ChangedAt:     v.ChangedAt,
			AIAssisted:    v.AIAssisted,
			IsArchived:    v.IsArchived,
			FieldChanges:  fcInfos,
		}
	}

	return entries, nil
}

// ============================================================
// RESTORE VERSION
// ============================================================

// RestoreVersion restores a row to a previous version
func (s *VersionService) RestoreVersion(rowID uuid.UUID, versionNumber int, reason string, baRestoredBy *string) (*CreateVersionResult, error) {
	// Get the version to restore
	var targetVersion models.RowVersion
	if err := database.DB.Where("row_id = ? AND version_number = ?", rowID, versionNumber).First(&targetVersion).Error; err != nil {
		return nil, fmt.Errorf("version not found: %w", err)
	}

	// Parse the data
	var data map[string]interface{}
	json.Unmarshal(targetVersion.Data, &data)

	var metadata map[string]interface{}
	json.Unmarshal(targetVersion.Metadata, &metadata)

	// Update the current row
	database.DB.Model(&models.Row{}).Where("id = ?", rowID).Updates(map[string]interface{}{
		"data":       targetVersion.Data,
		"metadata":   targetVersion.Metadata,
		"updated_at": time.Now(),
	})

	// Create a new version recording the restore
	return s.CreateVersion(CreateVersionInput{
		RowID:        rowID,
		TableID:      targetVersion.TableID,
		Data:         data,
		Metadata:     metadata,
		ChangeType:   models.ChangeTypeRestore,
		ChangeReason: fmt.Sprintf("Restored to version %d: %s", versionNumber, reason),
		BAChangedBy:  baRestoredBy,
	})
}

// ============================================================
// ARCHIVE VERSION
// ============================================================

// ArchiveVersion archives a version (30-day retention)
func (s *VersionService) ArchiveVersion(versionID uuid.UUID, baArchivedBy string) error {
	expiresAt := time.Now().Add(30 * 24 * time.Hour)

	return database.DB.Model(&models.RowVersion{}).Where("id = ?", versionID).Updates(map[string]interface{}{
		"is_archived":        true,
		"archived_at":        time.Now(),
		"ba_archived_by":     baArchivedBy,
		"archive_expires_at": expiresAt,
	}).Error
}

// DeleteVersion permanently deletes a version (admin only)
func (s *VersionService) DeleteVersion(versionID uuid.UUID) error {
	return database.DB.Delete(&models.RowVersion{}, versionID).Error
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

type fieldMetaInfo struct {
	Type  string
	Label string
}

func (s *VersionService) getFieldMetadata(tableID uuid.UUID) map[string]fieldMetaInfo {
	var fields []models.Field
	database.DB.Where("table_id = ?", tableID).Find(&fields)

	meta := make(map[string]fieldMetaInfo)
	for _, f := range fields {
		meta[f.Name] = fieldMetaInfo{
			Type:  f.Type,
			Label: f.Label,
		}
	}
	return meta
}

func (s *VersionService) getPIIFields(tableID uuid.UUID) []string {
	var piiFields []string

	// Query fields that have PII enabled in their config
	var fields []models.Field
	database.DB.Where("table_id = ?", tableID).Find(&fields)

	for _, f := range fields {
		var config map[string]interface{}
		json.Unmarshal(f.Config, &config)
		if isPII, ok := config["is_pii"].(bool); ok && isPII {
			piiFields = append(piiFields, f.Name)
		}
	}

	return piiFields
}

func (s *VersionService) checkIfPIIField(fieldName string, tableID uuid.UUID) bool {
	piiFields := s.getPIIFields(tableID)
	for _, f := range piiFields {
		if f == fieldName {
			return true
		}
	}
	return false
}

func (s *VersionService) redactPIIFields(data map[string]interface{}, piiFields []string) map[string]interface{} {
	redacted := make(map[string]interface{})
	for k, v := range data {
		isPII := false
		for _, pf := range piiFields {
			if k == pf {
				isPII = true
				break
			}
		}
		if isPII {
			redacted[k] = "[REDACTED]"
		} else {
			redacted[k] = v
		}
	}
	return redacted
}

func (s *VersionService) generateChangeSummary(changes []FieldChangeInfo, reason string) string {
	if reason != "" {
		return reason
	}

	if len(changes) == 0 {
		return "No changes"
	}

	if len(changes) == 1 {
		switch changes[0].ChangeAction {
		case models.ChangeActionAdd:
			return fmt.Sprintf("Added %s", changes[0].FieldLabel)
		case models.ChangeActionUpdate:
			return fmt.Sprintf("Updated %s", changes[0].FieldLabel)
		case models.ChangeActionRemove:
			return fmt.Sprintf("Removed %s", changes[0].FieldLabel)
		}
	}

	// Multiple changes - summarize
	var labels []string
	for _, c := range changes {
		if c.FieldLabel != "" {
			labels = append(labels, c.FieldLabel)
		} else {
			labels = append(labels, c.FieldName)
		}
	}

	if len(labels) > 3 {
		return fmt.Sprintf("Updated %s and %d more fields", strings.Join(labels[:3], ", "), len(labels)-3)
	}
	return fmt.Sprintf("Updated %s", strings.Join(labels, ", "))
}

func (s *VersionService) deepEqual(a, b interface{}) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}

func (s *VersionService) calculateSimilarity(old, new interface{}) float64 {
	// Simple string-based similarity for now
	// Could be enhanced with Levenshtein distance, semantic similarity, etc.

	oldStr := fmt.Sprintf("%v", old)
	newStr := fmt.Sprintf("%v", new)

	if oldStr == newStr {
		return 1.0
	}

	// Very basic similarity based on length difference
	lenOld := len(oldStr)
	lenNew := len(newStr)
	if lenOld == 0 && lenNew == 0 {
		return 1.0
	}

	maxLen := lenOld
	if lenNew > maxLen {
		maxLen = lenNew
	}

	// Count matching characters (very simplified)
	matches := 0
	minLen := lenOld
	if lenNew < minLen {
		minLen = lenNew
	}
	for i := 0; i < minLen; i++ {
		if oldStr[i] == newStr[i] {
			matches++
		}
	}

	return float64(matches) / float64(maxLen)
}
