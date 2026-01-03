-- Email Queue (for bulk sending with staggering)
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    sender_email VARCHAR(255) NOT NULL,
    submission_id UUID REFERENCES table_rows(id) ON DELETE SET NULL,
    form_id UUID REFERENCES data_tables(id) ON DELETE SET NULL,
    service_type VARCHAR(50) DEFAULT 'gmail' CHECK (service_type IN ('gmail', 'resend')),
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'retrying')),
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_workspace ON email_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority_status ON email_queue(priority DESC, status, scheduled_for);

-- Add comments
COMMENT ON TABLE email_queue IS 'Queue for bulk email sending with staggering and retry logic';
COMMENT ON COLUMN email_queue.priority IS 'Priority 1-10, higher numbers sent first';
COMMENT ON COLUMN email_queue.scheduled_for IS 'When to send this email (for staggering)';

