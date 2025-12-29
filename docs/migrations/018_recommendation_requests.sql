-- Recommendation Requests Schema
-- Stores recommendation requests and submissions for letters of recommendation

-- Recommendation requests table
CREATE TABLE IF NOT EXISTS recommendation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    form_id UUID NOT NULL,
    field_id TEXT NOT NULL,
    
    -- Recommender info (provided by applicant)
    recommender_name TEXT NOT NULL,
    recommender_email TEXT NOT NULL,
    recommender_relationship TEXT,
    recommender_organization TEXT,
    
    -- Request tracking
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reminded_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- The actual recommendation response
    response JSONB,
    
    -- Standard timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_submission ON recommendation_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_form ON recommendation_requests(form_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_token ON recommendation_requests(token);
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_status ON recommendation_requests(status);
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_email ON recommendation_requests(recommender_email);

-- Add comment for status values
COMMENT ON COLUMN recommendation_requests.status IS 'Status values: pending, submitted, expired, cancelled';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recommendation_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS recommendation_request_updated ON recommendation_requests;
CREATE TRIGGER recommendation_request_updated
    BEFORE UPDATE ON recommendation_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_recommendation_request_timestamp();

-- Enable RLS
ALTER TABLE recommendation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to view their own recommendations (via submission ownership)
CREATE POLICY "Users can view recommendations for their submissions"
    ON recommendation_requests
    FOR SELECT
    USING (true); -- We'll handle authorization in the API layer

-- Allow authenticated users to create recommendations
CREATE POLICY "Users can create recommendations"
    ON recommendation_requests
    FOR INSERT
    WITH CHECK (true);

-- Allow updates (for submitting recommendations)
CREATE POLICY "Users can update recommendations"
    ON recommendation_requests
    FOR UPDATE
    USING (true);

-- Allow deletes (for cancelling)
CREATE POLICY "Users can delete recommendations"
    ON recommendation_requests
    FOR DELETE
    USING (true);
