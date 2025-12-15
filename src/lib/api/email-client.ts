import { goFetch } from './go-client';

// Types
export interface GmailAccount {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  display_name: string;
  send_permission: 'myself' | 'admins' | 'members' | 'everyone' | 'specific';
  allowed_user_ids?: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface GmailConnection {
  connected: boolean;
  email?: string;
  needs_refresh?: boolean;
  needs_reconnect?: boolean;
  reconnect_reason?: string;
  accounts_count?: number;
  accounts?: GmailAccount[];
}

export interface SendEmailRequest {
  form_id?: string;
  recipients?: string[];
  recipient_emails?: string[]; // Direct list of emails to send to
  submission_ids?: string[]; // Submission IDs - backend looks up data securely
  email_field?: string; // Which field to use as the email address
  subject: string;
  body: string;
  body_html?: string;
  is_html?: boolean; // Flag to indicate body is HTML
  merge_tags?: boolean;
  track_opens?: boolean;
  save_template?: boolean;
  template_name?: string;
  sender_account_id?: string;
  signature_id?: string;
  // Threading support for replies
  thread_id?: string;     // Gmail thread ID to reply to
  in_reply_to?: string;   // Message-ID of the email being replied to
  references?: string;    // References header for threading
}

export interface SendEmailResponse {
  success: boolean;
  sent_count: number;
  total: number;
  errors: string[];
  campaign_id?: string;
}

export interface SentEmail {
  id: string;
  campaign_id?: string;
  workspace_id?: string;
  form_id?: string;
  submission_id?: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body: string;
  body_html?: string;
  sender_email: string;
  sender_name?: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  tracking_id?: string;
  status: string; // 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  opened_at?: string;
  open_count?: number;
  clicked_at?: string;
  click_count?: number;
  bounced_at?: string;
  bounce_reason?: string;
  sent_at: string;
  created_at?: string;
  updated_at?: string;
  source?: string; // 'database' | 'gmail'
}

export interface EmailCampaign {
  id: string;
  workspace_id: string;
  form_id?: string;
  subject: string;
  body: string;
  body_html?: string;
  sender_email: string;
  sender_name?: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  metadata?: Record<string, unknown>;
  sent_at?: string;
  created_at: string;
  updated_at: string;
  total_recipients: number;
  opened_count: number;
  clicked_count: number;
}

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  form_id?: string;
  created_by_id?: string;
  name: string;
  subject?: string;
  body: string;
  body_html?: string;
  type: 'manual' | 'automated';
  trigger_on?: 'submission' | 'approval' | 'rejection';
  is_active: boolean;
  share_with: 'only_me' | 'everyone' | 'admins' | 'specific';
  shared_user_ids?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmailSignature {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  content: string;
  content_html?: string;
  is_html: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateEmailTemplateRequest = Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>;
export type UpdateEmailTemplateRequest = Partial<CreateEmailTemplateRequest>;
export type CreateSignatureRequest = Omit<EmailSignature, 'id' | 'created_at' | 'updated_at'>;
export type UpdateSignatureRequest = Partial<CreateSignatureRequest>;

// API Client
export const emailClient = {
  // Gmail Connection / OAuth
  getAuthUrl: (workspaceId: string, userId?: string) => {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (userId) params.append('user_id', userId);
    return goFetch<{ auth_url: string }>(`/email/oauth/url?${params}`);
  },

  getConnection: (workspaceId: string) =>
    goFetch<GmailConnection>(`/email/connection?workspace_id=${workspaceId}`),

  disconnect: (workspaceId: string) =>
    goFetch<{ success: boolean }>(`/email/connection?workspace_id=${workspaceId}`, {
      method: 'DELETE',
    }),

  // Email Accounts
  listAccounts: (workspaceId: string) =>
    goFetch<GmailAccount[]>(`/email/accounts?workspace_id=${workspaceId}`),

  updateAccount: (id: string, data: {
    display_name?: string;
    send_permission?: string;
    allowed_user_ids?: string[];
    is_default?: boolean;
  }) =>
    goFetch<GmailAccount>(`/email/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAccount: (id: string) =>
    goFetch<{ success: boolean }>(`/email/accounts/${id}`, {
      method: 'DELETE',
    }),

  // Signatures
  listSignatures: (workspaceId: string, userId?: string) => {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (userId) params.append('user_id', userId);
    return goFetch<EmailSignature[]>(`/email/signatures?${params}`);
  },

  createSignature: (data: CreateSignatureRequest) =>
    goFetch<EmailSignature>('/email/signatures', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSignature: (id: string, data: UpdateSignatureRequest) =>
    goFetch<EmailSignature>(`/email/signatures/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteSignature: (id: string) =>
    goFetch<{ success: boolean }>(`/email/signatures/${id}`, {
      method: 'DELETE',
    }),

  // Sending
  send: (workspaceId: string, data: SendEmailRequest) =>
    goFetch<SendEmailResponse>(`/email/send?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // History
  getHistory: (workspaceId: string, formId?: string) => {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (formId) params.append('form_id', formId);
    return goFetch<SentEmail[]>(`/email/history?${params}`);
  },

  getCampaigns: (workspaceId: string, formId?: string) => {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (formId) params.append('form_id', formId);
    return goFetch<EmailCampaign[]>(`/email/campaigns?${params}`);
  },

  // Templates
  getTemplates: (workspaceId: string, formId?: string) => {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (formId) params.append('form_id', formId);
    return goFetch<EmailTemplate[]>(`/email/templates?${params}`);
  },

  createTemplate: (data: CreateEmailTemplateRequest) =>
    goFetch<EmailTemplate>('/email/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: UpdateEmailTemplateRequest) =>
    goFetch<EmailTemplate>(`/email/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    goFetch<{ success: boolean }>(`/email/templates/${id}`, {
      method: 'DELETE',
    }),

  // Submission-specific email history
  getSubmissionHistory: (submissionId: string, workspaceId?: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspace_id', workspaceId);
    const query = params.toString() ? `?${params}` : '';
    return goFetch<SentEmail[]>(`/email/submission/${submissionId}/history${query}`);
  },

  getSubmissionActivity: (submissionId: string, workspaceId?: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspace_id', workspaceId);
    const query = params.toString() ? `?${params}` : '';
    return goFetch<ActivityItem[]>(`/email/submission/${submissionId}/activity${query}`);
  },
};

// Activity types
export interface ActivityItem {
  type: 'email_sent' | 'email_opened' | 'email_clicked' | 'status_change' | 'review_added';
  title: string;
  description: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
