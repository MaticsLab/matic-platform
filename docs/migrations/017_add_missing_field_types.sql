-- Add missing field types to field_type_registry
-- These types are referenced in the codebase but were missing from the initial registry

-- Layout types
INSERT INTO field_type_registry (id, category, label, is_container, storage_schema, ai_schema, default_config)
VALUES
('paragraph', 'layout', 'Paragraph', false, 
  '{"type": "null"}', 
  '{"embedding_strategy": "skip"}',
  '{}'
),
('callout', 'layout', 'Callout Box', false, 
  '{"type": "null"}', 
  '{"embedding_strategy": "skip"}',
  '{"color": "blue", "icon": "info"}'
)
ON CONFLICT (id) DO NOTHING;

-- Primitive types
INSERT INTO field_type_registry (id, category, label, is_container, storage_schema, ai_schema, default_config)
VALUES
('url', 'primitive', 'URL', false, 
  '{"type": "string", "format": "uri"}', 
  '{"embedding_strategy": "skip", "privacy_level": "public"}',
  '{}'
),
('datetime', 'primitive', 'Date & Time', false, 
  '{"type": "string", "format": "date-time"}', 
  '{"embedding_strategy": "with_label", "privacy_level": "public"}',
  '{}'
),
('time', 'primitive', 'Time', false, 
  '{"type": "string", "format": "time"}', 
  '{"embedding_strategy": "with_label", "privacy_level": "public"}',
  '{}'
),
('checkbox', 'primitive', 'Checkbox', false, 
  '{"type": "boolean"}', 
  '{"embedding_strategy": "with_label", "privacy_level": "public"}',
  '{}'
),
('radio', 'primitive', 'Single Choice', false, 
  '{"type": "string"}', 
  '{"embedding_strategy": "value_only", "privacy_level": "public"}',
  '{"items": []}'
),
('image', 'special', 'Image Upload', false, 
  '{"type": "object", "properties": {"url": {"type": "string"}, "name": {"type": "string"}, "size": {"type": "number"}, "mime_type": {"type": "string"}}}', 
  '{"embedding_strategy": "filename_only", "privacy_level": "sensitive"}',
  '{"accept": "image/*", "maxSize": 5242880}'
),
('rank', 'primitive', 'Rank', false, 
  '{"type": "array", "items": {"type": "string"}}', 
  '{"embedding_strategy": "value_only", "privacy_level": "public"}',
  '{"items": []}'
)
ON CONFLICT (id) DO NOTHING;

-- Special/computed types
INSERT INTO field_type_registry (id, category, label, is_container, storage_schema, ai_schema, default_config)
VALUES
('link', 'special', 'Linked Record', false, 
  '{"type": "array", "items": {"type": "string", "format": "uuid"}}', 
  '{"embedding_strategy": "skip", "privacy_level": "public"}',
  '{}'
),
('lookup', 'special', 'Lookup', false, 
  '{"type": "any"}', 
  '{"embedding_strategy": "skip", "privacy_level": "public"}',
  '{}'
),
('rollup', 'special', 'Rollup', false, 
  '{"type": "any"}', 
  '{"embedding_strategy": "value_only", "privacy_level": "public"}',
  '{"function": "count"}'
),
('formula', 'special', 'Formula', false, 
  '{"type": "any"}', 
  '{"embedding_strategy": "value_only", "privacy_level": "public"}',
  '{"formula": ""}'
),
('item_list', 'special', 'Item List', false, 
  '{"type": "array", "items": {"type": "object"}}', 
  '{"embedding_strategy": "summarize_count", "privacy_level": "public"}',
  '{"items": []}'
)
ON CONFLICT (id) DO NOTHING;
