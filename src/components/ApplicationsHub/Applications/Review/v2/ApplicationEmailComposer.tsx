'use client';

import React, { MutableRefObject } from 'react';
import { Mail, ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui-components/popover';
import { GmailAccount, GmailConnection, EmailSignature } from '@/lib/api/email-client';
import { EmailNovelEditor } from '../EmailNovelEditor';
import type { EditorInstance } from '@/lib/novel';
import { Application } from './types';
import { ApplicationEmailComposerToolbar } from './ApplicationEmailComposerToolbar';

interface ApplicationEmailComposerProps {
  /** 'compact' is the composer docked under the sidebar-mode Activity panel;
   *  'full' is the composer docked under the modal/fullscreen-mode Activity panel.
   *  The two have always had different sizing/spacing and 'full' additionally shows a
   *  "suggested emails" quick-fill row that 'compact' does not — preserved exactly as before. */
  variant: 'compact' | 'full';
  application: Application;
  emailTo: string;
  setEmailTo: (value: string) => void;
  showCcBcc: boolean;
  setShowCcBcc: (value: boolean) => void;
  emailCc: string;
  setEmailCc: (value: string) => void;
  emailBcc: string;
  setEmailBcc: (value: string) => void;
  emailSubject: string;
  setEmailSubject: (value: string) => void;
  emailBody: string;
  setEmailBody: (value: string) => void;
  emailEditorRef: MutableRefObject<EditorInstance | null>;
  signatures: EmailSignature[];
  isLoadingSignatures: boolean;
  selectedFromEmail: string;
  setSelectedFromEmail: (email: string) => void;
  emailAccounts: GmailAccount[];
  gmailConnection: GmailConnection | null;
  showSignatureDropdown: boolean;
  setShowSignatureDropdown: (value: boolean) => void;
  handleInsertSignature: (signature: EmailSignature) => void;
  setShowEmailSettings: (value: boolean) => void;
  setShowAIComposer: (value: boolean) => void;
  handleSendEmail: () => void;
  isSending: boolean;
}

export function ApplicationEmailComposer({
  variant,
  application,
  emailTo,
  setEmailTo,
  showCcBcc,
  setShowCcBcc,
  emailCc,
  setEmailCc,
  emailBcc,
  setEmailBcc,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
  emailEditorRef,
  signatures,
  isLoadingSignatures,
  selectedFromEmail,
  setSelectedFromEmail,
  emailAccounts,
  gmailConnection,
  showSignatureDropdown,
  setShowSignatureDropdown,
  handleInsertSignature,
  setShowEmailSettings,
  setShowAIComposer,
  handleSendEmail,
  isSending,
}: ApplicationEmailComposerProps) {
  if (variant === 'compact') {
    return (
      <div className="border-t border-gray-100 bg-gray-50/50 flex-shrink-0 p-2">
        <div className="bg-white rounded-lg border border-gray-100 p-2 space-y-1.5">
          {/* From field */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10">From</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex-1 flex items-center gap-1.5 text-xs text-foreground hover:bg-gray-50 rounded px-2 py-1 transition-colors border border-gray-100">
                  {(() => {
                    const email = selectedFromEmail || gmailConnection?.email;
                    if (!email) return <span className="text-muted-foreground">Select sender...</span>;
                    const account = emailAccounts.find(a => a.email === email);
                    const name = account?.display_name || email.split('@')[0];
                    return (
                      <>
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground truncate">&lt;{email}&gt;</span>
                      </>
                    );
                  })()}
                  <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-white border border-gray-200 shadow-lg" align="start">
                <div className="max-h-48 overflow-y-auto">
                  {emailAccounts.map((account) => (
                    <button
                      key={account.email}
                      onClick={() => setSelectedFromEmail(account.email)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2",
                        selectedFromEmail === account.email && "bg-blue-50"
                      )}
                    >
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{account.email}</span>
                    </button>
                  ))}
                  {emailAccounts.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No email accounts connected
                    </div>
                  )}
                  <div className="border-t">
                    <button
                      onClick={() => setShowEmailSettings(true)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-600"
                    >
                      <Settings className="w-4 h-4" />
                      Configure Email Settings
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* To field */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10">To</span>
            <input
              type="text"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder={application.email}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            <button
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Cc Bcc
            </button>
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-12">Cc</span>
                <input
                  type="text"
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-12">Bcc</span>
                <input
                  type="text"
                  value={emailBcc}
                  onChange={(e) => setEmailBcc(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
            </>
          )}

          {/* Subject field */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 w-12">Subject</span>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email subject..."
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Email Body */}
          <div className="ml-14 relative flex-1 flex flex-col min-h-[200px] max-h-[400px] overflow-visible">
            <div className="flex-1 overflow-y-auto">
              <EmailNovelEditor
                value={emailBody}
                onChange={setEmailBody}
                placeholder="Say something, press 'space' for AI, '/' for commands"
                minHeight="200px"
                className="flex-1"
                editorRef={emailEditorRef}
                availableSignatures={signatures}
              />
            </div>
          </div>

          <ApplicationEmailComposerToolbar
            signatures={signatures}
            isLoadingSignatures={isLoadingSignatures}
            showSignatureDropdown={showSignatureDropdown}
            setShowSignatureDropdown={setShowSignatureDropdown}
            handleInsertSignature={handleInsertSignature}
            setShowEmailSettings={setShowEmailSettings}
            setShowAIComposer={setShowAIComposer}
            handleSendEmail={handleSendEmail}
            isSending={isSending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t bg-white flex-shrink-0 p-3">
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        {/* From field */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-12">From</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex-1 flex items-center gap-2 text-sm text-gray-900 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors bg-white border border-gray-200">
                {(() => {
                  const email = selectedFromEmail || gmailConnection?.email;
                  if (!email) return <span>Select sender...</span>;
                  const account = emailAccounts.find(a => a.email === email);
                  const name = account?.display_name || email.split('@')[0];
                  return (
                    <>
                      <span>{name}</span>
                      <span className="text-gray-500">&lt;{email}&gt;</span>
                    </>
                  );
                })()}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0 bg-white border border-gray-200 shadow-lg" align="start">
              <div className="max-h-48 overflow-y-auto">
                {emailAccounts.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => setSelectedFromEmail(account.email)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2",
                      selectedFromEmail === account.email && "bg-blue-50"
                    )}
                  >
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{account.email}</span>
                  </button>
                ))}
                {emailAccounts.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No email accounts connected
                  </div>
                )}
                <div className="border-t">
                  <button
                    onClick={() => setShowEmailSettings(true)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-600"
                  >
                    <Settings className="w-4 h-4" />
                    Configure Email Settings
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* To field */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-12">To</span>
          <input
            type="text"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder={application.email}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
          <button
            onClick={() => setShowCcBcc(!showCcBcc)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2"
          >
            Cc Bcc
          </button>
        </div>

        {/* Suggested Emails */}
        {application.email && (
          <div className="ml-14">
            <button
              onClick={() => setEmailTo(application.email || '')}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
            >
              {application.email}
            </button>
          </div>
        )}

        {showCcBcc && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-12">Cc</span>
              <input
                type="text"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-12">Bcc</span>
              <input
                type="text"
                value={emailBcc}
                onChange={(e) => setEmailBcc(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </>
        )}

        {/* Subject field */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-12">Subject</span>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Email subject..."
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>

        {/* Email Body */}
        <div className="ml-14 relative flex-1 flex flex-col min-h-[200px] max-h-[400px] overflow-visible">
          <div className="flex-1 overflow-y-auto">
            <EmailNovelEditor
              value={emailBody}
              onChange={setEmailBody}
              placeholder="Say something, press 'space' for AI, '/' for commands"
              minHeight="200px"
              className="flex-1"
              editorRef={emailEditorRef}
              availableSignatures={signatures}
            />
          </div>
        </div>

        <ApplicationEmailComposerToolbar
          signatures={signatures}
          isLoadingSignatures={isLoadingSignatures}
          showSignatureDropdown={showSignatureDropdown}
          setShowSignatureDropdown={setShowSignatureDropdown}
          handleInsertSignature={handleInsertSignature}
          setShowEmailSettings={setShowEmailSettings}
          setShowAIComposer={setShowAIComposer}
          handleSendEmail={handleSendEmail}
          isSending={isSending}
        />
      </div>
    </div>
  );
}
