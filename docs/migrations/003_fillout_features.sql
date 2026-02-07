-- Migration: Add Fillout-inspired features to form_fields and forms
-- Date: 2026-02-06
-- Description: Adds rich text, help text, prefill values, and calculated field support

-- Add new columns to form_fields
ALTER TABLE form_fields 
  ADD COLUMN IF NOT EXISTS help_text TEXT,
  ADD COLUMN IF NOT EXISTS is_rich_text BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prefill_value TEXT,
  ADD COLUMN IF NOT EXISTS calculation_rule TEXT;

-- Add comments for documentation
COMMENT ON COLUMN form_fields.help_text IS 'Additional guidance shown to users';
COMMENT ON COLUMN form_fields.is_rich_text IS 'Whether label/description contain HTML';
COMMENT ON COLUMN form_fields.prefill_value IS 'Default value to prefill field';
COMMENT ON COLUMN form_fields.calculation_rule IS 'Formula for calculated fields (e.g., "field1 + field2")';

-- Update form_fields validation JSONB to support nested validation rules
-- (No schema change needed - JSONB is already flexible)
COMMENT ON COLUMN form_fields.validation IS 'Validation rules supporting email_validation, phone_validation, url_validation, date_validation nested objects';

-- Update form_fields conditions JSONB to support ConditionalAction structure
-- (No schema change needed - JSONB is already flexible)
COMMENT ON COLUMN form_fields.conditions IS 'Conditional actions array: [{type: "show|hide|require|disable|prefill|calculate", conditions: [...], logic: "and|or", target: "field_key", value: any}]';

-- Update form_fields options JSONB to support color/icon/description
-- (No schema change needed - JSONB is already flexible)
COMMENT ON COLUMN form_fields.options IS 'Field options supporting: value, label, description, color, icon, disabled';

-- Update forms settings JSONB to support theme and branching
-- (No schema change needed - JSONB is already flexible)
COMMENT ON COLUMN forms.settings IS 'Form settings supporting: theme (colors, typography, layout, buttons), branching_rules, enable_branching, enable_rich_text, allow_save_and_exit, show_confirmation_page';

-- Update form_sections conditions JSONB to support ConditionalAction structure
-- (No schema change needed - JSONB is already flexible)
COMMENT ON COLUMN form_sections.conditions IS 'Conditional actions for section visibility: [{type: "show|hide", conditions: [...], logic: "and|or"}]';

-- Create index on form_fields for rich text queries (if needed)
CREATE INDEX IF NOT EXISTS idx_form_fields_rich_text ON form_fields(is_rich_text) WHERE is_rich_text = TRUE;

-- Create index on form_fields for calculated fields (if needed)
CREATE INDEX IF NOT EXISTS idx_form_fields_calculated ON form_fields(field_type) WHERE field_type = 'calculated';

-- Validation: Ensure existing JSONB columns have valid default values
UPDATE form_fields SET validation = '{}' WHERE validation IS NULL;
UPDATE form_fields SET options = '[]' WHERE options IS NULL;
UPDATE form_fields SET conditions = '[]' WHERE conditions IS NULL;
UPDATE form_sections SET conditions = '[]' WHERE conditions IS NULL;
UPDATE forms SET settings = '{}' WHERE settings IS NULL;
