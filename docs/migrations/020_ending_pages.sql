-- Create ending_pages table for customizable form submission end screens
CREATE TABLE IF NOT EXISTS ending_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- JSON block structure for page content
    blocks JSONB NOT NULL DEFAULT '[]',
    
    -- Settings for layout and spacing
    settings JSONB NOT NULL DEFAULT '{}',
    
    -- Theme configuration
    theme JSONB NOT NULL DEFAULT '{}',
    
    -- Conditional logic to determine which ending to show
    -- Array of condition objects: [{ fieldId, operator, value }, ...]
    conditions JSONB NOT NULL DEFAULT '[]',
    
    -- Whether this is the default ending
    is_default BOOLEAN DEFAULT false,
    
    -- Version tracking
    version INTEGER DEFAULT 1,
    
    -- Status: draft or published
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX idx_ending_pages_form_id ON ending_pages(form_id);
CREATE INDEX idx_ending_pages_status ON ending_pages(status);
CREATE INDEX idx_ending_pages_is_default ON ending_pages(is_default);
CREATE INDEX idx_ending_pages_form_status ON ending_pages(form_id, status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ending_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ending_pages_updated_at_trigger ON ending_pages;
CREATE TRIGGER ending_pages_updated_at_trigger
BEFORE UPDATE ON ending_pages
FOR EACH ROW
EXECUTE FUNCTION update_ending_pages_updated_at();
