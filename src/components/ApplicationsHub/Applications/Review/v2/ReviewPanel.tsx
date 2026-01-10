'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Save, Clock, Star, 
  FileText, MessageSquare, Check, AlertCircle, 
  ThumbsUp, ThumbsDown, MinusCircle, UserPlus, Mail,
  RefreshCw, CheckCircle2, Clock3, XCircle, ChevronUp
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Textarea } from '@/ui-components/textarea';
import { Slider } from '@/ui-components/slider';
import { ScrollArea } from '@/ui-components/scroll-area';
import { cn } from '@/lib/utils';
import { Application, Stage } from './types';
import { Form } from '@/types/forms';
import { Rubric } from '@/lib/api/workflows-client';
import { recommendationsClient, RecommendationRequest } from '@/lib/api/recommendations-client';

interface ReviewPanelProps {
  application: Application;
  form: Form | null;
  rubrics: Rubric[];
  stages: Stage[];
  workspaceId: string;
  formId: string;
  onClose: () => void;
  onSaveReview: (scores: Record<string, number>, comments: string, decision?: string) => Promise<void>;
  onNext: () => void;
  onPrevious: () => void;
  currentIndex: number;
  totalApplications: number;
}

export function ReviewPanel({
  application,
  form,
  rubrics,
  stages,
  workspaceId,
  formId,
  onClose,
  onSaveReview,
  onNext,
  onPrevious,
  currentIndex,
  totalApplications
}: ReviewPanelProps) {
  const [scores, setScores] = useState<Record<string, number>>(application.scores || {});
  const [comments, setComments] = useState(application.comments || '');
  const [isSaving, setIsSaving] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  // Recommendation requests state
  const [recommendations, setRecommendations] = useState<RecommendationRequest[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());
  
  // Fetch recommendations for this submission
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!application.id) return;
      setLoadingRecommendations(true);
      try {
        const data = await recommendationsClient.getForReview(application.id);
        setRecommendations(data || []);
      } catch (err) {
        console.error('[ReviewPanel] Failed to fetch recommendations:', err);
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
      // Refresh recommendations list
      const data = await recommendationsClient.getForReview(application.id);
      setRecommendations(data || []);
    } catch (err) {
      console.error('[ReviewPanel] Failed to send reminder:', err);
    } finally {
      setSendingReminder(null);
    }
  };
  
  // Get the active rubric (first one for now)
  const activeRubric = rubrics.length > 0 ? rubrics[0] : null;
  
  // Calculate total score
  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, val) => sum + (val || 0), 0);
  }, [scores]);
  
  const maxScore = activeRubric?.max_score || 100;
  
  // Timer effect
  useState(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  });
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleScoreChange = (category: string, value: number) => {
    setScores(prev => ({ ...prev, [category]: value }));
  };
  
  const handleSave = async (decision?: string) => {
    setIsSaving(true);
    try {
      await onSaveReview(scores, comments, decision);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Get application data for display
  const appData = application.raw_data || {};
  
  // Group fields by section if available
  const fieldSections = useMemo(() => {
    if (!Array.isArray(form?.fields)) return [];
    const sections: { name: string; fields: any[] }[] = [];
    let currentSection = { name: 'General', fields: [] as any[] };
    (form.fields as any[]).forEach(field => {
      if (field.type === 'section') {
        if (Array.isArray(currentSection.fields) && currentSection.fields.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { name: field.label || 'Section', fields: [] };
      } else {
        currentSection.fields.push(field);
      }
    });
    if (Array.isArray(currentSection.fields) && currentSection.fields.length > 0) {
      sections.push(currentSection);
    }
    return sections;
  }, [form?.fields]);
  
  // Get rubric categories
  const rubricCategories = useMemo(() => {
    if (!activeRubric?.categories) return [];
    return activeRubric.categories.map((c) => ({
      id: c.id || c.name,
      name: c.name,
      description: c.description,
      maxScore: c.max_points || 10,
      weight: c.weight || 1
    }));
  }, [activeRubric]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-semibold text-gray-900">
              Review: {application.firstName} {application.lastName}
            </h2>
            <p className="text-xs text-gray-500">
              Application {currentIndex + 1} of {totalApplications}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Timer */}
          <button
            onClick={() => setTimerActive(!timerActive)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
              timerActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
            )}
          >
            <Clock className="w-3 h-3" />
            {formatTime(timer)}
          </button>
          
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNext}
              disabled={currentIndex === totalApplications - 1}
              className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content - Split View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Application Data */}
        <div className="w-1/2 border-r overflow-y-auto">
          <div className="p-4 space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Application Details
            </h3>
            
            {fieldSections.map((section, idx) => (
              <div key={idx} className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 border-b pb-1">
                  {section.name}
                </h4>
                {section.fields.map((field) => {
                  const value = appData[field.name] || appData[field.id] || '';
                  if (!value) return null;
                  
                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">
                        {field.label}
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 rounded p-2">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            
            {/* Fallback if no sections */}
            {fieldSections.length === 0 && (
              <div className="space-y-3">
                {Object.entries(appData).map(([key, value]) => {
                  if (!value || key.startsWith('_')) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 rounded p-2">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Recommendations Section */}
            {(recommendations.length > 0 || loadingRecommendations) && (
              <div className="mt-6 pt-4 border-t space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Letters of Recommendation
                  {recommendations.length > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {recommendations.filter(r => r.status === 'submitted').length}/{recommendations.length} received
                    </span>
                  )}
                </h3>
                
                {loadingRecommendations ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading recommendations...
                  </div>
                ) : (
                  <div className="space-y-2">
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
                                  {new Date(rec.submitted_at).toLocaleDateString()}
                                </span>
                              )}
                              {rec.status === 'pending' && rec.reminder_count > 0 && (
                                <span className="text-gray-400">
                                  {rec.reminder_count} reminder{rec.reminder_count > 1 ? 's' : ''} sent
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {rec.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendReminder(rec.id)}
                              disabled={sendingReminder === rec.id}
                              className="flex-shrink-0 text-xs h-7"
                            >
                              {sendingReminder === rec.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Mail className="w-3 h-3 mr-1" />
                                  Remind
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {/* Show response preview if submitted */}
                        {rec.status === 'submitted' && rec.response && (() => {
                          const isExpanded = expandedRecommendations.has(rec.id);
                          const responseKeys = Object.keys(rec.response || {}).filter(k => !k.startsWith('_'));
                          
                          return (
                            <div className="mt-2 pt-2 border-t border-green-200">
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
                                className="text-xs text-green-700 hover:text-green-800 flex items-center gap-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    Hide recommendation
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-3 h-3" />
                                    View recommendation
                                  </>
                                )}
                              </button>
                              
                              {isExpanded && responseKeys.length > 0 && (
                                <div className="mt-2 space-y-2 bg-white rounded border p-3">
                                  {responseKeys.map((key) => {
                                    const value = rec.response?.[key];
                                    
                                    // Handle uploaded document
                                    if (key === 'uploaded_document' || key === 'document') {
                                      const doc = typeof value === 'object' ? value : {};
                                      const docUrl = doc.url || doc.URL || doc.Url || (typeof value === 'string' ? value : '');
                                      const docName = doc.filename || doc.name || doc.Name || 'Document';
                                      
                                      if (!docUrl) return null;
                                      
                                      return (
                                        <div key={key} className="space-y-1">
                                          <label className="text-xs font-medium text-gray-700">Uploaded Document</label>
                                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-900 flex-1">{docName}</span>
                                            <a
                                              href={docUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-blue-600 hover:text-blue-700"
                                            >
                                              Open
                                            </a>
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    // Handle relationship
                                    if (key === 'relationship') {
                                      return (
                                        <div key={key} className="space-y-1">
                                          <label className="text-xs font-medium text-gray-700">How do you know the applicant?</label>
                                          <p className="text-sm text-gray-900">{String(value)}</p>
                                        </div>
                                      );
                                    }
                                    
                                    // Handle other question responses
                                    const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                                    
                                    return (
                                      <div key={key} className="space-y-1">
                                        <label className="text-xs font-medium text-gray-700">{displayKey}</label>
                                        <div className="text-sm text-gray-900 whitespace-pre-wrap">{displayValue}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Scoring Panel */}
        <div className="w-1/2 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Score Summary */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Total Score</span>
                <span className="text-lg font-bold text-blue-600">
                  {totalScore} / {maxScore}
                </span>
              </div>
              <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min((totalScore / maxScore) * 100, 100)}%` }}
                />
              </div>
            </div>
            
            {/* Rubric Scoring */}
            {rubricCategories.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Scoring Criteria
                </h3>
                
                {rubricCategories.map((category) => (
                  <div key={category.id} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{category.name}</h4>
                        {category.description && (
                          <p className="text-xs text-gray-500">{category.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {scores[category.id] || 0} / {category.maxScore}
                      </span>
                    </div>
                    <Slider
                      value={[scores[category.id] || 0]}
                      max={category.maxScore}
                      step={1}
                      onValueChange={([value]) => handleScoreChange(category.id, value)}
                      className="py-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Simple scoring if no rubric */
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Overall Score
                </h3>
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Score</span>
                    <span className="text-sm font-medium text-gray-600">
                      {scores['overall'] || 0} / 100
                    </span>
                  </div>
                  <Slider
                    value={[scores['overall'] || 0]}
                    max={100}
                    step={1}
                    onValueChange={([value]) => handleScoreChange('overall', value)}
                    className="py-2"
                  />
                </div>
              </div>
            )}
            
            {/* Comments */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Review Notes
              </h3>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your review notes, feedback, or recommendations..."
                className="min-h-[120px] resize-none"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="border-t bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          {/* Quick Decision Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('reject')}
              disabled={isSaving}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('maybe')}
              disabled={isSaving}
              className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              Maybe
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('accept')}
              disabled={isSaving}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              Accept
            </Button>
          </div>
          
          {/* Save and Continue */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save & Next
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
