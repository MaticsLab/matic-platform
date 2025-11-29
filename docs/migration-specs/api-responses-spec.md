package maticplatform
// GET /api/v1/tables/:id/rows/:row_id/history
// Returns full version history for a row
type RowHistoryResponse struct {
    RowID      uuid.UUID       `json:"row_id"`
    TotalVersions int          `json:"total_versions"`
    Versions   []RowVersion    `json:"versions"`
}

// GET /api/v1/tables/:id/rows/:row_id/history/:version
// Returns specific version snapshot
type RowVersionDetail struct {
    Version    RowVersion      `json:"version"`
    Data       map[string]any  `json:"data"`       // Full data at this version
    Changes    []FieldChange   `json:"changes"`    // What changed in this version
    Previous   *int            `json:"previous_version,omitempty"`
    Next       *int            `json:"next_version,omitempty"`
}

// POST /api/v1/tables/:id/rows/:row_id/restore/:version
// Restore row to a previous version (creates new version)
type RestoreRequest struct {
    Reason string `json:"reason"` // Required: "Reverting accidental deletion"
}

// GET /api/v1/tables/:id/rows/:row_id/diff/:v1/:v2
// Compare two versions
type VersionDiff struct {
    Version1   int             `json:"version1"`
    Version2   int             `json:"version2"`
    FieldDiffs []FieldDiff     `json:"field_diffs"`
}

type FieldDiff struct {
    FieldName  string          `json:"field_name"`
    FieldLabel string          `json:"field_label"`
    OldValue   interface{}     `json:"old_value"`
    NewValue   interface{}     `json:"new_value"`
    ChangeType string          `json:"change_type"` // add, update, remove
}

// GET /api/v1/workspaces/:id/activity
// Get activity feed for workspace
type ActivityFeed struct {
    Activities []ActivityItem  `json:"activities"`
    NextCursor string          `json:"next_cursor,omitempty"`
}

type ActivityItem struct {
    ID          uuid.UUID       `json:"id"`
    Type        string          `json:"type"`      // row_created, row_updated, field_changed
    EntityType  string          `json:"entity_type"`
    EntityID    uuid.UUID       `json:"entity_id"`
    EntityTitle string          `json:"entity_title"`
    Summary     string          `json:"summary"`   // "Updated email, phone"
    ChangedBy   UserSummary     `json:"changed_by"`
    Timestamp   time.Time       `json:"timestamp"`
    Details     map[string]any  `json:"details,omitempty"`
}