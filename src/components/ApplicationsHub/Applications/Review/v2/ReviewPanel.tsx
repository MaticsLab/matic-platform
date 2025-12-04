'use client';

import { useState, useMemo } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Save, Clock, Star, 
  FileText, MessageSquare, Check, AlertCircle, 
  ThumbsUp, ThumbsDown, MinusCircle
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Textarea } from '@/ui-components/textarea';
import { Slider } from '@/ui-components/slider';
import { ScrollArea } from '@/ui-components/scroll-area';
import { cn } from '@/lib/utils';
import { Application, Stage } from './types';
import { Form } from '@/types/forms';
import { Rubric } from '@/lib/api/workflows-client';

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
    if (!form?.fields) return [];
    
    const sections: { name: string; fields: any[] }[] = [];
    let currentSection = { name: 'General', fields: [] as any[] };
    
    form.fields.forEach(field => {
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
              <ThumbsDown className="w-3.5 h-3.5 mr-1" />
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('maybe')}
              disabled={isSaving}
              className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
            >
              <MinusCircle className="w-3.5 h-3.5 mr-1" />
              Maybe
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('accept')}
              disabled={isSaving}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <ThumbsUp className="w-3.5 h-3.5 mr-1" />
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
              <Save className="w-3.5 h-3.5 mr-1" />
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
                  <Check className="w-3.5 h-3.5 mr-1" />
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
