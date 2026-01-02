'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Application, ApplicationStatus, ApplicationDetailProps, Stage, ReviewHistoryEntry } from './types';
import { 
  X, Mail, Trash2, ChevronRight, ChevronDown, 
  User, FileText, Star, MessageSquare,
  CheckCircle2, ArrowRight, AlertCircle, Users, Send,
  Paperclip, Sparkles, AtSign, Plus, Tag, Loader2, FileEdit, Settings,
  Play, Archive, XCircle, Clock, Folder, ChevronUp, Download, ExternalLink,
  Image, File, FileImage, Bell, Upload, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { emailClient, SendEmailRequest, EmailAttachment } from '@/lib/api/email-client';
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
import { filesClient } from '@/lib/api/files-client';
import type { TableFileResponse } from '@/types/files';
import { recommendationsClient, RecommendationRequest } from '@/lib/api/recommendations-client';
import { RefreshCw, UserPlus, Clock3 } from 'lucide-react';

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
function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

// Helper function to render field values properly (handles arrays, objects, repeaters, files)
function renderFieldValue(value: any, depth: number = 0, fieldLabel?: string): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">Not provided</span>;
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
                      <span className="text-xs font-medium text-gray-500 min-w-[80px]">{formatFieldLabel(k)}:</span>
                      <span className="text-sm text-gray-900">{renderFieldValue(v, depth + 1, k)}</span>
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
              <span className="text-gray-500">{formatFieldLabel(k)}:</span>{' '}
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
                {formatFieldLabel(k)}
              </div>
              <div className="text-gray-900">{renderFieldValue(v, depth + 1, k)}</div>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'documents' | 'reviews' | 'recommendations'>('overview');
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

  // Update emailTo when application changes
  useEffect(() => {
    const email = application.email || (application.raw_data?.email as string) || (application.raw_data?.Email as string) || '';
    setEmailTo(email);
    setSelectedAttachments([]); // Clear attachments when application changes
  }, [application.id, application.email, application.raw_data]);

  // Extract available documents from application for attachment
  const availableDocuments = useMemo(() => {
    const docs: { name: string; url: string; contentType: string }[] = [];
    const rawData = application.raw_data || {};
    
    Object.entries(rawData).forEach(([key, value]) => {
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
          
          docs.push({
            name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: value,
            contentType
          });
        }
      }
    });
    
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
      if (!formId) return;
      
      setIsLoadingFiles(true);
      try {
        // Try to fetch files by workspace_id first, then filter by storage_path containing form_id
        const allFiles = await filesClient.list({ workspace_id: workspaceId });
        // Filter files that belong to this form's submissions
        const formFiles = allFiles.filter(f => 
          f.storage_path?.includes(`submissions/${formId}/`) ||
          f.storage_path?.includes(`uploads/${formId}/`)
        );
        setStorageFiles(formFiles);
      } catch (error) {
        console.error('Failed to fetch storage files:', error);
        setStorageFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
    };
    
    fetchStorageFiles();
  }, [formId, workspaceId]);

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

  // Group fields by section
  const fieldSections = useMemo(() => {
    if (!fields || fields.length === 0) return [];
    
    const sections: { name: string; fields: typeof fields }[] = [];
    let currentSection = { name: 'General Information', fields: [] as typeof fields };
    
    fields.forEach(field => {
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

    if (!emailSubject.trim() || !emailBody.trim()) {
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
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: [application.id],
        recipient_emails: [recipientEmail], // Explicitly pass the recipient email
        subject: emailSubject,
        body: emailBody,
        is_html: true, // Rich text editor produces HTML
        merge_tags: true,
        track_opens: true,
        attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined,
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
    if (!stageId) return 'Unknown';
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
        const toStage = entry.to_stage_id ? getStageName(entry.to_stage_id) : (entry.to_stage || 'Unknown');
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
          message: `Review submitted${review.total_score ? ` (Score: ${review.total_score})` : ''}`,
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

  return (
    <div className="bg-white flex flex-col h-full">
      {/* Header with User Info */}
      <div className="px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {application.name || 'Unknown'}
            </h2>
            <p className="text-sm text-gray-600">{application.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b -mb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "pb-3 border-b-2 transition-colors text-sm font-medium",
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              "pb-3 border-b-2 transition-colors text-sm font-medium",
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Activity
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={cn(
              "pb-3 border-b-2 transition-colors text-sm font-medium flex items-center gap-2",
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Documents
            {documentCounts.uploaded > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-full",
                activeTab === 'documents' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              )}>
                {documentCounts.uploaded}
              </span>
            )}
            {documentCounts.missing > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {documentCounts.missing} missing
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={cn(
              "pb-3 border-b-2 transition-colors text-sm font-medium",
              activeTab === 'reviews'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={cn(
              "pb-3 border-b-2 transition-colors text-sm font-medium flex items-center gap-2",
              activeTab === 'recommendations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Recommendations
            {recommendations.length > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-full",
                recommendations.filter(r => r.status === 'submitted').length === recommendations.length
                  ? 'bg-green-100 text-green-700'
                  : recommendations.filter(r => r.status === 'submitted').length > 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
              )}>
                {recommendations.filter(r => r.status === 'submitted').length}/{recommendations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'overview' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Review Progress */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Review Progress</h3>
                  <div className="flex items-center justify-between gap-4">
                    {displayStages.slice(0, 4).map((stage, index) => (
                      <div key={stage} className="flex flex-col items-center flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all mb-2",
                          currentStageIndex === index
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                            : currentStageIndex > index
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-400'
                        )}>
                          {currentStageIndex > index ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className={cn(
                          "text-xs text-center font-medium",
                          currentStageIndex === index ? 'text-blue-600' : 'text-gray-600'
                        )}>
                          {stage}
                        </span>
                        <span className={cn(
                          "text-xs mt-0.5",
                          currentStageIndex === index ? 'text-blue-500' : 'text-gray-400'
                        )}>
                          {currentStageIndex === index ? 'Current' : currentStageIndex > index ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ready to Review Card */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold mb-1">Ready to Review</h3>
                      <p className="text-sm text-blue-100">Complete your review to move this application forward</p>
                    </div>
                    <button 
                      onClick={handleReview}
                      className="px-5 py-2.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold shadow-md text-sm"
                    >
                      Start Review
                    </button>
                  </div>
                </div>

                {/* Application Fields - Organized by Sections */}
                {fieldSections.length > 0 ? (
                  fieldSections.map((section, sectionIdx) => (
                    <div key={sectionIdx}>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        {section.name}
                      </h3>
                      <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="divide-y divide-gray-100">
                          {section.fields.map((field) => {
                            const value = application.raw_data?.[field.id] || 
                                         application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                                         application.raw_data?.[field.label] || '';
                            if (!value && value !== 0) return null;
                            
                            return (
                              <div key={field.id} className="px-4 py-3 flex items-start gap-4">
                                <div className="w-1/3 flex-shrink-0">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    {field.label}
                                  </span>
                                </div>
                                <div className="flex-1 text-sm">
                                  {renderFieldValue(value)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback: Show raw_data organized nicely */
                  application.raw_data && Object.keys(application.raw_data).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Application Details
                      </h3>
                      <div className="bg-white border rounded-xl overflow-hidden">
                        <div className="divide-y divide-gray-100">
                          {Object.entries(application.raw_data)
                            .filter(([key]) => !key.startsWith('_'))
                            .map(([key, value]) => {
                              if (!value && value !== 0) return null;
                              
                              return (
                                <div key={key} className="px-4 py-3 flex items-start gap-4">
                                  <div className="w-1/3 flex-shrink-0">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                  <div className="flex-1 text-sm">
                                    {renderFieldValue(value)}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Letters of Recommendation Section */}
                {(recommendations.length > 0 || loadingRecommendations) && (
                  <div className="mt-6 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-purple-600" />
                      Letters of Recommendation
                      {recommendations.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {recommendations.filter(r => r.status === 'submitted').length}/{recommendations.length} received
                        </span>
                      )}
                    </h3>
                    
                    {loadingRecommendations ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading recommendation requests...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recommendations.map((rec) => {
                          const isExpanded = expandedRecommendations.has(rec.id);
                          const hasResponse = rec.status === 'submitted' && rec.response && Object.keys(rec.response).length > 0;
                          
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
                                    <div className="flex items-center gap-2">
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
                                    <div className="mt-1 text-xs text-gray-500 truncate">
                                      {rec.recommender_email}
                                      {rec.recommender_relationship && ` • ${rec.recommender_relationship}`}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-xs">
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded",
                                        rec.status === 'submitted' ? "bg-green-100 text-green-700" :
                                        rec.status === 'expired' ? "bg-red-100 text-red-700" :
                                        rec.status === 'cancelled' ? "bg-gray-100 text-gray-500" :
                                        "bg-yellow-100 text-yellow-700"
                                      )}>
                                        {rec.status === 'submitted' ? 'Received' :
                                         rec.status === 'expired' ? 'Expired' :
                                         rec.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                                      </span>
                                      {rec.submitted_at && (
                                        <span className="text-gray-400">
                                          Submitted {new Date(rec.submitted_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {rec.status === 'pending' && rec.reminder_count > 0 && (
                                        <span className="text-gray-400">
                                          {rec.reminder_count} reminder{rec.reminder_count > 1 ? 's' : ''} sent
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {hasResponse && (
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
                                        className="flex-shrink-0 text-xs px-2 py-1 border rounded hover:bg-white transition-colors flex items-center gap-1"
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp className="w-3 h-3" />
                                            Hide
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3 h-3" />
                                            View
                                          </>
                                        )}
                                      </button>
                                    )}
                                    {rec.status === 'pending' && (
                                      <button
                                        onClick={() => handleSendReminder(rec.id)}
                                        disabled={sendingReminder === rec.id}
                                        className="flex-shrink-0 text-xs px-2 py-1 border rounded hover:bg-white transition-colors flex items-center gap-1"
                                      >
                                        {sendingReminder === rec.id ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <>
                                            <Mail className="w-3 h-3" />
                                            Remind
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Expanded response content */}
                                {isExpanded && hasResponse && (
                                  <div className="mt-3 pt-3 border-t border-green-200 space-y-3">
                                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                      Recommendation Content
                                    </h4>
                                    <div className="space-y-3 bg-white rounded border p-3">
                                      {Object.entries(rec.response || {}).map(([key, value]) => {
                                        // Skip internal fields
                                        if (key.startsWith('_')) return null;
                                        
                                        // Handle uploaded document
                                        if (key === 'uploaded_document' || key === 'document') {
                                          const doc = typeof value === 'object' ? value : {};
                                          const docUrl = doc.url || doc.URL || doc.Url || (typeof value === 'string' ? value : '');
                                          const docName = doc.filename || doc.name || doc.Name || 'Document';
                                          
                                          if (!docUrl) return null;
                                          
                                          return (
                                            <div key={key} className="space-y-1">
                                              <label className="text-xs font-medium text-gray-700">Uploaded Document</label>
                                              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="text-sm text-gray-900 flex-1 truncate">{docName}</span>
                                                <a
                                                  href={docUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                >
                                                  <ExternalLink className="w-3 h-3" />
                                                  Open
                                                </a>
                                              </div>
                                            </div>
                                          );
                                        }
                                        
                                        // Handle relationship field
                                        if (key === 'relationship') {
                                          return (
                                            <div key={key} className="space-y-1">
                                              <label className="text-xs font-medium text-gray-700">How do you know the applicant?</label>
                                              <p className="text-sm text-gray-900">{String(value)}</p>
                                            </div>
                                          );
                                        }
                                        
                                        // Handle question responses (by question ID)
                                        // For now, display as key-value pairs
                                        // In the future, we could fetch field config to get question labels
                                        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                                        
                                        return (
                                          <div key={key} className="space-y-1">
                                            <label className="text-xs font-medium text-gray-700">{displayKey}</label>
                                            <div className="text-sm text-gray-900 whitespace-pre-wrap">
                                              {displayValue}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            {(() => {
              // Extract all documents from fields and raw_data
              const documents: { fieldId: string; fieldLabel: string; value: any; required?: boolean }[] = [];
              const missingDocuments: { fieldId: string; fieldLabel: string }[] = [];
              
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
                      documents.push({
                        fieldId: field.id,
                        fieldLabel: field.label || field.id,
                        value: parsedValue
                      });
                    } else {
                      // No document uploaded for this field - it's missing
                      missingDocuments.push({
                        fieldId: field.id,
                        fieldLabel: field.label || field.id
                      });
                    }
                  }
                });
              }
              
              // Also scan raw_data for any file values not in fields
              if (application.raw_data) {
                Object.entries(application.raw_data).forEach(([key, value]) => {
                  const parsedValue = parseValueIfNeeded(value);
                  if (isFileValue(parsedValue)) {
                    // Check if we already have this document
                    const exists = documents.some(d => d.fieldId === key || d.fieldLabel === key);
                    if (!exists) {
                      documents.push({
                        fieldId: key,
                        fieldLabel: formatFieldLabel(key),
                        value: parsedValue
                      });
                    }
                  }
                });
              }
              
              // Add files from storage (table_files) that have proper URLs
              const storageDocuments = storageFiles.map(file => ({
                fieldId: file.id,
                fieldLabel: file.original_filename || file.filename || 'Document',
                value: {
                  url: file.public_url,
                  name: file.original_filename || file.filename,
                  size: file.size_bytes,
                  type: file.mime_type,
                  mimeType: file.mime_type,
                }
              }));
              
              // Combine documents - prefer storage files with proper URLs
              const allDocuments = [...storageDocuments];
              
              // Add documents from raw_data only if they have non-blob URLs
              documents.forEach(doc => {
                const parsedValue = parseValueIfNeeded(doc.value);
                const url = parsedValue?.url || parsedValue?.Url || parsedValue?.URL || '';
                // Only add if it's not a blob URL and not already in storage files
                if (url && !url.startsWith('blob:')) {
                  const alreadyExists = allDocuments.some(d => 
                    d.value?.url === url || d.fieldLabel === doc.fieldLabel
                  );
                  if (!alreadyExists) {
                    allDocuments.push(doc);
                  }
                }
              });
              
              const hasDocuments = allDocuments.length > 0;
              const hasMissing = missingDocuments.length > 0;
              
              return (
                <div className="space-y-6">
                  {/* Loading state */}
                  {isLoadingFiles && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-500">Loading documents...</span>
                    </div>
                  )}
                  
                  {/* Header with send reminder button */}
                  {!isLoadingFiles && (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Documents {hasDocuments && `(${allDocuments.length})`}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Files and documents uploaded by the applicant
                        </p>
                      </div>
                      {hasMissing && (
                        <button 
                          onClick={() => {
                            setActiveTab('activity');
                            setActiveCommentTab('email');
                            setEmailSubject(`Reminder: Missing Documents Required`);
                            setEmailBody(`Hi ${application.name || 'there'},\n\nWe noticed that your application is still missing the following documents:\n\n${missingDocuments.map(d => `- ${d.fieldLabel}`).join('\n')}\n\nPlease upload these at your earliest convenience to complete your application.\n\nThank you!`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium border border-amber-200"
                        >
                          <Bell className="w-4 h-4" />
                          Send Reminder
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Missing Documents Alert */}
                  {hasMissing && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-900 mb-1">Missing Documents</h4>
                          <p className="text-sm text-amber-700 mb-3">
                            The following required documents have not been uploaded yet:
                          </p>
                          <div className="space-y-2">
                            {missingDocuments.map((doc, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                  <Upload className="w-3 h-3 text-amber-600" />
                                </div>
                                <span className="text-amber-800 font-medium">{doc.fieldLabel}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Uploaded Documents */}
                  {hasDocuments ? (
                    <div className="space-y-4">
                      {allDocuments.map((doc, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                                <Paperclip className="w-4 h-4 text-blue-600" />
                                {doc.fieldLabel.replace(/_/g, ' ')}
                              </h4>
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">
                                Uploaded
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <InlineDocumentPreview value={doc.value} fieldLabel={doc.fieldLabel} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !hasMissing && !isLoadingFiles ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                      <Paperclip className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents</h3>
                      <p className="text-gray-500 text-sm">
                        This application doesn&apos;t have any file upload fields or documents
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Reviews ({application.reviewedCount || 0}/{application.totalReviewers || 0})
                </h3>
              </div>
              
              {application.reviewHistory && application.reviewHistory.length > 0 ? (
                <div className="space-y-4">
                  {application.reviewHistory.map((review, idx) => {
                    const totalScore = review.total_score || Object.values(review.scores || {}).reduce((a, b) => a + b, 0);
                    const reviewerName = review.reviewer_name || getReviewerName(review.reviewer_id);
                    return (
                      <div key={idx} className="bg-white border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                              {reviewerName[0]?.toUpperCase() || 'R'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{reviewerName}</div>
                              {review.reviewed_at && (
                                <div className="text-xs text-gray-500">
                                  {new Date(review.reviewed_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-lg">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-gray-900 text-sm font-semibold">{totalScore}/{application.maxScore || 10}</span>
                          </div>
                        </div>
                        {review.notes && (
                          <p className="text-gray-700 text-sm">{review.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Yet</h3>
                  <p className="text-gray-500 text-sm">Reviews from assigned reviewers will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-600" />
                  Letters of Recommendation
                  {recommendations.length > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {recommendations.filter(r => r.status === 'submitted').length}/{recommendations.length} received
                    </span>
                  )}
                </h3>
              </div>
              
              {loadingRecommendations ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-8">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading recommendation requests...
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div 
                      key={rec.id} 
                      className={cn(
                        "p-4 rounded-lg border",
                        rec.status === 'submitted' ? "bg-green-50 border-green-200" :
                        rec.status === 'expired' ? "bg-red-50 border-red-200" :
                        rec.status === 'cancelled' ? "bg-gray-50 border-gray-200" :
                        "bg-yellow-50 border-yellow-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {rec.status === 'submitted' ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : rec.status === 'expired' ? (
                              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            ) : rec.status === 'cancelled' ? (
                              <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <Clock3 className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {rec.recommender_name}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium",
                              rec.status === 'submitted' ? "bg-green-100 text-green-700" :
                              rec.status === 'expired' ? "bg-red-100 text-red-700" :
                              rec.status === 'cancelled' ? "bg-gray-100 text-gray-500" :
                              "bg-yellow-100 text-yellow-700"
                            )}>
                              {rec.status === 'submitted' ? 'Received' :
                               rec.status === 'expired' ? 'Expired' :
                               rec.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {rec.recommender_email}
                          </div>
                          {rec.recommender_relationship && (
                            <div className="text-sm text-gray-500 mt-1">
                              Relationship: {rec.recommender_relationship}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            {rec.submitted_at ? (
                              <span>Submitted {new Date(rec.submitted_at).toLocaleDateString()}</span>
                            ) : (
                              <span>Requested {new Date(rec.created_at).toLocaleDateString()}</span>
                            )}
                            {rec.reminder_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Bell className="w-3 h-3" />
                                {rec.reminder_count} reminder{rec.reminder_count > 1 ? 's' : ''} sent
                              </span>
                            )}
                          </div>
                        </div>
                        {rec.status === 'pending' && (
                          <button
                            onClick={() => handleSendReminder(rec.id)}
                            disabled={sendingReminder === rec.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {sendingReminder === rec.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                            Send Reminder
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recommendations Requested</h3>
                  <p className="text-gray-500 text-sm">
                    Letters of recommendation for this applicant will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            {/* Activity Feed */}
            <div className="flex-shrink-0 p-6">
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-2 text-sm">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                      activity.type === 'status' ? 'bg-blue-100 text-blue-600' :
                      activity.type === 'review' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {activity.type === 'status' ? <ArrowRight className="w-3 h-3" /> :
                       activity.type === 'review' ? <Star className="w-3 h-3" /> :
                       <MessageSquare className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900">{activity.message}</p>
                      <div className="flex items-center gap-1.5 text-gray-500 mt-0.5 text-xs">
                        <span>{activity.user}</span>
                        <span>•</span>
                        <span>{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment/Email Input */}
            <div className="border-t bg-white flex-shrink-0 p-4 pb-20">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                {activeCommentTab === 'email' ? (
                  <>
                    {/* From field */}
                    <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                      <span className="text-gray-600 text-sm w-16">From</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex-1 flex items-center gap-2 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors text-left">
                            <span className="text-gray-900 text-sm">
                              {selectedFromEmail || gmailConnection?.email || 'Select sender...'}
                            </span>
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
                      <button
                        onClick={() => setShowEmailSettings(true)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Email settings"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    {/* To field */}
                    <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                      <span className="text-gray-600 text-sm w-16">To</span>
                      <input
                        type="text"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder={application.email}
                        className="flex-1 px-0 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 text-sm"
                      />
                      <button
                        onClick={() => setShowCcBcc(!showCcBcc)}
                        className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
                      >
                        Cc Bcc
                      </button>
                    </div>
                    
                    {showCcBcc && (
                      <>
                        <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                          <span className="text-gray-600 text-sm w-16">Cc</span>
                          <input
                            type="text"
                            value={emailCc}
                            onChange={(e) => setEmailCc(e.target.value)}
                            className="flex-1 px-0 bg-transparent border-0 text-gray-900 focus:outline-none focus:ring-0 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                          <span className="text-gray-600 text-sm w-16">Bcc</span>
                          <input
                            type="text"
                            value={emailBcc}
                            onChange={(e) => setEmailBcc(e.target.value)}
                            className="flex-1 px-0 bg-transparent border-0 text-gray-900 focus:outline-none focus:ring-0 text-sm"
                          />
                        </div>
                      </>
                    )}
                    
                    {/* Subject field */}
                    <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                      <span className="text-gray-600 text-sm w-16">Subject</span>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="flex-1 px-0 bg-transparent border-0 text-gray-900 focus:outline-none focus:ring-0 text-sm"
                      />
                    </div>

                    {/* Merge Tags Button */}
                    {availableMergeTags.length > 0 && (
                      <div className="py-2 border-b border-gray-200">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors">
                              <Tag className="w-3 h-3" />
                              Insert Field
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-0 bg-white border border-gray-200 shadow-lg" align="start">
                            <div className="max-h-48 overflow-y-auto">
                              {availableMergeTags.map((field, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => insertMergeTag(field.label)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between bg-white"
                                >
                                  <span className="truncate">{field.label}</span>
                                  <span className="text-xs text-gray-400 ml-2">{field.tag}</span>
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {/* Attachments Section */}
                    {(availableDocuments.length > 0 || selectedAttachments.length > 0) && (
                      <div className="py-2 border-b border-gray-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Attachment picker */}
                          {availableDocuments.length > 0 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 px-2 py-1 hover:bg-gray-100 rounded transition-colors">
                                  <Paperclip className="w-3 h-3" />
                                  Attach Document
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2 bg-white border border-gray-200 shadow-lg" align="start">
                                <p className="text-xs text-gray-500 mb-2">Select documents to attach:</p>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {availableDocuments.map((doc, idx) => {
                                    const isSelected = selectedAttachments.some(a => a.url === doc.url);
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => toggleAttachment(doc)}
                                        className={cn(
                                          "w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors",
                                          isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100 text-gray-700"
                                        )}
                                      >
                                        {doc.contentType.includes('pdf') ? (
                                          <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        ) : doc.contentType.includes('image') ? (
                                          <Image className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        ) : (
                                          <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        )}
                                        <span className="truncate flex-1">{doc.name}</span>
                                        <Checkbox checked={isSelected} className="flex-shrink-0" />
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}

                          {/* Show selected attachments */}
                          {selectedAttachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{att.filename}</span>
                              <button
                                onClick={() => setSelectedAttachments(prev => prev.filter((_, i) => i !== idx))}
                                className="ml-1 hover:bg-blue-100 rounded p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Email body */}
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Write your message. Use Insert Field to add personalized content like {{First Name}}"
                      rows={3}
                      className="w-full px-0 py-3 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none text-sm"
                    />
                  </>
                ) : (
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a comment..."
                    rows={2}
                    className="w-full px-0 py-2 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none text-sm"
                  />
                )}
                
                {/* Action bar */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <Plus className="w-4 h-4" />
                    </button>
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                        className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-200 rounded transition-colors text-gray-700 text-sm"
                      >
                        <span className="capitalize">{activeCommentTab}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      
                      {showTypeDropdown && (
                        <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                          <button
                            onClick={() => {
                              setActiveCommentTab('comment');
                              setShowTypeDropdown(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm",
                              activeCommentTab === 'comment' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            )}
                          >
                            Comment
                          </button>
                          <button
                            onClick={() => {
                              setActiveCommentTab('email');
                              setShowTypeDropdown(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm",
                              activeCommentTab === 'email' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            )}
                          >
                            Email
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600">
                      <Sparkles className="w-4 h-4" />
                    </button>
                    
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                      <AtSign className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (activeCommentTab === 'comment') {
                        toast.success('Comment added');
                        setComment('');
                      } else {
                        handleSendEmail();
                      }
                    }}
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
        )}

        {/* Action Buttons - Fixed at bottom for overview tab only */}
        {activeTab === 'overview' && (
        <div className="p-4 border-t bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Dynamic Action Button with Dropdown */}
            <div className="relative flex-1 max-w-sm">
              <button
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium shadow-sm transition-all text-sm"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Move to: {application.stageName || application.status}
                </span>
                {showActionsDropdown ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {showActionsDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* Stage Actions */}
                  {stageActions.length > 0 && (
                    <div className="p-2 border-b border-gray-100">
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Stage Actions
                      </div>
                      {stageActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => {
                            // Execute stage action
                            if (action.target_stage_id) {
                              const targetStage = stages.find(s => s.id === action.target_stage_id);
                              if (targetStage) {
                                handleStageChange(targetStage.name as ApplicationStatus);
                              }
                            } else if (action.status_value) {
                              handleStageChange(action.status_value as ApplicationStatus);
                            }
                            setShowActionsDropdown(false);
                            toast.success(`Action "${action.name}" executed`);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                            "hover:bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            action.color === 'green' && 'bg-green-100 text-green-600',
                            action.color === 'blue' && 'bg-blue-100 text-blue-600',
                            action.color === 'orange' && 'bg-orange-100 text-orange-600',
                            action.color === 'red' && 'bg-red-100 text-red-600',
                            action.color === 'purple' && 'bg-purple-100 text-purple-600',
                            (!action.color || action.color === 'gray') && 'bg-gray-100 text-gray-600'
                          )}>
                            {actionIcons[action.icon] || <ArrowRight className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{action.name}</div>
                            {action.description && (
                              <div className="text-xs text-gray-500">{action.description}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Move to Stage */}
                  <div className="p-2 border-b border-gray-100">
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Move to Stage
                    </div>
                    {displayStages.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => {
                          handleStageChange(stage);
                          setShowActionsDropdown(false);
                        }}
                        disabled={stage === application.stageName || stage === application.status}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm",
                          stage === application.stageName || stage === application.status
                            ? 'opacity-50 cursor-not-allowed bg-gray-50'
                            : 'hover:bg-gray-50'
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <span className="text-gray-900">{stage}</span>
                        {(stage === application.stageName || stage === application.status) && (
                          <span className="ml-auto text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Current</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Workflow Actions (Global) */}
                  {workflowActions.length > 0 && (
                    <div className="p-2 border-b border-gray-100">
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Quick Actions
                      </div>
                      {workflowActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => {
                            if (action.target_stage_id) {
                              const targetStage = stages.find(s => s.id === action.target_stage_id);
                              if (targetStage) {
                                handleStageChange(targetStage.name as ApplicationStatus);
                              }
                            }
                            setShowActionsDropdown(false);
                            toast.success(`Action "${action.name}" executed`);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                            "hover:bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            action.color === 'green' && 'bg-green-100 text-green-600',
                            action.color === 'blue' && 'bg-blue-100 text-blue-600',
                            action.color === 'orange' && 'bg-orange-100 text-orange-600',
                            action.color === 'red' && 'bg-red-100 text-red-600',
                            action.color === 'purple' && 'bg-purple-100 text-purple-600',
                            (!action.color || action.color === 'gray') && 'bg-gray-100 text-gray-600'
                          )}>
                            {actionIcons[action.icon] || <ArrowRight className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{action.name}</div>
                            {action.description && (
                              <div className="text-xs text-gray-500">{action.description}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Default Actions */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        handleStageChange('revision_requested' as ApplicationStatus);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm hover:bg-yellow-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
                        <FileEdit className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Request Revision</div>
                        <div className="text-xs text-gray-500">Allow applicant to edit their submission</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleStageChange('Rejected' as ApplicationStatus);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm hover:bg-red-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Reject Application</div>
                        <div className="text-xs text-gray-500">Move to rejected status</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="ml-auto">
              <button 
                onClick={handleDelete}
                className={cn(
                  "p-2.5 rounded-lg border transition-all",
                  showDeleteConfirm 
                    ? 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200' 
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                )}
                title={showDeleteConfirm ? 'Click again to confirm' : 'Delete application'}
              >
                {showDeleteConfirm ? <AlertCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {showActionsDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowActionsDropdown(false)}
        />
      )}

      {/* Email Settings Dialog */}
      {workspaceId && (
        <EmailSettingsDialog
          workspaceId={workspaceId}
          open={showEmailSettings}
          onOpenChange={setShowEmailSettings}
          onAccountsUpdated={refreshConnection}
        />
      )}
    </div>
  );
}
