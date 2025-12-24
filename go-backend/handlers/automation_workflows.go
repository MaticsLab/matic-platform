package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetAutomationWorkflows retrieves all automation workflows for a workspace
func GetAutomationWorkflows(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workflows []models.AutomationWorkflow
	result := database.DB.Where("workspace_id = ?", wsID).
		Order("updated_at DESC").
		Find(&workflows)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workflows"})
		return
	}

	// Add isOwner field to each workflow
	response := make([]models.AutomationWorkflowResponse, len(workflows))
	for i, wf := range workflows {
		var nodes, edges interface{}
		json.Unmarshal(wf.Nodes, &nodes)
		json.Unmarshal(wf.Edges, &edges)

		response[i] = models.AutomationWorkflowResponse{
			ID:          wf.ID,
			Name:        wf.Name,
			Description: wf.Description,
			WorkspaceID: wf.WorkspaceID,
			UserID:      wf.UserID,
			Nodes:       nodes,
			Edges:       edges,
			Visibility:  wf.Visibility,
			TriggerType: wf.TriggerType,
			IsActive:    wf.IsActive,
			IsOwner:     wf.UserID.String() == userID.(string),
			CreatedAt:   wf.CreatedAt,
			UpdatedAt:   wf.UpdatedAt,
		}
	}

	c.JSON(http.StatusOK, response)
}

// GetAutomationWorkflow retrieves a single automation workflow by ID
func GetAutomationWorkflow(c *gin.Context) {
	workflowID := c.Param("id")
	if workflowID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workflow ID is required"})
		return
	}

	wfID, err := uuid.Parse(workflowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workflow ID"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workflow models.AutomationWorkflow
	result := database.DB.First(&workflow, "id = ?", wfID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	isOwner := workflow.UserID.String() == userID.(string)

	// If not owner, check visibility
	if !isOwner && workflow.Visibility == "private" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	var nodes, edges interface{}
	json.Unmarshal(workflow.Nodes, &nodes)
	json.Unmarshal(workflow.Edges, &edges)

	response := models.AutomationWorkflowResponse{
		ID:          workflow.ID,
		Name:        workflow.Name,
		Description: workflow.Description,
		WorkspaceID: workflow.WorkspaceID,
		UserID:      workflow.UserID,
		Nodes:       nodes,
		Edges:       edges,
		Visibility:  workflow.Visibility,
		TriggerType: workflow.TriggerType,
		IsActive:    workflow.IsActive,
		IsOwner:     isOwner,
		CreatedAt:   workflow.CreatedAt,
		UpdatedAt:   workflow.UpdatedAt,
	}

	c.JSON(http.StatusOK, response)
}

// CreateAutomationWorkflow creates a new automation workflow
func CreateAutomationWorkflow(c *gin.Context) {
	var req models.CreateAutomationWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	// Get user ID from context
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Convert nodes and edges to JSON
	nodesJSON, _ := json.Marshal(req.Nodes)
	edgesJSON, _ := json.Marshal(req.Edges)

	// Set defaults
	visibility := "private"
	if req.Visibility != "" {
		visibility = req.Visibility
	}

	triggerType := "manual"
	if req.TriggerType != "" {
		triggerType = req.TriggerType
	}

	workflow := models.AutomationWorkflow{
		Name:        req.Name,
		Description: req.Description,
		WorkspaceID: wsID,
		UserID:      userID,
		Nodes:       nodesJSON,
		Edges:       edgesJSON,
		Visibility:  visibility,
		TriggerType: triggerType,
		IsActive:    true,
	}

	result := database.DB.Create(&workflow)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workflow"})
		return
	}

	var nodes, edges interface{}
	json.Unmarshal(workflow.Nodes, &nodes)
	json.Unmarshal(workflow.Edges, &edges)

	response := models.AutomationWorkflowResponse{
		ID:          workflow.ID,
		Name:        workflow.Name,
		Description: workflow.Description,
		WorkspaceID: workflow.WorkspaceID,
		UserID:      workflow.UserID,
		Nodes:       nodes,
		Edges:       edges,
		Visibility:  workflow.Visibility,
		TriggerType: workflow.TriggerType,
		IsActive:    workflow.IsActive,
		IsOwner:     true,
		CreatedAt:   workflow.CreatedAt,
		UpdatedAt:   workflow.UpdatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// UpdateAutomationWorkflow updates an existing automation workflow
func UpdateAutomationWorkflow(c *gin.Context) {
	workflowID := c.Param("id")
	if workflowID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workflow ID is required"})
		return
	}

	wfID, err := uuid.Parse(workflowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workflow ID"})
		return
	}

	// Get user ID from context
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Find existing workflow
	var workflow models.AutomationWorkflow
	result := database.DB.First(&workflow, "id = ?", wfID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	// Check ownership
	if workflow.UserID.String() != userIDStr.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to update this workflow"})
		return
	}

	var req models.UpdateAutomationWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if req.Name != nil {
		workflow.Name = *req.Name
	}
	if req.Description != nil {
		workflow.Description = *req.Description
	}
	if req.Nodes != nil {
		nodesJSON, _ := json.Marshal(req.Nodes)
		workflow.Nodes = nodesJSON
	}
	if req.Edges != nil {
		edgesJSON, _ := json.Marshal(req.Edges)
		workflow.Edges = edgesJSON
	}
	if req.TriggerType != nil {
		workflow.TriggerType = *req.TriggerType
	}
	if req.Visibility != nil {
		if *req.Visibility != "private" && *req.Visibility != "public" && *req.Visibility != "workspace" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visibility value"})
			return
		}
		workflow.Visibility = *req.Visibility
	}
	if req.IsActive != nil {
		workflow.IsActive = *req.IsActive
	}

	result = database.DB.Save(&workflow)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workflow"})
		return
	}

	var nodes, edges interface{}
	json.Unmarshal(workflow.Nodes, &nodes)
	json.Unmarshal(workflow.Edges, &edges)

	response := models.AutomationWorkflowResponse{
		ID:          workflow.ID,
		Name:        workflow.Name,
		Description: workflow.Description,
		WorkspaceID: workflow.WorkspaceID,
		UserID:      workflow.UserID,
		Nodes:       nodes,
		Edges:       edges,
		Visibility:  workflow.Visibility,
		TriggerType: workflow.TriggerType,
		IsActive:    workflow.IsActive,
		IsOwner:     true,
		CreatedAt:   workflow.CreatedAt,
		UpdatedAt:   workflow.UpdatedAt,
	}

	c.JSON(http.StatusOK, response)
}

