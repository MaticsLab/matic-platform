package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// =============== Application Groups ===============

// ListApplicationGroups returns all groups for a workflow
func ListApplicationGroups(c *gin.Context) {
	workflowID := c.Query("workflow_id")
	workspaceID := c.Query("workspace_id")

	var groups []models.ApplicationGroup
	query := database.DB

	if workflowID != "" {
		query = query.Where("review_workflow_id = ?", workflowID)
	} else if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Order("order_index ASC").Find(&groups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// GetApplicationGroup returns a single group by ID
func GetApplicationGroup(c *gin.Context) {
	id := c.Param("id")

	var group models.ApplicationGroup
	if err := database.DB.First(&group, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	c.JSON(http.StatusOK, group)
}

// CreateApplicationGroup creates a new application group
func CreateApplicationGroup(c *gin.Context) {
	var input struct {
		WorkspaceID      string `json:"workspace_id" binding:"required"`
		ReviewWorkflowID string `json:"review_workflow_id" binding:"required"`
		Name             string `json:"name" binding:"required"`
		Description      string `json:"description"`
		Color            string `json:"color"`
		Icon             string `json:"icon"`
		OrderIndex       int    `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceID, _ := uuid.Parse(input.WorkspaceID)
	workflowID, _ := uuid.Parse(input.ReviewWorkflowID)

	group := models.ApplicationGroup{
		ID:               uuid.New(),
		WorkspaceID:      workspaceID,
		ReviewWorkflowID: workflowID,
		Name:             input.Name,
		Description:      input.Description,
		Color:            input.Color,
		Icon:             input.Icon,
		OrderIndex:       input.OrderIndex,
		IsSystem:         false,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if group.Color == "" {
		group.Color = "gray"
	}
	if group.Icon == "" {
		group.Icon = "folder"
	}

	if err := database.DB.Create(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, group)
}

// UpdateApplicationGroup updates an existing group
func UpdateApplicationGroup(c *gin.Context) {
	id := c.Param("id")

	var group models.ApplicationGroup
	if err := database.DB.First(&group, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	var input struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Color       *string `json:"color"`
		Icon        *string `json:"icon"`
		OrderIndex  *int    `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		group.Name = *input.Name
	}
	if input.Description != nil {
		group.Description = *input.Description
	}
	if input.Color != nil {
		group.Color = *input.Color
	}
	if input.Icon != nil {
		group.Icon = *input.Icon
	}
	if input.OrderIndex != nil {
		group.OrderIndex = *input.OrderIndex
	}
	group.UpdatedAt = time.Now()

	if err := database.DB.Save(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, group)
}

// DeleteApplicationGroup deletes a group (if not a system group)
func DeleteApplicationGroup(c *gin.Context) {
	id := c.Param("id")

	var group models.ApplicationGroup
	if err := database.DB.First(&group, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	if group.IsSystem {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete system groups"})
		return
	}

	if err := database.DB.Delete(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Group deleted successfully"})
}

// =============== Workflow Actions ===============

// ListWorkflowActions returns all actions for a workflow
func ListWorkflowActions(c *gin.Context) {
	workflowID := c.Query("workflow_id")
	workspaceID := c.Query("workspace_id")

	var actions []models.WorkflowAction
	query := database.DB

	if workflowID != "" {
		query = query.Where("review_workflow_id = ?", workflowID)
	} else if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Order("order_index ASC").Find(&actions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, actions)
}

// GetWorkflowAction returns a single action by ID
func GetWorkflowAction(c *gin.Context) {
	id := c.Param("id")

	var action models.WorkflowAction
	if err := database.DB.First(&action, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Action not found"})
		return
	}

	c.JSON(http.StatusOK, action)
}

// CreateWorkflowAction creates a new workflow action
func CreateWorkflowAction(c *gin.Context) {
	var input struct {
		WorkspaceID      string  `json:"workspace_id" binding:"required"`
		ReviewWorkflowID string  `json:"review_workflow_id" binding:"required"`
		Name             string  `json:"name" binding:"required"`
		Description      string  `json:"description"`
		Color            string  `json:"color"`
		Icon             string  `json:"icon"`
		ActionType       string  `json:"action_type"`
		TargetGroupID    *string `json:"target_group_id"`
		TargetStageID    *string `json:"target_stage_id"`
		RequiresComment  bool    `json:"requires_comment"`
		OrderIndex       int     `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceID, _ := uuid.Parse(input.WorkspaceID)
	workflowID, _ := uuid.Parse(input.ReviewWorkflowID)

	action := models.WorkflowAction{
		ID:               uuid.New(),
		WorkspaceID:      workspaceID,
		ReviewWorkflowID: workflowID,
		Name:             input.Name,
		Description:      input.Description,
		Color:            input.Color,
		Icon:             input.Icon,
		ActionType:       input.ActionType,
		RequiresComment:  input.RequiresComment,
		IsSystem:         false,
		OrderIndex:       input.OrderIndex,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if input.TargetGroupID != nil && *input.TargetGroupID != "" {
		groupID, _ := uuid.Parse(*input.TargetGroupID)
		action.TargetGroupID = &groupID
	}
	if input.TargetStageID != nil && *input.TargetStageID != "" {
		stageID, _ := uuid.Parse(*input.TargetStageID)
		action.TargetStageID = &stageID
	}

	if action.Color == "" {
		action.Color = "gray"
	}
	if action.Icon == "" {
		action.Icon = "circle"
	}
	if action.ActionType == "" {
		action.ActionType = "move_to_group"
	}

	if err := database.DB.Create(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, action)
}

// UpdateWorkflowAction updates an existing workflow action
func UpdateWorkflowAction(c *gin.Context) {
	id := c.Param("id")

	var action models.WorkflowAction
	if err := database.DB.First(&action, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Action not found"})
		return
	}

	var input struct {
		Name            *string `json:"name"`
		Description     *string `json:"description"`
		Color           *string `json:"color"`
		Icon            *string `json:"icon"`
		ActionType      *string `json:"action_type"`
		TargetGroupID   *string `json:"target_group_id"`
		TargetStageID   *string `json:"target_stage_id"`
		RequiresComment *bool   `json:"requires_comment"`
		OrderIndex      *int    `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		action.Name = *input.Name
	}
	if input.Description != nil {
		action.Description = *input.Description
	}
	if input.Color != nil {
		action.Color = *input.Color
	}
	if input.Icon != nil {
		action.Icon = *input.Icon
	}
	if input.ActionType != nil {
		action.ActionType = *input.ActionType
	}
	if input.TargetGroupID != nil {
		if *input.TargetGroupID == "" {
			action.TargetGroupID = nil
		} else {
			groupID, _ := uuid.Parse(*input.TargetGroupID)
			action.TargetGroupID = &groupID
		}
	}
	if input.TargetStageID != nil {
		if *input.TargetStageID == "" {
			action.TargetStageID = nil
		} else {
			stageID, _ := uuid.Parse(*input.TargetStageID)
			action.TargetStageID = &stageID
		}
	}
	if input.RequiresComment != nil {
		action.RequiresComment = *input.RequiresComment
	}
	if input.OrderIndex != nil {
		action.OrderIndex = *input.OrderIndex
	}
	action.UpdatedAt = time.Now()

	if err := database.DB.Save(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, action)
}

// DeleteWorkflowAction deletes a workflow action (if not a system action)
func DeleteWorkflowAction(c *gin.Context) {
	id := c.Param("id")

	var action models.WorkflowAction
	if err := database.DB.First(&action, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Action not found"})
		return
	}

	if action.IsSystem {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete system actions"})
		return
	}

	if err := database.DB.Delete(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Action deleted successfully"})
}

// =============== Stage Actions ===============

// ListStageActions returns all actions for a stage
func ListStageActions(c *gin.Context) {
	stageID := c.Query("stage_id")

	var actions []models.StageAction
	if err := database.DB.Where("stage_id = ?", stageID).Order("order_index ASC").Find(&actions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, actions)
}

// CreateStageAction creates a new stage action
func CreateStageAction(c *gin.Context) {
	var input struct {
		StageID         string  `json:"stage_id" binding:"required"`
		Name            string  `json:"name" binding:"required"`
		Description     string  `json:"description"`
		Color           string  `json:"color"`
		Icon            string  `json:"icon"`
		ActionType      string  `json:"action_type"`
		TargetGroupID   *string `json:"target_group_id"`
		TargetStageID   *string `json:"target_stage_id"`
		StatusValue     string  `json:"status_value"`
		RequiresComment bool    `json:"requires_comment"`
		OrderIndex      int     `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stageID, _ := uuid.Parse(input.StageID)

	action := models.StageAction{
		ID:              uuid.New(),
		StageID:         stageID,
		Name:            input.Name,
		Description:     input.Description,
		Color:           input.Color,
		Icon:            input.Icon,
		ActionType:      input.ActionType,
		StatusValue:     input.StatusValue,
		RequiresComment: input.RequiresComment,
		OrderIndex:      input.OrderIndex,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if input.TargetGroupID != nil && *input.TargetGroupID != "" {
		groupID, _ := uuid.Parse(*input.TargetGroupID)
		action.TargetGroupID = &groupID
	}
	if input.TargetStageID != nil && *input.TargetStageID != "" {
		stageID, _ := uuid.Parse(*input.TargetStageID)
		action.TargetStageID = &stageID
	}

	if action.Color == "" {
		action.Color = "blue"
	}
	if action.Icon == "" {
		action.Icon = "check"
	}
	if action.ActionType == "" {
		action.ActionType = "set_status"
	}

	if err := database.DB.Create(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, action)
}

// UpdateStageAction updates an existing stage action
func UpdateStageAction(c *gin.Context) {
	id := c.Param("id")

	var action models.StageAction
	if err := database.DB.First(&action, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Action not found"})
		return
	}

	var input struct {
		Name            *string `json:"name"`
		Description     *string `json:"description"`
		Color           *string `json:"color"`
		Icon            *string `json:"icon"`
		ActionType      *string `json:"action_type"`
		TargetGroupID   *string `json:"target_group_id"`
		TargetStageID   *string `json:"target_stage_id"`
		StatusValue     *string `json:"status_value"`
		RequiresComment *bool   `json:"requires_comment"`
		OrderIndex      *int    `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		action.Name = *input.Name
	}
	if input.Description != nil {
		action.Description = *input.Description
	}
	if input.Color != nil {
		action.Color = *input.Color
	}
	if input.Icon != nil {
		action.Icon = *input.Icon
	}
	if input.ActionType != nil {
		action.ActionType = *input.ActionType
	}
	if input.TargetGroupID != nil {
		if *input.TargetGroupID == "" {
			action.TargetGroupID = nil
		} else {
			groupID, _ := uuid.Parse(*input.TargetGroupID)
			action.TargetGroupID = &groupID
		}
	}
	if input.TargetStageID != nil {
		if *input.TargetStageID == "" {
			action.TargetStageID = nil
		} else {
			stageID, _ := uuid.Parse(*input.TargetStageID)
			action.TargetStageID = &stageID
		}
	}
	if input.StatusValue != nil {
		action.StatusValue = *input.StatusValue
	}
	if input.RequiresComment != nil {
		action.RequiresComment = *input.RequiresComment
	}
	if input.OrderIndex != nil {
		action.OrderIndex = *input.OrderIndex
	}
	action.UpdatedAt = time.Now()

	if err := database.DB.Save(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, action)
}

// DeleteStageAction deletes a stage action
func DeleteStageAction(c *gin.Context) {
	id := c.Param("id")

	var action models.StageAction
	if err := database.DB.First(&action, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Action not found"})
		return
	}

	if err := database.DB.Delete(&action).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Action deleted successfully"})
}

// =============== Execute Actions ===============

// ExecuteAction executes an action on an application (moves to group or stage)
func ExecuteAction(c *gin.Context) {
	var input struct {
		FormID       string  `json:"form_id" binding:"required"`
		SubmissionID string  `json:"submission_id" binding:"required"`
		ActionType   string  `json:"action_type" binding:"required"` // workflow_action, stage_action
		ActionID     string  `json:"action_id" binding:"required"`
		Comment      *string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the submission
	var row models.Row
	if err := database.DB.First(&row, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	var targetGroupID *uuid.UUID
	var targetStageID *uuid.UUID
	var statusValue string

	if input.ActionType == "workflow_action" {
		var action models.WorkflowAction
		if err := database.DB.First(&action, "id = ?", input.ActionID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workflow action not found"})
			return
		}

		if action.RequiresComment && (input.Comment == nil || *input.Comment == "") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This action requires a comment"})
			return
		}

		targetGroupID = action.TargetGroupID
		targetStageID = action.TargetStageID
	} else if input.ActionType == "stage_action" {
		var action models.StageAction
		if err := database.DB.First(&action, "id = ?", input.ActionID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Stage action not found"})
			return
		}

		if action.RequiresComment && (input.Comment == nil || *input.Comment == "") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "This action requires a comment"})
			return
		}

		targetGroupID = action.TargetGroupID
		targetStageID = action.TargetStageID
		statusValue = action.StatusValue
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action type"})
		return
	}

	// Update the row's metadata with the action result
	var metadata map[string]interface{}
	if row.Metadata != nil {
		if err := row.Metadata.UnmarshalJSON(row.Metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	// Move to group (removes from pipeline)
	if targetGroupID != nil {
		metadata["group_id"] = targetGroupID.String()
		metadata["stage_id"] = nil // Remove from stages
	} else if targetStageID != nil {
		// Move to stage
		metadata["stage_id"] = targetStageID.String()
		metadata["group_id"] = nil // Ensure not in a group
	}

	if statusValue != "" {
		metadata["status"] = statusValue
	}

	if input.Comment != nil && *input.Comment != "" {
		// Add to action history
		actionHistory, ok := metadata["action_history"].([]interface{})
		if !ok {
			actionHistory = []interface{}{}
		}
		actionHistory = append(actionHistory, map[string]interface{}{
			"action_id": input.ActionID,
			"comment":   *input.Comment,
			"timestamp": time.Now().Format(time.RFC3339),
			"actor_id":  c.GetString("user_id"),
		})
		metadata["action_history"] = actionHistory
	}

	row.Metadata = mapToJSON(metadata)
	row.UpdatedAt = time.Now()

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Action executed successfully",
		"target_group_id": targetGroupID,
		"target_stage_id": targetStageID,
		"status":          statusValue,
	})
}

// MoveToGroup moves an application to a group (removing from pipeline)
func MoveToGroup(c *gin.Context) {
	var input struct {
		FormID       string  `json:"form_id" binding:"required"`
		SubmissionID string  `json:"submission_id" binding:"required"`
		GroupID      string  `json:"group_id" binding:"required"`
		Comment      *string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify group exists
	var group models.ApplicationGroup
	if err := database.DB.First(&group, "id = ?", input.GroupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// Get the submission
	var row models.Row
	if err := database.DB.First(&row, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Update metadata
	var metadata map[string]interface{}
	if row.Metadata != nil {
		if err := row.Metadata.UnmarshalJSON(row.Metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	metadata["group_id"] = input.GroupID
	metadata["stage_id"] = nil // Remove from pipeline

	if input.Comment != nil && *input.Comment != "" {
		moveHistory, ok := metadata["move_history"].([]interface{})
		if !ok {
			moveHistory = []interface{}{}
		}
		moveHistory = append(moveHistory, map[string]interface{}{
			"to_group":  input.GroupID,
			"comment":   *input.Comment,
			"timestamp": time.Now().Format(time.RFC3339),
		})
		metadata["move_history"] = moveHistory
	}

	row.Metadata = mapToJSON(metadata)
	row.UpdatedAt = time.Now()

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Moved to group successfully",
		"group_id": input.GroupID,
	})
}

// GetGroupApplications returns all applications in a group
func GetGroupApplications(c *gin.Context) {
	groupID := c.Param("id")
	formID := c.Query("form_id")

	var rows []models.Row
	query := database.DB.Where("metadata->>'group_id' = ?", groupID)

	if formID != "" {
		query = query.Where("table_id = ?", formID)
	}

	if err := query.Order("updated_at DESC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

// RestoreFromGroup moves an application back to the pipeline from a group
func RestoreFromGroup(c *gin.Context) {
	var input struct {
		FormID       string `json:"form_id" binding:"required"`
		SubmissionID string `json:"submission_id" binding:"required"`
		StageID      string `json:"stage_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the submission
	var row models.Row
	if err := database.DB.First(&row, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Update metadata
	var metadata map[string]interface{}
	if row.Metadata != nil {
		if err := row.Metadata.UnmarshalJSON(row.Metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	metadata["stage_id"] = input.StageID
	metadata["group_id"] = nil // Remove from group

	row.Metadata = mapToJSON(metadata)
	row.UpdatedAt = time.Now()

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Restored to pipeline successfully",
		"stage_id": input.StageID,
	})
}

// CreateDefaultGroupsForWorkflow creates default groups (Rejected, Waitlist) for a new workflow
func CreateDefaultGroupsForWorkflow(workspaceID, workflowID uuid.UUID) error {
	defaultGroups := []models.ApplicationGroup{
		{
			ID:               uuid.New(),
			WorkspaceID:      workspaceID,
			ReviewWorkflowID: workflowID,
			Name:             "Rejected",
			Description:      "Applications that have been rejected",
			Color:            "red",
			Icon:             "x-circle",
			OrderIndex:       0,
			IsSystem:         true,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		},
		{
			ID:               uuid.New(),
			WorkspaceID:      workspaceID,
			ReviewWorkflowID: workflowID,
			Name:             "Waitlist",
			Description:      "Applications on the waitlist",
			Color:            "yellow",
			Icon:             "clock",
			OrderIndex:       1,
			IsSystem:         true,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		},
	}

	for _, group := range defaultGroups {
		if err := database.DB.Create(&group).Error; err != nil {
			return err
		}
	}

	// Create default workflow action for Reject
	rejectAction := models.WorkflowAction{
		ID:               uuid.New(),
		WorkspaceID:      workspaceID,
		ReviewWorkflowID: workflowID,
		Name:             "Reject",
		Description:      "Reject the application and move to Rejected group",
		Color:            "red",
		Icon:             "x-circle",
		ActionType:       "move_to_group",
		TargetGroupID:    &defaultGroups[0].ID,
		RequiresComment:  false,
		IsSystem:         true,
		OrderIndex:       0,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := database.DB.Create(&rejectAction).Error; err != nil {
		return err
	}

	return nil
}
