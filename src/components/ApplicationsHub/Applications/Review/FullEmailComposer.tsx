'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Mail, Loader2, ChevronDown, Clock, Eye, Save, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { emailClient, EmailTemplate, EmailDraft, CreateEmailDraftRequest, EmailSignature } from '@/lib/api/email-client';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import { useSession } from '@/components/auth/provider';
import { Button } from '@/ui-components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog';
import { EmailNovelEditor } from './EmailNovelEditor';
import { cn } from '@/lib/utils';
import type { EditorInstance } from 'novel';

interface FullEmailComposerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  formId?: string;
  submissionId?: string;
  recipientEmails?: string[];
  initialSubject?: string;
  initialBody?: string;
  templateId?: string;
  onSent?: () => void;
}

export function FullEmailComposer({
  open,
  onClose,
  workspaceId,
  formId,
  submissionId,
  recipientEmails = [],
  initialSubject = '',
  initialBody = '',
  templateId,
  onSent
}: FullEmailComposerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const [to, setTo] = useState<string>('');
  const [cc, setCc] = useState<string>('');
  const [bcc, setBcc] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emailEditorRef = useRef<EditorInstance | null>(null);

  const { canSendEmail, sendBlockedReason, handleOAuthError, selectedFromEmail, accounts } = useEmailConnection(workspaceId);
  const { data: session } = useSession();
  const userId = session?.user?.id || null;

  // Helper to check if HTML body has actual content (strips HTML tags and checks for text)
  const hasBodyContent = (html: string): boolean => {
    if (!html || !html.trim()) return false;
    // Remove HTML tags, entities, and check for actual text content
    const textContent = html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&[a-z]+;/gi, ' ') // Replace other HTML entities
      .trim();
    return textContent.length > 0;
  };

  // Initialize form
  useEffect(() => {
    if (open) {
      if (recipientEmails.length > 0) {
        setTo(recipientEmails.join(', '));
      }
      setSubject(initialSubject);
      setBody(initialBody);
      setCc('');
      setBcc('');
      setScheduledFor('');
      setSelectedTemplate(null);
      setDraftId(null);
      setLastSaved(null);
      loadTemplates();
      loadSignatures();
      if (templateId) {
        loadTemplate(templateId);
      }
    }
  }, [open, recipientEmails, initialSubject, initialBody, templateId]);

  // Auto-save draft every 10 seconds
  useEffect(() => {
    if (open && (subject.trim() || hasBodyContent(body))) {
      autoSaveIntervalRef.current = setInterval(() => {
        saveDraft();
      }, 10000); // 10 seconds

      return () => {
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
        }
      };
    }
  }, [open, subject, body, to, cc, bcc]);

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

  const loadSignatures = async () => {
    if (!userId) return;
    setIsLoadingSignatures(true);
    try {
      const data = await emailClient.listSignatures(workspaceId, userId);
      setSignatures(data || []);
    } catch (error) {
      console.error('Failed to load signatures:', error);
      setSignatures([]);
    } finally {
      setIsLoadingSignatures(false);
    }
  };

  const loadTemplate = async (id: string) => {
    try {
      const allTemplates = await emailClient.getTemplates(workspaceId, formId);
      const template = allTemplates.find(t => t.id === id);
      if (template) {
        setSelectedTemplate(template);
        setSubject(template.subject || '');
        setBody(template.body_html || template.body || '');
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  const saveDraft = useCallback(async () => {
    if (!workspaceId || !userId) return;
    if (!subject.trim() && !hasBodyContent(body)) return; // Don't save empty drafts

    setIsSavingDraft(true);
    try {
      const draftData: CreateEmailDraftRequest = {
        workspace_id: workspaceId,
        user_id: userId,
        form_id: formId,
        submission_id: submissionId,
        recipient_emails: to.split(',').map(e => e.trim()).filter(Boolean),
        subject: subject.trim(),
        body: body.trim(),
        body_html: body.trim(), // For now, treat as HTML
        template_id: selectedTemplate?.id,
        merge_fields: {},
        metadata: {
          cc: cc.trim(),
          bcc: bcc.trim(),
        },
      };

      if (draftId) {
        await emailClient.updateDraft(draftId, draftData);
      } else {
        const newDraft = await emailClient.createDraft(draftData);
        setDraftId(newDraft.id);
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
      // Don't show error toast for auto-save failures
    } finally {
      setIsSavingDraft(false);
    }
  }, [workspaceId, formId, submissionId, to, subject, body, cc, bcc, selectedTemplate, draftId]);

  const handleSend = async () => {
    if (!canSendEmail) {
      toast.error(sendBlockedReason || 'Cannot send email');
      return;
    }

    if (!to.trim()) {
      toast.error('Please enter at least one recipient');
      return;
    }

    if (!subject.trim() || !hasBodyContent(body)) {
      toast.error('Please enter a subject and message');
      return;
    }

    setIsSending(true);
    try {
      const emails = to.split(',').map(e => e.trim()).filter(Boolean);
      
      // Find the account ID for the selected email
      const selectedAccount = accounts.find(acc => acc.email === selectedFromEmail);
      
      // Process email body to extract signature content from data attributes
      const processSignatureHTML = (html: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const signatureDivs = doc.querySelectorAll('div[data-type="emailSignature"]');
        
        signatureDivs.forEach((div) => {
          const content = div.getAttribute('data-content');
          if (content) {
            div.innerHTML = content;
          }
        });
        
        return doc.body.innerHTML;
      };
      
      const processedBody = processSignatureHTML(body.trim());
      
      const request = {
        form_id: formId,
        submission_ids: submissionId ? [submissionId] : undefined,
        recipient_emails: emails,
        subject: subject.trim(),
        body: processedBody,
        is_html: true,
        merge_tags: true,
        track_opens: true,
        sender_account_id: selectedAccount?.id || undefined,
      };

      const result = await emailClient.send(workspaceId, request);

      if (result.success) {
        toast.success('Email sent successfully!');
        // Delete draft if exists
        if (draftId) {
          try {
            await emailClient.deleteDraft(draftId);
          } catch (error) {
            console.error('Failed to delete draft:', error);
          }
        }
        onSent?.();
        onClose();
      } else {
        const errorMessage = result.errors?.[0] || 'Failed to send email';
        handleOAuthError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject || '');
    setBody(template.body_html || template.body || '');
    setShowTemplateDropdown(false);
  };

  const handleInsertSignature = (signature: EmailSignature) => {
    if (emailEditorRef.current) {
      const editor = emailEditorRef.current;
      
      // Check if there's already a signature in the document
      let hasExistingSignature = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'emailSignature') {
          hasExistingSignature = true;
          return false;
        }
      });

      if (hasExistingSignature) {
        toast.error('A signature already exists. Please remove it first or change it using the menu.');
        setShowSignatureDropdown(false);
        return;
      }

      // Insert a paragraph break before signature if there's content
      const currentContent = editor.getHTML();
      
      if (currentContent.trim()) {
        // Insert a paragraph break (empty line) before the signature
        editor.commands.insertContent('<p><br></p>');
      }

      // Insert signature using the custom extension
      (editor.commands as any).insertSignature({
        id: signature.id,
        name: signature.name,
        content: signature.is_html ? (signature.content_html || signature.content) : signature.content,
        is_html: signature.is_html,
        content_html: signature.content_html,
      });
      
      setShowSignatureDropdown(false);
      toast.success('Signature added');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <DialogTitle>Compose Email</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-gray-500">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              {isSavingDraft && (
                <Save className="w-4 h-4 text-gray-400 animate-pulse" />
              )}
            </div>
          </div>
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
                            onClick={() => handleTemplateSelect(template)}
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

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium mb-2">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">CC (optional)</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">BCC (optional)</label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Message</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowSignatureDropdown(!showSignatureDropdown)}
                    disabled={isLoadingSignatures || signatures.length === 0}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add signature"
                  >
                    <FileSignature className="w-3 h-3" />
                    Add signature
                  </button>
                  {showSignatureDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowSignatureDropdown(false)}
                      />
                      <div className="absolute right-0 z-20 mt-1 bg-white border rounded-md shadow-lg min-w-[200px] max-h-60 overflow-auto">
                        {isLoadingSignatures ? (
                          <div className="p-3 text-sm text-gray-500">Loading signatures...</div>
                        ) : signatures.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">
                            No signatures available. 
                            <a 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                setShowSignatureDropdown(false);
                                // You could open email settings here
                              }}
                              className="text-blue-600 hover:underline ml-1"
                            >
                              Create one in settings
                            </a>
                          </div>
                        ) : (
                          signatures.map((signature) => (
                            <button
                              key={signature.id}
                              onClick={() => handleInsertSignature(signature)}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                                signature.is_default && "font-medium"
                              )}
                            >
                              {signature.name}
                              {signature.is_default && (
                                <span className="ml-2 text-xs text-gray-500">(Default)</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>
            {showPreview ? (
              <div className="w-full min-h-[300px] px-3 py-2 border rounded-md bg-gray-50 overflow-auto">
                <div dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden flex-1 flex flex-col min-h-[300px]">
                <EmailNovelEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Your message... (merge tags like {{First Name}} will be replaced)"
                  minHeight="300px"
                  className="flex-1"
                  editorRef={emailEditorRef}
                  availableSignatures={signatures}
                />
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              Tip: Use merge tags like {'{{First Name}}'} to personalize your message. Drafts are auto-saved every 10 seconds.
            </div>
          </div>

          {/* Scheduling (optional) */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Schedule for later (optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-1 text-xs text-gray-500">
              Leave empty to send immediately
            </div>
          </div>
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
            onClick={saveDraft}
            variant="outline"
            disabled={isSavingDraft}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !hasBodyContent(body) || !to.trim()}
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
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

