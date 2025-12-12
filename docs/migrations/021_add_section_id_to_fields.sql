-- Add section_id to table_fields to link fields to form sections
-- Using TEXT instead of UUID since section IDs in form settings are strings
ALTER TABLE table_fields ADD COLUMN section_id TEXT;

-- Create index for faster queries
CREATE INDEX idx_table_fields_section_id ON table_fields(section_id);
