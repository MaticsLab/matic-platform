'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Application, ApplicationStatus, ApplicationDetailProps, Stage, ReviewHistoryEntry } from './types';
import { 
  X, Mail, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  User, FileText, Star, MessageSquare,
  CheckCircle2, ArrowRight, AlertCircle, Users, Send,
  Paperclip, Sparkles, AtSign, Tag, Loader2, FileEdit, Settings,
  Play, Archive, XCircle, Clock, Folder, ChevronUp, Download, ExternalLink,
  Image, File, FileImage, Bell, Upload, Eye, Search, Link, Smile, PenTool, MoreVertical, Maximize2, Square, PanelRight, UserPlus, Clock3, FileSignature
} from 'lucide-react';
import { cn, getApplicantDisplayName } from '@/lib/utils';
import { NOT_PROVIDED, UNKNOWN, NO_NAME_PROVIDED } from '@/constants/fallbacks';
import { toast } from 'sonner';
import { emailClient, SendEmailRequest, EmailAttachment, EmailSignature } from '@/lib/api/email-client';
import { workflowsClient, StageAction, WorkflowAction } from '@/lib/api/workflows-client';
import { dashboardClient } from '@/lib/api/dashboard-client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";
import { Checkbox } from '@/ui-components/checkbox';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import { EmailSettingsDialog } from '../../Communications/EmailSettingsDialog';
import { filesClient, rowFilesClient } from '@/lib/api/files-client';
import type { TableFileResponse } from '@/types/files';
import { recommendationsClient, RecommendationRequest } from '@/lib/api/recommendations-client';
import { RefreshCw } from 'lucide-react';
import { QuickReminderPanel } from '../QuickReminderPanel';
import { FullEmailComposer } from '../FullEmailComposer';
import { EmailNovelEditor } from '../EmailNovelEditor';
import { EmailAIComposer } from '../EmailAIComposer';
import type { EditorInstance } from 'novel';

// Icon mapping for actions
const actionIcons: Record<string, React.ReactNode> = {
  'play': <Play className="w-4 h-4" />,
  'check-circle': <CheckCircle2 className="w-4 h-4" />,
  'x-circle': <XCircle className="w-4 h-4" />,
  'archive': <Archive className="w-4 h-4" />,
  'clock': <Clock className="w-4 h-4" />,
  'folder': <Folder className="w-4 h-4" />,
  'arrow-right': <ArrowRight className="w-4 h-4" />,
};

// Helper to parse JSON strings
function parseValueIfNeeded(value: any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

// Helper to check if a value is a file/document
function isFileValue(value: any): boolean {
  if (!value) return false;
  
  // Check if it's a string URL pointing to a file
  if (typeof value === 'string') {
    if (value.includes('storage') && value.includes('object')) return true;
    if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx)($|\?)/i.test(value)) return true;
  }
  
  // Check if it's an object with file properties
  if (typeof value === 'object' && value !== null) {
    const hasUrl = !!(value.url || value.Url || value.URL);
    const hasMime = !!(value.mimeType || value['Mime Type'] || value.mime_type || value.type);
    const hasName = !!(value.name || value.Name || value.filename);
    return hasUrl || (hasMime && hasName);
  }
  
  // Check if it's an array of files
  if (Array.isArray(value) && value.length > 0) {
    return isFileValue(value[0]);
  }
  
  return false;
}

// Get file type from value
function getFileType(value: any): 'pdf' | 'image' | 'video' | 'other' {
  const mimeType = (value.mimeType || value.type || value['Mime Type'] || '').toLowerCase();
  const name = (value.name || value.Name || value.url || '').toLowerCase();
  
  if (mimeType.includes('pdf') || name.includes('.pdf')) return 'pdf';
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/.test(name)) return 'image';
  if (mimeType.startsWith('video/') || /\.(mp4|webm|mov)/.test(name)) return 'video';
  return 'other';
}

