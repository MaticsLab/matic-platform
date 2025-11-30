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

// =============== Stage Groups ===============
// Stage groups are sub-groups within a stage (visible only in that stage)

// ListStageGroups returns all stage groups for a stage
func ListStageGroups(c *gin.Context) {
	stageID := c.Query("stage_id")
	workspaceID := c.Query("workspace_id")

	var groups []models.StageGroup
	query := database.DB

	if stageID != "" {
		query = query.Where("stage_id = ?", stageID)
	} else if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Order("order_index ASC").Find(&groups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// GetStageGroup returns a single stage group by ID
func GetStageGroup(c *gin.Context) {
	id := c.Param("id")

	var group models.StageGroup
	if err := database.DB.First(&group, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stage group not found"})
		return
	}

	c.JSON(http.StatusOK, group)
}

// CreateStageGroup creates a new stage group
func CreateStageGroup(c *gin.Context) {
	var input struct {
		StageID     string `json:"stage_id" binding:"required"`
		WorkspaceID string `json:"workspace_id" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Color       string `json:"color"`
		Icon        string `json:"icon"`
		OrderIndex  int    `json:"order_index"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stageID, _ := uuid.Parse(input.StageID)
	workspaceID, _ := uuid.Parse(input.WorkspaceID)

	group := models.StageGroup{
		ID:          uuid.New(),
		StageID:     stageID,
		WorkspaceID: workspaceID,
		Name:        input.Name,
		Description: input.Description,
		Color:       input.Color,
		Icon:        input.Icon,
		OrderIndex:  input.OrderIndex,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if group.Color == "" {
		group.Color = "blue"
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

// UpdateStageGroup updates an existing stage group
func UpdateStageGroup(c *gin.Context) {
	id := c.Param("id")

	var group models.StageGroup
	if err := database.DB.First(&group, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stage group not found"})
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

// DeleteStageGroup deletes a stage group
func DeleteStageGroup(c *gin.Context) {
	id := c.Param("id")

	var group models.StageGroup
	if err := database.DB.First(&group, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stage group not found"})
		return
	}

	// Set stage_group_id to null for all submissions in this group
	database.DB.Model(&models.Row{}).
		Where("stage_group_id = ?", id).
		Update("stage_group_id", nil)

	if err := database.DB.Delete(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stage group deleted successfully"})
}

// =============== Custom Statuses ===============

// ListCustomStatuses returns all custom statuses for a stage
func ListCustomStatuses(c *gin.Context) {
	stageID := c.Query("stage_id")
	workspaceID := c.Query("workspace_id")

	var statuses []models.CustomStatus
	query := database.DB

	if stageID != "" {
		query = query.Where("stage_id = ?", stageID)
	} else if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Order("order_index ASC").Find(&statuses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, statuses)
}

// GetCustomStatus returns a single custom status by ID
func GetCustomStatus(c *gin.Context) {
	id := c.Param("id")

	var status models.CustomStatus
	if err := database.DB.First(&status, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Custom status not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// CreateCustomStatus creates a new custom status
func CreateCustomStatus(c *gin.Context) {
	var input struct {
		StageID         string      `json:"stage_id" binding:"required"`
		WorkspaceID     string      `json:"workspace_id" binding:"required"`
		Name            string      `json:"name" binding:"required"`
		Description     string      `json:"description"`
		Color           string      `json:"color"`
		Icon            string      `json:"icon"`
		IsPrimary       bool        `json:"is_primary"`
		OrderIndex      int         `json:"order_index"`
		RequiresComment bool        `json:"requires_comment"`
		RequiresScore   bool        `json:"requires_score"`
		Actions         interface{} `json:"actions"` // []StatusActionConfig
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stageID, _ := uuid.Parse(input.StageID)
	workspaceID, _ := uuid.Parse(input.WorkspaceID)

	status := models.CustomStatus{
		ID:              uuid.New(),
		StageID:         stageID,
		WorkspaceID:     workspaceID,
		Name:            input.Name,
		Description:     input.Description,
		Color:           input.Color,
		Icon:            input.Icon,
		IsPrimary:       input.IsPrimary,
		OrderIndex:      input.OrderIndex,
		RequiresComment: input.RequiresComment,
		RequiresScore:   input.RequiresScore,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if input.Actions != nil {
		status.Actions = interfaceToJSON(input.Actions)
	}

	if status.Color == "" {
		status.Color = "blue"
	}
	if status.Icon == "" {
		status.Icon = "circle"
	}

	if err := database.DB.Create(&status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, status)
}

// UpdateCustomStatus updates an existing custom status
func UpdateCustomStatus(c *gin.Context) {
	id := c.Param("id")

	var status models.CustomStatus
	if err := database.DB.First(&status, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Custom status not found"})
		return
	}

	var input struct {
		Name            *string     `json:"name"`
		Description     *string     `json:"description"`
		Color           *string     `json:"color"`
		Icon            *string     `json:"icon"`
		IsPrimary       *bool       `json:"is_primary"`
		OrderIndex      *int        `json:"order_index"`
		RequiresComment *bool       `json:"requires_comment"`
		RequiresScore   *bool       `json:"requires_score"`
		Actions         interface{} `json:"actions"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		status.Name = *input.Name
	}
	if input.Description != nil {
		status.Description = *input.Description
	}
	if input.Color != nil {
		status.Color = *input.Color
	}
	if input.Icon != nil {
		status.Icon = *input.Icon
	}
	if input.IsPrimary != nil {
		status.IsPrimary = *input.IsPrimary
	}
	if input.OrderIndex != nil {
		status.OrderIndex = *input.OrderIndex
	}
	if input.RequiresComment != nil {
		status.RequiresComment = *input.RequiresComment
	}
	if input.RequiresScore != nil {
		status.RequiresScore = *input.RequiresScore
	}
	if input.Actions != nil {
		status.Actions = interfaceToJSON(input.Actions)
	}
	status.UpdatedAt = time.Now()

	if err := database.DB.Save(&status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// DeleteCustomStatus deletes a custom status
func DeleteCustomStatus(c *gin.Context) {
	id := c.Param("id")

	var status models.CustomStatus
	if err := database.DB.First(&status, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Custom status not found"})
		return
	}

	if err := database.DB.Delete(&status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Custom status deleted successfully"})
}

// MoveToStageGroup moves an application to a stage group
func MoveToStageGroup(c *gin.Context) {
	var input struct {
		SubmissionID string  `json:"submission_id" binding:"required"`
		StageGroupID *string `json:"stage_group_id"` // null to remove from group
		Comment      *string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var row models.Row
	if err := database.DB.First(&row, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	if input.StageGroupID != nil && *input.StageGroupID != "" {
		// Verify stage group exists
		var group models.StageGroup
		if err := database.DB.First(&group, "id = ?", *input.StageGroupID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Stage group not found"})
			return
		}

		// Update stage_group_id
		stageGroupID, _ := uuid.Parse(*input.StageGroupID)
		row.StageGroupID = &stageGroupID
	} else {
		row.StageGroupID = nil
	}

	row.UpdatedAt = time.Now()

	// Add to metadata history
	var metadata map[string]interface{}
	if row.Metadata != nil {
		row.Metadata.UnmarshalJSON(row.Metadata)
	}
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	actionHistory, ok := metadata["action_history"].([]interface{})
	if !ok {
		actionHistory = []interface{}{}
	}
	historyEntry := map[string]interface{}{
		"action":         "move_to_stage_group",
		"stage_group_id": input.StageGroupID,
		"timestamp":      time.Now().Format(time.RFC3339),
		"actor_id":       c.GetString("user_id"),
	}
	if input.Comment != nil && *input.Comment != "" {
		historyEntry["comment"] = *input.Comment
	}
	actionHistory = append(actionHistory, historyEntry)
	metadata["action_history"] = actionHistory

	row.Metadata = mapToJSON(metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Application moved to stage group successfully",
		"stage_group_id": input.StageGroupID,
	})
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

// ExecuteStatusAction executes a status action from stage's custom_statuses
func ExecuteStatusAction(c *gin.Context) {
	var input struct {
		StageID      string  `json:"stage_id" binding:"required"`
		StatusName   string  `json:"status_name" binding:"required"`
		SubmissionID string  `json:"submission_id" binding:"required"`
		Comment      *string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the stage to find its status_actions config
	var stage models.ApplicationStage
	if err := database.DB.First(&stage, "id = ?", input.StageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stage not found"})
		return
	}

	// Parse status_actions from stage
	var statusActions map[string]struct {
		MoveToStageID   *string  `json:"move_to_stage_id"`
		MoveToGroupID   *string  `json:"move_to_group_id"`
		AddTags         []string `json:"add_tags"`
		RemoveTags      []string `json:"remove_tags"`
		SetStatus       string   `json:"set_status"`
		SendEmail       bool     `json:"send_email"`
		EmailTemplateID *string  `json:"email_template_id"`
		RequireComment  bool     `json:"require_comment"`
	}

	if stage.StatusActions != nil {
		if err := stage.StatusActions.UnmarshalJSON(stage.StatusActions); err != nil {
			// No actions configured - just set the status
			statusActions = make(map[string]struct {
				MoveToStageID   *string  `json:"move_to_stage_id"`
				MoveToGroupID   *string  `json:"move_to_group_id"`
				AddTags         []string `json:"add_tags"`
				RemoveTags      []string `json:"remove_tags"`
				SetStatus       string   `json:"set_status"`
				SendEmail       bool     `json:"send_email"`
				EmailTemplateID *string  `json:"email_template_id"`
				RequireComment  bool     `json:"require_comment"`
			})
		}
	}

	// Get the submission
	var row models.Row
	if err := database.DB.First(&row, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Parse existing metadata
	var metadata map[string]interface{}
	if row.Metadata != nil {
		if err := row.Metadata.UnmarshalJSON(row.Metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	// Check if we have action config for this status
	actionConfig, hasAction := statusActions[input.StatusName]

	// Apply the action
	if hasAction {
		// Check if comment is required
		if actionConfig.RequireComment && (input.Comment == nil || *input.Comment == "") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Comment is required for this action"})
			return
		}

		// Move to group
		if actionConfig.MoveToGroupID != nil && *actionConfig.MoveToGroupID != "" {
			metadata["group_id"] = *actionConfig.MoveToGroupID
			metadata["stage_id"] = nil
		} else if actionConfig.MoveToStageID != nil && *actionConfig.MoveToStageID != "" {
			// Move to stage
			metadata["stage_id"] = *actionConfig.MoveToStageID
			metadata["group_id"] = nil
		}

		// Set status
		if actionConfig.SetStatus != "" {
			metadata["status"] = actionConfig.SetStatus
		}

		// Handle tags
		existingTags, _ := metadata["tags"].([]interface{})
		tagSet := make(map[string]bool)
		for _, t := range existingTags {
			if s, ok := t.(string); ok {
				tagSet[s] = true
			}
		}

		// Add tags
		for _, tag := range actionConfig.AddTags {
			tagSet[tag] = true
		}

		// Remove tags
		for _, tag := range actionConfig.RemoveTags {
			delete(tagSet, tag)
		}

		// Convert back to slice
		var newTags []string
		for tag := range tagSet {
			newTags = append(newTags, tag)
		}
		metadata["tags"] = newTags
	}

	// Always set the current status name
	metadata["current_status"] = input.StatusName

	// Add to action history
	actionHistory, ok := metadata["action_history"].([]interface{})
	if !ok {
		actionHistory = []interface{}{}
	}
	historyEntry := map[string]interface{}{
		"status":    input.StatusName,
		"timestamp": time.Now().Format(time.RFC3339),
		"actor_id":  c.GetString("user_id"),
	}
	if input.Comment != nil && *input.Comment != "" {
		historyEntry["comment"] = *input.Comment
	}
	actionHistory = append(actionHistory, historyEntry)
	metadata["action_history"] = actionHistory

	row.Metadata = mapToJSON(metadata)
	row.UpdatedAt = time.Now()

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Status action executed successfully",
		"status":         input.StatusName,
		"action_applied": hasAction,
	})
}
