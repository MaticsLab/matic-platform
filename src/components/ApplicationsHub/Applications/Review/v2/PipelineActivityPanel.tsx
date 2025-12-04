'use client';

import { useState, useEffect } from 'react';
import { Application, ActivityItem, PipelineActivityPanelProps } from './types';
import { 
  X, Mail, ChevronDown, Send, Plus, Sparkles, Paperclip, 
  AtSign, ArrowRight, Star, MessageSquare, Users, Tag, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { emailClient, SendEmailRequest, GmailConnection } from '@/lib/api/email-client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";

export function PipelineActivityPanel({ 
  applications, 
  activities,
  onClose,
  onSendEmail,
  onAddComment,
  workspaceId,
  formId,
  fields = []
}: PipelineActivityPanelProps) {
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'comment' | 'email'>('email');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  // Check Gmail connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!workspaceId) {
        setIsCheckingConnection(false);
        return;
      }
      try {
        setIsCheckingConnection(true);
        const connection = await emailClient.getConnection(workspaceId);
        setGmailConnection(connection);
      } catch (error) {
        console.error('Failed to check Gmail connection:', error);
        setGmailConnection({ connected: false, email: '' });
      } finally {
        setIsCheckingConnection(false);
      }
    };
    checkConnection();
  }, [workspaceId]);

  // Insert merge tag into email body
  const insertMergeTag = (fieldLabel: string) => {
    setEmailBody(prev => prev + `{{${fieldLabel}}}`);
  };

  // Get available merge tags from applications
  const availableMergeTags = (() => {
    // Use provided fields first
    if (fields.length > 0) {
      return fields.map(f => ({ label: f.label, tag: `{{${f.label}}}` }));
    }
    // Fall back to extracting from first application's raw_data
    if (applications.length > 0 && applications[0].raw_data) {
      return Object.keys(applications[0].raw_data).slice(0, 20).map(key => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        tag: `{{${key}}}`
      }));
    }
    return [];
  })();

  const handleSendEmail = async () => {
    if (!workspaceId) {
      toast.error('Workspace not configured');
      return;
    }

    if (!gmailConnection?.connected) {
      toast.error('Please connect your Gmail account in Communications settings');
      return;
    }

    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    setIsSending(true);
    try {
      const submissionIds = applications.map(a => a.id);
      
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: submissionIds,
        subject: emailSubject,
        body: emailBody,
        is_html: false,
        merge_tags: true,
        track_opens: true,
      };

      const result = await emailClient.send(workspaceId, request);

      if (result.success) {
        toast.success(`Successfully sent ${result.sent_count} emails!`);
        setEmailSubject('');
        setEmailBody('');
        setEmailTo('');
        setEmailCc('');
        setEmailBcc('');
        
        // Also call the callback if provided
        onSendEmail?.(
          emailTo || `All applicants (${applications.length})`, 
          emailSubject, 
          emailBody,
          { cc: emailCc, bcc: emailBcc, submissionIds, formId: formId || undefined }
        );
      } else {
        toast.error(result.errors?.[0] || 'Failed to send some emails');
      }
    } catch (error) {
      console.error('Failed to send emails:', error);
      toast.error('Failed to send emails. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    onAddComment?.(comment);
    toast.success('Comment added to pipeline');
    setComment('');
  };

  return (
    <div className="bg-white flex flex-col h-full max-h-full border-l border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-gray-900 font-medium">Pipeline Activity</h2>
              <p className="text-gray-500 text-xs mt-0.5">{applications.length} applications</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No activity yet
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2 text-sm">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  activity.type === 'status' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'review' ? 'bg-green-100 text-green-600' :
                  activity.type === 'email' ? 'bg-purple-100 text-purple-600' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {activity.type === 'status' ? <ArrowRight className="w-3 h-3" /> :
                   activity.type === 'review' ? <Star className="w-3 h-3" /> :
                   activity.type === 'email' ? <Mail className="w-3 h-3" /> :
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
            ))
          )}
        </div>
      </div>

      {/* Comment/Email Input - Sticky Bottom */}
      <div className="border-t bg-white flex-shrink-0 p-4 mt-auto">
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
          {activeCommentTab === 'email' ? (
            <>
              {/* Gmail Connection Status */}
              {isCheckingConnection ? (
                <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking email connection...
                </div>
              ) : !gmailConnection?.connected && workspaceId ? (
                <div className="py-2 mb-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3">
                  Gmail not connected. Go to Communications to connect.
                </div>
              ) : null}

              {/* From field */}
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-600 text-sm w-16">From</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-gray-900 text-sm">
                    {gmailConnection?.email || 'You'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                </div>
              </div>
              
              {/* To field with recipient suggestion */}
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-600 text-sm w-16">To</span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder={`All applicants (${applications.length})`}
                    className="flex-1 px-0 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 text-sm"
                  />
                  <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
                  >
                    Cc Bcc
                  </button>
                </div>
              </div>
              
              {/* Cc/Bcc fields - conditionally shown */}
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
            /* Comment input */
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a pipeline note..."
              rows={2}
              className="w-full px-0 py-2 bg-transparent border-0 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 resize-none text-sm"
            />
          )}
          
          {/* Action bar */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-1">
              {/* Plus button */}
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                <Plus className="w-4 h-4" />
              </button>
              
              {/* Comment/Email Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-200 rounded transition-colors text-gray-700 text-sm"
                >
                  <span className="capitalize">{activeCommentTab}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                
                {/* Dropdown menu */}
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
              
              {/* AI icon */}
              <button 
                onClick={() => toast.info('AI assistant coming soon')}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-purple-600"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              
              {/* Attachment icon */}
              <button 
                onClick={() => toast.info('Attachment feature coming soon')}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              
              {/* Mention icon */}
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600">
                <AtSign className="w-4 h-4" />
              </button>
            </div>
            
            {/* Send button */}
            <button
              onClick={() => {
                if (activeCommentTab === 'comment') {
                  handleAddComment();
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
  );
}
