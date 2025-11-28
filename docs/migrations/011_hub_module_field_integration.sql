-- =====================================================
-- MIGRATION 011: HUB & MODULE INTEGRATION WITH UNIVERSAL FIELD SYSTEM
-- =====================================================
-- This migration connects the Universal Field System (field_type_registry, 
-- row_versions, etc.) with the Hub/Module architecture for a unified system.
--
-- Key integrations:
-- 1. Module-specific field types (e.g., attendance, pulse scan result)
-- 2. Per-module version tracking settings
-- 3. AI suggestions per module context
-- 4. Sub-module configuration and data isolation
-- =====================================================

-- =====================================================
-- PHASE 1: EXTEND FIELD TYPE REGISTRY FOR MODULES
-- =====================================================

-- Add module context to field type registry
ALTER TABLE field_type_registry 
ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES module_definitions(id),
ADD COLUMN IF NOT EXISTS is_system_field BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_field_type TEXT REFERENCES field_type_registry(id);

COMMENT ON COLUMN field_type_registry.module_id IS 'Which module this field type belongs to (null = universal)';
COMMENT ON COLUMN field_type_registry.is_system_field IS 'System fields are auto-created and cannot be deleted';
COMMENT ON COLUMN field_type_registry.parent_field_type IS 'For inheritance - base field type this extends';

-- Insert module-specific field types
INSERT INTO field_type_registry (id, category, label, description, module_id, is_system_field, input_schema, storage_schema, config_schema, is_container, is_searchable, is_sortable, is_filterable, is_editable, supports_pii, ai_schema, track_changes, require_reason)
VALUES
  -- Pulse module fields
  ('scan_result', 'special', 'Scan Result', 'Barcode/QR scan result for check-in', 'pulse', true,
   '{"type": "object", "properties": {"barcode": {"type": "string"}, "scan_type": {"type": "string", "enum": ["check_in", "check_out"]}}}',
   '{"type": "object", "properties": {"barcode": {"type": "string"}, "scan_type": {"type": "string"}, "scanned_at": {"type": "string", "format": "date-time"}, "scanner_id": {"type": "string"}}}',
   '{"allowed_scan_types": ["check_in", "check_out"], "auto_checkout_hours": 8}',
   false, true, true, true, false, false,
   '{"embedding_strategy": "value_only", "privacy_level": "public"}', true, false),
  
  ('attendance_status', 'special', 'Attendance Status', 'Attendance tracking status', 'attendance', true,
   '{"type": "string", "enum": ["present", "absent", "late", "excused"]}',
   '{"type": "object", "properties": {"status": {"type": "string"}, "check_in_time": {"type": "string"}, "check_out_time": {"type": "string"}, "duration_minutes": {"type": "number"}}}',
   '{"auto_calculate_duration": true, "late_threshold_minutes": 15}',
   false, true, true, true, true, false,
   '{"embedding_strategy": "value_only", "privacy_level": "public"}', true, false),
  
  -- Review workflow fields
  ('review_score', 'special', 'Review Score', 'Rubric-based review score', 'review_workflow', true,
   '{"type": "object", "properties": {"score": {"type": "number"}, "max_score": {"type": "number"}, "rubric_id": {"type": "string"}}}',
   '{"type": "object", "properties": {"score": {"type": "number"}, "max_score": {"type": "number"}, "rubric_id": {"type": "string"}, "criteria_scores": {"type": "object"}}}',
   '{"rubric_id": "string", "weight": 1}',
   false, true, true, true, false, false,
   '{"embedding_strategy": "value_only", "privacy_level": "sensitive"}', true, true),
  
  ('stage_status', 'special', 'Stage Status', 'Application stage status', 'review_workflow', true,
   '{"type": "string", "enum": ["pending", "in_review", "approved", "rejected", "waitlisted"]}',
   '{"type": "object", "properties": {"status": {"type": "string"}, "stage_id": {"type": "string"}, "moved_at": {"type": "string"}, "moved_by": {"type": "string"}}}',
   '{"allowed_statuses": ["pending", "in_review", "approved", "rejected", "waitlisted"]}',
   false, true, true, true, true, false,
   '{"embedding_strategy": "value_only", "privacy_level": "sensitive"}', true, true),
  
  ('reviewer_assignment', 'special', 'Reviewer Assignment', 'Assigned reviewers for an application', 'review_workflow', true,
   '{"type": "array", "items": {"type": "object", "properties": {"reviewer_id": {"type": "string"}, "role": {"type": "string"}}}}',
   '{"type": "array", "items": {"type": "object", "properties": {"reviewer_id": {"type": "string"}, "reviewer_type_id": {"type": "string"}, "assigned_at": {"type": "string"}, "completed_at": {"type": "string"}}}}',
   '{"max_reviewers": 5, "required_reviewer_types": []}',
   false, true, false, true, true, false,
   '{"embedding_strategy": "skip", "privacy_level": "sensitive"}', true, false),
  
  -- Rubrics fields
  ('rubric_response', 'special', 'Rubric Response', 'Response to a rubric criteria', 'rubrics', true,
   '{"type": "object", "properties": {"criteria_id": {"type": "string"}, "score": {"type": "number"}, "comment": {"type": "string"}}}',
   '{"type": "object", "properties": {"criteria_id": {"type": "string"}, "score": {"type": "number"}, "max_score": {"type": "number"}, "comment": {"type": "string"}, "scored_at": {"type": "string"}, "scored_by": {"type": "string"}}}',
   '{"show_comments": true, "require_comments_for_low_scores": true}',
   false, true, true, true, true, false,
   '{"embedding_strategy": "with_label", "privacy_level": "sensitive"}', true, true),
  
  -- Calendar integration fields
  ('calendar_event', 'special', 'Calendar Event', 'Linked calendar event', 'calendar', true,
   '{"type": "object", "properties": {"title": {"type": "string"}, "start": {"type": "string"}, "end": {"type": "string"}}}',
   '{"type": "object", "properties": {"provider": {"type": "string"}, "external_id": {"type": "string"}, "title": {"type": "string"}, "start": {"type": "string"}, "end": {"type": "string"}, "synced_at": {"type": "string"}}}',
   '{"provider": "google", "sync_enabled": true}',
   false, true, true, true, true, false,
   '{"embedding_strategy": "with_label", "privacy_level": "public"}', false, false)
   
