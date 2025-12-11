-- Fresh Start Schema for Matic Platform
-- Simplified for Applications Hub + Data Hub only
-- Drop all existing tables first, then create new clean schema

-- ==================== DROP ALL TABLES ====================
DROP TABLE IF EXISTS cascade (
  sent_emails,
  email_campaigns,
  email_templates,
  email_signatures,
  gmail_connections,
  tag_automations,
  search_analytics,
  search_index,
  embedding_queue,
  batch_operations,
  stage_actions,
  workflow_actions,
  stage_reviewer_configs,
  reviewer_types,
  rubrics,
  review_workflows,
  stage_groups,
  application_stages,
  application_groups,
  change_approvals,
  change_requests,
  portal_applicants,
  table_row_links,
  table_links,
  table_views,
  table_files,
  table_rows,
  table_fields,
  data_tables,
  field_changes,
  row_versions,
  ai_field_suggestions,
  field_type_registry,
  semantic_field_types,
  entity_types,
  metadata_schema,
  module_history_settings,
  module_field_configs,
  module_definitions,
  hub_module_configs,
  sub_modules,
  custom_tags,
  custom_statuses,
  organization_members,
  workspace_members,
  organizations,
  workspaces
);

-- ==================== CORE SCHEMA ====================

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  avatar_url VARCHAR(512),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces (organization containers)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Users (Supabase Auth integration)
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- admin, editor, viewer, member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ==================== APPLICATIONS HUB ====================

-- Forms (applications)
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255),
  is_published BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}', -- Portal config (sections, settings, translations)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

-- Form Submissions (applicants)
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_data JSONB NOT NULL, -- Flattened form responses
  submitted_by UUID, -- User ID or portal applicant email
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  review_status VARCHAR(50) DEFAULT 'pending', -- pending, in_review, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portal Applicants (public portal users)
CREATE TABLE portal_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  submission_data JSONB DEFAULT '{}',
  submission_status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, in_review, approved, rejected
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_id, email)
);

-- Review Workflows
CREATE TABLE review_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}', -- Stages, reviewers, logic
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review Stages
CREATE TABLE application_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stage_order INT NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviewer Types (e.g., Academic, Community)
CREATE TABLE reviewer_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submission Reviews
CREATE TABLE submission_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL, -- User ID
  reviewer_type_id UUID REFERENCES reviewer_types(id),
  score NUMERIC,
  feedback JSONB, -- Structured feedback per field
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, returned
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Statuses (for submissions, e.g., "Waitlisted", "Interview Scheduled")
CREATE TABLE custom_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== DATA HUB ====================

-- Data Tables
CREATE TABLE data_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255),
  icon VARCHAR(50),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

-- Table Columns (Fields)
CREATE TABLE table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- text, email, number, select, date, etc.
  position INT NOT NULL,
  config JSONB DEFAULT '{}', -- Field-specific settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Rows (Records)
CREATE TABLE table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  row_data JSONB NOT NULL, -- Column ID -> Value mapping
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row History/Versions
CREATE TABLE row_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  row_data JSONB NOT NULL,
  changed_by UUID,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(row_id, version_number)
);

-- Table Views
CREATE TABLE table_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  view_type VARCHAR(50) DEFAULT 'grid', -- grid, kanban, calendar, etc.
  config JSONB DEFAULT '{}', -- Filters, sorts, grouping
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Links (Relations)
CREATE TABLE table_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  target_table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  link_name VARCHAR(255),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Links (Linked records)
CREATE TABLE table_row_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  target_row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES table_links(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_row_id, target_row_id, link_id)
);

-- ==================== SUPPORT TABLES ====================

-- Field Type Registry (supported field types)
CREATE TABLE field_type_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  description TEXT,
  config_schema JSONB, -- JSON schema for field config
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(512) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX idx_workspaces_organization_id ON workspaces(organization_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_forms_workspace_id ON forms(workspace_id);
CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_portal_applicants_form_id ON portal_applicants(form_id);
CREATE INDEX idx_review_workflows_workspace_id ON review_workflows(workspace_id);
CREATE INDEX idx_application_stages_workflow_id ON application_stages(workflow_id);
CREATE INDEX idx_reviewer_types_workspace_id ON reviewer_types(workspace_id);
CREATE INDEX idx_submission_reviews_submission_id ON submission_reviews(submission_id);
CREATE INDEX idx_custom_statuses_workspace_id ON custom_statuses(workspace_id);
CREATE INDEX idx_data_tables_workspace_id ON data_tables(workspace_id);
CREATE INDEX idx_table_fields_table_id ON table_fields(table_id);
CREATE INDEX idx_table_rows_table_id ON table_rows(table_id);
CREATE INDEX idx_row_versions_row_id ON row_versions(row_id);
CREATE INDEX idx_table_views_table_id ON table_views(table_id);
CREATE INDEX idx_table_links_source_table ON table_links(source_table_id);
CREATE INDEX idx_table_row_links_source_row ON table_row_links(source_row_id);
CREATE INDEX idx_files_workspace_id ON files(workspace_id);

-- ==================== DEFAULT FIELD TYPES ====================
INSERT INTO field_type_registry (type_name, display_name, description) VALUES
  ('text', 'Text', 'Short text field'),
  ('textarea', 'Long Text', 'Multi-line text field'),
  ('email', 'Email', 'Email address field'),
  ('phone', 'Phone', 'Phone number field'),
  ('number', 'Number', 'Numeric field'),
  ('currency', 'Currency', 'Currency field'),
  ('percent', 'Percent', 'Percentage field'),
  ('date', 'Date', 'Date field'),
  ('time', 'Time', 'Time field'),
  ('datetime', 'Date & Time', 'Date and time field'),
  ('select', 'Select', 'Single select field'),
  ('multiselect', 'Multi-select', 'Multiple select field'),
  ('checkbox', 'Checkbox', 'Boolean/checkbox field'),
  ('radio', 'Radio', 'Radio button field'),
  ('rating', 'Rating', 'Star rating field'),
  ('url', 'URL', 'URL field'),
  ('file', 'File', 'File upload field'),
  ('image', 'Image', 'Image upload field'),
  ('signature', 'Signature', 'Digital signature field'),
  ('address', 'Address', 'Address field'),
  ('heading', 'Heading', 'Section heading'),
  ('paragraph', 'Paragraph', 'Text content'),
  ('divider', 'Divider', 'Visual divider'),
  ('spacer', 'Spacer', 'Vertical space'),
  ('callout', 'Callout', 'Callout box')
ON CONFLICT DO NOTHING;
