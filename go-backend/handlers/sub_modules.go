package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gosimple/slug"
)

// ============================================================
// SUB-MODULE HANDLERS
// ============================================================

// ListSubModules returns all sub-modules for a hub
func ListSubModules(c *gin.Context) {
	hubID := c.Param("hub_id")
	moduleID := c.Query("module_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	var subModules []models.SubModule
	query := database.DB.Where("hub_id = ?", hubUUID)

	if moduleID != "" {
		query = query.Where("parent_module_id = ?", moduleID)
	}

	query.Order("position ASC").Find(&subModules)

	c.JSON(http.StatusOK, subModules)
}

// GetSubModule returns a specific sub-module
func GetSubModule(c *gin.Context) {
	subModuleID := c.Param("sub_module_id")

	subModuleUUID, err := uuid.Parse(subModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub-module ID"})
		return
	}

	var subModule models.SubModule
	if err := database.DB.Preload("ParentModule").Preload("DataTable").First(&subModule, subModuleUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub-module not found"})
		return
	}

	c.JSON(http.StatusOK, subModule)
}

// CreateSubModule creates a new sub-module
func CreateSubModule(c *gin.Context) {
	hubID := c.Param("hub_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	var input models.CreateSubModuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr)

	// Verify hub exists
	var hub models.Table
	if err := database.DB.First(&hub, hubUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hub not found"})
		return
	}

	// Verify module is enabled for this hub
	var moduleConfig models.HubModuleConfig
	if err := database.DB.Where("table_id = ? AND module_id = ? AND is_enabled = true", hubUUID, input.ParentModuleID).First(&moduleConfig).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Module is not enabled for this hub"})
		return
	}

	// Generate slug if not provided
	subModuleSlug := input.Slug
	if subModuleSlug == "" {
		subModuleSlug = slug.Make(input.Name)
	}

	// Get next position
	var maxPosition int
	database.DB.Model(&models.SubModule{}).
		Where("hub_id = ? AND parent_module_id = ?", hubUUID, input.ParentModuleID).
		Select("COALESCE(MAX(position), 0)").
		Scan(&maxPosition)

	filterConfigJSON, _ := json.Marshal(input.FilterConfig)
	settingsJSON, _ := json.Marshal(input.Settings)

	subModule := models.SubModule{
		ParentModuleID:  input.ParentModuleID,
		HubID:           hubUUID,
		Name:            input.Name,
		Slug:            subModuleSlug,
		Description:     input.Description,
		Icon:            input.Icon,
		UsesParentTable: input.UsesParentTable,
		FilterConfig:    filterConfigJSON,
		Settings:        settingsJSON,
		IsEnabled:       true,
		Position:        maxPosition + 1,
		CreatedBy:       &userID,
	}

	// If not using parent table, create a dedicated table
	if !input.UsesParentTable {
		dataTable := models.Table{
			WorkspaceID: hub.WorkspaceID,
			Name:        input.Name,
			Slug:        subModuleSlug + "-data",
			Description: "Data table for " + input.Name,
			CreatedBy:   userID,
		}
		if err := database.DB.Create(&dataTable).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create data table"})
			return
		}
		subModule.DataTableID = &dataTable.ID
	}

	if err := database.DB.Create(&subModule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, subModule)
}

// UpdateSubModule updates a sub-module
func UpdateSubModule(c *gin.Context) {
	subModuleID := c.Param("sub_module_id")

	subModuleUUID, err := uuid.Parse(subModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub-module ID"})
		return
	}

	var subModule models.SubModule
	if err := database.DB.First(&subModule, subModuleUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub-module not found"})
		return
	}

	var input models.UpdateSubModuleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		subModule.Name = *input.Name
	}
	if input.Description != nil {
		subModule.Description = *input.Description
	}
	if input.Icon != nil {
		subModule.Icon = *input.Icon
	}
	if input.IsEnabled != nil {
		subModule.IsEnabled = *input.IsEnabled
	}
	if input.Position != nil {
		subModule.Position = *input.Position
	}
	if input.FilterConfig != nil {
		filterJSON, _ := json.Marshal(*input.FilterConfig)
		subModule.FilterConfig = filterJSON
	}
	if input.Settings != nil {
		settingsJSON, _ := json.Marshal(*input.Settings)
		subModule.Settings = settingsJSON
	}

	if err := database.DB.Save(&subModule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, subModule)
}

