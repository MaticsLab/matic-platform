-- Field Architecture Improvement Migration
-- This migration improves the relationship between table_fields and field_type_registry

-- ============================================================
-- PHASE 1: Add default_config to field_type_registry
-- ============================================================

ALTER TABLE field_type_registry 
ADD COLUMN IF NOT EXISTS default_config JSONB DEFAULT '{}';

-- Populate default configs for all field types
UPDATE field_type_registry SET default_config = '{
  "placeholder": "",
  "maxLength": 500,
  "minLength": 0
}' WHERE id = 'text';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "",
  "rows": 3,
  "maxLength": 10000
}' WHERE id = 'textarea';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "email@example.com"
}' WHERE id = 'email';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "(555) 123-4567",
  "format": "us"
}' WHERE id = 'phone';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "https://",
  "requireHttps": false
}' WHERE id = 'url';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "Enter address...",
  "requireGeocode": false
}' WHERE id = 'address';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "0",
  "min": null,
  "max": null,
  "precision": 2,
  "format": "decimal"
}' WHERE id = 'number';

UPDATE field_type_registry SET default_config = '{
  "format": "YYYY-MM-DD",
  "minDate": null,
  "maxDate": null
}' WHERE id = 'date';

UPDATE field_type_registry SET default_config = '{
  "format": "YYYY-MM-DDTHH:mm",
  "timezone": "local"
}' WHERE id = 'datetime';

UPDATE field_type_registry SET default_config = '{
  "format": "HH:mm"
}' WHERE id = 'time';

UPDATE field_type_registry SET default_config = '{
  "options": [],
  "allowCustom": false,
  "placeholder": "Select..."
}' WHERE id = 'select';

UPDATE field_type_registry SET default_config = '{
  "options": [],
  "maxSelections": null,
  "placeholder": "Select multiple..."
}' WHERE id = 'multiselect';

UPDATE field_type_registry SET default_config = '{
  "options": [],
  "layout": "vertical"
}' WHERE id = 'radio';

UPDATE field_type_registry SET default_config = '{
  "label": "Yes",
  "defaultValue": false
}' WHERE id = 'checkbox';

UPDATE field_type_registry SET default_config = '{
  "options": [],
  "maxSelections": null
}' WHERE id = 'rank';

UPDATE field_type_registry SET default_config = '{
  "children": [],
  "collapsible": false,
  "defaultCollapsed": false
}' WHERE id = 'group';

UPDATE field_type_registry SET default_config = '{
  "children": [],
  "minItems": 0,
  "maxItems": null,
  "addButtonLabel": "Add Item",
  "itemLabel": "Item"
}' WHERE id = 'repeater';

UPDATE field_type_registry SET default_config = '{}' WHERE id = 'divider';
UPDATE field_type_registry SET default_config = '{}' WHERE id = 'heading';
UPDATE field_type_registry SET default_config = '{}' WHERE id = 'paragraph';

UPDATE field_type_registry SET default_config = '{
  "color": "blue",
  "icon": "info"
}' WHERE id = 'callout';

UPDATE field_type_registry SET default_config = '{
  "children": [],
  "collapsible": true
}' WHERE id = 'section';

UPDATE field_type_registry SET default_config = '{
  "accept": "*/*",
  "maxSize": 10485760,
  "multiple": false,
  "maxFiles": 5
}' WHERE id = 'file';

UPDATE field_type_registry SET default_config = '{
  "accept": "image/*",
  "maxSize": 5242880,
  "multiple": false,
  "maxFiles": 5
}' WHERE id = 'image';

UPDATE field_type_registry SET default_config = '{
  "width": 400,
  "height": 200,
  "penColor": "#000000"
}' WHERE id = 'signature';

UPDATE field_type_registry SET default_config = '{
  "maxRating": 5,
  "allowHalf": false
}' WHERE id = 'rating';

UPDATE field_type_registry SET default_config = '{
  "items": [],
  "minItems": 0,
  "maxItems": null
}' WHERE id = 'item_list';

-- ============================================================
-- PHASE 2: Populate missing field_type_id values
-- ============================================================

-- Copy 'type' to 'field_type_id' where missing
UPDATE table_fields 
SET field_type_id = type 
WHERE field_type_id IS NULL OR field_type_id = '';