// Format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Document preview component for inline display
function InlineDocumentPreview({ value, fieldLabel }: { value: any; fieldLabel?: string }) {
  const parsedValue = parseValueIfNeeded(value);
  const files = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
  
  return (
    <div className="space-y-3">
      {files.map((file, idx) => {
        // Get the URL - check multiple possible property names
        // Prioritize non-blob URLs over blob URLs
        const possibleUrls = [
          file.url, 
          file.Url, 
          file.URL, 
          file.publicUrl,
          file.public_url,
          typeof file === 'string' ? file : ''
        ].filter(Boolean);
        
        // Find a non-blob URL first, fallback to any URL
        const nonBlobUrl = possibleUrls.find(u => u && !u.startsWith('blob:'));
        const url = nonBlobUrl || possibleUrls[0] || '';
        const isBlobUrl = url.startsWith('blob:');
        
        const name = file.name || file.Name || file.filename || file.fileName || url?.split('/').pop()?.split('?')[0] || 'Document';
        const size = file.size || file.Size;
        const mimeType = file.mimeType || file.type || file.Type || file['Mime Type'] || file.mime_type || '';
        const fileType = getFileType({ ...file, url, name });
        const isImage = fileType === 'image';
        
        // If it's a blob URL, show a warning and don't try to load it
        if (isBlobUrl || !url) {
          return (
            <div key={idx} className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                  <p className="text-xs text-amber-600">
                    {isBlobUrl 
                      ? 'Temporary preview URL - file may need to be re-uploaded' 
                      : 'No download URL available'}
                  </p>
                  {mimeType && <p className="text-xs text-gray-500">{mimeType}{size ? ` • ${formatFileSize(size)}` : ''}</p>}
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Preview area */}
            {isImage && url ? (
              <div className="relative h-40 bg-gray-100 flex items-center justify-center">
                <img 
                  src={url} 
                  alt={name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden flex-col items-center justify-center text-gray-400">
                  <FileImage className="w-10 h-10 mb-2" />
                  <span className="text-xs">Preview unavailable</span>
                </div>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
              </div>
            ) : fileType === 'pdf' && url ? (
              <div className="relative h-40 bg-gray-100">
                <iframe 
                  src={`${url}#toolbar=0&navpanes=0`}
                  className="w-full h-full"
                  title={name}
                />
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
              </div>
            ) : null}
            
            {/* File info */}
            <div className="p-3 flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                fileType === 'pdf' ? 'bg-red-100' : fileType === 'image' ? 'bg-blue-100' : 'bg-gray-100'
              )}>
                {fileType === 'pdf' ? (
                  <FileText className="w-5 h-5 text-red-600" />
                ) : fileType === 'image' ? (
                  <FileImage className="w-5 h-5 text-blue-600" />
                ) : (
                  <File className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-500">
                  {mimeType && <span>{mimeType}</span>}
                  {size && <span> • {formatFileSize(size)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {url && (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </a>
                    <a
                      href={url}
                      download={name}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper to format field labels nicely
function formatFieldLabel(key: string, fieldMap?: Map<string, any>): string {
  // First try to look up the field in the map
  if (fieldMap) {
    // Try direct key match
    let fieldDef = fieldMap.get(key);
    
    // Try without "Field-" prefix
    if (!fieldDef && key.startsWith('Field-')) {
      const withoutPrefix = key.replace(/^Field-/, '');
      fieldDef = fieldMap.get(withoutPrefix);
      
      // Try matching by ID (field IDs often have format like "Field-{timestamp}-{random}")
      // Extract the base ID if it's a complex ID
      if (!fieldDef) {
        // Try to match by extracting the timestamp part or matching the full ID
        for (const [mapKey, mapField] of fieldMap.entries()) {
          const mapFieldId = mapField.id || mapKey;
          // Exact match
          if (mapFieldId === key || mapFieldId === withoutPrefix) {
            fieldDef = mapField;
            break;
          }
          // Try matching the base part (before the last segment)
          // e.g., "Field-1766110112708-zg4hskrds" might match a field with ID "Field-1766110112708-..."
          if (key.includes('-') && mapFieldId.includes('-')) {
            const keyParts = key.split('-');
            const mapIdParts = mapFieldId.split('-');
            // Match if first parts are similar (timestamp matching)
            if (keyParts.length >= 2 && mapIdParts.length >= 2 && keyParts[0] === mapIdParts[0]) {
              fieldDef = mapField;
              break;
            }
          }
        }
      }
    }
    
    // If found, use the label
    if (fieldDef && (fieldDef.label || fieldDef.name)) {
      return fieldDef.label || fieldDef.name || key;
    }
  }
  
  // Fallback to formatting the key
  return key
    .replace(/^Field-/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

// Helper function to render field values properly (handles arrays, objects, repeaters, files)
function renderFieldValue(value: any, depth: number = 0, fieldLabel?: string, fieldMap?: Map<string, any>): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">{NOT_PROVIDED}</span>;
  }
  
  // Try to parse JSON strings first
  const parsedValue = parseValueIfNeeded(value);
  
  // Check if this is a file/document - render with preview
  if (isFileValue(parsedValue)) {
    return <InlineDocumentPreview value={parsedValue} fieldLabel={fieldLabel} />;
  }
  
  // Handle booleans
  if (typeof parsedValue === 'boolean') {
    return <span className={parsedValue ? 'text-green-600' : 'text-gray-500'}>{parsedValue ? 'Yes' : 'No'}</span>;
  }
  
  // Handle numbers
  if (typeof parsedValue === 'number') {
    return <span className="font-medium">{parsedValue.toLocaleString()}</span>;
  }
  
  // Handle strings
  if (typeof parsedValue === 'string') {
    // Check if it's a URL to a file (but wasn't caught by isFileValue)
    if (parsedValue.startsWith('http://') || parsedValue.startsWith('https://')) {
      // Check if it looks like a file URL
      if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx)($|\?)/i.test(parsedValue)) {
        return <InlineDocumentPreview value={{ url: parsedValue, name: parsedValue.split('/').pop() || 'Document' }} />;
      }
      return (
        <a href={parsedValue} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
          {parsedValue}
        </a>
      );
    }
    // Long text
    if (parsedValue.length > 200) {
      return <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{parsedValue}</p>;
    }
    return <span className="text-gray-900">{parsedValue}</span>;
  }
  
  // Handle arrays
  if (Array.isArray(parsedValue)) {
    if (parsedValue.length === 0) {
      return <span className="text-gray-400 italic">None</span>;
    }
    
    // Check if it's an array of files
    if (isFileValue(parsedValue)) {
      return <InlineDocumentPreview value={parsedValue} fieldLabel={fieldLabel} />;
    }
    
    // Check if it's an array of primitives (strings, numbers)
    if (parsedValue.every(v => typeof v !== 'object' || v === null)) {
      // Filter out empty strings and join
      const filtered = parsedValue.filter(v => v !== null && v !== undefined && v !== '');
      if (filtered.length === 0) {
        return <span className="text-gray-400 italic">None</span>;
      }
      return <span className="text-gray-900">{filtered.join(', ')}</span>;
    }
    
    // Array of objects (repeater items)
    return (
      <div className="space-y-2 mt-1">
        {parsedValue.map((item, idx) => (
          <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Item {idx + 1}</div>
            <div className="grid gap-2">
              {typeof item === 'object' && item !== null ? (
                Object.entries(item)
                  .filter(([k]) => !k.startsWith('_')) // Skip internal fields like _id
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-wrap gap-x-2">
                      <span className="text-xs font-medium text-gray-500 min-w-[80px]">{formatFieldLabel(k, fieldMap)}:</span>
                      <span className="text-sm text-gray-900">{renderFieldValue(v, depth + 1, k, fieldMap)}</span>
                    </div>
                  ))
              ) : (
                <span className="text-sm text-gray-900">{String(item)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Handle objects
  if (typeof parsedValue === 'object') {
    const entries = Object.entries(parsedValue).filter(([k]) => !k.startsWith('_')); // Skip internal fields
    
    if (entries.length === 0) {
      return <span className="text-gray-400 italic">Empty</span>;
    }
    
    // Check if all values are simple (no nested objects)
    const allSimple = entries.every(([, v]) => typeof v !== 'object' || v === null);
    
    if (allSimple && entries.length <= 4) {
      // Render inline for simple groups with few fields
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entries.map(([k, v]) => (
            <span key={k} className="text-sm">
              <span className="text-gray-500">{formatFieldLabel(k, fieldMap)}:</span>{' '}
              <span className="text-gray-900 font-medium">{v === null || v === '' ? '-' : String(v)}</span>
            </span>
          ))}
        </div>
      );
    }
    
    // Render as nested card for complex groups
    return (
      <div className={cn("mt-1 rounded-lg border border-gray-200 overflow-hidden", depth === 0 ? "bg-white" : "bg-gray-50")}>
        <div className="divide-y divide-gray-100">
          {entries.map(([k, v]) => (
            <div key={k} className="px-3 py-2">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                {formatFieldLabel(k, fieldMap)}
              </div>
              <div className="text-gray-900">{renderFieldValue(v, depth + 1, k, fieldMap)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return <span className="text-gray-900">{String(value)}</span>;
}

export function ApplicationDetail({
  application,
  stages,
  reviewersMap,
  onStatusChange,
  onClose,
  onStartReview,
  onDelete,
  workspaceId,
  formId,
  fields = [],
  onActivityCreated
}: ApplicationDetailProps) {
  const [showActivityPanel, setShowActivityPanel] = useState(false); // Toggle between details and activity
  const [showRecommendersPanel, setShowRecommendersPanel] = useState(false); // Toggle recommenders panel
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(false); // Toggle documents panel
  const [viewMode, setViewMode] = useState<'modal' | 'fullscreen' | 'sidebar'>('sidebar');
  const [selectedStage, setSelectedStage] = useState(application.stageId || application.status);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'comment' | 'email'>('comment');
  const [comment, setComment] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [emailTo, setEmailTo] = useState(application.email || '');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<EmailAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [stageActions, setStageActions] = useState<StageAction[]>([]);
  const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [storageFiles, setStorageFiles] = useState<TableFileResponse[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  // Recommendation requests state
  const [recommendations, setRecommendations] = useState<RecommendationRequest[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());
  
  // Email composer state
  const [showQuickReminder, setShowQuickReminder] = useState(false);
  const [showFullComposer, setShowFullComposer] = useState(false);
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
      const { authClient } = await import('@/lib/better-auth-client');
      const session = await authClient.getSession();
      setUserId(session?.data?.user?.id || null);
    };
    getUser();
  }, []);

  // Load signatures when userId is available
  useEffect(() => {
    if (userId && workspaceId) {
      loadSignatures();
    }
  }, [userId, workspaceId]);

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
      const { from } = editor.state.selection;
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

  // Warn if applicant info is incomplete
  const applicantDisplayName = getApplicantDisplayName(application);
  const isApplicantInfoIncomplete = applicantDisplayName === NO_NAME_PROVIDED;

  // Extract available documents from application for attachment
  const availableDocuments = useMemo(() => {
    const docs: { name: string; url: string; contentType: string }[] = [];
    const rawData = application.raw_data || {};
    
    console.log('[ApplicationDetail] Checking raw_data for documents:', Object.keys(rawData));
    
    Object.entries(rawData).forEach(([key, value]) => {
      // Check for string URLs
      if (typeof value === 'string' && (
        value.startsWith('http://') || 
        value.startsWith('https://') ||
        value.includes('supabase') ||
        value.includes('storage')
      )) {
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
          let contentType = 'application/octet-stream';
          if (lowerValue.includes('.pdf')) contentType = 'application/pdf';
          else if (lowerValue.includes('.doc')) contentType = 'application/msword';
          else if (lowerValue.includes('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (lowerValue.includes('.png')) contentType = 'image/png';
          else if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) contentType = 'image/jpeg';
          
          console.log('[ApplicationDetail] Found document in raw_data:', { key, url: value.substring(0, 50) });
          
          docs.push({
            name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: value,
            contentType
          });
        }
      }
      
      // Also check for file objects (not just string URLs)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const fileUrl = (value as any).url || (value as any).Url || (value as any).URL;
        const fileName = (value as any).name || (value as any).Name || (value as any).filename;
        
        if (fileUrl && (typeof fileUrl === 'string')) {
          console.log('[ApplicationDetail] Found file object in raw_data:', { key, fileName });
          
          let contentType = (value as any).mimeType || (value as any).mime_type || (value as any).type || 'application/octet-stream';
          docs.push({
            name: fileName || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: fileUrl,
            contentType
          });
        }
      }
      
      // Check for arrays of files
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            const fileUrl = item.url || item.Url || item.URL;
            const fileName = item.name || item.Name || item.filename;
            
            if (fileUrl && (typeof fileUrl === 'string')) {
              console.log('[ApplicationDetail] Found file in array:', { key, fileName, idx });
              
              let contentType = item.mimeType || item.mime_type || item.type || 'application/octet-stream';
              docs.push({
                name: fileName || `${key} ${idx + 1}`,
                url: fileUrl,
                contentType
              });
            }
          }
        });
      }
    });
    
    console.log('[ApplicationDetail] Total documents found:', docs.length);
    
    return docs;
  }, [application.raw_data]);

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

  // Fetch stage actions and workflow actions
  useEffect(() => {
    const fetchActions = async () => {
      if (!application.stageId && !application.workflowId) return;
      
      setIsLoadingActions(true);
      try {
        // Fetch stage-specific actions
        if (application.stageId) {
          const stageActionsData = await workflowsClient.listStageActions(application.stageId);
          setStageActions(stageActionsData || []);
        }
        
        // Fetch workflow-level actions (global actions like Reject)
        if (application.workflowId) {
          const workflowActionsData = await workflowsClient.listWorkflowActions(application.workflowId);
          setWorkflowActions(workflowActionsData || []);
        }
      } catch (error) {
        console.error('Failed to fetch actions:', error);
      } finally {
        setIsLoadingActions(false);
      }
    };
    
    fetchActions();
  }, [application.stageId, application.workflowId]);

  // Fetch files from table_files (uploaded to Supabase storage)
  useEffect(() => {
    const fetchStorageFiles = async () => {
      if (!application.id) return;
      
      console.log('[ApplicationDetail] Fetching storage files for row_id:', application.id);
      
      setIsLoadingFiles(true);
      try {
        // Try the dedicated row files endpoint first (cleaner API)
        const files = await rowFilesClient.list(application.id);
        console.log('[ApplicationDetail] Storage files loaded via rowFilesClient:', files?.length || 0, files);
        setStorageFiles(files || []);
      } catch (error) {
        console.warn('[ApplicationDetail] rowFilesClient failed, trying filesClient:', error);
        // Fallback to general files endpoint
        try {
          const files = await filesClient.list({ 
            row_id: application.id,
            workspace_id: workspaceId 
          });
          console.log('[ApplicationDetail] Storage files loaded via filesClient:', files?.length || 0, files);
          setStorageFiles(files || []);
        } catch (fallbackError) {
          console.error('[ApplicationDetail] Failed to fetch storage files:', fallbackError);
          setStorageFiles([]);
        }
      } finally {
        setIsLoadingFiles(false);
      }
    };
    
    fetchStorageFiles();
  }, [application.id, workspaceId]);

  // Fetch recommendation requests for this submission
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!application.id) return;
      setLoadingRecommendations(true);
      try {
        const data = await recommendationsClient.getForReview(application.id);
        setRecommendations(data || []);
      } catch (err) {
        console.error('[ApplicationDetail] Failed to fetch recommendations:', err);
        setRecommendations([]);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    fetchRecommendations();
  }, [application.id]);

  // Send reminder to recommender
  const handleSendReminder = async (requestId: string) => {
    setSendingReminder(requestId);
    try {
      await recommendationsClient.sendReminder(requestId);
      toast.success('Reminder sent successfully');
      // Refresh recommendations list
      const data = await recommendationsClient.getForReview(application.id);
      setRecommendations(data || []);
    } catch (err) {
      console.error('[ApplicationDetail] Failed to send reminder:', err);
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  // Create a field map for looking up field labels by ID
  const fieldMap = useMemo(() => {
    const map = new Map<string, any>();
    fields.forEach(f => {
      const fieldId = f.id || (f as any).field_id;
      const fieldLabel = f.label || (f as any).name;
      
      if (fieldId) {
        map.set(fieldId, f);
        if (!fieldId.startsWith('Field-')) {
          map.set(`Field-${fieldId}`, f);
        }
        if (fieldId.startsWith('Field-')) {
          map.set(fieldId.replace(/^Field-/, ''), f);
        }
      }
      if (fieldLabel) {
        map.set(fieldLabel, f);
        map.set(fieldLabel.toLowerCase().replace(/\s+/g, '_'), f);
        map.set(fieldLabel.replace(/\s+/g, '_'), f);
      }
      // Map child fields for repeater/group fields
      const children = (f as any).children || (f as any).child_fields || [];
      if (Array.isArray(children)) {
        children.forEach((child: any) => {
          const childId = child.id || child.field_id;
          const childLabel = child.label || child.name;
          
          if (childId) {
            map.set(childId, child);
            if (!childId.startsWith('Field-')) {
              map.set(`Field-${childId}`, child);
            }
            if (childId.startsWith('Field-')) {
              map.set(childId.replace(/^Field-/, ''), child);
            }
          }
          if (childLabel) {
            map.set(childLabel, child);
            map.set(childLabel.toLowerCase().replace(/\s+/g, '_'), child);
            map.set(childLabel.replace(/\s+/g, '_'), child);
          }
        });
      }
    });
    return map;
  }, [fields]);

  // Helper to get field label from field_id
  const getFieldLabel = (fieldId?: string): string | null => {
    if (!fieldId) return null;
    const field = fieldMap.get(fieldId);
    if (field) {
      return field.label || field.name || null;
    }
    return null;
  };

  // Group fields by section
  const fieldSections = useMemo(() => {
    if (!fields || fields.length === 0) return [];
    
    // Filter out layout fields (section, divider, heading, paragraph, callout, etc.)
    // Layout fields should not appear in database/application data views
    const layoutFieldTypes = ['section', 'divider', 'heading', 'paragraph', 'callout'];
    const regularFields = fields.filter(field => {
      // Check if field type category is layout (if field_type is available)
      if ((field as any).field_type?.category === 'layout') {
        return false;
      }
      // Also filter by type as fallback
      if (layoutFieldTypes.includes(field.type)) {
        return false;
      }
      return true;
    });
    
    const sections: { name: string; fields: typeof fields }[] = [];
    let currentSection = { name: 'General Information', fields: [] as typeof fields };
    
    regularFields.forEach(field => {
      if (field.type === 'section') {
        if (currentSection.fields.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { name: field.label || 'Section', fields: [] };
      } else {
        currentSection.fields.push(field);
      }
    });
    
    if (currentSection.fields.length > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  }, [fields]);

  // Insert merge tag into email body
  const insertMergeTag = (fieldLabel: string) => {
    setEmailBody(prev => prev + `{{${fieldLabel}}}`);
  };

  // Get available merge tags from fields or application raw_data
  const availableMergeTags = (() => {
    if (fields.length > 0) {
      return fields.map(f => ({ label: f.label, tag: `{{${f.label}}}` }));
    }
    if (application.raw_data) {
      return Object.keys(application.raw_data).slice(0, 20).map(key => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        tag: `{{${key}}}`
      }));
    }
    return [];
  })();

  // Count documents and missing documents for tab badge
  const documentCounts = useMemo(() => {
    let uploaded = 0;
    let missing = 0;
    
    // Count storage files first (these are reliable)
    uploaded += storageFiles.length;
    
    // Check fields for file/image upload types
    if (fields && fields.length > 0) {
      fields.forEach(field => {
        const isFileField = field.type === 'file_upload' || field.type === 'image_upload' || 
                           field.type === 'file' || field.type === 'image' ||
                           field.label?.toLowerCase().includes('upload') ||
                           field.label?.toLowerCase().includes('document') ||
                           field.label?.toLowerCase().includes('attachment');
        
        if (isFileField) {
          const value = application.raw_data?.[field.id] || 
                       application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                       application.raw_data?.[field.label];
          const parsedValue = parseValueIfNeeded(value);
          
          if (parsedValue && isFileValue(parsedValue)) {
            // Only count if not a blob URL and not already counted from storage
            const url = parsedValue?.url || parsedValue?.Url || '';
            if (url && !url.startsWith('blob:') && storageFiles.length === 0) {
              uploaded++;
            }
          } else if (storageFiles.length === 0) {
            // Only mark as missing if no storage files found
            missing++;
          }
        }
      });
    }
    
    // Also scan raw_data for any file values not tracked in fields
    if (application.raw_data && storageFiles.length === 0) {
      const trackedFields = new Set(fields.map(f => f.id));
      Object.entries(application.raw_data).forEach(([key, value]) => {
        if (trackedFields.has(key)) return;
        const parsedValue = parseValueIfNeeded(value);
        if (isFileValue(parsedValue)) {
          const url = parsedValue?.url || parsedValue?.Url || '';
          if (url && !url.startsWith('blob:')) {
            uploaded++;
          }
        }
      });
    }
    
    return { uploaded, missing };
  }, [fields, application.raw_data, storageFiles]);

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
        
        signatureDivs.forEach((div) => {
          const content = div.getAttribute('data-content');
          if (content) {
            div.innerHTML = content;
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

  // Build stages list from props or fallback to default
  const displayStages: ApplicationStatus[] = stages.length > 0 
    ? stages.map(s => s.name as ApplicationStatus)
    : ['Submitted', 'Initial Review', 'Under Review', 'Final Review', 'Approved'];

  const currentStageIndex = displayStages.findIndex(s => 
    s === application.stageName || s === application.status
  );

  const handleStageChange = (newStage: ApplicationStatus) => {
    setSelectedStage(newStage);
    onStatusChange(application.id, newStage);
    toast.success(`Application moved to ${newStage}`);
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }
    onDelete?.(application.id);
    toast.error('Application deleted');
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleReview = () => {
    onStartReview?.(application.id);
    toast.success('Opening review form...');
  };

  const getReviewerName = (reviewerId: string) => {
    return reviewersMap[reviewerId]?.name || 'Reviewer';
  };

  // Format relative time
  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Get stage name by ID
  const getStageName = (stageId?: string) => {
    if (!stageId) return UNKNOWN;
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || stageId;
  };

  // Build activities from real data (stageHistory and reviewHistory)
  const activities = useMemo(() => {
    const items: Array<{
      id: string | number;
      type: 'status' | 'review' | 'comment' | 'email';
      message: string;
      user: string;
      time: string;
      timestamp: number;
    }> = [];

    // Add stage history items
    if (application.stageHistory && Array.isArray(application.stageHistory)) {
      application.stageHistory.forEach((entry, idx) => {
        const timestamp = entry.moved_at || entry.timestamp;
        const toStage = entry.to_stage_id ? getStageName(entry.to_stage_id) : (entry.to_stage || UNKNOWN);
        const action = entry.action || 'moved';
        
        let message = '';
        if (action === 'auto_advanced') {
          message = `Auto-advanced to ${toStage}`;
        } else if (action === 'auto_rejected') {
          message = 'Application auto-rejected';
        } else {
          message = `Moved to ${toStage}`;
        }

        items.push({
          id: `stage-${idx}`,
          type: 'status',
          message,
          user: 'System',
          time: formatRelativeTime(timestamp),
          timestamp: timestamp ? new Date(timestamp).getTime() : 0,
        });
      });
    }

    // Add review history items
    if (application.reviewHistory && Array.isArray(application.reviewHistory)) {
      application.reviewHistory.forEach((review, idx) => {
        items.push({
          id: `review-${idx}`,
          type: 'review',
          message: review.total_score ? `Review submitted (Score: ${review.total_score})` : 'Review submitted',
          user: review.reviewer_name || getReviewerName(review.reviewer_id) || 'Reviewer',
          time: formatRelativeTime(review.reviewed_at),
          timestamp: review.reviewed_at ? new Date(review.reviewed_at).getTime() : 0,
        });
      });
    }

    // Add submission as first activity if no other activities
    if (items.length === 0) {
      items.push({
        id: 'submitted',
        type: 'status',
        message: 'Application submitted',
        user: application.name || application.email || 'Applicant',
        time: formatRelativeTime(application.submittedDate),
        timestamp: application.submittedDate ? new Date(application.submittedDate).getTime() : 0,
      });
    }

    // Also add current status if not in history
    const currentStageInHistory = application.stageHistory?.some(
      h => (h.to_stage_id === application.stageId) || (h.to_stage === application.stageName)
    );
    if (!currentStageInHistory && application.stageName) {
      items.push({
        id: 'current-status',
        type: 'status',
        message: `Moved to ${application.stageName}`,
        user: 'System',
        time: application.lastActivity || 'Recently',
        timestamp: Date.now() - 1000, // Recent but not newest
      });
    }

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }, [application.stageHistory, application.reviewHistory, application.stageName, application.stageId, application.lastActivity, application.submittedDate, application.name, application.email, stages]);

  // Main content JSX
  const mainContent = (
    <div className={cn(
      "bg-white flex flex-col h-full relative",
      viewMode === 'modal' && "max-w-5xl mx-auto my-8 rounded-lg shadow-xl border border-gray-200",
      viewMode === 'fullscreen' && "fixed inset-0 z-50 w-full h-full"
    )}>
      {/* Header - All modes */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
          <div className="h-4 w-px bg-gray-300" />
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">
                <Maximize2 className="w-4 h-4 text-gray-500" />
                <span className="capitalize">{viewMode === 'fullscreen' ? 'Full screen' : viewMode}</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1">
                <button
                  onClick={() => setViewMode('sidebar')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors text-left",
                    viewMode === 'sidebar' && "bg-purple-50 text-purple-700"
                  )}
                >
                  <div className="w-8 h-6 border border-gray-300 rounded flex gap-0.5 p-0.5">
                    <div className="flex-1 bg-gray-100 rounded"></div>
                    <div className="w-2 bg-gray-200 rounded"></div>
                  </div>
                  <span className={cn("text-sm", viewMode === 'sidebar' && "text-purple-700 font-medium")}>Sidebar</span>
                </button>
                <button
                  onClick={() => setViewMode('modal')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors text-left",
                    viewMode === 'modal' && "bg-purple-50 text-purple-700"
                  )}
                >
                  <div className="w-8 h-6 border border-gray-300 rounded flex items-center justify-center bg-white">
                    <div className="w-4 h-3 border border-gray-200 rounded"></div>
                  </div>
                  <span className={cn("text-sm", viewMode === 'modal' && "text-purple-700 font-medium")}>Modal</span>
                </button>
                <button
                  onClick={() => setViewMode('fullscreen')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors text-left",
                    viewMode === 'fullscreen' && "bg-purple-50 text-purple-700"
                  )}
                >
                  <div className="w-8 h-6 border-2 border-gray-400 rounded bg-gray-50"></div>
                  <span className={cn("text-sm", viewMode === 'fullscreen' && "text-purple-700 font-medium")}>Full screen</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Split View: Overview (Left) + Icons (Middle) + Activity (Right) - Always visible */}
      <div className={cn(
        "flex-1 min-h-0 flex overflow-hidden",
        viewMode === 'modal' && "rounded-lg"
      )}>
        {/* Application Details Panel - Show when no panel is active in sidebar, or always in fullscreen */}
        {((viewMode !== 'fullscreen' && !showActivityPanel && !showRecommendersPanel && !showDocumentsPanel) || viewMode === 'fullscreen') && (
          <div className="flex overflow-hidden transition-all duration-300 flex-1">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
              {/* Name */}
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {application.name || UNKNOWN}
              </h1>

            {/* Key Fields */}
            <div className="space-y-3 mb-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-200 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {application.stageName?.toUpperCase() || application.status?.toUpperCase() || 'SUBMITTED'}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 px-2 pb-1">Change Status</p>
                      {stages.map((stage) => {
                        const isCurrentStage = stage.id === application.stageId || stage.name === application.stageName;
                        return (
                          <button
                            key={stage.id}
                            onClick={() => {
                              if (!isCurrentStage) {
                                onStatusChange?.(application.id, stage.name as ApplicationStatus);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                              isCurrentStage 
                                ? "bg-green-100 text-green-700 font-medium" 
                                : "hover:bg-gray-100 text-gray-700"
                            )}
                          >
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: stage.color || '#6B7280' }}
                            />
                            <span className="flex-1 truncate">{stage.name}</span>
                            {isCurrentStage && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assignees - Only show if data exists */}
              {application.assignedTo && application.assignedTo.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Assignees</span>
                  <span className="text-sm text-gray-900">{application.assignedTo.join(', ')}</span>
                </div>
              )}

              {/* Dates - Only show if submittedDate exists */}
              {application.submittedDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Dates</span>
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(application.submittedDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Priority - Only show if data exists */}
              {application.priority && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priority</span>
                  <span className={cn(
                    "text-sm font-medium capitalize",
                    application.priority === 'high' && 'text-red-600',
                    application.priority === 'medium' && 'text-yellow-600',
                    application.priority === 'low' && 'text-gray-600'
                  )}>
                    {application.priority}
                  </span>
                </div>
              )}

              {/* Tags - Only show if data exists */}
              {application.tags && application.tags.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tags</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {application.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Description Section - Only show if comments exist */}
            {application.comments && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Description</span>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[100px]">
                  <p className="text-sm text-gray-900">{application.comments}</p>
                </div>
              </div>
            )}

            {/* Reviewers Section */}
            {Array.isArray(application.assignedTo) && application.assignedTo.length > 0 && reviewersMap && (
              <div className="border-t pt-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Reviewers</span>
                </div>
                <div className="space-y-2">
                  {application.assignedTo
                    .map((reviewerId: string) => ({ reviewer: reviewersMap[reviewerId], reviewerId }))
                    .filter(({ reviewer }) => Boolean(reviewer))
                    .map(({ reviewer, reviewerId }, idx) => (
                      <div key={reviewerId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{reviewer.name || 'Reviewer'}</div>
                          {reviewer.email && (
                            <div className="text-xs text-gray-500">{reviewer.email}</div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Custom Fields Section - Show all fields */}
            {fields && fields.length > 0 && (
              <div className="border-t pt-4 mb-6">
                <div className="flex items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">Application Data</span>
                </div>
                      {/* Sticky Bottom Action Bar */}
                      <div className="sticky bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                          {/* Action Dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                              Actions
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {showActionsDropdown && ([...stageActions, ...workflowActions].length > 0 ? (
                              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                                {[...stageActions, ...workflowActions].map((action) => (
                                  <button
                                    key={action.id}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700"
                                    onClick={async () => {
                                      setShowActionsDropdown(false);
                                      if (!formId) {
                                        toast.error('Form ID is required');
                                        return;
                                      }
                                      try {
                                        await workflowsClient.executeAction({
                                          form_id: formId,
                                          submission_id: application.id,
                                          action_type: stageActions.some(a => a.id === action.id) ? 'stage_action' : 'workflow_action',
                                          action_id: action.id,
                                        });
                                        toast.success(`Action "${action.name}" executed successfully`);
                                        if (action.target_stage_id) {
                                          const targetStage = stages.find(s => s.id === action.target_stage_id);
                                          if (targetStage) {
                                            onStatusChange?.(application.id, targetStage.name as ApplicationStatus);
                                          }
                                        }
                                      } catch (error) {
                                        console.error('Failed to execute action:', error);
                                        toast.error('Failed to execute action');
                                      }
                                    }}
                                  >
                                    {action.name}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                                <div className="px-4 py-2 text-gray-400">No actions available</div>
                              </div>
                            ))}
                          </div>
                          {/* Request Revision Button */}
                          <button
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium shadow hover:bg-yellow-600 transition-colors"
                            onClick={() => toast('Request Revision sent!')}
                          >
                            Request Revision
                          </button>
                          {/* Delete Button */}
                          <button
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium shadow hover:bg-red-700 transition-colors"
                            onClick={handleDelete}
                            // No isLoading state for delete, so do not disable
                          >
                            {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
                          </button>
                        </div>
                        {/* Optional: Add more controls or info here */}
                      </div>
                <div className="space-y-4">
                  {(() => {
                    // Create field map for nested field lookup (includes child fields for repeaters)
                    const fieldMap = new Map<string, any>();
                    fields.forEach(f => {
                      const fieldId = f.id || (f as any).field_id;
                      const fieldLabel = f.label || (f as any).name;
                                // Create field map for nested field lookup (includes all subfields recursively)
                                const fieldMap = new Map<string, any>();
                                function addFieldToMap(field: any) {
                                  const fieldId = field.id || field.field_id;
                                  const fieldLabel = field.label || field.name;
                                  if (fieldId) {
                                    fieldMap.set(fieldId, field);
                                    if (!fieldId.startsWith('Field-')) fieldMap.set(`Field-${fieldId}`, field);
                                    if (fieldId.startsWith('Field-')) fieldMap.set(fieldId.replace(/^Field-/, ''), field);
                                  }
                                  if (fieldLabel) {
                                    fieldMap.set(fieldLabel, field);
                                    fieldMap.set(fieldLabel.toLowerCase().replace(/\s+/g, '_'), field);
                                    fieldMap.set(fieldLabel.replace(/\s+/g, '_'), field);
                                  }
                                  const children = field.children || field.child_fields || [];
                                  if (Array.isArray(children)) {
                                    children.forEach(addFieldToMap);
                                  }
                                }
                                fields.forEach(addFieldToMap);
                    });
                    
                    return fieldSections.map((section, sectionIdx) => {
                      // Check if section has any data
                      const hasData = section.fields.some(field => {
                        const value = application.raw_data?.[field.id] || 
                                     application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                                     application.raw_data?.[field.label];
                        return value !== null && value !== undefined && value !== '';
                      });
                      
                      if (!hasData) return null;
                      
                      return (
                        <div key={sectionIdx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          {/* Section Header */}
                          {fieldSections.length > 1 && (
                            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                              <span className="text-base font-bold text-gray-800">{section.name}</span>
                            </div>
                          )}
                          
                          {/* Section Fields */}
                          <div className="divide-y divide-gray-100">
                            {section.fields.map((field) => {
                              const value = application.raw_data?.[field.id] || 
                                           application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                                           application.raw_data?.[field.label];
                              if (value === null || value === undefined || value === '') return null;

                              // Use field.label directly, fallback to formatFieldLabel if not available
                              const displayLabel = field.label || formatFieldLabel(field.id, fieldMap);

                              return (
                                <div key={field.id} className="px-6 py-5">
                                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                                    {displayLabel}
                                  </p>
                                  <div className="text-gray-800 text-[15px] leading-relaxed">
                                    {renderFieldValue(value, 0, field.id, fieldMap)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Actions Section */}
            {(stageActions.length > 0 || workflowActions.length > 0) && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Actions</span>
                </div>
                <div className="space-y-2">
                  {[...stageActions, ...workflowActions].map((action) => {
                    const icon = actionIcons[action.icon || 'arrow-right'] || <ArrowRight className="w-4 h-4" />;
                    const isStageAction = stageActions.some(a => a.id === action.id);
                    return (
                      <button
                        key={action.id}
                        onClick={async () => {
                          if (!formId) {
                            toast.error('Form ID is required');
                            return;
                          }
                          try {
                            await workflowsClient.executeAction({
                              form_id: formId,
                              submission_id: application.id,
                              action_type: isStageAction ? 'stage_action' : 'workflow_action',
                              action_id: action.id,
                            });
                            toast.success(`Action "${action.name}" executed successfully`);
                            if (action.target_stage_id) {
                              const targetStage = stages.find(s => s.id === action.target_stage_id);
                              if (targetStage) {
                                onStatusChange?.(application.id, targetStage.name as ApplicationStatus);
                              }
                            }
                          } catch (error) {
                            console.error('Failed to execute action:', error);
                            toast.error('Failed to execute action');
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      >
                        {icon}
                        <span className="flex-1">{action.name}</span>
                        {action.target_stage_id && (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        )}

        {/* Recommenders Panel - Show in fullscreen when showRecommendersPanel is true */}
        {viewMode === 'fullscreen' && showRecommendersPanel && (
          <div className="w-80 flex flex-col overflow-hidden border-l border-gray-200">
              <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">Recommenders</h2>
                <button 
                  onClick={() => setShowRecommendersPanel(false)}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingRecommendations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No recommendation requests found
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
        )}

        {/* Documents Panel - Show in fullscreen when showDocumentsPanel is true */}
        {viewMode === 'fullscreen' && showDocumentsPanel && (
          <div className="w-80 flex flex-col overflow-hidden border-l border-gray-200">
              <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
                <button 
                  onClick={() => setShowDocumentsPanel(false)}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingFiles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : storageFiles.length === 0 && availableDocuments.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No documents found
                  </div>
                ) : (
                  <div className="space-y-3">
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
        )}


        {/* Recommenders Panel - Replaces details when active (sidebar mode), or shows to the right (fullscreen mode) */}
        {showRecommendersPanel && viewMode !== 'fullscreen' && (
          <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-200">
            <div className="px-4 py-2 border-b border-t border-l bg-white flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Recommenders</h2>
              <button 
                onClick={() => setShowRecommendersPanel(false)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingRecommendations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No recommendation requests found
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
        )}

        {/* Documents Panel - Replaces details when active (sidebar mode), or shows to the right (fullscreen mode) */}
        {showDocumentsPanel && viewMode !== 'fullscreen' && (
          <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-200">
            <div className="px-4 py-2 border-b border-t border-l bg-white flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
              <button 
                onClick={() => setShowDocumentsPanel(false)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : storageFiles.length === 0 && availableDocuments.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No documents found
                </div>
              ) : (
                <div className="space-y-3">
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
        )}

        {/* Activity Panel - Replaces details in sidebar (left), or shows on right in modal/fullscreen */}
        {showActivityPanel && viewMode !== 'fullscreen' ? (
          <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-200">
            {/* Activity Header */}
            <div className="px-4 py-2 border-b border-t border-l bg-white flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
              <button 
                onClick={() => setShowActivityPanel(false)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

          {/* Activity Feed */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{activity.user}</span>
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{activity.message}</p>
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <CheckCircle2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors ml-auto">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email Composer - Fixed at Bottom */}
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

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1">
                  <button className="px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">
                    Email
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setShowAIComposer(true)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600"
                    title="AI Email Composer"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <AtSign className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <Smile className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <PenTool className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <Settings className="w-4 h-4" />
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
            </div>
          </div>
          </div>
        ) : null}

        {/* Action Buttons - Vertical Icons - Always visible, positioned after left panel */}
        <div className="flex flex-col items-center gap-2 p-2 border-l border-gray-200 bg-gray-50 flex-shrink-0">
          <button 
            onClick={() => {
              setShowActivityPanel(!showActivityPanel);
              setShowRecommendersPanel(false);
              setShowDocumentsPanel(false);
            }}
            className={cn(
              "p-1.5 hover:bg-gray-100 rounded transition-colors",
              showActivityPanel && "bg-blue-50"
            )}
            title="Activity"
          >
            <MessageSquare className="w-4 h-4 text-gray-500" />
          </button>
          <button 
            onClick={() => {
              setShowRecommendersPanel(!showRecommendersPanel);
              setShowActivityPanel(false);
              setShowDocumentsPanel(false);
            }}
            className={cn(
              "p-1.5 hover:bg-gray-100 rounded transition-colors relative",
              showRecommendersPanel && "bg-blue-50"
            )}
            title="Recommenders"
          >
            <UserPlus className="w-4 h-4 text-gray-500" />
            {recommendations.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
                {recommendations.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => {
              setShowDocumentsPanel(!showDocumentsPanel);
              setShowActivityPanel(false);
              setShowRecommendersPanel(false);
            }}
            className={cn(
              "p-1.5 hover:bg-gray-100 rounded transition-colors relative",
              showDocumentsPanel && "bg-blue-50"
            )}
            title="Documents"
          >
            <FileText className="w-4 h-4 text-gray-500" />
            {documentCounts.uploaded > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
                {documentCounts.uploaded}
              </span>
            )}
          </button>
        </div>

        {/* Activity Panel - Show on the right in modal/fullscreen */}
        {((viewMode === 'modal' || viewMode === 'fullscreen') && !showActivityPanel && !showRecommendersPanel && !showDocumentsPanel) || 
         (viewMode === 'fullscreen' && showActivityPanel) ? (
          <div className="w-96 flex flex-col overflow-hidden border-l border-gray-200">
            {/* Activity Header */}
            <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
              <div className="flex items-center gap-1">
                {viewMode === 'fullscreen' && (showActivityPanel || showRecommendersPanel || showDocumentsPanel) && (
                  <button 
                    onClick={() => {
                      setShowActivityPanel(false);
                      setShowRecommendersPanel(false);
                      setShowDocumentsPanel(false);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                  <Search className="w-4 h-4 text-gray-500" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors relative">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">1</span>
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                  <Settings className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{activity.user}</span>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{activity.message}</p>
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <CheckCircle2 className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <MessageSquare className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <Mail className="w-4 h-4 text-gray-400" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors ml-auto">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Composer - Fixed at Bottom */}
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

                {/* Bottom Toolbar */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">
                      Email
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  <button 
                    onClick={() => setShowAIComposer(true)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600"
                    title="AI Email Composer"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <AtSign className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <Smile className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <PenTool className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <Settings className="w-4 h-4" />
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
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  // Wrap content with dialogs
  const contentWithDialogs = (
    <>
      {mainContent}
      
      {/* Email Settings Dialog */}
      {workspaceId && (
        <EmailSettingsDialog
          workspaceId={workspaceId}
          open={showEmailSettings}
          onOpenChange={setShowEmailSettings}
          onAccountsUpdated={refreshConnection}
        />
      )}

      {/* Quick Reminder Panel */}
      {workspaceId && application.id && (
        <QuickReminderPanel
          open={showQuickReminder}
          onClose={() => setShowQuickReminder(false)}
          workspaceId={workspaceId}
          formId={formId || undefined}
          submissionId={application.id}
          recipientEmail={application.email || ''}
          recipientName={application.name}
          onSent={() => {
            if (onActivityCreated) {
              onActivityCreated();
            }
          }}
        />
      )}

      {/* Full Email Composer */}
      {workspaceId && (
        <FullEmailComposer
          open={showFullComposer}
          onClose={() => setShowFullComposer(false)}
          workspaceId={workspaceId}
          formId={formId || undefined}
          submissionId={application.id}
          recipientEmails={application.email ? [application.email] : []}
          onSent={() => {
            if (onActivityCreated) {
              onActivityCreated();
            }
          }}
        />
      )}

      {/* AI Email Composer */}
      <EmailAIComposer
        open={showAIComposer}
        onClose={() => setShowAIComposer(false)}
        currentSubject={emailSubject}
        currentBody={emailBody}
        applicationData={{
          name: application.name,
          email: application.email,
          raw_data: application.raw_data,
        }}
        fields={fields}
        onApply={(subject, body) => {
          setEmailSubject(subject);
          setEmailBody(body);
          // Update editor content if editor is available
          if (emailEditorRef.current) {
            emailEditorRef.current.commands.setContent(body);
          }
        }}
      />
    </>
  );

  // For modal, wrap in portal-like container with backdrop
  if (viewMode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        {contentWithDialogs}
      </div>
    );
  }

  // For fullscreen, it's already fixed positioned in mainContent
  if (viewMode === 'fullscreen') {
    return contentWithDialogs;
  }

  // Default sidebar view
  return contentWithDialogs;
}
