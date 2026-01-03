'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Application, ApplicationStatus, ApplicationDetailProps, Stage, ReviewHistoryEntry } from './types';
import { 
  X, Mail, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  User, FileText, Star, MessageSquare,
  CheckCircle2, ArrowRight, AlertCircle, Users, Send,
  Paperclip, Sparkles, AtSign, Plus, Tag, Loader2, FileEdit, Settings,
  Play, Archive, XCircle, Clock, Folder, ChevronUp, Download, ExternalLink,
  Image, File, FileImage, Bell, Upload, Eye, Search, Link, Smile, PenTool, MoreVertical, Maximize2, Square, PanelRight
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
import { QuickReminderPanel } from '../QuickReminderPanel';
import { FullEmailComposer } from '../FullEmailComposer';

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
  const [showActivityPanel, setShowActivityPanel] = useState(false); // Toggle between details and activity
  const [isActivityPanelCollapsed, setIsActivityPanelCollapsed] = useState(false); // For modal/fullscreen collapse
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
      // Find the account ID for the selected email
      const selectedAccount = emailAccounts.find(acc => acc.email === selectedFromEmail);
      
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
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500">
            <Sparkles className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500">
            <Users className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split View: Overview (Left) + Activity (Right) - Always visible */}
      <div className={cn(
        "flex-1 min-h-0 flex overflow-hidden",
        viewMode === 'modal' && "rounded-lg"
      )}>
        {/* Application Details Panel */}
        {(!showActivityPanel || viewMode === 'fullscreen') && (
          <div className={cn(
            "flex overflow-hidden transition-all duration-300",
            (viewMode === 'modal' || viewMode === 'fullscreen') && isActivityPanelCollapsed ? "flex-1 w-full" : "flex-1"
          )}>
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
              {/* Name */}
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {application.name || 'Unknown'}
              </h1>

            {/* AI Prompt Box */}
            <div className="mb-6 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Ask Brain to write a description, create a summary or find similar people.
                </p>
              </div>
            </div>

            {/* Key Fields */}
            <div className="space-y-3 mb-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <button 
                  onClick={() => {
                    const currentStage = stages.find(s => s.id === application.stageId);
                    if (currentStage) {
                      const nextStageIndex = stages.findIndex(s => s.id === currentStage.id) + 1;
                      if (nextStageIndex < stages.length) {
                        onStatusChange?.(application.id, stages[nextStageIndex].name as ApplicationStatus);
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-200 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  {application.stageName?.toUpperCase() || application.status?.toUpperCase() || 'SUBMITTED'}
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
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

            {/* Custom Fields Section */}
            <div className="border-t pt-4">
              <button className="flex items-center justify-between w-full text-left">
                <span className="text-sm font-medium text-gray-700">Custom Fields</span>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-400" />
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                  <Plus className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            </div>
              </div>
            </div>

            {/* Action Buttons - Right Side Vertical (sidebar and fullscreen modes) */}
            {(viewMode === 'sidebar' || viewMode === 'fullscreen') && (
              <div className="flex flex-col items-center gap-2 p-2 border-l border-gray-200 bg-gray-50">
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                  <Search className="w-4 h-4 text-gray-500" />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded transition-colors relative">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">1</span>
                </button>
                <button 
                  onClick={() => setShowActivityPanel(true)}
                  className={cn(
                    "p-1.5 hover:bg-gray-100 rounded transition-colors",
                    showActivityPanel && "bg-blue-50"
                  )}
                >
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Activity Panel - Show in modal/fullscreen when not collapsed, or in fullscreen when showActivityPanel is true */}
        {((viewMode === 'modal' || viewMode === 'fullscreen') && !showActivityPanel && !isActivityPanelCollapsed) || 
         (viewMode === 'fullscreen' && showActivityPanel) ? (
          <>
            {/* Collapse Button */}
            <div className="flex items-center justify-center w-6 border-l border-gray-200 bg-gray-50">
              <button
                onClick={() => setIsActivityPanelCollapsed(true)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Collapse activity panel"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Activity Panel */}
            <div className="w-80 flex flex-col overflow-hidden border-l border-gray-200">
              {/* Activity Header */}
              <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
                <div className="flex items-center gap-1">
                  {viewMode === 'fullscreen' && showActivityPanel && (
                    <button 
                      onClick={() => setShowActivityPanel(false)}
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
                  <div className="ml-14 relative">
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Say something, press 'space' for AI, '/' for commands"
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white"
                    />
                  </div>

                  {/* Bottom Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button className="px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">
                        Email
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600">
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <AtSign className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <AtSign className="w-4 h-4" />
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
                      <button className="px-2 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors">
                        Add signature
                      </button>
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
          </>
        ) : null}

        {/* Expand Button - Show when activity panel is collapsed in modal/fullscreen */}
        {(viewMode === 'modal' || viewMode === 'fullscreen') && !showActivityPanel && isActivityPanelCollapsed && (
          <div className="flex items-center justify-center w-6 border-l border-gray-200 bg-gray-50">
            <button
              onClick={() => setIsActivityPanelCollapsed(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Expand activity panel"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        {/* Activity Panel - Replaces details when active (sidebar mode), or shows to the right (fullscreen mode) */}
        {showActivityPanel && viewMode !== 'fullscreen' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Activity Header */}
            <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
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
              <div className="ml-14 relative">
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Say something, press 'space' for AI, '/' for commands"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white"
                />
              </div>

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button className="px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">
                    Email
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600">
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <AtSign className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <AtSign className="w-4 h-4" />
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
                  <button className="px-2 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors">
                    Add signature
                  </button>
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
        )}
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
