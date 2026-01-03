'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Send, Mail, Loader2, ChevronDown, Clock, Users, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { emailClient, EmailTemplate, EmailQueueItem } from '@/lib/api/email-client';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import { formsClient } from '@/lib/api/forms-client';
import { Button } from '@/ui-components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog';
import { RichTextEditor } from '@/components/PortalBuilder/RichTextEditor';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/ui-components/checkbox';

interface CampaignComposerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  formId?: string;
  selectedSubmissionIds?: string[];
  onSent?: () => void;
}

interface Recipient {
  id: string;
  email: string;
  name?: string;
  selected: boolean;
}

export function CampaignComposer({
  open,
  onClose,
  workspaceId,
  formId,
  selectedSubmissionIds = [],
  onSent
}: CampaignComposerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [staggerDelay, setStaggerDelay] = useState<number>(0); // seconds between emails
  const [scheduledFor, setScheduledFor] = useState<string>('');

  const { canSendEmail, sendBlockedReason, handleOAuthError } = useEmailConnection(workspaceId);

  // Load templates
  useEffect(() => {
    if (open && workspaceId) {
      loadTemplates();
      loadRecipients();
    }
  }, [open, workspaceId, formId, selectedSubmissionIds]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await emailClient.getTemplates(workspaceId, formId);
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Helper function to extract email from submission data
  const extractEmail = (data: Record<string, any>): string => {
    // Check common email field names
    const emailFields = [
      '_applicant_email', 'email', 'Email', 'EMAIL',
      'personal_email', 'personalEmail', 'work_email', 'workEmail',
      'contact_email', 'contactEmail', 'email_address', 'emailAddress',
      'Email Address', 'email_address'
    ];
    
    for (const field of emailFields) {
      const value = data[field];
      if (typeof value === 'string' && value.includes('@')) {
        return value;
      }
    }
    
    // Check nested personal object
    if (data.personal && typeof data.personal === 'object') {
      const personalEmail = (data.personal as any).personalEmail || (data.personal as any).email;
      if (personalEmail && typeof personalEmail === 'string' && personalEmail.includes('@')) {
        return personalEmail;
      }
    }
    
    // Search all fields for email-like values
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
        return value;
      }
    }
    
    return '';
  };

  // Helper function to extract name from submission data
  const extractName = (data: Record<string, any>, submission: any): string => {
    // Check for applicant_full_name from portal_applicants
    if (submission.applicant_full_name) {
      return submission.applicant_full_name;
    }
    
    // Check common name fields
    const nameFields = [
      'name', 'Name', 'full_name', 'fullName', 'Full Name',
      'applicant_name', 'applicantName'
    ];
    
    for (const field of nameFields) {
      const value = data[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    
    // Try first + last name
    const firstName = data['First Name'] || data.first_name || data.firstName || '';
    const lastName = data['Last Name'] || data.last_name || data.lastName || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return '';
  };

  const loadRecipients = async () => {
    if (!formId || selectedSubmissionIds.length === 0) {
      setRecipients([]);
      return;
    }

    setIsLoadingRecipients(true);
    try {
      // Fetch all submissions for the form
      const allSubmissions = await formsClient.getSubmissions(formId) as Array<{ 
        id: string; 
        data?: Record<string, any> | string;
        applicant_full_name?: string;
      }>;
      
      // Filter to only selected submissions and extract email/name
      const recipientList: Recipient[] = selectedSubmissionIds
        .map((id) => {
          const submission = allSubmissions.find((s) => s.id === id);
          if (!submission) return null;

          // Parse data if it's a string
          const data = typeof submission.data === 'string' 
            ? JSON.parse(submission.data) 
            : (submission.data || {});
          
          const email = extractEmail(data);
          const name = extractName(data, submission);

          if (!email) {
            console.warn(`No email found for submission ${id}`);
          }

          return {
            id,
            email: email || `No email (${id.slice(0, 8)})`,
            name: name || undefined,
            selected: true,
          };
        })
        .filter((r): r is Recipient => r !== null);

      setRecipients(recipientList);
    } catch (error) {
      console.error('Failed to load recipients:', error);
      toast.error('Failed to load recipients');
      setRecipients([]);
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject || '');
      setBody(selectedTemplate.body_html || selectedTemplate.body || '');
    }
  }, [selectedTemplate]);

  // Reset when panel opens
  useEffect(() => {
    if (open) {
      setSubject('');
      setBody('');
      setSelectedTemplate(null);
      setStaggerDelay(0);
      setScheduledFor('');
    }
  }, [open]);

  const selectedRecipients = useMemo(() => {
    return recipients.filter(r => r.selected);
  }, [recipients]);

  const validRecipients = useMemo(() => {
    return selectedRecipients.filter(r => {
      const email = r.email.trim();
      return email && email.includes('@') && !email.startsWith('No email');
    });
  }, [selectedRecipients]);

  const toggleRecipient = (id: string) => {
    setRecipients(prev =>
      prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r)
    );
  };

  const selectAll = () => {
    setRecipients(prev => prev.map(r => ({ ...r, selected: true })));
  };

  const deselectAll = () => {
    setRecipients(prev => prev.map(r => ({ ...r, selected: false })));
  };

  const handleSend = async () => {
    if (!canSendEmail) {
      toast.error(sendBlockedReason || 'Cannot send email');
      return;
    }

    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    // Filter out recipients without valid emails
    const validRecipients = selectedRecipients.filter(r => {
      const email = r.email.trim();
      return email && email.includes('@') && !email.startsWith('No email');
    });

    if (validRecipients.length === 0) {
      toast.error('No recipients with valid email addresses selected');
      return;
    }

    if (validRecipients.length < selectedRecipients.length) {
      const invalidCount = selectedRecipients.length - validRecipients.length;
      toast.warning(`${invalidCount} recipient${invalidCount !== 1 ? 's' : ''} without email addresses will be skipped`);
    }

    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    setIsSending(true);
    try {
      // Create campaign and queue emails
      const recipientEmails = validRecipients.map(r => r.email.trim()).filter(Boolean);
      const submissionIds = validRecipients.map(r => r.id);

      const request = {
        form_id: formId,
        submission_ids: submissionIds,
        recipient_emails: recipientEmails,
        subject: subject.trim(),
        body: body.trim(),
        is_html: true,
        merge_tags: true,
        track_opens: true,
      };

      const result = await emailClient.send(workspaceId, request);

      if (result.success) {
        toast.success(`Successfully sent ${result.sent_count} email${result.sent_count !== 1 ? 's' : ''}!`);
        onSent?.();
        onClose();
      } else {
        const errorMessage = result.errors?.[0] || 'Failed to send some emails';
        handleOAuthError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to send campaign:', error);
      toast.error('Failed to send campaign. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <DialogTitle>Campaign Composer</DialogTitle>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Send emails to multiple recipients with staggered delivery
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Template Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Template (optional)</label>
            <div className="relative">
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-md hover:bg-gray-50"
                disabled={isLoadingTemplates}
              >
                <span className="text-sm">
                  {selectedTemplate ? selectedTemplate.name : 'Select a template...'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {showTemplateDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowTemplateDropdown(false)}
                  />
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {isLoadingTemplates ? (
                      <div className="p-3 text-sm text-gray-500">Loading templates...</div>
                    ) : templates.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No templates available</div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedTemplate(null);
                            setShowTemplateDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b"
                        >
                          None (Custom)
                        </button>
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => {
                              setSelectedTemplate(template);
                              setShowTemplateDropdown(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                              selectedTemplate?.id === template.id && "bg-blue-50"
                            )}
                          >
                            {template.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recipients Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-semibold text-gray-900">
                  Recipients
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-600">
                    {selectedRecipients.length} of {recipients.length} selected
                  </span>
                  {validRecipients.length < selectedRecipients.length && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-amber-600 font-medium">
                        {selectedRecipients.length - validRecipients.length} without email
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs font-medium text-gray-600 hover:text-gray-700 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg bg-white shadow-sm max-h-64 overflow-auto">
              {isLoadingRecipients ? (
                <div className="p-6 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-gray-500">Loading recipients...</p>
                </div>
              ) : recipients.length === 0 ? (
                <div className="p-6 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No recipients found. Select applications first.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recipients.map((recipient) => (
                    <label
                      key={recipient.id}
                      className={cn(
                        "flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors",
                        recipient.selected && "bg-blue-50/50"
                      )}
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          checked={recipient.selected}
                          onChange={() => toggleRecipient(recipient.id)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            {recipient.name ? (
                              <>
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {recipient.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                  {recipient.email}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {recipient.email}
                              </div>
                            )}
                          </div>
                        </div>
                        {recipient.email.startsWith('No email') && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              No email address
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Message</label>
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Your message... (merge tags like {{First Name}} will be replaced for each recipient)"
                minHeight="320px"
              />
            </div>
            <div className="mt-2 flex items-start gap-2 text-xs text-gray-500 bg-blue-50 p-2 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Tip:</strong> Use merge tags like {'{{First Name}}'}, {'{{Last Name}}'}, {'{{Email}}'} to personalize your message for each recipient.
              </span>
            </div>
          </div>

          {/* Staggering Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                Stagger Delay
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={staggerDelay}
                  onChange={(e) => setStaggerDelay(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  max="3600"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">seconds</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Delay between each email (0 = send all at once)
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                Schedule for later (optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <div className="mt-2 text-xs text-gray-500">
                Leave empty to send immediately
              </div>
            </div>
          </div>

          {/* Campaign Summary */}
          {selectedRecipients.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-3 text-base">Campaign Summary</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-xs text-gray-600">Valid Recipients</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {validRecipients.length} {validRecipients.length === 1 ? 'recipient' : 'recipients'}
                        </div>
                        {validRecipients.length < selectedRecipients.length && (
                          <div className="text-xs text-amber-600 mt-0.5">
                            {selectedRecipients.length - validRecipients.length} without email
                          </div>
                        )}
                      </div>
                    </div>
                    {staggerDelay > 0 && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs text-gray-600">Stagger Delay</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {staggerDelay}s between emails
                          </div>
                        </div>
                      </div>
                    )}
                    {staggerDelay > 0 && selectedRecipients.length > 1 && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs text-gray-600">Total Duration</div>
                          <div className="text-sm font-semibold text-gray-900">
                            ~{Math.ceil((staggerDelay * (selectedRecipients.length - 1)) / 60)} minutes
                          </div>
                        </div>
                      </div>
                    )}
                    {scheduledFor && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs text-gray-600">Scheduled</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {new Date(scheduledFor).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedRecipients.length > 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>
                  Ready to send to <strong className="text-gray-900">{validRecipients.length}</strong> recipient{validRecipients.length !== 1 ? 's' : ''}
                  {validRecipients.length < selectedRecipients.length && (
                    <span className="text-amber-600 ml-1">
                      ({selectedRecipients.length - validRecipients.length} without email will be skipped)
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <span className="text-gray-400">Select recipients to continue</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSending}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !subject.trim() || !body.trim() || validRecipients.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {validRecipients.length} Recipient{validRecipients.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

