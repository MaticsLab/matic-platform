/**
 * Types for APITable-inspired submission views
 */

export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery';

export interface Submission {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  status: string;
  submittedDate: string;
  raw_data: Record<string, any>;
  reviewedCount?: number;
  totalReviewers?: number;
  applicant_name?: string;
  applicant_email?: string;
  form_name?: string;
  submitted_at?: string;
  documents?: { name: string; url: string; type: string }[];
}

export interface FormField {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: any;
  validation?: any;
}

export interface ViewConfig {
  type: ViewType;
  groupBy?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  hiddenFields?: string[];
  filters?: FilterConfig[];
}

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'between';
  value: any;
}

export interface ColumnConfig {
  field: string;
  label: string;
  width?: number;
  visible: boolean;
  frozen?: boolean;
}