// DeleteAutomationWorkflow deletes an automation workflow
func DeleteAutomationWorkflow(c *gin.Context) {
	workflowID := c.Param("id")
	if workflowID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workflow ID is required"})
		return
	}

	wfID, err := uuid.Parse(workflowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workflow ID"})
		return
	}

	// Get user ID from context
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Find existing workflow
	var workflow models.AutomationWorkflow
	result := database.DB.First(&workflow, "id = ?", wfID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	// Check ownership
	if workflow.UserID.String() != userIDStr.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to delete this workflow"})
		return
	}

	// Delete execution logs first
	database.DB.Where("execution_id IN (SELECT id FROM automation_workflow_executions WHERE workflow_id = ?)", wfID).
		Delete(&models.AutomationWorkflowExecutionLog{})

	// Delete executions
	database.DB.Where("workflow_id = ?", wfID).Delete(&models.AutomationWorkflowExecution{})

	// Delete workflow
	result = database.DB.Delete(&workflow)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workflow"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Workflow deleted successfully"})
}

// DuplicateAutomationWorkflow creates a copy of an existing workflow
func DuplicateAutomationWorkflow(c *gin.Context) {
	workflowID := c.Param("id")
	if workflowID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workflow ID is required"})
		return
	}

	wfID, err := uuid.Parse(workflowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workflow ID"})
		return
	}

	// Get user ID from context
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Find original workflow
	var original models.AutomationWorkflow
	result := database.DB.First(&original, "id = ?", wfID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	// Check access (owner or public)
	isOwner := original.UserID.String() == userIDStr.(string)
	if !isOwner && original.Visibility == "private" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}

	// Create copy
	newWorkflow := models.AutomationWorkflow{
		Name:        original.Name + " (Copy)",
		Description: original.Description,
		WorkspaceID: original.WorkspaceID,
		UserID:      userID,
		Nodes:       original.Nodes,
		Edges:       original.Edges,
		Visibility:  "private",
		TriggerType: original.TriggerType,
		IsActive:    true,
	}

	result = database.DB.Create(&newWorkflow)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to duplicate workflow"})
		return
	}

	var nodes, edges interface{}
	json.Unmarshal(newWorkflow.Nodes, &nodes)
	json.Unmarshal(newWorkflow.Edges, &edges)

	response := models.AutomationWorkflowResponse{
		ID:          newWorkflow.ID,
		Name:        newWorkflow.Name,
		Description: newWorkflow.Description,
		WorkspaceID: newWorkflow.WorkspaceID,
		UserID:      newWorkflow.UserID,
		Nodes:       nodes,
		Edges:       edges,
		Visibility:  newWorkflow.Visibility,
		TriggerType: newWorkflow.TriggerType,
		IsActive:    newWorkflow.IsActive,
		IsOwner:     true,
		CreatedAt:   newWorkflow.CreatedAt,
		UpdatedAt:   newWorkflow.UpdatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// GetAutomationWorkflowExecutions retrieves execution history for a workflow
func GetAutomationWorkflowExecutions(c *gin.Context) {
	workflowID := c.Param("id")
	if workflowID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workflow ID is required"})
		return
	}

	wfID, err := uuid.Parse(workflowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workflow ID"})
		return
	}

	var executions []models.AutomationWorkflowExecution
	result := database.DB.Where("workflow_id = ?", wfID).
		Order("created_at DESC").
		Limit(50).
		Find(&executions)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch executions"})
		return
	}

	c.JSON(http.StatusOK, executions)
}

// GetAutomationWorkflowExecutionLogs retrieves logs for a specific execution
func GetAutomationWorkflowExecutionLogs(c *gin.Context) {
	executionID := c.Param("executionId")
	if executionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Execution ID is required"})
		return
	}

	execID, err := uuid.Parse(executionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid execution ID"})
		return
	}

	var logs []models.AutomationWorkflowExecutionLog
	result := database.DB.Where("execution_id = ?", execID).
		Order("created_at ASC").
		Find(&logs)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch execution logs"})
		return
	}

	c.JSON(http.StatusOK, logs)
}
