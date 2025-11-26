-- Add group and repeater to allowed field types
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;

ALTER TABLE form_fields ADD CONSTRAINT form_fields_field_type_check CHECK (field_type IN (
    'text', 'textarea', 'email', 'phone', 'number', 'url',
    'select', 'multiselect', 'radio', 'checkbox',
    'date', 'datetime', 'time',
    'file', 'image',
    'signature', 'rating',
    'divider', 'heading', 'paragraph',
    'group', 'repeater'
));
