package handlers

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

// --- Review Workflows ---

func ListReviewWorkflows(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	var workflows []models.ReviewWorkflow
	if err := database.DB.Where("workspace_id = ?", workspaceID).Find(&workflows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, workflows)
}

func CreateReviewWorkflow(c *gin.Context) {
	var workflow models.ReviewWorkflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&workflow).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, workflow)
}

func GetReviewWorkflow(c *gin.Context) {
	id := c.Param("id")
	var workflow models.ReviewWorkflow
	if err := database.DB.First(&workflow, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}
	c.JSON(http.StatusOK, workflow)
}

func UpdateReviewWorkflow(c *gin.Context) {
	id := c.Param("id")
	var workflow models.ReviewWorkflow
	if err := database.DB.First(&workflow, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workflow not found"})
		return
	}
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Save(&workflow)
	c.JSON(http.StatusOK, workflow)
}

func DeleteReviewWorkflow(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.ReviewWorkflow{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Application Stages ---

func ListApplicationStages(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	workflowID := c.Query("review_workflow_id")

	query := database.DB.Where("workspace_id = ?", workspaceID)
	if workflowID != "" {
		query = query.Where("review_workflow_id = ?", workflowID)
	}

	var stages []models.ApplicationStage
	if err := query.Find(&stages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stages)
}

func CreateApplicationStage(c *gin.Context) {
	var stage models.ApplicationStage
	if err := c.ShouldBindJSON(&stage); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&stage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, stage)
}

func GetApplicationStage(c *gin.Context) {
	id := c.Param("id")
	var stage models.ApplicationStage
	if err := database.DB.First(&stage, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stage not found"})
		return
	}
	c.JSON(http.StatusOK, stage)
}

func UpdateApplicationStage(c *gin.Context) {
	id := c.Param("id")
	var stage models.ApplicationStage
	if err := database.DB.First(&stage, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stage not found"})
		return
	}

	// Parse update data into a map first to handle all fields properly
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert hidden_pii_fields to proper JSON format for GORM
	if fields, ok := updates["hidden_pii_fields"]; ok {
		if fieldsArr, ok := fields.([]interface{}); ok {
			jsonBytes, _ := json.Marshal(fieldsArr)
			updates["hidden_pii_fields"] = datatypes.JSON(jsonBytes)
		}
	}

	// Use Updates to properly handle false boolean values and empty arrays
	if err := database.DB.Model(&stage).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload to get the updated stage
	database.DB.First(&stage, "id = ?", id)
	c.JSON(http.StatusOK, stage)
}

func DeleteApplicationStage(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.ApplicationStage{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Reviewer Types ---

func ListReviewerTypes(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	var types []models.ReviewerType
	if err := database.DB.Where("workspace_id = ?", workspaceID).Find(&types).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, types)
}

func CreateReviewerType(c *gin.Context) {
	var rType models.ReviewerType
	if err := c.ShouldBindJSON(&rType); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&rType).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rType)
}

func GetReviewerType(c *gin.Context) {
	id := c.Param("id")
	var rType models.ReviewerType
	if err := database.DB.First(&rType, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Reviewer Type not found"})
		return
	}
	c.JSON(http.StatusOK, rType)
}

func UpdateReviewerType(c *gin.Context) {
	id := c.Param("id")
	var rType models.ReviewerType
	if err := database.DB.First(&rType, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Reviewer Type not found"})
		return
	}
	if err := c.ShouldBindJSON(&rType); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Save(&rType)
	c.JSON(http.StatusOK, rType)
}

func DeleteReviewerType(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.ReviewerType{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Rubrics ---

func ListRubrics(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	var rubrics []models.Rubric
	if err := database.DB.Where("workspace_id = ?", workspaceID).Find(&rubrics).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rubrics)
}

func CreateRubric(c *gin.Context) {
	var rubric models.Rubric
	if err := c.ShouldBindJSON(&rubric); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&rubric).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rubric)
}

func GetRubric(c *gin.Context) {
	id := c.Param("id")
	var rubric models.Rubric
	if err := database.DB.First(&rubric, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rubric not found"})
		return
	}
	c.JSON(http.StatusOK, rubric)
}

func UpdateRubric(c *gin.Context) {
	id := c.Param("id")
	var rubric models.Rubric
	if err := database.DB.First(&rubric, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rubric not found"})
		return
	}
	if err := c.ShouldBindJSON(&rubric); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Save(&rubric)
	c.JSON(http.StatusOK, rubric)
}

func DeleteRubric(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Rubric{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Stage Reviewer Configs ---

func ListStageReviewerConfigs(c *gin.Context) {
	stageID := c.Query("stage_id")
	var configs []models.StageReviewerConfig
	if err := database.DB.Where("stage_id = ?", stageID).Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, configs)
}

func CreateStageReviewerConfig(c *gin.Context) {
	var config models.StageReviewerConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, config)
}

func UpdateStageReviewerConfig(c *gin.Context) {
	id := c.Param("id")
	var config models.StageReviewerConfig
	if err := database.DB.First(&config, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
		return
	}
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Save(&config)
	c.JSON(http.StatusOK, config)
}

