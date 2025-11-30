// Request Hub System Types
// Adapted from request hub example

export type RequestStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Denied' | 'Completed';

export type UserRole = 'staff' | 'supervisor' | 'program_director' | 'finance' | 'admin' | 'transportation' | 'editor' | 'viewer';

export type ApprovalAction = 'approve' | 'deny' | 'request_changes' | 'forward' | 'pending';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'file' | 'item_list' | 'email' | 'phone' | 'url' | 'address' | 'group' | 'repeater';

// User Types
export interface RequestUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

// Request Types
export interface Request {
  id: string;
  hub_id: string;
  staff_user_id: string;
  request_type: string;
  status: RequestStatus;
  submitted_date: string;
  completed_date?: string;
  priority: 'low' | 'medium' | 'high';
  current_step: number;
  workflow_instance_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RequestDetail {
  id: string;
  request_id: string;
  field_key: string;
  field_value: string;
}

// Form Types
export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  defaultValue?: any;
  helpText?: string;
  subFields?: FormField[];
}

export interface FormTemplate {
  id: string;
  hub_id: string;
  request_type: string;
  name: string;
  description: string;
  fields: FormField[];
  workflow_template_id?: string;
  created_at: string;
  updated_at: string;
}

// Workflow Types
export interface WorkflowStep {
  step_number: number;
  name: string;
  approver_roles: UserRole[];
  required_approvals: number; // For parallel approval
  timeout_hours?: number;
  conditions?: {
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
    value: string | number;
  }[];
  next_step?: number | 'conditional';
}

export interface WorkflowTemplate {
  id: string;
  hub_id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  request_id: string;
  workflow_template_id: string;
  current_step: number;
  status: 'active' | 'completed' | 'cancelled';
  approval_history: ApprovalActionRecord[];
  created_at: string;
  updated_at: string;
}

export interface ApprovalActionRecord {
  id: string;
  request_id: string;
  workflow_instance_id: string;
  approver_id: string;
  step_number: number;
  action: ApprovalAction;
  comments?: string;
  timestamp: string;
}

// Attachment Types
export interface Attachment {
  id: string;
  request_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
  url: string;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  request_id: string;
  type: 'status_change' | 'approval_needed' | 'escalation' | 'completion' | 'comment';
  message: string;
  read: boolean;
  created_at: string;
}

// Analytics Types
export interface RequestMetrics {
  total_requests: number;
  pending_approvals: number;
  average_approval_time: number; // in hours
  approval_rate: number; // percentage
  denial_rate: number; // percentage
}

export interface RequestsByType {
  request_type: string;
  count: number;
}

export interface RequestsByStatus {
  status: RequestStatus;
  count: number;
}

export interface RequestTrend {
  date: string;
  count: number;
}

// Item List Type (for complex fields like budget items)
export interface ItemListItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  category?: string;
}