ON CONFLICT (id) DO UPDATE SET
  module_id = EXCLUDED.module_id,
  is_system_field = EXCLUDED.is_system_field,
  description = EXCLUDED.description;

-- =====================================================
-- PHASE 2: SUB-MODULES TABLE
-- =====================================================

-- Sub-modules allow modules to have child modules with their own tables
CREATE TABLE IF NOT EXISTS sub_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_module_id TEXT NOT NULL REFERENCES module_definitions(id),
  hub_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  -- Data storage
  data_table_id UUID REFERENCES data_tables(id) ON DELETE SET NULL, -- Optional dedicated table
  uses_parent_table BOOLEAN DEFAULT true, -- If true, uses hub's main table with filtered view
  filter_config JSONB DEFAULT '{}', -- Filter to apply when using parent table
  
  -- Configuration
  settings JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  position INT DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hub_id, parent_module_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sub_modules_hub ON sub_modules(hub_id);
CREATE INDEX IF NOT EXISTS idx_sub_modules_parent ON sub_modules(parent_module_id);
CREATE INDEX IF NOT EXISTS idx_sub_modules_data_table ON sub_modules(data_table_id);

COMMENT ON TABLE sub_modules IS 'Child modules within a parent module (e.g., Events within Attendance module)';

-- =====================================================
-- PHASE 3: MODULE FIELD CONFIGS
-- =====================================================

-- Define which fields are required/optional per module
CREATE TABLE IF NOT EXISTS module_field_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id TEXT NOT NULL REFERENCES module_definitions(id),
  field_type_id TEXT NOT NULL REFERENCES field_type_registry(id),
  
  is_required BOOLEAN DEFAULT false,
  is_auto_created BOOLEAN DEFAULT false, -- Auto-create when module is enabled
  default_config JSONB DEFAULT '{}',
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(module_id, field_type_id)
);

