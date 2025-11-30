-- Add address field type to field_type_registry
-- Run this on production database to fix the foreign key constraint error

INSERT INTO field_type_registry (id, category, label, is_container, storage_schema, ai_schema)
VALUES (
  'address', 
  'primitive', 
  'Address', 
  false,
  '{
    "type": "object",
    "properties": {
      "full_address": {"type": "string"},
      "street_address": {"type": "string"},
      "city": {"type": "string"},
      "state": {"type": "string"},
      "postal_code": {"type": "string"},
      "country": {"type": "string"},
      "country_code": {"type": "string"},
      "latitude": {"type": "number"},
      "longitude": {"type": "number"},
      "place_name": {"type": "string"}
    },
    "required": ["full_address"]
  }',
  '{"embedding_strategy": "value_only", "privacy_level": "pii", "semantic_hint": "Physical address with geocoding"}'
)
ON CONFLICT (id) DO NOTHING;
