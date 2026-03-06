'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Application, ApplicationStatus, ApplicationDetailProps, ReviewHistoryEntry } from './types';
import { 
  X, Mail, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  User, FileText, Star, MessageSquare,
  CheckCircle2, ArrowRight, AlertCircle, Users, Send,
  Paperclip, Sparkles, AtSign, Tag, Loader2, FileEdit, Settings,
  Play, Archive, XCircle, Clock, Folder, ChevronUp, Download, ExternalLink,
  Image, File, FileImage, Bell, Upload, Eye, Search, Link, Smile, PenTool, MoreVertical, Maximize2, Square, PanelRight, UserPlus, Clock3, FileSignature, KeyRound, Copy
} from 'lucide-react';
import { cn, getApplicantDisplayName } from '@/lib/utils';
import { NOT_PROVIDED, UNKNOWN, NO_NAME_PROVIDED } from '@/constants/fallbacks';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { Badge } from '@/ui-components/badge';
import { Separator } from '@/ui-components/separator';
import { ScrollArea } from '@/ui-components/scroll-area';
import { Button } from '@/ui-components/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui-components/tooltip';
import { emailClient, SendEmailRequest, EmailAttachment, EmailSignature } from '@/lib/api/email-client';
import { dashboardClient } from '@/lib/api/dashboard-client';
import { crmClient } from '@/lib/api/crm-client';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/ui-components/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";
import { Checkbox } from '@/ui-components/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui-components/collapsible';
import { Progress } from '@/ui-components/progress';
import { RadioGroup, RadioGroupItem } from '@/ui-components/radio-group';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
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
    }
    
    // Try matching by ID or name (for repeater subfields that use field IDs/names as keys)
    if (!fieldDef) {
      for (const [mapKey, mapField] of fieldMap.entries()) {
        const mapFieldId = mapField.id || mapKey;
        const mapFieldName = mapField.name;
        
        // Exact match by ID
        if (mapFieldId === key || mapFieldId === key.replace(/^Field-/, '')) {
          fieldDef = mapField;
          break;
        }
        
        // Match by name (for repeater subfields)
        if (mapFieldName && (mapFieldName === key || mapFieldName.toLowerCase().replace(/\s+/g, '_') === key.toLowerCase())) {
          fieldDef = mapField;
          break;
        }
        
        // Try matching the base part (before the last segment) for complex IDs
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
    // Address field — render as a single clean string
    if ('full_address' in parsedValue || 'city' in parsedValue) {
      const address =
        parsedValue.full_address ||
        [parsedValue.street_address, parsedValue.city, parsedValue.state, parsedValue.postal_code]
          .filter(Boolean)
          .join(', ');
      return <span className="text-gray-900">{address}</span>;
    }

    const entries = Object.entries(parsedValue).filter(([k]) => !k.startsWith('_')); // Skip internal fields

    if (entries.length === 0) {
      return <span className="text-gray-400 italic">Empty</span>;
    }

    // Unwrap single-value groups (e.g. {"field-1766110112708-zg4hskrds": "11"} → "11")
    if (entries.length === 1) {
      return renderFieldValue(entries[0][1], depth, fieldLabel, fieldMap);
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
  reviewersMap,
  onStatusChange,
  onClose,
  onStartReview,
  onDelete,
  workspaceId,
  formId,
  fields = [],
  sections = [],
  onActivityCreated
}: ApplicationDetailProps) {
  const [showActivityPanel, setShowActivityPanel] = useState(false); // Toggle between details and activity
  const [showRecommendersPanel, setShowRecommendersPanel] = useState(false); // Toggle recommenders panel
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(false); // Toggle documents panel
  const [viewMode, setViewMode] = useState<'modal' | 'fullscreen' | 'sidebar'>('sidebar');
  const [selectedStage, setSelectedStage] = useState(application.status);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'comment' | 'email'>('comment');
  const [comment, setComment] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  
  // Reset password state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [passwordMode, setPasswordMode] = useState<'generate' | 'custom'>('generate');
  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
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
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  
  // Collapsible sections state - first section open by default
  const [openSections, setOpenSections] = useState<{ [sectionName: string]: boolean }>({});

  // Calculate completion percentage for a section
  const calculateSectionCompletion = (sectionFields: any[]) => {
    let totalFields = 0;
    let completedFields = 0;
    
    sectionFields.forEach(field => {
      // Skip non-required fields from completion calculation
      if (!(field as any).required && (field as any).required !== undefined) {
        return;
      }
      
      totalFields++;
      
      // Try field.id first (UUID key), then fallback to field_key/label
      const value = application.raw_data?.[field.id] || 
                   application.raw_data?.[field.field_key] ||
                   application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                   application.raw_data?.[field.label];
      
      // Check if field is completed
      if (value !== null && value !== undefined && value !== '' && value !== '[]' && value !== '{}') {
        // For arrays, check if they have content
        if (Array.isArray(value) && value.length === 0) {
          return;
        }
        // For objects, check if they have meaningful content
        if (typeof value === 'object' && Object.keys(value).length === 0) {
          return;
        }
        completedFields++;
      }
    });
    
    const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    
    return { completionPercentage, completedFields, totalFields };
  };

  // Toggle section open/closed
  const toggleSection = (sectionName: string, open?: boolean) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: open !== undefined ? open : !prev[sectionName]
    }));
  };
  const [storageFiles, setStorageFiles] = useState<TableFileResponse[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  // Recommendation requests state
  const [recommendations, setRecommendations] = useState<RecommendationRequest[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());
  
  // Email account selection for reminders
  const [selectedReminderAccount, setSelectedReminderAccount] = useState<string>('');
  
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
      const { authClient } = await import('@/auth/client/main');
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

  // Handle password reset
  const handleResetPassword = async () => {
    if (!workspaceId) {
      toast.error('Workspace ID not found');
      return;
    }

    // Validate custom password if in custom mode
    if (passwordMode === 'custom') {
      if (!customPassword || customPassword.length < 8) {
        toast.error('Password must be at least 8 characters long');
        return;
      }
    }

    setIsResettingPassword(true);
    try {
      if (passwordMode === 'generate') {
        const result = await crmClient.resetPassword(application.id, workspaceId);
        if (result.success) {
          setTemporaryPassword(result.temporary_password);
          toast.success('Password reset successfully');
        } else {
          toast.error(result.message || 'Failed to reset password');
          setShowResetPasswordModal(false);
        }
      } else {
        const result = await crmClient.setPassword(application.id, workspaceId, customPassword);
        if (result.success) {
          setTemporaryPassword(customPassword);
          toast.success('Password set successfully');
        } else {
          toast.error(result.message || 'Failed to set password');
          setShowResetPasswordModal(false);
        }
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast.error('Failed to reset password');
      setShowResetPasswordModal(false);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      toast.success('Password copied to clipboard');
    }
  };

  const handleCloseResetModal = () => {
    setShowResetPasswordModal(false);
    setTemporaryPassword(null);
    setPasswordMode('generate');
    setCustomPassword('');
    setShowPassword(false);
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
        console.log('[ApplicationDetail] Loaded recommendations:', data?.length, data);
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

  // Extract recommendation documents for display
  const recommendationDocuments = useMemo(() => {
    const docs: { name: string; url: string; contentType: string; recommenderName: string; submittedAt?: string }[] = [];
    
    recommendations.forEach(rec => {
      if (rec.status === 'submitted' && rec.response) {
        try {
          const response = typeof rec.response === 'string' ? JSON.parse(rec.response) : rec.response;
          
          // Check for uploaded_document in response
          if (response.uploaded_document) {
            const doc = response.uploaded_document;
            if (doc.url) {
              docs.push({
                name: doc.name || doc.filename || `Recommendation from ${rec.recommender_name}`,
                url: doc.url,
                contentType: doc.content_type || doc.mime_type || 'application/pdf',
                recommenderName: rec.recommender_name,
                submittedAt: rec.submitted_at
              });
            }
          }
        } catch (err) {
          console.error('[ApplicationDetail] Failed to parse recommendation response:', err);
        }
      }
    });
    
    console.log('[ApplicationDetail] Extracted recommendation documents:', docs.length, docs);
    return docs;
  }, [recommendations]);

  // Send reminder to recommender
  const handleSendReminder = async (requestId: string) => {
    setSendingReminder(requestId);
    try {
      // Use selected account or default account
      const accountId = selectedReminderAccount || (emailAccounts.find(acc => acc.is_default)?.id);
      await recommendationsClient.sendReminder(requestId, accountId);
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
      // Also index by field_key / name so repeater sub-field keys resolve to labels
      const fieldName = (f as any).name;
      if (fieldName && fieldName !== fieldLabel) {
        map.set(fieldName, f);
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

  // Group fields by section using form editor sections
  const fieldSections = useMemo(() => {
    console.log('ApplicationDetail - Processing sections:', sections);
    console.log('ApplicationDetail - Processing fields:', fields);
    console.log('ApplicationDetail - Application raw_data keys:', Object.keys(application.raw_data || {}));
    
    if (!fields || fields.length === 0) return [];
    
    // If we have sections from the form editor, use those
    if (sections && sections.length > 0) {
      console.log('ApplicationDetail - Using form editor sections');
      return sections
        .map((section, index) => {
          // Handle different section property names based on source
          const sectionId = section.id;
          const sectionName = section.name;
          const sectionDescription = section.description;
          const sortOrder = section.sort_order !== undefined ? section.sort_order : index;
          
          console.log('ApplicationDetail - Processing section:', sectionName, 'with id:', sectionId);
          
          // Get fields for this section
          const sectionFields = fields.filter(field => {
            const fieldSectionId = (field as any).section_id;
            const hasSection = fieldSectionId === sectionId;
            console.log(`ApplicationDetail - Field ${field.label} (${field.id}) section_id: ${fieldSectionId}, matches section ${sectionId}: ${hasSection}`);
            return hasSection;
          });
          
          console.log(`ApplicationDetail - Section "${sectionName}" has ${sectionFields.length} fields:`, sectionFields.map(f => f.label));
          
          // Filter out layout fields
          const layoutFieldTypes = ['section', 'divider', 'heading', 'paragraph', 'callout'];
          const regularFields = sectionFields.filter(field => {
            if ((field as any).field_type?.category === 'layout') {
              return false;
            }
            if (layoutFieldTypes.includes(field.type)) {
              return false;
            }
            return true;
          });
          
          // Skip sections with no regular fields
          if (regularFields.length === 0) {
            console.log(`ApplicationDetail - Skipping section "${sectionName}" - no regular fields`);
            return null;
          }
          
          const completionStats = calculateSectionCompletion(regularFields);
          
          console.log(`ApplicationDetail - Section "${sectionName}" completion:`, completionStats);
          
          return {
            name: sectionName,
            description: sectionDescription,
            fields: regularFields,
            sortOrder,
            ...completionStats
          };
        })
        .filter(Boolean) // Remove null sections
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder); // Sort by order
    }
    
    // Fallback to original field-based parsing if no sections available
    console.log('ApplicationDetail - No sections available, using fallback field-based parsing');
    const layoutFieldTypes = ['section', 'divider', 'heading', 'paragraph', 'callout'];
    const regularFields = fields.filter(field => {
      if ((field as any).field_type?.category === 'layout') {
        return false;
      }
      if (layoutFieldTypes.includes(field.type)) {
        return false;
      }
      return true;
    });
    
    console.log('ApplicationDetail - Regular fields for fallback:', regularFields.length);
    
    const fallbackSections: { name: string; fields: typeof fields; completionPercentage: number; completedFields: number; totalFields: number }[] = [];
    let currentSection = { name: 'General Information', fields: [] as typeof fields };
    
    regularFields.forEach(field => {
      if (field.type === 'section') {
        if (currentSection.fields.length > 0) {
          const completionStats = calculateSectionCompletion(currentSection.fields);
          fallbackSections.push({ ...currentSection, ...completionStats });
        }
        currentSection = { name: field.label || 'Section', fields: [] };
      } else {
        currentSection.fields.push(field);
      }
    });
    
    if (currentSection.fields.length > 0) {
      const completionStats = calculateSectionCompletion(currentSection.fields);
      fallbackSections.push({ ...currentSection, ...completionStats });
    }
    
    console.log('ApplicationDetail - Fallback sections created:', fallbackSections.map(s => ({ name: s.name, fieldCount: s.fields.length })));
    
    return fallbackSections;
  }, [fields, sections, application.raw_data]);
  
  // Initialize open sections - first section open by default
  useEffect(() => {
    const firstSection = fieldSections[0];
    if (fieldSections.length > 0 && firstSection?.name && !openSections.hasOwnProperty(firstSection.name)) {
      setOpenSections(prev => ({ ...prev, [firstSection.name]: true }));
    }
  }, [fieldSections]);

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
    
    // Count recommendation documents
    uploaded += recommendationDocuments.length;
    
    // Check fields for file/image upload types
    if (fields && fields.length > 0) {
      fields.forEach(field => {
        const isFileField = field.type === 'file_upload' || field.type === 'image_upload' || 
                           field.type === 'file' || field.type === 'image' ||
                           field.label?.toLowerCase().includes('upload') ||
                           field.label?.toLowerCase().includes('document') ||
                           field.label?.toLowerCase().includes('attachment');
        
        if (isFileField) {
          // Try field.id first (UUID key), then fallback to field name/label
          const value = application.raw_data?.[field.id] || 
                       (field.name && application.raw_data?.[field.name]) ||
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
  }, [fields, application.raw_data, storageFiles, recommendationDocuments]);

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

  // Default statuses for filtering
  const displayStages: ApplicationStatus[] = ['Submitted', 'Initial Review', 'Under Review', 'Final Review', 'Approved'];

  const currentStageIndex = displayStages.findIndex(s => 
    s === application.status
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

  // Status names are used directly now
  const getStatusName = (status?: string) => {
    return status || UNKNOWN;
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

    // Stage history removed - workflow feature deleted

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

    // Current status tracking - simplified without workflow stages

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }, [application.reviewHistory, application.lastActivity, application.submittedDate, application.name, application.email]);

  // Main content JSX
  const mainContent = (
    <div className={cn(
      "bg-white flex flex-col h-full relative",
      viewMode === 'modal' && "max-w-5xl mx-auto my-8 rounded-xl shadow-2xl border border-gray-200",
      viewMode === 'fullscreen' && "fixed inset-0 z-50 w-full h-full"
    )}>
      {/* Header - Compact design */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-4" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="capitalize">{viewMode === 'fullscreen' ? 'Full screen' : viewMode}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
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
            <ScrollArea className="flex-1">
              <div className="p-4">
              {/* Name & Status Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold text-gray-900 leading-tight">
                    {application.name || UNKNOWN}
                  </h1>
                  {application.email && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{application.email}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowResetPasswordModal(true)}
                        className="h-6 px-2 text-xs hover:bg-blue-50 hover:text-blue-700"
                      >
                        <KeyRound className="h-3 w-3 mr-1" />
                        Reset Password
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Status Badge (read-only) */}
                  <Badge 
                    variant="secondary"
                    className="bg-green-50 text-green-700 border-green-200 gap-1.5 px-2.5 py-1"
                  >
                    <Play className="h-3 w-3" />
                    {application.status || 'Submitted'}
                  </Badge>


                </div>
              </div>

            {/* Quick Info - Compact horizontal layout */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-4">
              {/* Date */}
              {application.submittedDate && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(application.submittedDate).toLocaleDateString()}</span>
                </div>
              )}
              
              {/* Assignees */}
              {application.assignedTo && application.assignedTo.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{application.assignedTo.length} assigned</span>
                </div>
              )}

              {/* Priority */}
              {application.priority && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-5",
                    application.priority === 'high' && 'border-red-200 text-red-600 bg-red-50',
                    application.priority === 'medium' && 'border-yellow-200 text-yellow-600 bg-yellow-50',
                    application.priority === 'low' && 'border-gray-200 text-gray-600 bg-gray-50'
                  )}
                >
                  {application.priority}
                </Badge>
              )}

              {/* Tags */}
              {application.tags && application.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {application.tags.slice(0, 2).map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-gray-100">
                      {tag}
                    </Badge>
                  ))}
                  {application.tags.length > 2 && (
                    <span className="text-muted-foreground">+{application.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>

            {/* Description Section - Compact */}
            {application.comments && (
              <Card className="mb-4 shadow-none border-gray-100">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm text-foreground leading-relaxed">{application.comments}</p>
                </CardContent>
              </Card>
            )}

            {/* Reviewers Section - Compact */}
            {Array.isArray(application.assignedTo) && application.assignedTo.length > 0 && reviewersMap && (
              <Card className="mb-4 shadow-none border-gray-100">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    Reviewers ({application.assignedTo.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-1.5">
                    {application.assignedTo
                      .map((reviewerId: string) => ({ reviewer: reviewersMap[reviewerId], reviewerId }))
                      .filter(({ reviewer }) => Boolean(reviewer))
                      .map(({ reviewer, reviewerId }, idx) => (
                        <div key={reviewerId} className="flex items-center gap-2 py-1">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{reviewer.name || 'Reviewer'}</div>
                          </div>
                          {reviewer.email && (
                            <span className="text-xs text-muted-foreground truncate">{reviewer.email}</span>
                          )}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Custom Fields Section - Form-like layout with collapsible sections */}
            {fields && fields.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-4">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Application Details</span>
                </div>
                <div className="space-y-3">
                  {(() => {
                    // Create field map for nested field lookup (includes all subfields recursively)
                    const fieldMap = new Map<string, any>();
                    
                    function addFieldToMap(field: any) {
                      const fieldId = field.id || field.field_id;
                      const fieldLabel = field.label || field.name;
                      const fieldName = field.name;
                      
                      // Map by ID
                      if (fieldId) {
                        fieldMap.set(fieldId, field);
                        if (!fieldId.startsWith('Field-')) fieldMap.set(`Field-${fieldId}`, field);
                        if (fieldId.startsWith('Field-')) fieldMap.set(fieldId.replace(/^Field-/, ''), field);
                      }
                      
                      // Map by name (for repeater subfields)
                      if (fieldName) {
                        fieldMap.set(fieldName, field);
                        fieldMap.set(fieldName.toLowerCase().replace(/\s+/g, '_'), field);
                        fieldMap.set(fieldName.replace(/\s+/g, '_'), field);
                      }
                      
                      // Map by label
                      if (fieldLabel) {
                        fieldMap.set(fieldLabel, field);
                        fieldMap.set(fieldLabel.toLowerCase().replace(/\s+/g, '_'), field);
                        fieldMap.set(fieldLabel.replace(/\s+/g, '_'), field);
                      }
                      
                      // Recursively add children from config.children (for repeaters/groups)
                      const configChildren = (field.config as any)?.children || [];
                      const directChildren = field.children || field.child_fields || [];
                      const allChildren = [...configChildren, ...directChildren];
                      
                      if (Array.isArray(allChildren) && allChildren.length > 0) {
                        allChildren.forEach((child: any) => {
                          // If child is a field definition object from config.children, create a proper field object
                          if (child && typeof child === 'object') {
                            const childField = {
                              id: child.id || child.name || `child-${Math.random()}`,
                              name: child.name,
                              label: child.label || child.name || 'Unnamed Field',
                              type: child.type || 'text',
                              config: child.config || child
                            };
                            addFieldToMap(childField);
                          } else if (child && typeof child === 'string') {
                            // If child is an ID, try to find it in the fields array
                            const foundField = fields.find((f: any) => f.id === child || f.name === child);
                            if (foundField) {
                              addFieldToMap(foundField);
                            }
                          }
                        });
                      }
                    }
                    
                    // Add all top-level fields
                    fields.forEach(addFieldToMap);
                    
                    return fieldSections
                      .filter((section): section is NonNullable<typeof section> => section !== null)
                      .map((section, sectionIdx) => {
                        const isOpen = openSections[section.name] || false;
                      
                      return (
                        <Card key={sectionIdx} className="shadow-none border-gray-100">
                          <Collapsible 
                            open={isOpen} 
                            onOpenChange={(open) => toggleSection(section.name, open)}
                          >
                            <CollapsibleTrigger asChild>
                              <CardHeader className="p-4 pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      {isOpen ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <div className="flex flex-col">
                                        <CardTitle className="text-sm font-medium text-foreground">
                                          {section.name}
                                        </CardTitle>
                                        {(section as any).description && (
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {(section as any).description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {/* Completion indicator */}
                                    <div className="flex items-center gap-2">
                                      <Progress 
                                        value={section.completionPercentage} 
                                        className="w-16 h-1.5"
                                      />
                                      <span className="text-xs text-muted-foreground font-mono">
                                        {section.completionPercentage}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {section.completedFields}/{section.totalFields} fields completed
                                  </div>
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <CardContent className="p-4 pt-0">
                                <div className="space-y-4">
                                  {section.fields.map((field) => {
                                    const value = application.raw_data?.[field.id] ||
                                                 application.raw_data?.[(field as any).name] ||
                                                 application.raw_data?.[(field as any).field_key] ||
                                                 application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                                                 application.raw_data?.[field.label];
                                    
                                    // Strip HTML from rich-text labels
                                    const displayLabel = (field.label || formatFieldLabel(field.id, fieldMap)).replace(/<[^>]+>/g, '').trim();
                                    const isRequired = (field as any).required;
                                    const isEmpty = value === null || value === undefined || value === '';

                                    return (
                                      <div key={field.id} className="space-y-2">
                                        {/* Form field label styling */}
                                        <div className="flex items-center gap-1">
                                          <label className="text-sm font-medium text-foreground">
                                            {displayLabel}
                                          </label>
                                          {isRequired && (
                                            <span className="text-red-500 text-sm">*</span>
                                          )}
                                        </div>
                                        
                                        {/* Form field value styling - looks like a disabled input */}
                                        <div className="relative">
                                          <div className={cn(
                                            "min-h-[36px] w-full rounded-md border px-3 py-2 text-sm ring-offset-background",
                                            isEmpty 
                                              ? "border-input bg-muted/20 text-muted-foreground" 
                                              : "border-input bg-muted/30"
                                          )}>
                                            <div className={isEmpty ? "text-muted-foreground italic" : "text-foreground"}>
                                              {isEmpty 
                                                ? "Not filled out" 
                                                : renderFieldValue(value, 0, field.id, fieldMap)
                                              }
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Actions Section - Removed (workflow feature deleted) */}

              </div>
            </ScrollArea>
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
          <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-100">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Recommenders
              </h2>
              <Button 
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowRecommendersPanel(false)}
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
                  No recommendation requests found
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
                                  {uploadedDocument.name || uploadedDocument.filename || 'Recommendation Letter'}
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
        )}

        {/* Documents Panel - Replaces details when active (sidebar mode), or shows to the right (fullscreen mode) */}
        {showDocumentsPanel && viewMode !== 'fullscreen' && (
          <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-100">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Documents
              </h2>
              <Button 
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowDocumentsPanel(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
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
        )}

        {/* Activity Panel - Replaces details in sidebar (left), or shows on right in modal/fullscreen */}
        {showActivityPanel && viewMode !== 'fullscreen' ? (
          <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-100">
            {/* Activity Header */}
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Activity
              </h2>
              <Button 
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowActivityPanel(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

          {/* Activity Feed */}
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2 py-1.5">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{activity.user}</span>
                      <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Email Composer - Fixed at Bottom - Compact */}
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

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {!temporaryPassword 
                ? `Reset the password for ${application.name || application.email}`
                : 'Password has been reset successfully'}
            </DialogDescription>
          </DialogHeader>
          
          {!temporaryPassword ? (
            <div className="space-y-4">
              <RadioGroup value={passwordMode} onValueChange={(value: 'generate' | 'custom') => setPasswordMode(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="generate" id="generate" />
                  <Label htmlFor="generate" className="font-normal cursor-pointer">
                    Generate random password
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="font-normal cursor-pointer">
                    Set custom password
                  </Label>
                </div>
              </RadioGroup>

              {passwordMode === 'generate' ? (
                <p className="text-sm text-muted-foreground">
                  A secure random password will be generated for {application.email}.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="custom-password">Password (min. 8 characters)</Label>
                  <div className="relative">
                    <Input
                      id="custom-password"
                      type={showPassword ? 'text' : 'password'}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password will be set for {application.email}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCloseResetModal}
                  disabled={isResettingPassword}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || (passwordMode === 'custom' && customPassword.length < 8)}
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {passwordMode === 'generate' ? 'Generating...' : 'Setting...'}
                    </>
                  ) : (
                    <>
                      {passwordMode === 'generate' ? 'Generate Password' : 'Set Password'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">Password has been set successfully</p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">Make sure to save this password securely before closing this dialog</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-green-800 dark:text-green-200">New Password for {application.email}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-background rounded border font-mono text-sm select-all">
                      {temporaryPassword}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleCopyPassword}
                      className="shrink-0"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Important:</strong> This password will only be shown once. Save it now in a secure location. 
                    Share it with the user through a secure channel.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCloseResetModal}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