func DeleteStageReviewerConfig(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.StageReviewerConfig{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// GetReviewWorkspaceData returns all data needed for the review workspace in a single call
// This dramatically reduces the number of API calls and improves load time
func GetReviewWorkspaceData(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	workflowID := c.Query("workflow_id")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Response structure
	type StageWithDetails struct {
		models.ApplicationStage
		ReviewerConfigs []models.StageReviewerConfig `json:"reviewer_configs"`
		StageActions    []models.StageAction         `json:"stage_actions"`
	}

	type ReviewWorkspaceResponse struct {
		Workflows       []models.ReviewWorkflow   `json:"workflows"`
		Rubrics         []models.Rubric           `json:"rubrics"`
		ReviewerTypes   []models.ReviewerType     `json:"reviewer_types"`
		Stages          []StageWithDetails        `json:"stages"`
		WorkflowActions []models.WorkflowAction   `json:"workflow_actions"`
		Groups          []models.ApplicationGroup `json:"groups"`
		StageGroups     []models.StageGroup       `json:"stage_groups"`
	}

	var response ReviewWorkspaceResponse

	// Use WaitGroup to fetch base data in parallel
	var wg sync.WaitGroup
	var workflowsErr, rubricsErr, reviewerTypesErr, stageGroupsErr error

	wg.Add(4)

	go func() {
		defer wg.Done()
		workflowsErr = database.DB.Where("workspace_id = ?", workspaceID).Find(&response.Workflows).Error
	}()

	go func() {
		defer wg.Done()
		rubricsErr = database.DB.Where("workspace_id = ?", workspaceID).Find(&response.Rubrics).Error
	}()

	go func() {
		defer wg.Done()
		reviewerTypesErr = database.DB.Where("workspace_id = ?", workspaceID).Find(&response.ReviewerTypes).Error
	}()

	go func() {
		defer wg.Done()
		stageGroupsErr = database.DB.Where("workspace_id = ?", workspaceID).Order("order_index ASC").Find(&response.StageGroups).Error
	}()

	wg.Wait()

	// Check for errors
	if workflowsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workflows: " + workflowsErr.Error()})
		return
	}
	if rubricsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rubrics: " + rubricsErr.Error()})
		return
	}
	if reviewerTypesErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reviewer types: " + reviewerTypesErr.Error()})
		return
	}
	if stageGroupsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stage groups: " + stageGroupsErr.Error()})
		return
	}

	// Determine active workflow
	activeWorkflowID := workflowID
	if activeWorkflowID == "" && len(response.Workflows) > 0 {
		// Find active workflow or use first one
		for _, w := range response.Workflows {
			if w.IsActive {
				activeWorkflowID = w.ID.String()
				break
			}
		}
		if activeWorkflowID == "" {
			activeWorkflowID = response.Workflows[0].ID.String()
		}
	}

	if activeWorkflowID != "" {
		// Fetch workflow actions, groups, and stages in parallel
		var stages []models.ApplicationStage
		var stagesErr error

		var wg2 sync.WaitGroup
		wg2.Add(3)

		go func() {
			defer wg2.Done()
			database.DB.Where("review_workflow_id = ?", activeWorkflowID).Order("order_index ASC").Find(&response.WorkflowActions)
		}()

		go func() {
			defer wg2.Done()
			database.DB.Where("review_workflow_id = ?", activeWorkflowID).Order("order_index ASC").Find(&response.Groups)
		}()

		go func() {
			defer wg2.Done()
			stagesErr = database.DB.Where("workspace_id = ? AND review_workflow_id = ?", workspaceID, activeWorkflowID).Order("order_index ASC").Find(&stages).Error
		}()

		wg2.Wait()

		if stagesErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stages: " + stagesErr.Error()})
			return
		}

		// Get all stage IDs for bulk queries
		stageIDs := make([]string, len(stages))
		for i, s := range stages {
			stageIDs[i] = s.ID.String()
		}

		// Bulk fetch all stage configs and actions in parallel
		var allConfigs []models.StageReviewerConfig
		var allActions []models.StageAction

		if len(stageIDs) > 0 {
			var wg3 sync.WaitGroup
			wg3.Add(2)

			go func() {
				defer wg3.Done()
				database.DB.Where("stage_id IN ?", stageIDs).Find(&allConfigs)
			}()

			go func() {
				defer wg3.Done()
				database.DB.Where("stage_id IN ?", stageIDs).Order("order_index ASC").Find(&allActions)
			}()

			wg3.Wait()
		}

		// Map configs and actions to stages
		configMap := make(map[string][]models.StageReviewerConfig)
		for _, cfg := range allConfigs {
			configMap[cfg.StageID.String()] = append(configMap[cfg.StageID.String()], cfg)
		}

		actionMap := make(map[string][]models.StageAction)
		for _, action := range allActions {
			actionMap[action.StageID.String()] = append(actionMap[action.StageID.String()], action)
		}

		// Build stages with details
		response.Stages = make([]StageWithDetails, len(stages))
		for i, stage := range stages {
			stageID := stage.ID.String()
			response.Stages[i] = StageWithDetails{
				ApplicationStage: stage,
				ReviewerConfigs:  configMap[stageID],
				StageActions:     actionMap[stageID],
			}
			if response.Stages[i].ReviewerConfigs == nil {
				response.Stages[i].ReviewerConfigs = []models.StageReviewerConfig{}
			}
			if response.Stages[i].StageActions == nil {
				response.Stages[i].StageActions = []models.StageAction{}
			}
		}
	}

	c.JSON(http.StatusOK, response)
}
