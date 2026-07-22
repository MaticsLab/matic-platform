'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { emailClient, SendEmailRequest, EmailAttachment, EmailSignature } from '@/lib/api/email-client';
import { dashboardClient } from '@/lib/api/dashboard-client';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import type { EditorInstance } from '@/lib/novel';
import { Application } from './types';

/**
 * Owns all state + handlers for the email composer docked under the Activity
 * panel (shared between its sidebar/compact and modal-fullscreen/full variants).
 * Split out of ApplicationDetail because the composer is the single largest
 * cluster of state in that component.
 */
export function useApplicationEmailComposer(
  application: Application,
  workspaceId: string | undefined,
  formId: string | undefined,
  onActivityCreated?: () => void,
) {
  const [emailTo, setEmailTo] = useState(application.email || '');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<EmailAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showEmailSettings, setShowEmailSettings] = useState(false);

  // Email composer state
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const [showAIComposer, setShowAIComposer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const emailEditorRef = useRef<EditorInstance | null>(null);

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

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { authClient } = await import('@/auth/client/main');
      const session = await authClient.getSession();
      setUserId(session?.data?.user?.id || null);
    };
    getUser();
  }, []);

  const loadSignatures = async () => {
    if (!userId || !workspaceId) return;
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

  // Load signatures when userId is available
  useEffect(() => {
    if (userId && workspaceId) {
      loadSignatures();
    }
  }, [userId, workspaceId]);

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

  // Update emailTo when application changes
  useEffect(() => {
    const email = application.email || (application.raw_data?.email as string) || (application.raw_data?.Email as string) || '';
    setEmailTo(email);
    setSelectedAttachments([]); // Clear attachments when application changes
  }, [application.id, application.email, application.raw_data]);

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

  // Send email using email client
  const handleSendEmail = async () => {
    if (!workspaceId) {
      toast.error('Workspace not configured');
      return;
    }

    if (!canSendEmail) {
      toast.error(sendBlockedReason || 'Cannot send email');
      return;
    }

    if (!emailSubject.trim() || !hasBodyContent(emailBody)) {
      toast.error('Please enter a subject and message');
      return;
    }

    const recipientEmail = emailTo.trim() || application.email;
    if (!recipientEmail) {
      toast.error('No recipient email address');
      return;
    }

    setIsSending(true);
    try {
      // Find the account ID for the selected email
      const selectedAccount = emailAccounts.find(acc => acc.email === selectedFromEmail);

      // Process email body to extract signature content from data attributes
      const processSignatureHTML = (html: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const signatureDivs = doc.querySelectorAll('div[data-type="emailSignature"]');

        const decodeHtmlEntities = (input: string): string => {
          const textarea = doc.createElement('textarea');
          textarea.innerHTML = input;
          return textarea.value;
        };

        signatureDivs.forEach((div) => {
          const content = div.getAttribute('data-content');
          if (content) {
            const decoded = decodeHtmlEntities(content);
            const wrapper = doc.createElement('div');
            wrapper.innerHTML = decoded;
            div.replaceWith(...Array.from(wrapper.childNodes));
          } else {
            const decodedInner = decodeHtmlEntities(div.innerHTML);
            div.innerHTML = decodedInner;
          }
        });

        return doc.body.innerHTML;
      };

      const processedBody = processSignatureHTML(emailBody);

      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: [application.id],
        recipient_emails: [recipientEmail], // Explicitly pass the recipient email
        subject: emailSubject,
        body: processedBody,
        body_html: processedBody,
        is_html: true, // Rich text editor produces HTML
        merge_tags: true,
        track_opens: true,
        attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined,
        sender_account_id: selectedAccount?.id || undefined,
      };

      const result = await emailClient.send(workspaceId, request);

      if (result.success) {
        // Log activity for the email sent
        try {
          await dashboardClient.createActivity(application.id, {
            activityType: 'message',
            content: `Email sent to ${recipientEmail}\n\nSubject: ${emailSubject}\n\n${emailBody.replace(/<[^>]*>/g, '')}`,
            visibility: 'internal',
            metadata: {
              type: 'email_sent',
              to: recipientEmail,
              subject: emailSubject,
              from: selectedFromEmail || gmailConnection?.email
            }
          });
          // Trigger refresh of activities if callback exists
          if (onActivityCreated) {
            onActivityCreated();
          }
        } catch (activityError) {
          console.error('Failed to log email activity:', activityError);
          // Don't fail the email send if activity logging fails
        }

        toast.success('Email sent successfully!');
        setEmailSubject('');
        setEmailBody('');
        setSelectedAttachments([]);
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

  return {
    emailTo,
    setEmailTo,
    emailSubject,
    setEmailSubject,
    emailBody,
    setEmailBody,
    showCcBcc,
    setShowCcBcc,
    emailCc,
    setEmailCc,
    emailBcc,
    setEmailBcc,
    isSending,
    showEmailSettings,
    setShowEmailSettings,
    signatures,
    isLoadingSignatures,
    showSignatureDropdown,
    setShowSignatureDropdown,
    showAIComposer,
    setShowAIComposer,
    emailEditorRef,
    gmailConnection,
    emailAccounts,
    isCheckingConnection,
    selectedFromEmail,
    setSelectedFromEmail,
    canSendEmail,
    sendBlockedReason,
    handleOAuthError,
    refreshConnection,
    handleInsertSignature,
    handleSendEmail,
  };
}
