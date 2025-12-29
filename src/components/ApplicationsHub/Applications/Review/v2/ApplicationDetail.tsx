'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Application, ApplicationStatus, ApplicationDetailProps, Stage, ReviewHistoryEntry } from './types';
import { 
  X, Mail, Trash2, ChevronRight, ChevronDown, 
  User, FileText, Star, MessageSquare,
  CheckCircle2, ArrowRight, AlertCircle, Users, Send,
  Paperclip, Sparkles, AtSign, Plus, Tag, Loader2, FileEdit, Settings,
  Play, Archive, XCircle, Clock, Folder, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { emailClient, SendEmailRequest } from '@/lib/api/email-client';
import { workflowsClient, StageAction, WorkflowAction } from '@/lib/api/workflows-client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";
import { EmailConnectionStatus } from '@/components/Email/EmailConnectionStatus';
import { useEmailConnection } from '@/hooks/useEmailConnection';
import { EmailSettingsDialog } from '../../Communications/EmailSettingsDialog';

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

// Helper to format field labels nicely
function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

// Helper function to render field values properly (handles arrays, objects, repeaters)
function renderFieldValue(value: any, depth: number = 0): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">Not provided</span>;
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-600' : 'text-gray-500'}>{value ? 'Yes' : 'No'}</span>;
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    return <span className="font-medium">{value.toLocaleString()}</span>;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    // Check if it's a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
          {value}
        </a>
      );
    }
    // Long text
    if (value.length > 200) {
      return <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{value}</p>;
    }
    return <span className="text-gray-900">{value}</span>;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 italic">None</span>;
    }
    
    // Check if it's an array of primitives (strings, numbers)
    if (value.every(v => typeof v !== 'object' || v === null)) {
      // Filter out empty strings and join
      const filtered = value.filter(v => v !== null && v !== undefined && v !== '');
      if (filtered.length === 0) {
        return <span className="text-gray-400 italic">None</span>;
      }
      return <span className="text-gray-900">{filtered.join(', ')}</span>;
    }
    
    // Array of objects (repeater items)
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, idx) => (
          <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Item {idx + 1}</div>
            <div className="grid gap-2">
              {typeof item === 'object' && item !== null ? (
                Object.entries(item)
                  .filter(([k]) => !k.startsWith('_')) // Skip internal fields like _id
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-wrap gap-x-2">
                      <span className="text-xs font-medium text-gray-500 min-w-[80px]">{formatFieldLabel(k)}:</span>
                      <span className="text-sm text-gray-900">{renderFieldValue(v, depth + 1)}</span>
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
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([k]) => !k.startsWith('_')); // Skip internal fields
    
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
              <div className="text-gray-900">{renderFieldValue(v, depth + 1)}</div>
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
  fields = []
}: ApplicationDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'documents' | 'reviews'>('overview');
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
  const [isSending, setIsSending] = useState(false);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [stageActions, setStageActions] = useState<StageAction[]>([]);
  const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

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

    setIsSending(true);
    try {
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: [application.id],
        subject: emailSubject,
        body: emailBody,
        is_html: false,
        merge_tags: true,
        track_opens: true,
      };

      const result = await emailClient.send(workspaceId, request);

      if (result.success) {
        toast.success('Email sent successfully!');
        setEmailSubject('');
        setEmailBody('');
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

  const statusMessage = application.stageName || application.status;
  const activities = [
    { 
      id: 1, 
      type: 'status' as const, 
      message: `Moved to ${statusMessage}`, 
      user: 'System', 
      time: application.lastActivity || 'Recently' 
    },
  ];

  return (
    <div className="bg-white flex flex-col h-full">
      {/* Header with User Info */}
      <div className="px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {application.name || 'Unknown'}
              </h2>
              <p className="text-sm text-gray-600">{application.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MessageSquare className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-500" />
            </button>
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
              "pb-3 border-b-2 transition-colors text-sm font-medium",
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Documents
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
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents</h3>
              <p className="text-gray-500 text-sm">Documents submitted by the applicant will appear here</p>
            </div>
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

        {activeTab === 'activity' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Activity Feed */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
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
            <div className="border-t bg-white flex-shrink-0 p-4">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                {activeCommentTab === 'email' ? (
                  <>
                    {/* Gmail Connection Status */}
                    <EmailConnectionStatus
                      connection={gmailConnection}
                      isChecking={isCheckingConnection}
                      variant="inline"
                      onConfigureClick={() => setShowEmailSettings(true)}
                    />

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

        {/* Action Buttons - Fixed at bottom for all tabs */}
        <div className="p-4 border-t bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleReview}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white shadow-sm font-medium text-sm"
            >
              <Play className="w-4 h-4" />
              <span>Start Review</span>
            </button>

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
