'use client';

import React from 'react';
import {
  X, Loader2, RefreshCw, Folder, FileText, FileSignature, Eye,
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { ScrollArea } from '@/ui-components/scroll-area';
import type { TableFileResponse } from '@/types/files';
import { formatFileSize } from './ApplicationFieldValueDisplay';

interface AvailableDocument {
  name: string;
  url: string;
  contentType: string;
}

interface RecommendationDocument extends AvailableDocument {
  recommenderName: string;
  submittedAt?: string;
}

interface ApplicationDocumentsPanelProps {
  /** 'fullscreen' shows as a fixed-width right rail (only reachable in fullscreen view mode);
   *  'sidebar' replaces the details panel in sidebar/modal view mode. Chrome differs slightly
   *  between the two, preserved here exactly as before. */
  variant: 'fullscreen' | 'sidebar';
  isLoadingFiles: boolean;
  storageFiles: TableFileResponse[];
  availableDocuments: AvailableDocument[];
  recommendationDocuments: RecommendationDocument[];
  getFieldLabel: (fieldId?: string) => string | null;
  isExternalReviewer: boolean;
  isSyncingAllSubmissionsToDrive: boolean;
  isSyncingRecommendationsToDrive: boolean;
  handleSyncAllSubmissionsToDrive: () => void;
  handleSyncRecommendationDocumentsToDrive: () => void;
  formId?: string;
  onClose: () => void;
}

export function ApplicationDocumentsPanel({
  variant,
  isLoadingFiles,
  storageFiles,
  availableDocuments,
  recommendationDocuments,
  getFieldLabel,
  isExternalReviewer,
  isSyncingAllSubmissionsToDrive,
  isSyncingRecommendationsToDrive,
  handleSyncAllSubmissionsToDrive,
  handleSyncRecommendationDocumentsToDrive,
  formId,
  onClose,
}: ApplicationDocumentsPanelProps) {
  if (variant === 'fullscreen') {
    return (
      <div className="w-80 flex flex-col overflow-hidden border-l border-gray-200">
          <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
            <div className="flex items-center gap-2">
              {!isExternalReviewer && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncAllSubmissionsToDrive}
                    disabled={isSyncingAllSubmissionsToDrive || !formId}
                  >
                    {isSyncingAllSubmissionsToDrive ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                    )}
                    Sync All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncRecommendationDocumentsToDrive}
                    disabled={isSyncingRecommendationsToDrive}
                  >
                    {isSyncingRecommendationsToDrive ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Folder className="w-4 h-4 mr-1.5" />
                    )}
                    Sync Drive
                  </Button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : storageFiles.length === 0 && availableDocuments.length === 0 && recommendationDocuments.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No documents found
              </div>
            ) : (
              <div className="space-y-3">
                {/* Recommendation Documents */}
                {recommendationDocuments.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                      Recommendations
                    </h3>
                    {recommendationDocuments.map((doc, idx) => (
                      <div key={`fullscreen-rec-doc-${idx}`} className="border border-green-200 bg-green-50 rounded-lg p-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <FileSignature className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              <span className="text-green-600 font-medium">From {doc.recommenderName}</span>
                              {doc.contentType && ` • ${doc.contentType}`}
                              {doc.submittedAt && ` • ${new Date(doc.submittedAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-green-100 rounded transition-colors"
                            title="View document"
                          >
                            <Eye className="w-4 h-4 text-green-600" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Storage Files */}
                {storageFiles.map((file) => {
                  const fileUrl = file.public_url || file.storage_path;
                  const fileName = file.filename || file.original_filename || file.storage_path?.split('/').pop() || 'Document';
                  const fieldLabel = getFieldLabel(file.field_id);

                  return (
                    <div key={file.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                          <p className="text-xs text-gray-500">
                            {fieldLabel && <span className="text-blue-600 font-medium">{fieldLabel}</span>}
                            {fieldLabel && (file.mime_type || file.size_bytes) && ' • '}
                            {file.mime_type} {file.size_bytes && `• ${formatFileSize(file.size_bytes)}`}
                          </p>
                        </div>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                            title="View file"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Documents from raw_data */}
                {availableDocuments.map((doc, idx) => {
                  // Don't duplicate if already in storage files
                  const isDuplicate = storageFiles.some(sf =>
                    (sf.public_url === doc.url) || (sf.storage_path === doc.url)
                  );
                  if (isDuplicate) return null;

                  return (
                    <div key={`doc-${idx}`} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.contentType}</p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          title="View file"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </a>
                      </div>
                    </div>
                  );
                })}
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
          <FileText className="h-3.5 w-3.5" />
          Documents
        </h2>
        <div className="flex items-center gap-1">
          {!isExternalReviewer && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleSyncAllSubmissionsToDrive}
                disabled={isSyncingAllSubmissionsToDrive || !formId}
              >
                {isSyncingAllSubmissionsToDrive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <span className="ml-1">Sync All</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleSyncRecommendationDocumentsToDrive}
                disabled={isSyncingRecommendationsToDrive}
              >
                {isSyncingRecommendationsToDrive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Folder className="h-3 w-3" />
                )}
                <span className="ml-1">Sync Drive</span>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : storageFiles.length === 0 && availableDocuments.length === 0 && recommendationDocuments.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No documents found
          </div>
        ) : (
          <div className="space-y-3">
            {/* Recommendation Documents */}
            {recommendationDocuments.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  Recommendations
                </h3>
                {recommendationDocuments.map((doc, idx) => (
                  <div key={`rec-doc-${idx}`} className="border border-green-200 bg-green-50 rounded-lg p-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <FileSignature className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          <span className="text-green-600 font-medium">From {doc.recommenderName}</span>
                          {doc.contentType && ` • ${doc.contentType}`}
                          {doc.submittedAt && ` • ${new Date(doc.submittedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-green-100 rounded transition-colors"
                        title="View document"
                      >
                        <Eye className="w-4 h-4 text-green-600" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Storage Files */}
            {storageFiles.map((file) => {
              const fileUrl = file.public_url || file.storage_path;
              const fileName = file.filename || file.original_filename || file.storage_path?.split('/').pop() || 'Document';
              const fieldLabel = getFieldLabel(file.field_id);

              return (
                <div key={file.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                      <p className="text-xs text-gray-500">
                        {fieldLabel && <span className="text-blue-600 font-medium">{fieldLabel}</span>}
                        {fieldLabel && (file.mime_type || file.size_bytes) && ' • '}
                        {file.mime_type} {file.size_bytes && `• ${formatFileSize(file.size_bytes)}`}
                      </p>
                    </div>
                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="View file"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Documents from raw_data */}
            {availableDocuments.map((doc, idx) => {
              // Don't duplicate if already in storage files
              const isDuplicate = storageFiles.some(sf =>
                (sf.public_url === doc.url) || (sf.storage_path === doc.url)
              );
              if (isDuplicate) return null;

              return (
                <div key={`doc-${idx}`} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.contentType}</p>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded transition-colors"
                      title="View file"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
