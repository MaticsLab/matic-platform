'use client';

import React from 'react';
import {
  X, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Clock3, UserPlus, FileSignature, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui-components/button';
import { ScrollArea } from '@/ui-components/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui-components/popover';
import { RecommendationRequest } from '@/lib/api/recommendations-client';
import { GmailAccount } from '@/lib/api/email-client';

interface ApplicationRecommendersPanelProps {
  /** 'fullscreen' shows as a fixed-width right rail (only reachable in fullscreen view mode);
   *  'sidebar' replaces the details panel in sidebar/modal view mode. The two variants have
   *  always had slightly different chrome and, notably, only 'sidebar' supports expanding a
   *  submitted recommendation to see its attached document — preserved here exactly as before. */
  variant: 'fullscreen' | 'sidebar';
  recommendations: RecommendationRequest[];
  loadingRecommendations: boolean;
  emailAccounts: GmailAccount[];
  selectedReminderAccount: string;
  setSelectedReminderAccount: (id: string) => void;
  sendingReminder: string | null;
  handleSendReminder: (requestId: string) => void;
  onClose: () => void;
  expandedRecommendations: Set<string>;
  setExpandedRecommendations: (ids: Set<string>) => void;
}

export function ApplicationRecommendersPanel({
  variant,
  recommendations,
  loadingRecommendations,
  emailAccounts,
  selectedReminderAccount,
  setSelectedReminderAccount,
  sendingReminder,
  handleSendReminder,
  onClose,
  expandedRecommendations,
  setExpandedRecommendations,
}: ApplicationRecommendersPanelProps) {
  if (variant === 'fullscreen') {
    return (
      <div className="w-80 flex flex-col overflow-hidden border-l border-gray-200">
          <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">References</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Email Account Selector for Reminders */}
          {emailAccounts.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Send reminders from:
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs h-8"
                  >
                    <span className="truncate">
                      {(() => {
                        const accountId = selectedReminderAccount || emailAccounts.find(acc => acc.is_default)?.id;
                        const account = emailAccounts.find(a => a.id === accountId);
                        if (!account) return 'Select email account...';
                        return `${account.display_name || account.email.split('@')[0]} (${account.email})`;
                      })()}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <div className="p-1">
                    {emailAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => setSelectedReminderAccount(account.id)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs rounded hover:bg-gray-100 transition-colors",
                          (selectedReminderAccount === account.id || (!selectedReminderAccount && account.is_default)) && "bg-blue-50"
                        )}
                      >
                        <div className="font-medium truncate">
                          {account.display_name || account.email.split('@')[0]}
                          {account.is_default && <span className="ml-1 text-blue-600">(Default)</span>}
                        </div>
                        <div className="text-gray-500 truncate">{account.email}</div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {loadingRecommendations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No reference requests found
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      rec.status === 'submitted' ? "bg-green-50 border-green-200" :
                      rec.status === 'expired' ? "bg-red-50 border-red-200" :
                      rec.status === 'cancelled' ? "bg-gray-50 border-gray-200" :
                      "bg-yellow-50 border-yellow-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {rec.status === 'submitted' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : rec.status === 'expired' ? (
                            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          ) : rec.status === 'cancelled' ? (
                            <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <Clock3 className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {rec.recommender_name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {rec.recommender_email}
                          {rec.recommender_relationship && ` • ${rec.recommender_relationship}`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: <span className="capitalize">{rec.status}</span>
                          {rec.created_at && (
                            <> • Requested {new Date(rec.created_at).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                      {rec.status === 'pending' && (
                        <button
                          onClick={() => handleSendReminder(rec.id)}
                          disabled={sendingReminder === rec.id}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          {sendingReminder === rec.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Remind'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-100">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          References
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Email Account Selector for Reminders */}
      {emailAccounts.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">
            Send reminders from:
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs h-7"
              >
                <span className="truncate">
                  {(() => {
                    const accountId = selectedReminderAccount || emailAccounts.find(acc => acc.is_default)?.id;
                    const account = emailAccounts.find(a => a.id === accountId);
                    if (!account) return 'Select email account...';
                    return `${account.display_name || account.email.split('@')[0]}`;
                  })()}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-1">
                {emailAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setSelectedReminderAccount(account.id)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs rounded hover:bg-gray-100 transition-colors",
                      (selectedReminderAccount === account.id || (!selectedReminderAccount && account.is_default)) && "bg-blue-50"
                    )}
                  >
                    <div className="font-medium truncate">
                      {account.display_name || account.email.split('@')[0]}
                      {account.is_default && <span className="ml-1 text-blue-600">(Default)</span>}
                    </div>
                    <div className="text-gray-500 truncate">{account.email}</div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        {loadingRecommendations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No reference requests found
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const isExpanded = expandedRecommendations.has(rec.id);
              let uploadedDocument = null;

              // Extract document from response
              if (rec.status === 'submitted' && rec.response) {
                try {
                  const response = typeof rec.response === 'string' ? JSON.parse(rec.response) : rec.response;
                  uploadedDocument = response.uploaded_document;
                } catch (err) {
                  console.error('Failed to parse recommendation response:', err);
                }
              }

              return (
              <div
                key={rec.id}
                className={cn(
                  "rounded-lg border",
                  rec.status === 'submitted' ? "bg-green-50 border-green-200" :
                  rec.status === 'expired' ? "bg-red-50 border-red-200" :
                  rec.status === 'cancelled' ? "bg-gray-50 border-gray-200" :
                  "bg-yellow-50 border-yellow-200"
                )}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {rec.status === 'submitted' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : rec.status === 'expired' ? (
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        ) : rec.status === 'cancelled' ? (
                          <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <Clock3 className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {rec.recommender_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {rec.recommender_email}
                        {rec.recommender_relationship && ` • ${rec.recommender_relationship}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Status: <span className="capitalize">{rec.status}</span>
                        {rec.created_at && (
                          <> • Requested {new Date(rec.created_at).toLocaleDateString()}</>
                        )}
                        {rec.submitted_at && rec.status === 'submitted' && (
                          <> • Submitted {new Date(rec.submitted_at).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {rec.status === 'pending' && (
                        <button
                          onClick={() => handleSendReminder(rec.id)}
                          disabled={sendingReminder === rec.id}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          {sendingReminder === rec.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Remind'
                          )}
                        </button>
                      )}
                      {rec.status === 'submitted' && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedRecommendations);
                            if (isExpanded) {
                              newExpanded.delete(rec.id);
                            } else {
                              newExpanded.add(rec.id);
                            }
                            setExpandedRecommendations(newExpanded);
                          }}
                          className="p-1 hover:bg-white/50 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details for submitted recommendations */}
                {isExpanded && rec.status === 'submitted' && (
                  <div className="border-t border-green-200 bg-white p-3 space-y-2">
                    {uploadedDocument && uploadedDocument.url && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                          <FileSignature className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {uploadedDocument.name || uploadedDocument.filename || 'Reference Letter'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {uploadedDocument.content_type || uploadedDocument.mime_type || 'Document'}
                          </p>
                        </div>
                        <a
                          href={uploadedDocument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="View document"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </a>
                      </div>
                    )}
                    {!uploadedDocument && (
                      <p className="text-xs text-gray-500 italic">No document attached</p>
                    )}
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
