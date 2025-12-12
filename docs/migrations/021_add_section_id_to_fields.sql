-- Add section_id to table_fields to link fields to form sections
ALTER TABLE table_fields ADD COLUMN section_id UUID;

-- Create index for faster queries
CREATE INDEX idx_table_fields_section_id ON table_fields(section_id);
