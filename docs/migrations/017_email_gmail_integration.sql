-- Migration: Email/Gmail Integration Tables
-- Description: Creates tables for Gmail OAuth connections, email campaigns, sent emails, and templates

-- Gmail OAuth Connections (per workspace)
CREATE TABLE IF NOT EXISTS gmail_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id)
);

-- Email Campaigns (bulk sends)
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    form_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sent Emails (individual tracking)
CREATE TABLE IF NOT EXISTS sent_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    form_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES rows(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    gmail_message_id VARCHAR(255),
    gmail_thread_id VARCHAR(255),
    tracking_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
    opened_at TIMESTAMP WITH TIME ZONE,
    open_count INTEGER DEFAULT 0,
    clicked_at TIMESTAMP WITH TIME ZONE,
    click_count INTEGER DEFAULT 0,
    bounced_at TIMESTAMP WITH TIME ZONE,
    bounce_reason TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    form_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    type VARCHAR(50) DEFAULT 'manual' CHECK (type IN ('manual', 'automated')),
    trigger_on VARCHAR(50) CHECK (trigger_on IN ('submission', 'approval', 'rejection')),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_connections_workspace ON gmail_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_workspace ON email_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_form ON email_campaigns(form_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_workspace ON sent_emails(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_form ON sent_emails(form_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_campaign ON sent_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_tracking ON sent_emails(tracking_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_recipient ON sent_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace ON email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_form ON email_templates(form_id);

-- Comments for documentation
COMMENT ON TABLE gmail_connections IS 'OAuth tokens for Gmail API integration per workspace';
COMMENT ON TABLE email_campaigns IS 'Bulk email send campaigns with aggregated stats';
COMMENT ON TABLE sent_emails IS 'Individual sent emails with tracking data';
COMMENT ON TABLE email_templates IS 'Reusable email templates for manual or automated sends';
COMMENT ON COLUMN sent_emails.tracking_id IS 'Unique ID used in tracking pixel URL for open tracking';
