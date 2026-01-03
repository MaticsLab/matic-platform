'use client';

import { useState, useEffect } from 'react';
import { Send, Mail, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { emailClient, EmailTemplate } from '@/lib/api/email-client';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import { Button } from '@/ui-components/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui-components/sheet';
import { cn } from '@/lib/utils';

interface QuickReminderPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  formId?: string;
  submissionId: string;
  recipientEmail: string;
  recipientName?: string;
  onSent?: () => void;
}

export function QuickReminderPanel({
  open,
  onClose,
  workspaceId,
  formId,
  submissionId,
  recipientEmail,
  recipientName,
  onSent
}: QuickReminderPanelProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const { canSendEmail, sendBlockedReason, handleOAuthError } = useEmailConnection(workspaceId);

  // Load templates
  useEffect(() => {
    if (open && workspaceId) {
      loadTemplates();
    }
  }, [open, workspaceId, formId]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await emailClient.getTemplates(workspaceId, formId);
      // Filter for reminder templates or show all
      const reminderTemplates = data.filter(t => 
        (t as any).category === 'reminder' || 
        t.name.toLowerCase().includes('reminder') ||
        t.type === 'automated'
      );
      setTemplates(reminderTemplates.length > 0 ? reminderTemplates : data.slice(0, 5));
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
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
    }
  }, [open]);

  const handleSend = async () => {
    if (!canSendEmail) {
      toast.error(sendBlockedReason || 'Cannot send email');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    setIsSending(true);
    try {
      const result = await emailClient.send(workspaceId, {
        form_id: formId,
        submission_ids: [submissionId],
        recipient_emails: [recipientEmail],
        subject: subject.trim(),
        body: body.trim(),
        is_html: true,
        merge_tags: true,
        track_opens: true,
      });

      if (result.success) {
        toast.success('Reminder sent successfully!');
        onSent?.();
        onClose();
      } else {
        const errorMessage = result.errors?.[0] || 'Failed to send reminder';
        handleOAuthError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send reminder. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <SheetTitle>Send Reminder</SheetTitle>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex flex-col h-[calc(100vh-73px)]">
          {/* Recipient Info */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="text-sm text-gray-600">To:</div>
            <div className="font-medium">
              {recipientName || recipientEmail}
            </div>
            <div className="text-sm text-gray-500">{recipientEmail}</div>
          </div>

          {/* Template Selector */}
          <div className="p-4 border-b">
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

          {/* Subject */}
          <div className="p-4 border-b">
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
          <div className="flex-1 p-4 border-b overflow-auto">
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Your message... (merge tags like {{First Name}} will be replaced)"
              className="w-full h-full min-h-[200px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="mt-2 text-xs text-gray-500">
              Tip: Use merge tags like {'{{First Name}}'} to personalize your message
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t bg-gray-50 flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !subject.trim() || !body.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Reminder
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