CREATE INDEX IF NOT EXISTS idx_module_field_configs_module ON module_field_configs(module_id);

-- Seed module field configurations
INSERT INTO module_field_configs (module_id, field_type_id, is_required, is_auto_created, display_order) VALUES
  -- Pulse module requires scan_result
  ('pulse', 'scan_result', true, true, 1),
  ('pulse', 'datetime', true, true, 2),
  
  -- Attendance module
  ('attendance', 'attendance_status', true, true, 1),
  ('attendance', 'scan_result', false, false, 2),
  
  -- Review workflow
  ('review_workflow', 'stage_status', true, true, 1),
  ('review_workflow', 'reviewer_assignment', true, true, 2),
  ('review_workflow', 'review_score', false, true, 3),
  
  -- Rubrics
  ('rubrics', 'rubric_response', true, true, 1)
ON CONFLICT (module_id, field_type_id) DO NOTHING;

-- =====================================================
-- PHASE 4: MODULE VERSION SETTINGS
-- =====================================================

-- Override history/approval settings per module
CREATE TABLE IF NOT EXISTS module_history_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hub_module_config_id UUID NOT NULL REFERENCES hub_module_configs(id) ON DELETE CASCADE,
  
  -- Version tracking overrides (null = use table defaults)
  track_changes BOOLEAN,
  require_change_reason BOOLEAN,
  version_retention_days INT,
  
  -- Approval overrides
  require_approval BOOLEAN,
  approval_type TEXT, -- 'table_owner', 'workspace_admin', 'specific_user'
  specific_approvers UUID[],
  
  -- AI settings overrides
  enable_ai_suggestions BOOLEAN,
  auto_apply_threshold FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hub_module_config_id)
);

-- =====================================================
-- PHASE 5: EXTEND ROW_VERSIONS FOR MODULE CONTEXT
-- =====================================================

ALTER TABLE row_versions
ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES module_definitions(id),
ADD COLUMN IF NOT EXISTS sub_module_id UUID REFERENCES sub_modules(id);

CREATE INDEX IF NOT EXISTS idx_row_versions_module ON row_versions(module_id) WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_row_versions_sub_module ON row_versions(sub_module_id) WHERE sub_module_id IS NOT NULL;

COMMENT ON COLUMN row_versions.module_id IS 'Which module triggered this version (for module-specific history)';
COMMENT ON COLUMN row_versions.sub_module_id IS 'Which sub-module triggered this version';

-- =====================================================
-- PHASE 6: AI SUGGESTIONS MODULE CONTEXT
-- =====================================================

ALTER TABLE ai_field_suggestions
ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES module_definitions(id),
ADD COLUMN IF NOT EXISTS sub_module_id UUID REFERENCES sub_modules(id);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_module ON ai_field_suggestions(module_id) WHERE module_id IS NOT NULL;

-- =====================================================
-- PHASE 7: HELPER FUNCTIONS
-- =====================================================