-- ============================================================
-- PHASE 3: Add parent_field_id for nested fields
-- ============================================================

ALTER TABLE table_fields 
ADD COLUMN IF NOT EXISTS parent_field_id UUID REFERENCES table_fields(id) ON DELETE CASCADE;

-- Create index for nested field queries
CREATE INDEX IF NOT EXISTS idx_table_fields_parent ON table_fields(parent_field_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_type ON table_fields(field_type_id);

-- ============================================================
-- PHASE 4: Add foreign key constraint (optional, can be done later)
-- ============================================================

-- Note: Only run this after confirming all field_type_id values exist in registry
-- ALTER TABLE table_fields 
-- ADD CONSTRAINT fk_field_type 
-- FOREIGN KEY (field_type_id) 
-- REFERENCES field_type_registry(id) 
-- ON UPDATE CASCADE 
-- ON DELETE RESTRICT;

-- ============================================================
-- PHASE 5: Create view for effective field config
-- ============================================================

CREATE OR REPLACE VIEW v_fields_with_effective_config AS
SELECT 
    tf.id,
    tf.table_id,
    tf.field_type_id,
    tf.name,
    tf.label,
    tf.description,
    tf.position,
    tf.width,
    tf.is_visible,
    tf.is_primary,
    tf.parent_field_id,
    tf.linked_table_id,
    tf.semantic_type,
    tf.is_searchable,
    tf.search_weight,
    tf.created_at,
    tf.updated_at,
    -- Registry fields
    ftr.category,
    ftr.storage_schema,
    ftr.input_schema,
    ftr.config_schema,
    ftr.is_container,
    COALESCE(tf.is_searchable, ftr.is_searchable) as effective_is_searchable,
    ftr.is_sortable,
    ftr.is_filterable,
    ftr.is_editable,
    ftr.supports_pii,
    ftr.ai_schema,
    -- Merged config (registry defaults + instance overrides)
    COALESCE(ftr.default_config, '{}') || COALESCE(tf.config, '{}') as effective_config,
    tf.config as instance_config,
    ftr.default_config as registry_default_config
FROM table_fields tf
LEFT JOIN field_type_registry ftr ON tf.field_type_id = ftr.id;

-- ============================================================
-- PHASE 6: Function to get effective config for a field
-- ============================================================

CREATE OR REPLACE FUNCTION get_effective_field_config(p_field_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_field_type_id TEXT;
    v_instance_config JSONB;
    v_default_config JSONB;
BEGIN
    -- Get field data
    SELECT field_type_id, config INTO v_field_type_id, v_instance_config
    FROM table_fields WHERE id = p_field_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Get registry defaults
    SELECT default_config INTO v_default_config
    FROM field_type_registry WHERE id = v_field_type_id;
    
    -- Merge: defaults || instance (instance wins)
    RETURN COALESCE(v_default_config, '{}') || COALESCE(v_instance_config, '{}');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PHASE 7: Function to validate field config against schema
-- ============================================================

-- Note: Full JSON Schema validation would require pg_jsonschema extension
-- This is a simplified version that checks required keys
CREATE OR REPLACE FUNCTION validate_field_config(
    p_field_type_id TEXT,
    p_config JSONB
) RETURNS TABLE(is_valid BOOLEAN, errors TEXT[]) AS $$
DECLARE
    v_config_schema JSONB;
    v_errors TEXT[] := '{}';
BEGIN
    -- Get config schema from registry
    SELECT config_schema INTO v_config_schema
    FROM field_type_registry WHERE id = p_field_type_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, ARRAY['Unknown field type: ' || p_field_type_id];
        RETURN;
    END IF;
    
    -- Basic validation - check required properties
    IF v_config_schema ? 'required' THEN
        FOR i IN 0..jsonb_array_length(v_config_schema->'required')-1 LOOP
            IF NOT p_config ? (v_config_schema->'required'->>i) THEN
                v_errors := array_append(v_errors, 
                    'Missing required property: ' || (v_config_schema->'required'->>i));
            END IF;
        END LOOP;
    END IF;
    
    IF array_length(v_errors, 1) > 0 THEN
        RETURN QUERY SELECT FALSE, v_errors;
    ELSE
        RETURN QUERY SELECT TRUE, v_errors;
    END IF;
END;
$$ LANGUAGE plpgsql;
