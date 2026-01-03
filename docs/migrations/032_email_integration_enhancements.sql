-- Migration: Email Integration System Enhancements
-- Description: Adds tables for email drafts, email queue, resend integration, and service health monitoring
-- This implements Phase 1 of the unified email management system

-- Email Drafts (auto-save functionality)
CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- User who created the draft
    form_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES rows(id) ON DELETE SET NULL,
    recipient_emails TEXT[] DEFAULT '{}',
    subject VARCHAR(500),
    body TEXT,
    body_html TEXT,
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    merge_fields JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    auto_saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    submission_id UUID REFERENCES rows(id) ON DELETE SET NULL,
    form_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    service_type VARCHAR(50) DEFAULT 'gmail' CHECK (service_type IN ('gmail', 'resend')),
    priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'retrying')),
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resend Integration (workspace-level configuration)
CREATE TABLE IF NOT EXISTS resend_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL, -- Encrypted in production
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id)
);

-- Email Service Health (monitoring for Gmail and Resend)
CREATE TABLE IF NOT EXISTS email_service_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('gmail', 'resend')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, service_type)
);

-- Enhance existing sent_emails table to support Resend
ALTER TABLE sent_emails 
    ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'gmail' CHECK (service_type IN ('gmail', 'resend')),
    ADD COLUMN IF NOT EXISTS resend_message_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS resend_event_id VARCHAR(255);

-- Enhance email_campaigns table
ALTER TABLE email_campaigns
    ADD COLUMN IF NOT EXISTS stagger_delay_seconds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'gmail' CHECK (service_type IN ('gmail', 'resend')),
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- Enhance email_templates table with category and usage tracking
ALTER TABLE email_templates
    ADD COLUMN IF NOT EXISTS category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_drafts_workspace ON email_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_submission ON email_drafts(submission_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_workspace ON email_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority_status ON email_queue(priority DESC, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_resend_integrations_workspace ON resend_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_service_health_workspace ON email_service_health(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_service_health_service ON email_service_health(service_type);
CREATE INDEX IF NOT EXISTS idx_sent_emails_service_type ON sent_emails(service_type);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_service_type ON email_campaigns(service_type);

-- Comments for documentation
COMMENT ON TABLE email_drafts IS 'Auto-saved email drafts with 30-day retention';
COMMENT ON TABLE email_queue IS 'Queue for bulk email sending with staggering and retry logic';
COMMENT ON TABLE resend_integrations IS 'Resend API configuration per workspace';
COMMENT ON TABLE email_service_health IS 'Health monitoring for email service providers';
COMMENT ON COLUMN email_queue.priority IS 'Priority 1-10, higher numbers sent first';
COMMENT ON COLUMN email_queue.scheduled_for IS 'When to send this email (for staggering)';

