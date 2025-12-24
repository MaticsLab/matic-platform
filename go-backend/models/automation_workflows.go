package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// AutomationWorkflow represents a visual automation workflow (like Zapier/Make)
type AutomationWorkflow struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Nodes       datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"nodes"`
	Edges       datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"edges"`
	Visibility  string         `gorm:"type:varchar(20);not null;default:'private'" json:"visibility"` // private, public, workspace
	TriggerType string         `gorm:"type:varchar(50);default:'manual'" json:"trigger_type"`         // manual, webhook, schedule, form_submission, row_created, row_updated
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Workspace  *Workspace                    `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	Executions []AutomationWorkflowExecution `gorm:"foreignKey:WorkflowID" json:"executions,omitempty"`
}

func (AutomationWorkflow) TableName() string {
	return "automation_workflows"
}

// AutomationWorkflowExecution represents a single execution of an automation workflow
type AutomationWorkflowExecution struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkflowID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"workflow_id"`
	UserID      *uuid.UUID     `gorm:"type:uuid;index" json:"user_id"`
	Status      string         `gorm:"type:varchar(20);not null;default:'pending'" json:"status"` // pending, running, completed, failed, cancelled
	TriggerType string         `gorm:"type:varchar(50)" json:"trigger_type"`
	TriggerData datatypes.JSON `gorm:"type:jsonb" json:"trigger_data"`
	Output      datatypes.JSON `gorm:"type:jsonb" json:"output"`
	Error       string         `gorm:"type:text" json:"error"`
	StartedAt   *time.Time     `json:"started_at"`
	CompletedAt *time.Time     `json:"completed_at"`
	Duration    int64          `json:"duration"` // milliseconds
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Workflow *AutomationWorkflow              `gorm:"foreignKey:WorkflowID" json:"workflow,omitempty"`
	Logs     []AutomationWorkflowExecutionLog `gorm:"foreignKey:ExecutionID" json:"logs,omitempty"`
}

func (AutomationWorkflowExecution) TableName() string {
	return "automation_workflow_executions"
}

// AutomationWorkflowExecutionLog represents a log entry for a workflow execution step
type AutomationWorkflowExecutionLog struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ExecutionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"execution_id"`
	NodeID      string         `gorm:"type:varchar(100);not null" json:"node_id"`
	NodeType    string         `gorm:"type:varchar(50)" json:"node_type"`
	NodeLabel   string         `gorm:"type:varchar(255)" json:"node_label"`
	Status      string         `gorm:"type:varchar(20);not null" json:"status"` // pending, running, completed, failed, skipped
	Input       datatypes.JSON `gorm:"type:jsonb" json:"input"`
	Output      datatypes.JSON `gorm:"type:jsonb" json:"output"`
	Error       string         `gorm:"type:text" json:"error"`
	StartedAt   *time.Time     `json:"started_at"`
	CompletedAt *time.Time     `json:"completed_at"`
	Duration    int64          `json:"duration"` // milliseconds
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Execution *AutomationWorkflowExecution `gorm:"foreignKey:ExecutionID" json:"execution,omitempty"`
}

func (AutomationWorkflowExecutionLog) TableName() string {
	return "automation_workflow_execution_logs"
}

// AutomationIntegration represents a user's integration credentials for automations
type AutomationIntegration struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Type        string         `gorm:"type:varchar(50);not null" json:"type"` // slack, stripe, resend, database, openai, etc.
	Config      datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"config"`
	IsManaged   bool           `gorm:"default:false" json:"is_managed"` // OAuth managed vs manual entry
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Workspace *Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
}

func (AutomationIntegration) TableName() string {
	return "automation_integrations"
}

// Request/Response types for API

// CreateAutomationWorkflowRequest represents the request body for creating an automation workflow
type CreateAutomationWorkflowRequest struct {
	Name        string      `json:"name" binding:"required"`
	Description string      `json:"description"`
	Nodes       interface{} `json:"nodes" binding:"required"`
	Edges       interface{} `json:"edges" binding:"required"`
	TriggerType string      `json:"trigger_type"`
	Visibility  string      `json:"visibility"`
}

// UpdateAutomationWorkflowRequest represents the request body for updating an automation workflow
type UpdateAutomationWorkflowRequest struct {
	Name        *string     `json:"name"`
	Description *string     `json:"description"`
	Nodes       interface{} `json:"nodes"`
	Edges       interface{} `json:"edges"`
	TriggerType *string     `json:"trigger_type"`
	Visibility  *string     `json:"visibility"`
	IsActive    *bool       `json:"is_active"`
}

// ExecuteAutomationWorkflowRequest represents the request to execute a workflow
type ExecuteAutomationWorkflowRequest struct {
	TriggerType string                 `json:"trigger_type"`
	TriggerData map[string]interface{} `json:"trigger_data"`
}

// AutomationWorkflowResponse represents the API response for a workflow
type AutomationWorkflowResponse struct {
	ID          uuid.UUID   `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	WorkspaceID uuid.UUID   `json:"workspace_id"`
	UserID      uuid.UUID   `json:"user_id"`
	Nodes       interface{} `json:"nodes"`
	Edges       interface{} `json:"edges"`
	Visibility  string      `json:"visibility"`
	TriggerType string      `json:"trigger_type"`
	IsActive    bool        `json:"is_active"`
	IsOwner     bool        `json:"is_owner"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}
