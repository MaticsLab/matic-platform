'use client';

import { useState } from 'react';
import { Application, ApplicationStatus, ApplicationDetailProps, Stage, ReviewHistoryEntry } from './types';
import { 
  X, Mail, Trash2, ChevronRight, ChevronDown, 
  User, FileText, Star, MessageSquare,
  CheckCircle2, ArrowRight, AlertCircle, Users, Send,
  Paperclip, Sparkles, AtSign, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ApplicationDetail({ 
  application, 
  stages,
  reviewersMap,
  onStatusChange, 
  onClose,
  onStartReview,
  onDelete
}: ApplicationDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
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

  // Get reviewer names from the map
  const getReviewerName = (reviewerId: string) => {
    return reviewersMap[reviewerId]?.name || `Reviewer`;
  };

  // Mock activity data - in real implementation, this would come from props or API
  const activities = [
    { id: 1, type: 'status' as const, message: `Moved to ${application.stageName || application.status}`, user: 'System', time: application.lastActivity || 'Recently' },
    ...(application.reviewHistory || []).map((review, idx) => ({
      id: `review-${idx}`,
      type: 'review' as const,
      message: `Review submitted (Score: ${review.total_score || Object.values(review.scores || {}).reduce((a, b) => a + b, 0)})`,
      user: review.reviewer_name || getReviewerName(review.reviewer_id),
      time: review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : 'Unknown'
    })),
  ];

  return (
    <div className="bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Tabs */}
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                "pb-2 border-b-2 transition-colors text-sm font-medium",
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
                "pb-2 border-b-2 transition-colors text-sm font-medium",
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              Activity
            </button>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'overview' && (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                {/* Visual Pipeline */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between gap-2">
                    {displayStages.map((stage, index) => (
                      <div key={stage} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                            currentStageIndex === index
                              ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                              : currentStageIndex > index
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-400 border-2 border-gray-300'
                          )}>
                            {currentStageIndex > index ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <span className="text-xs font-medium">{index + 1}</span>
                            )}
                          </div>
                          <span className={cn(
                            "text-xs mt-1.5 text-center",
                            currentStageIndex === index ? 'text-blue-600 font-medium' : 'text-gray-600'
                          )}>
                            {stage}
                          </span>
                        </div>
                        {index < displayStages.length - 1 && (
                          <div className={cn(
                            "h-0.5 flex-1 mx-1",
                            currentStageIndex > index ? 'bg-green-500' : 'bg-gray-300'
                          )} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage Selector */}
                <div className="relative">
                  <select
                    value={selectedStage}
                    onChange={(e) => handleStageChange(e.target.value as ApplicationStatus)}
                    className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-gray-900 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors cursor-pointer text-sm"
                  >
                    <option value="" disabled>Status: {application.stageName || application.status}</option>
                    {displayStages.map((stage) => (
                      <option key={stage} value={stage}>
                        Move to: {stage}
                      </option>
                    ))}
                    <option value="Rejected">Reject Application</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Personal Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      Personal
                    </h3>
                    <div className="space-y-2.5 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs">Name</div>
                        <div className="text-gray-900">{application.firstName} {application.lastName}</div>
                      </div>
                      {application.dateOfBirth && (
                        <div>
                          <div className="text-gray-500 text-xs">Date of Birth</div>
                          <div className="text-gray-900">{application.dateOfBirth}</div>
                        </div>
                      )}
                      {application.gender && (
                        <div>
                          <div className="text-gray-500 text-xs">Gender</div>
                          <div className="text-gray-900">{application.gender}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      Contact
                    </h3>
                    <div className="space-y-2.5 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs">Email</div>
                        <div className="text-gray-900">{application.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Reviewers */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Reviewers
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {application.assignedTo && application.assignedTo.length > 0 ? (
                        application.assignedTo.map(reviewer => (
                          <span key={reviewer} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-sm">
                            {reviewer}
                          </span>
                        ))
                      ) : application.assignedReviewerIds && application.assignedReviewerIds.length > 0 ? (
                        application.assignedReviewerIds.map(id => (
                          <span key={id} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-sm">
                            {getReviewerName(id)}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">Not assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {application.tags && application.tags.length > 0 ? (
                        application.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-gray-200 text-gray-700 rounded-md text-sm">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">No tags</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reviews Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Reviews ({application.reviewedCount}/{application.totalReviewers})
                  </h3>
                  
                  {application.reviewHistory && application.reviewHistory.length > 0 ? (
                    <div className="space-y-3">
                      {application.reviewHistory.map((review, idx) => {
                        const totalScore = review.total_score || Object.values(review.scores || {}).reduce((a, b) => a + b, 0);
                        const reviewerName = review.reviewer_name || getReviewerName(review.reviewer_id);
                        return (
                          <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                                  {reviewerName[0]?.toUpperCase() || 'R'}
                                </div>
                                <span className="text-gray-900 text-sm font-medium">{reviewerName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                <span className="text-gray-900 text-sm font-medium">{totalScore}/{application.maxScore || 10}</span>
                              </div>
                            </div>
                            {review.notes && (
                              <p className="text-gray-700 text-sm">{review.notes}</p>
                            )}
                            {review.reviewed_at && (
                              <div className="text-gray-500 text-xs mt-2">
                                {new Date(review.reviewed_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-400 py-4 text-center text-sm">No reviews yet</div>
                  )}
                  
                  {application.reviewedCount < application.totalReviewers && (
                    <div className="text-gray-500 text-center text-sm mt-3">
                      Waiting for {application.totalReviewers - application.reviewedCount} more review(s)
                    </div>
                  )}
                </div>

                {/* Application Data Preview */}
                {application.raw_data && Object.keys(application.raw_data).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Application Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(application.raw_data).slice(0, 6).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500">{key}</span>
                          <span className="text-gray-900 truncate max-w-[60%]">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </span>
                        </div>
                      ))}
                      {Object.keys(application.raw_data).length > 6 && (
                        <div className="text-gray-400 text-center pt-2">
                          +{Object.keys(application.raw_data).length - 6} more fields
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="sticky bottom-0 p-3 border-t bg-gray-50 flex-shrink-0 z-10">
              <div className="flex items-center justify-between">
                <button 
                  onClick={handleDelete}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    showDeleteConfirm 
                      ? 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200' 
                      : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                  )}
                  title={showDeleteConfirm ? 'Click again to confirm' : 'Delete application'}
                >
                  {showDeleteConfirm ? <AlertCircle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>

                <button 
                  onClick={handleReview}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white shadow-sm text-sm font-medium"
                >
                  <span>Start Review</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'activity' && (
          <div className="h-full flex flex-col">
            {/* Activity Feed */}
            <div className="flex-1 overflow-y-auto p-6">
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
                    
                    <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                      <span className="text-gray-600 text-sm w-16">Subject</span>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="flex-1 px-0 bg-transparent border-0 text-gray-900 focus:outline-none focus:ring-0 text-sm"
                      />
                    </div>
                    
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Write your message..."
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
                        toast.success('Email sent successfully');
                        setEmailSubject('');
                        setEmailBody('');
                      }
                    }}
                    className="p-1.5 hover:bg-blue-100 rounded transition-colors text-blue-600"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