// DeleteSubModule deletes a sub-module
func DeleteSubModule(c *gin.Context) {
	subModuleID := c.Param("sub_module_id")

	subModuleUUID, err := uuid.Parse(subModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub-module ID"})
		return
	}

	var subModule models.SubModule
	if err := database.DB.First(&subModule, subModuleUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub-module not found"})
		return
	}

	// Delete associated data table if it exists
	if subModule.DataTableID != nil {
		database.DB.Delete(&models.Table{}, subModule.DataTableID)
	}

	if err := database.DB.Delete(&subModule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ReorderSubModules reorders sub-modules
func ReorderSubModules(c *gin.Context) {
	hubID := c.Param("hub_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	var input struct {
		SubModuleIDs []string `json:"sub_module_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update positions
	for i, idStr := range input.SubModuleIDs {
		id, _ := uuid.Parse(idStr)
		database.DB.Model(&models.SubModule{}).
			Where("id = ? AND hub_id = ?", id, hubUUID).
			Update("position", i)
	}

	// Return updated list
	var subModules []models.SubModule
	database.DB.Where("hub_id = ?", hubUUID).Order("position ASC").Find(&subModules)

	c.JSON(http.StatusOK, subModules)
}

// ============================================================
// MODULE FIELD HANDLERS
// ============================================================

// GetModuleFields returns field configurations for a module
func GetModuleFields(c *gin.Context) {
	moduleID := c.Param("module_id")

	var fieldConfigs []models.ModuleFieldConfig
	database.DB.Where("module_id = ?", moduleID).
		Preload("FieldType").
		Order("display_order ASC").
		Find(&fieldConfigs)

	// Also get system fields for this module
	var systemFields []models.FieldTypeRegistry
	database.DB.Where("module_id = ? AND is_system_field = true", moduleID).Find(&systemFields)

	// Get module info
	var module models.ModuleDefinition
	database.DB.First(&module, "id = ?", moduleID)

	c.JSON(http.StatusOK, models.ModuleFieldsResponse{
		ModuleID:     moduleID,
		ModuleName:   module.Name,
		Fields:       fieldConfigs,
		SystemFields: systemFields,
	})
}

// GetHubModulesWithFields returns enabled modules with their field configs
func GetHubModulesWithFields(c *gin.Context) {
	hubID := c.Param("hub_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	// Get hub with hub_type
	var hub models.Table
	if err := database.DB.First(&hub, hubUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hub not found"})
		return
	}

	// Get hub type from settings
	var settings map[string]interface{}
	json.Unmarshal(hub.Settings, &settings)
	hubType, _ := settings["hub_type"].(string)
	if hubType == "" {
		hubType = "data"
	}

	// Get enabled modules with configs
	var enabledConfigs []models.HubModuleConfig
	database.DB.Where("table_id = ? AND is_enabled = true", hubUUID).
		Preload("Module").
		Find(&enabledConfigs)

	enabledModules := make([]models.ModuleWithFields, 0)
	for _, config := range enabledConfigs {
		if config.Module == nil {
			continue
		}

		// Get field configs for this module
		var fieldConfigs []models.ModuleFieldConfig
		database.DB.Where("module_id = ?", config.ModuleID).
			Preload("FieldType").
			Order("display_order ASC").
			Find(&fieldConfigs)

		// Get sub-modules
		var subModules []models.SubModule
		database.DB.Where("hub_id = ? AND parent_module_id = ? AND is_enabled = true", hubUUID, config.ModuleID).
			Order("position ASC").
			Find(&subModules)

		// Get history settings
		var historySettings models.ModuleHistorySettings
		database.DB.Where("hub_module_config_id = ?", config.ID).First(&historySettings)

		mwf := models.ModuleWithFields{
			ModuleWithStatus: models.ModuleWithStatus{
				ModuleDefinition: *config.Module,
				IsEnabled:        config.IsEnabled,
				Settings:         config.Settings,
			},
			Fields:     fieldConfigs,
			SubModules: subModules,
		}
		if historySettings.ID != uuid.Nil {
			mwf.HistorySettings = &historySettings
		}

		enabledModules = append(enabledModules, mwf)
	}

	// Get available (not enabled) modules for this hub type
	var allModules []models.ModuleDefinition
	database.DB.Find(&allModules)

	enabledModuleIDs := make(map[string]bool)
	for _, config := range enabledConfigs {
		enabledModuleIDs[config.ModuleID] = true
	}

	availableModules := make([]models.ModuleWithStatus, 0)
	for _, mod := range allModules {
		if enabledModuleIDs[mod.ID] {
			continue
		}
		if !mod.IsModuleAvailable(hubType) {
			continue
		}
		availableModules = append(availableModules, models.ModuleWithStatus{
			ModuleDefinition: mod,
			IsEnabled:        false,
		})
	}

	// Get sub-modules
	var allSubModules []models.SubModule
	database.DB.Where("hub_id = ?", hubUUID).
		Order("parent_module_id, position ASC").
		Find(&allSubModules)

	subModulesWithData := make([]models.SubModuleWithData, len(allSubModules))
	for i, sm := range allSubModules {
		subModulesWithData[i] = models.SubModuleWithData{
			SubModule: sm,
		}
		// Get row count if has data table
		if sm.DataTableID != nil {
			var count int64
			database.DB.Model(&models.Row{}).Where("table_id = ?", sm.DataTableID).Count(&count)
			subModulesWithData[i].RowCount = int(count)
		}
	}

	c.JSON(http.StatusOK, models.HubModulesWithFieldsResponse{
		TableID:          hubUUID,
		HubType:          hubType,
		EnabledModules:   enabledModules,
		AvailableModules: availableModules,
		SubModules:       subModulesWithData,
	})
}

// ============================================================
// MODULE HISTORY SETTINGS HANDLERS
// ============================================================

// GetModuleHistorySettings returns history settings for a module config
func GetModuleHistorySettings(c *gin.Context) {
	configID := c.Param("config_id")

	configUUID, err := uuid.Parse(configID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	var settings models.ModuleHistorySettings
	if err := database.DB.Where("hub_module_config_id = ?", configUUID).First(&settings).Error; err != nil {
		// Return empty settings if not found
		c.JSON(http.StatusOK, gin.H{
			"hub_module_config_id": configID,
			"using_table_defaults": true,
		})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateModuleHistorySettings updates history settings for a module config
func UpdateModuleHistorySettings(c *gin.Context) {
	configID := c.Param("config_id")

	configUUID, err := uuid.Parse(configID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	// Verify config exists
	var config models.HubModuleConfig
	if err := database.DB.First(&config, configUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Module config not found"})
		return
	}

	var input struct {
		TrackChanges         *bool    `json:"track_changes"`
		RequireChangeReason  *bool    `json:"require_change_reason"`
		VersionRetentionDays *int     `json:"version_retention_days"`
		RequireApproval      *bool    `json:"require_approval"`
		ApprovalType         string   `json:"approval_type"`
		SpecificApprovers    []string `json:"specific_approvers"`
		EnableAISuggestions  *bool    `json:"enable_ai_suggestions"`
		AutoApplyThreshold   *float64 `json:"auto_apply_threshold"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find or create settings
	var settings models.ModuleHistorySettings
	result := database.DB.Where("hub_module_config_id = ?", configUUID).First(&settings)
	if result.Error != nil {
		settings = models.ModuleHistorySettings{
			HubModuleConfigID: configUUID,
		}
	}

	// Update fields
	settings.TrackChanges = input.TrackChanges
	settings.RequireChangeReason = input.RequireChangeReason
	settings.VersionRetentionDays = input.VersionRetentionDays
	settings.RequireApproval = input.RequireApproval
	settings.ApprovalType = input.ApprovalType
	settings.EnableAISuggestions = input.EnableAISuggestions
	settings.AutoApplyThreshold = input.AutoApplyThreshold

	// Parse specific approvers
	if len(input.SpecificApprovers) > 0 {
		approvers := make([]uuid.UUID, len(input.SpecificApprovers))
		for i, a := range input.SpecificApprovers {
			approvers[i], _ = uuid.Parse(a)
		}
		settings.SpecificApprovers = approvers
	}

	if err := database.DB.Save(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// ============================================================
// EXTENDED MODULE HANDLERS
// ============================================================

// EnableModuleWithFields enables a module and auto-creates its fields
func EnableModuleWithFields(c *gin.Context) {
	hubID := c.Param("hub_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	var input struct {
		ModuleID         string                 `json:"module_id" binding:"required"`
		Settings         map[string]interface{} `json:"settings"`
		AutoCreateFields bool                   `json:"auto_create_fields"`
		HistorySettings  *struct {
			TrackChanges        *bool `json:"track_changes"`
			RequireChangeReason *bool `json:"require_change_reason"`
			RequireApproval     *bool `json:"require_approval"`
		} `json:"history_settings"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr)

	// Verify module exists and is available for this hub type
	var module models.ModuleDefinition
	if err := database.DB.First(&module, "id = ?", input.ModuleID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Module not found"})
		return
	}

	// Get hub type
	var hub models.Table
	if err := database.DB.First(&hub, hubUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hub not found"})
		return
	}

	var settings map[string]interface{}
	json.Unmarshal(hub.Settings, &settings)
	hubType, _ := settings["hub_type"].(string)
	if hubType == "" {
		hubType = "data"
	}

	if !module.IsModuleAvailable(hubType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Module not available for this hub type"})
		return
	}

	// Check dependencies
	var enabledConfigs []models.HubModuleConfig
	database.DB.Where("table_id = ? AND is_enabled = true", hubUUID).Find(&enabledConfigs)
	enabledIDs := models.GetEnabledModuleIDs(enabledConfigs)

	if !models.CanEnableModule(&module, enabledIDs) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Module dependencies not satisfied"})
		return
	}

	// Create or update module config
	settingsJSON, _ := json.Marshal(input.Settings)
	config := models.HubModuleConfig{
		TableID:   hubUUID,
		ModuleID:  input.ModuleID,
		IsEnabled: true,
		Settings:  settingsJSON,
		EnabledBy: &userID,
	}

	result := database.DB.Where("table_id = ? AND module_id = ?", hubUUID, input.ModuleID).
		Assign(map[string]interface{}{
			"is_enabled": true,
			"settings":   settingsJSON,
			"enabled_by": userID,
		}).
		FirstOrCreate(&config)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Auto-create fields if requested (trigger will handle this via database)
	// The database trigger auto_create_module_fields will fire

	// Create history settings if provided
	if input.HistorySettings != nil {
		histSettings := models.ModuleHistorySettings{
			HubModuleConfigID:   config.ID,
			TrackChanges:        input.HistorySettings.TrackChanges,
			RequireChangeReason: input.HistorySettings.RequireChangeReason,
			RequireApproval:     input.HistorySettings.RequireApproval,
		}
		database.DB.Create(&histSettings)
	}

	// Return full module info
	var fieldConfigs []models.ModuleFieldConfig
	database.DB.Where("module_id = ?", input.ModuleID).
		Preload("FieldType").
		Find(&fieldConfigs)

	c.JSON(http.StatusOK, models.ModuleWithFields{
		ModuleWithStatus: models.ModuleWithStatus{
			ModuleDefinition: module,
			IsEnabled:        true,
			Settings:         settingsJSON,
		},
		Fields: fieldConfigs,
	})
}

// GetSubModuleRows returns rows for a sub-module (filtered or from dedicated table)
func GetSubModuleRows(c *gin.Context) {
	subModuleID := c.Param("sub_module_id")

	subModuleUUID, err := uuid.Parse(subModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub-module ID"})
		return
	}

	var subModule models.SubModule
	if err := database.DB.First(&subModule, subModuleUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub-module not found"})
		return
	}

	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	offset := (page - 1) * pageSize

	var rows []models.Row
	var total int64
	var tableID uuid.UUID

	if subModule.UsesParentTable {
		// Use parent hub's table with filter
		tableID = subModule.HubID

		// Parse filter config
		var filterConfig map[string]interface{}
		json.Unmarshal(subModule.FilterConfig, &filterConfig)

		query := database.DB.Model(&models.Row{}).Where("table_id = ?", tableID)

		// Apply filters from filter_config
		// This is a simplified version - you might need more complex filtering
		for field, value := range filterConfig {
			query = query.Where("data->>? = ?", field, value)
		}

		query.Count(&total)
		query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&rows)
	} else if subModule.DataTableID != nil {
		// Use dedicated data table
		tableID = *subModule.DataTableID

		database.DB.Model(&models.Row{}).Where("table_id = ?", tableID).Count(&total)
		database.DB.Where("table_id = ?", tableID).
			Offset(offset).Limit(pageSize).
			Order("created_at DESC").
			Find(&rows)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sub-module has no data source"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sub_module_id": subModuleID,
		"table_id":      tableID,
		"rows":          rows,
		"total":         total,
		"page":          page,
		"page_size":     pageSize,
	})
}