-- Function to get enabled modules for a hub with their field types
CREATE OR REPLACE FUNCTION get_hub_module_fields(p_hub_id UUID)
RETURNS TABLE (
  module_id TEXT,
  module_name TEXT,
  field_type_id TEXT,
  field_label TEXT,
  is_required BOOLEAN,
  is_auto_created BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id as module_id,
    md.name as module_name,
    mfc.field_type_id,
    ftr.label as field_label,
    mfc.is_required,
    mfc.is_auto_created
  FROM hub_module_configs hmc
  JOIN module_definitions md ON md.id = hmc.module_id
  LEFT JOIN module_field_configs mfc ON mfc.module_id = md.id
  LEFT JOIN field_type_registry ftr ON ftr.id = mfc.field_type_id
  WHERE hmc.table_id = p_hub_id
  AND hmc.is_enabled = true
  ORDER BY md.display_order, mfc.display_order;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create fields when enabling a module
CREATE OR REPLACE FUNCTION auto_create_module_fields()
RETURNS TRIGGER AS $$
DECLARE
  field_config RECORD;
  new_field_id UUID;
BEGIN
  -- Only run when module is being enabled
  IF NEW.is_enabled = true AND (OLD IS NULL OR OLD.is_enabled = false) THEN
    -- Get auto-create fields for this module
    FOR field_config IN 
      SELECT mfc.*, ftr.label, ftr.input_schema, ftr.config_schema
      FROM module_field_configs mfc
      JOIN field_type_registry ftr ON ftr.id = mfc.field_type_id
      WHERE mfc.module_id = NEW.module_id
      AND mfc.is_auto_created = true
    LOOP
      -- Check if field already exists
      IF NOT EXISTS (
        SELECT 1 FROM table_fields 
        WHERE table_id = NEW.table_id 
        AND field_type_id = field_config.field_type_id
      ) THEN
        -- Create the field
        INSERT INTO table_fields (table_id, name, label, field_type_id, config, position, is_required)
        VALUES (
          NEW.table_id,
          LOWER(REPLACE(field_config.label, ' ', '_')),
          field_config.label,
          field_config.field_type_id,
          COALESCE(field_config.default_config, '{}'),
          (SELECT COALESCE(MAX(position), 0) + 1 FROM table_fields WHERE table_id = NEW.table_id),
          field_config.is_required
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-creating fields
DROP TRIGGER IF EXISTS trigger_auto_create_module_fields ON hub_module_configs;
CREATE TRIGGER trigger_auto_create_module_fields
  AFTER INSERT OR UPDATE ON hub_module_configs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_module_fields();

-- Function to get version history filtered by module
CREATE OR REPLACE FUNCTION get_module_row_history(
  p_row_id UUID,
  p_module_id TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  version_number INT,
  change_type TEXT,
  change_summary TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ,
  module_id TEXT,
  sub_module_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rv.id,
    rv.version_number,
    rv.change_type,
    rv.change_summary,
    rv.changed_by,
    rv.changed_at,
    rv.module_id,
    rv.sub_module_id
  FROM row_versions rv
  WHERE rv.row_id = p_row_id
  AND (p_module_id IS NULL OR rv.module_id = p_module_id)
  AND rv.is_archived = false
  ORDER BY rv.version_number DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 8: UPDATE HUB_MODULE_CONFIGS FOR FIELD SYSTEM
-- =====================================================

-- Add field-related settings to hub_module_configs
ALTER TABLE hub_module_configs
ADD COLUMN IF NOT EXISTS auto_create_fields BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_field_overrides JSONB DEFAULT '{}';

COMMENT ON COLUMN hub_module_configs.auto_create_fields IS 'Whether to auto-create required fields when module is enabled';
COMMENT ON COLUMN hub_module_configs.custom_field_overrides IS 'Override default field configs for this specific hub';

-- =====================================================
-- PHASE 9: REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for sub_modules
ALTER PUBLICATION supabase_realtime ADD TABLE sub_modules;

-- =====================================================
-- PHASE 10: ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE sub_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_field_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_history_settings ENABLE ROW LEVEL SECURITY;

-- Sub-modules: Users can access if they can access the hub
CREATE POLICY "sub_modules_access" ON sub_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM data_tables dt
      WHERE dt.id = sub_modules.hub_id
      AND (dt.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members wm 
        WHERE wm.workspace_id = dt.workspace_id 
        AND wm.user_id = auth.uid()
      ))
    )
  );

-- Module field configs: Read-only for all authenticated users
CREATE POLICY "module_field_configs_read" ON module_field_configs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Module history settings: Access through hub_module_configs
CREATE POLICY "module_history_settings_access" ON module_history_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hub_module_configs hmc
      JOIN data_tables dt ON dt.id = hmc.table_id
      WHERE hmc.id = module_history_settings.hub_module_config_id
      AND (dt.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members wm 
        WHERE wm.workspace_id = dt.workspace_id 
        AND wm.user_id = auth.uid()
      ))
    )
  );

-- =====================================================
-- COMPLETE
-- =====================================================
