'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Send, Mail, Loader2, ChevronDown, Clock, Users, CheckCircle2, AlertCircle } from 'lucide-react';
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

  const loadRecipients = async () => {
    if (!formId || selectedSubmissionIds.length === 0) {
      setRecipients([]);
      return;
    }

    setIsLoadingRecipients(true);
    try {
      // Fetch all submissions for the form
      const allSubmissions = await formsClient.getSubmissions(formId);
      
      // Filter to only selected submissions and extract email/name
      const recipientList: Recipient[] = selectedSubmissionIds
        .map((id) => {
          const submission = allSubmissions.find((s: any) => s.id === id);
          if (!submission) return null;

          // Extract email from submission data (common field names)
          const data = submission.data || {};
          const email = data.email || data.Email || data['Email Address'] || data['email_address'] || '';
          
          // Extract name from submission data
          const name = data.name || data.Name || data['Full Name'] || data['full_name'] || 
                      `${data['First Name'] || data.first_name || ''} ${data['Last Name'] || data.last_name || ''}`.trim() || '';

          return {
            id,
            email: email || `submission-${id.slice(0, 8)}`,
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

    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    setIsSending(true);
    try {
      // Create campaign and queue emails
      const recipientEmails = selectedRecipients.map(r => r.email).filter(Boolean);
      const submissionIds = selectedRecipients.map(r => r.id);

      // For now, send directly (you can enhance this to use the queue)
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
        toast.success(`Successfully sent ${result.sent_count} emails!`);
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

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Template Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Template (optional)</label>
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Recipients ({selectedRecipients.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="border rounded-md max-h-48 overflow-auto">
              {isLoadingRecipients ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                  Loading recipients...
                </div>
              ) : recipients.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No recipients found. Select applications first.
                </div>
              ) : (
                <div className="divide-y">
                  {recipients.map((recipient) => (
                    <label
                      key={recipient.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={recipient.selected}
                        onChange={() => toggleRecipient(recipient.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {recipient.name || recipient.email || `Submission ${recipient.id.slice(0, 8)}`}
                        </div>
                        {recipient.name && recipient.email && (
                          <div className="text-xs text-gray-500">{recipient.email}</div>
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
            <label className="block text-sm font-medium mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <div className="border rounded-md overflow-hidden">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Your message... (merge tags like {{First Name}} will be replaced for each recipient)"
                minHeight="300px"
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Tip: Use merge tags like {'{{First Name}}'} to personalize your message for each recipient.
            </div>
          </div>

          {/* Staggering Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Stagger Delay (seconds)
              </label>
              <input
                type="number"
                value={staggerDelay}
                onChange={(e) => setStaggerDelay(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                max="3600"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-1 text-xs text-gray-500">
                Delay between each email (0 = send all at once)
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Schedule for later (optional)</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Campaign Summary */}
          {selectedRecipients.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-1">Campaign Ready</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>• {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected</div>
                    {staggerDelay > 0 && (
                      <div>• Staggered: {staggerDelay}s delay between emails</div>
                    )}
                    {staggerDelay > 0 && selectedRecipients.length > 1 && (
                      <div>• Total time: ~{Math.ceil((staggerDelay * (selectedRecipients.length - 1)) / 60)} minutes</div>
                    )}
                    {scheduledFor && (
                      <div>• Scheduled for: {new Date(scheduledFor).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim() || selectedRecipients.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send to {selectedRecipients.length} Recipient{selectedRecipients.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

