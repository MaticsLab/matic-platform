'use client';

import React from 'react';
import { Sparkles, FileSignature, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailSignature } from '@/lib/api/email-client';

interface ApplicationEmailComposerToolbarProps {
  signatures: EmailSignature[];
  isLoadingSignatures: boolean;
  showSignatureDropdown: boolean;
  setShowSignatureDropdown: (value: boolean) => void;
  handleInsertSignature: (signature: EmailSignature) => void;
  setShowEmailSettings: (value: boolean) => void;
  setShowAIComposer: (value: boolean) => void;
  handleSendEmail: () => void;
  isSending: boolean;
}

/** The AI-compose / signature-dropdown / send row docked under the email body —
 *  byte-identical between the compact (sidebar) and full (modal/fullscreen)
 *  composer variants, so it's shared rather than duplicated. */
export function ApplicationEmailComposerToolbar({
  signatures,
  isLoadingSignatures,
  showSignatureDropdown,
  setShowSignatureDropdown,
  handleInsertSignature,
  setShowEmailSettings,
  setShowAIComposer,
  handleSendEmail,
  isSending,
}: ApplicationEmailComposerToolbarProps) {
  return (
    <div className="flex items-center justify-between pt-2 border-t">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowAIComposer(true)}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600"
          title="AI Email Composer"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowSignatureDropdown(!showSignatureDropdown)}
            disabled={isLoadingSignatures || signatures.length === 0}
            className="px-2 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
              <div className="absolute bottom-full right-0 mb-1 z-20 bg-white border rounded-md shadow-lg min-w-[200px] max-h-60 overflow-auto">
                {isLoadingSignatures ? (
                  <div className="p-3 text-sm text-gray-500">Loading signatures...</div>
                ) : signatures.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    No signatures available.
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setShowSignatureDropdown(false);
                        setShowEmailSettings(true);
                      }}
                      className="text-blue-600 hover:underline ml-1"
                    >
                      Create one in settings
                    </button>
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
      </div>
      <button
        onClick={handleSendEmail}
        disabled={isSending}
        className={cn(
          "p-1.5 rounded transition-colors",
          isSending ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-100 text-blue-600"
        )}
      >
        {isSending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
