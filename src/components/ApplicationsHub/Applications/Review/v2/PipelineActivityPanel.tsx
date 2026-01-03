'use client';

import { useState, useEffect, useMemo } from 'react';
import { Application, ActivityItem, PipelineActivityPanelProps } from './types';
import { 
  X, Mail, ChevronDown, Send, Plus, Sparkles, Paperclip, 
  AtSign, ArrowRight, Star, MessageSquare, Users, Tag, Loader2, Settings, File, FileText, Image
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { emailClient, SendEmailRequest, GmailAccount, EmailAttachment } from '@/lib/api/email-client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";
import { EmailSettingsDialog } from '../../Communications/EmailSettingsDialog';
import { EmailConnectionStatus } from '@/components/Email/EmailConnectionStatus';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import { Checkbox } from '@/ui-components/checkbox';
import { FullEmailComposer } from '../FullEmailComposer';
import { CampaignComposer } from '../CampaignComposer';
import { EmailManagementDashboard } from '../EmailManagementDashboard';

export function PipelineActivityPanel({ 
  applications, 
  activities,
  onClose,
  onSendEmail,
  onAddComment,
  workspaceId,
  formId,
  fields = []
}: PipelineActivityPanelProps) {
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'comment' | 'email'>('email');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<EmailAttachment[]>([]);
  const [showFullComposer, setShowFullComposer] = useState(false);
  const [showCampaignComposer, setShowCampaignComposer] = useState(false);
  const [showEmailDashboard, setShowEmailDashboard] = useState(false);
  
  // Gmail connection - use shared hook
  const { 
    connection: gmailConnection, 
    accounts: emailAccounts,
    isChecking: isCheckingConnection,
    selectedFromEmail,
    setSelectedFromEmail,
    canSendEmail,
    sendBlockedReason,
    handleOAuthError,
    refresh: refreshConnection
  } = useEmailConnection(workspaceId);

  // Update emailTo when applications change
  useEffect(() => {
    if (applications.length === 1) {
      // Single applicant - show their email in the To field
      const app = applications[0];
      const email = app.email || (app.raw_data?.email as string) || (app.raw_data?.Email as string) || '';
      setEmailTo(email);
    } else {
      // Multiple applicants - clear the field (will show placeholder)
      setEmailTo('');
    }
    // Clear attachments when application changes
    setSelectedAttachments([]);
  }, [applications]);

  // Insert merge tag into email body
  const insertMergeTag = (fieldLabel: string) => {
    setEmailBody(prev => prev + `{{${fieldLabel}}}`);
  };

  // Get available merge tags from applications
  const availableMergeTags = (() => {
    // Use provided fields first
    if (fields.length > 0) {
      return fields.map(f => ({ label: f.label, tag: `{{${f.label}}}` }));
    }
    // Fall back to extracting from first application's raw_data
    if (applications.length > 0 && applications[0].raw_data) {
      return Object.keys(applications[0].raw_data).slice(0, 20).map(key => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        tag: `{{${key}}}`
      }));
    }
    return [];
  })();

  // Extract available documents from application(s) for attachment
  const availableDocuments = useMemo(() => {
    const docs: { name: string; url: string; contentType: string }[] = [];
    
    applications.forEach(app => {
      const rawData = app.raw_data || {};
      
      // Look through raw_data for file URLs (typically from file upload fields)
      Object.entries(rawData).forEach(([key, value]) => {
        if (typeof value === 'string' && (
          value.startsWith('http://') || 
          value.startsWith('https://') ||
          value.includes('supabase') ||
          value.includes('storage')
        )) {
          // Check if it looks like a file URL (not just any URL)
          const lowerKey = key.toLowerCase();
          const lowerValue = value.toLowerCase();
          if (
            lowerKey.includes('file') ||
            lowerKey.includes('document') ||
            lowerKey.includes('upload') ||
            lowerKey.includes('attachment') ||
            lowerKey.includes('resume') ||
            lowerKey.includes('transcript') ||
            lowerKey.includes('essay') ||
            lowerKey.includes('pdf') ||
            lowerValue.includes('.pdf') ||
            lowerValue.includes('.doc') ||
            lowerValue.includes('.docx') ||
            lowerValue.includes('.png') ||
            lowerValue.includes('.jpg') ||
            lowerValue.includes('.jpeg')
          ) {
            // Determine content type from URL
            let contentType = 'application/octet-stream';
            if (lowerValue.includes('.pdf')) contentType = 'application/pdf';
            else if (lowerValue.includes('.doc')) contentType = 'application/msword';
            else if (lowerValue.includes('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (lowerValue.includes('.png')) contentType = 'image/png';
            else if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) contentType = 'image/jpeg';
            
            // Extract filename from URL or use field key
            const urlParts = value.split('/');
            const filename = urlParts[urlParts.length - 1].split('?')[0] || key;
            
            docs.push({
              name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              url: value,
              contentType
            });
          }
        }
      });
    });
    
    return docs;
  }, [applications]);

  // Toggle attachment selection
  const toggleAttachment = (doc: { name: string; url: string; contentType: string }) => {
    setSelectedAttachments(prev => {
      const exists = prev.find(a => a.url === doc.url);
      if (exists) {
        return prev.filter(a => a.url !== doc.url);
      }
      return [...prev, {
        filename: doc.name,
        url: doc.url,
        content_type: doc.contentType
      }];
    });
  };

  const handleSendEmail = async () => {
    if (!workspaceId) {
      toast.error('Workspace not configured');
      return;
    }

    if (!canSendEmail) {
      toast.error(sendBlockedReason || 'Cannot send email');
      return;
    }

    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    setIsSending(true);
    try {
      const submissionIds = applications.map(a => a.id);
      
      // Find the account ID for the selected email
      const selectedAccount = emailAccounts.find(acc => acc.email === selectedFromEmail);
      
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: submissionIds,
        subject: emailSubject,
        body: emailBody,
        is_html: false,
        merge_tags: true,
        track_opens: true,
        attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined,
        sender_account_id: selectedAccount?.id || undefined,
      };

      const result = await emailClient.send(workspaceId, request);

      if (result.success) {
        toast.success(`Successfully sent ${result.sent_count} emails!`);
        setEmailSubject('');
        setEmailBody('');
        setEmailTo('');
        setEmailCc('');
        setEmailBcc('');
        setSelectedAttachments([]);
        
        // Also call the callback if provided
        onSendEmail?.(
          emailTo || `All applicants (${applications.length})`, 
          emailSubject, 
          emailBody,
          { cc: emailCc, bcc: emailBcc, submissionIds, formId: formId || undefined }
        );
      } else {
        const errorMessage = result.errors?.[0] || 'Failed to send some emails';
        handleOAuthError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to send emails:', error);
      toast.error('Failed to send emails. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    onAddComment?.(comment);
    toast.success('Comment added to pipeline');
    setComment('');
  };

  return (
    <div className="bg-white flex flex-col h-full max-h-full border-l border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-gray-900 font-medium">Pipeline Activity</h2>
              <p className="text-gray-500 text-xs mt-0.5">{applications.length} applications</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No activity yet
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2 text-sm">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  activity.type === 'status' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'review' ? 'bg-green-100 text-green-600' :
                  activity.type === 'email' ? 'bg-purple-100 text-purple-600' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {activity.type === 'status' ? <ArrowRight className="w-3 h-3" /> :
                   activity.type === 'review' ? <Star className="w-3 h-3" /> :
                   activity.type === 'email' ? <Mail className="w-3 h-3" /> :
                   <MessageSquare className="w-3 h-3" />}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900">{activity.message}</p>
                  <div className="flex items-center gap-1.5 text-gray-500 mt-0.5 text-xs">
                    <span>{activity.user}</span>
                    <span>•</span>
                    <span>{activity.time}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Comment/Email Input - Sticky Bottom */}
      <div className="border-t bg-white flex-shrink-0 p-4 mt-auto">
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
          {activeCommentTab === 'email' ? (
            <>
              {/* Gmail Connection Status */}
              <EmailConnectionStatus 
                connection={gmailConnection}
                isChecking={isCheckingConnection}
                variant="inline"
                onConfigureClick={() => setShowEmailSettings(true)}
              />

              {/* Quick Action Buttons */}
              <div className="flex flex-col gap-2 mt-3">
                {applications.length === 1 ? (
                  <button
                    onClick={() => setShowFullComposer(true)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Compose Email</div>
                        <div className="text-xs text-gray-500">Send to {applications[0].name || applications[0].email}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCampaignComposer(true)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Campaign Composer</div>
                        <div className="text-xs text-gray-500">Send to {applications.length} applicants</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFullComposer(true)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    <Mail className="w-4 h-4 inline mr-2" />
                    Single Email
                  </button>
                  {applications.length > 1 && (
                    <button
                      onClick={() => setShowCampaignComposer(true)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      <Users className="w-4 h-4 inline mr-2" />
                      Campaign
                    </button>
                  )}
                  <button
                    onClick={() => setShowEmailDashboard(true)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                    title="Email Dashboard"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Comment input */
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a pipeline note..."
              rows={2}
              className="w-full px-0 py-2 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none text-sm"
            />
          )}
          
          {/* Action bar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-1">
              {/* Plus button */}
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                <Plus className="w-4 h-4" />
              </button>
              
              {/* Comment/Email Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-200 rounded transition-colors text-gray-700 text-sm"
                >
                  <span className="capitalize">{activeCommentTab}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                
                {/* Dropdown menu */}
                {showTypeDropdown && (
                  <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        setActiveCommentTab('comment');
                        setShowTypeDropdown(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm",
                        activeCommentTab === 'comment' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      )}
                    >
                      Comment
                    </button>
                    <button
                      onClick={() => {
                        setActiveCommentTab('email');
                        setShowTypeDropdown(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm",
                        activeCommentTab === 'email' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      )}
                    >
                      Email
                    </button>
                  </div>
                )}
              </div>
              
              {/* AI icon */}
              <button 
                onClick={() => toast.info('AI assistant coming soon')}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              
              {/* Attachment icon */}
              <button 
                onClick={() => toast.info('Attachment feature coming soon')}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              
              {/* Mention icon */}
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                <AtSign className="w-4 h-4" />
              </button>
            </div>
            
            {/* Send button - only for comments */}
            {activeCommentTab === 'comment' && (
              <button
                onClick={handleAddComment}
                disabled={!comment.trim()}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  !comment.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-100 text-blue-600"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Email Settings Dialog */}
      {workspaceId && (
        <EmailSettingsDialog
          workspaceId={workspaceId}
          open={showEmailSettings}
          onOpenChange={setShowEmailSettings}
          onAccountsUpdated={refreshConnection}
        />
      )}

      {/* Full Email Composer */}
      {workspaceId && applications.length === 1 && (
        <FullEmailComposer
          open={showFullComposer}
          onClose={() => setShowFullComposer(false)}
          workspaceId={workspaceId}
          formId={formId}
          submissionId={applications[0]?.id}
          recipientEmails={applications[0]?.email ? [applications[0].email] : []}
          onSent={() => {
            if (onSendEmail) {
              onSendEmail(
                applications[0]?.email || '',
                emailSubject,
                emailBody,
                { submissionIds: [applications[0]?.id].filter(Boolean) }
              );
            }
          }}
        />
      )}

      {/* Campaign Composer */}
      {workspaceId && applications.length > 0 && (
        <CampaignComposer
          open={showCampaignComposer}
          onClose={() => setShowCampaignComposer(false)}
          workspaceId={workspaceId}
          formId={formId}
          selectedSubmissionIds={applications.map(app => app.id).filter(Boolean)}
          onSent={() => {
            if (onSendEmail) {
              onSendEmail(
                applications.map(app => app.email).filter(Boolean).join(', '),
                emailSubject,
                emailBody,
                { submissionIds: applications.map(app => app.id).filter(Boolean) }
              );
            }
          }}
        />
      )}

      {/* Email Management Dashboard */}
      {workspaceId && (
        <EmailManagementDashboard
          open={showEmailDashboard}
          onClose={() => setShowEmailDashboard(false)}
          workspaceId={workspaceId}
          formId={formId}
        />
      )}
    </div>
  );
}
