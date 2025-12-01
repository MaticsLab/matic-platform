package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
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
