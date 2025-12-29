'use client';

/**
 * Recommendation Field Renderer
 * Handles the letter of recommendation request field type.
 * 
 * In form mode (applicant filling out form):
 * - Shows UI to add recommenders (name, email, relationship)
 * - Tracks status of each recommendation request
 * - Shows submitted recommendations (if visible to applicant)
 * 
 * In review mode (admin reviewing application):
 * - Shows all recommendation requests with status
 * - Allows sending reminders
 * - Shows submitted recommendation responses
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Badge } from '@/ui-components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/ui-components/dialog';
import { cn } from '@/lib/utils';
import { 
  UserPlus, 
  Mail, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  Star
} from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';
import recommendationsClient, { 
  RecommendationRequest,
  RecommendationQuestion 
} from '@/lib/api/recommendations-client';

export const RECOMMENDATION_FIELD_TYPES = [
  FIELD_TYPES.RECOMMENDATION,
] as const;

interface RecommendationConfig {
  min_recommenders?: number;
  max_recommenders?: number;
  deadline_days?: number;
  allow_applicant_edit?: boolean;
  show_status_to_applicant?: boolean;
  show_responses_to_applicant?: boolean;
  questions?: RecommendationQuestion[];
  instructions?: string;
  email_template?: {
    subject?: string;
    body?: string;
  };
}

interface NewRecommender {
  name: string;
  email: string;
  relationship?: string;
  organization?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

export function RecommendationRenderer({
  field,
  value,
  onChange,
  mode = 'edit',
  context = 'form',
  disabled = false,
  required = false,
  error,
  className,
}: FieldRendererProps) {
  const config = (field.config || {}) as RecommendationConfig;
  const [requests, setRequests] = useState<RecommendationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [newRecommender, setNewRecommender] = useState<NewRecommender>({
    name: '',
    email: '',
    relationship: '',
    organization: '',
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Get submission ID and form ID from the value or context
  const submissionId = value?.submission_id || (value as any)?.submissionId;
  const formId = field.table_id;

  // Load existing recommendation requests
  useEffect(() => {
    if (submissionId) {
      loadRequests();
    }
  }, [submissionId]);

  const loadRequests = async () => {
    if (!submissionId) return;
    
    try {
      setLoading(true);
      const data = await recommendationsClient.list(submissionId);
      // Filter to only show requests for this field
      const fieldRequests = data.filter(r => r.field_id === field.id);
      setRequests(fieldRequests);
    } catch (err) {
      console.error('Failed to load recommendation requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecommender = async () => {
    if (!newRecommender.name || !newRecommender.email) return;
    if (!submissionId || !formId) {
      console.error('Missing submission_id or form_id');
      return;
    }

    try {
      setSending(true);
      await recommendationsClient.create({
        submission_id: submissionId,
        form_id: formId,
        field_id: field.id,
        recommender_name: newRecommender.name,
        recommender_email: newRecommender.email,
        recommender_relationship: newRecommender.relationship,
        recommender_organization: newRecommender.organization,
      });
      
      // Reset form and close dialog
      setNewRecommender({ name: '', email: '', relationship: '', organization: '' });
      setAddDialogOpen(false);
      
      // Reload requests
      await loadRequests();
    } catch (err: any) {
      console.error('Failed to create recommendation request:', err);
      alert(err.message || 'Failed to send recommendation request');
    } finally {
      setSending(false);
    }
  };

  const handleSendReminder = async (id: string) => {
    try {
      setSendingReminder(id);
      await recommendationsClient.sendReminder(id);
      await loadRequests();
    } catch (err: any) {
      console.error('Failed to send reminder:', err);
      alert(err.message || 'Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this recommendation request?')) return;
    
    try {
      await recommendationsClient.cancel(id);
      await loadRequests();
    } catch (err: any) {
      console.error('Failed to cancel request:', err);
      alert(err.message || 'Failed to cancel request');
    }
  };

  const maxRecommenders = config.max_recommenders || 3;
  const minRecommenders = config.min_recommenders || 1;
  const activeRequests = requests.filter(r => r.status !== 'cancelled');
  const submittedCount = requests.filter(r => r.status === 'submitted').length;
  const canAddMore = activeRequests.length < maxRecommenders;

  // Display/compact mode - just show summary
  if (mode === 'display' || mode === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-sm text-muted-foreground">{field.label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {submittedCount} / {minRecommenders} recommendations received
          </span>
          {submittedCount >= minRecommenders ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          )}
        </div>
      </div>
    );
  }

  // Form/Edit mode - Show management UI
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">
            {field.label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
          )}
        </div>
        
        <Badge variant="outline" className="ml-2">
          {submittedCount} / {minRecommenders} received
        </Badge>
      </div>

      {config.instructions && (
        <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
          {config.instructions}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* List of recommendation requests */}
      {!loading && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((request) => {
            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedId === request.id;
            const hasResponse = request.status === 'submitted' && request.response;

            return (
              <Card key={request.id} className="overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        statusConfig.color
                      )}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{request.recommender_name}</p>
                        <p className="text-sm text-muted-foreground">{request.recommender_email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                      {hasResponse || request.recommender_relationship ? (
                        isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                    {request.recommender_relationship && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Relationship</p>
                        <p className="text-sm">{request.recommender_relationship}</p>
                      </div>
                    )}
                    
                    {request.recommender_organization && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Organization</p>
                        <p className="text-sm">{request.recommender_organization}</p>
                      </div>
                    )}

                    {request.expires_at && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Deadline</p>
                        <p className="text-sm">
                          {new Date(request.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Show response for submitted recommendations */}
                    {hasResponse && (context === 'review' || config.show_responses_to_applicant) && (
                      <div className="border-t pt-3 mt-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                          Recommendation Response
                        </p>
                        <ResponseViewer response={request.response!} questions={config.questions} />
                      </div>
                    )}

                    {/* Actions */}
                    {request.status === 'pending' && !disabled && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendReminder(request.id);
                          }}
                          disabled={sendingReminder === request.id}
                        >
                          {sendingReminder === request.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
                          Send Reminder
                          {request.reminder_count > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              ({request.reminder_count} sent)
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(request.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && requests.length === 0 && (
        <div className="text-center py-6 bg-muted/30 rounded-lg border-2 border-dashed">
          <UserPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No recommenders added yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add at least {minRecommenders} recommender{minRecommenders > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Add recommender button */}
      {!disabled && canAddMore && submissionId && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Recommender
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Recommender</DialogTitle>
              <DialogDescription>
                Enter the details of the person you'd like to request a recommendation from.
                They will receive an email with a link to submit their recommendation.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rec-name">Full Name *</Label>
                <Input
                  id="rec-name"
                  placeholder="Dr. Jane Smith"
                  value={newRecommender.name}
                  onChange={(e) => setNewRecommender(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rec-email">Email Address *</Label>
                <Input
                  id="rec-email"
                  type="email"
                  placeholder="jane.smith@university.edu"
                  value={newRecommender.email}
                  onChange={(e) => setNewRecommender(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rec-relationship">Relationship</Label>
                <Input
                  id="rec-relationship"
                  placeholder="e.g., Professor, Supervisor, Manager"
                  value={newRecommender.relationship || ''}
                  onChange={(e) => setNewRecommender(prev => ({ ...prev, relationship: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rec-org">Organization</Label>
                <Input
                  id="rec-org"
                  placeholder="e.g., University of Example"
                  value={newRecommender.organization || ''}
                  onChange={(e) => setNewRecommender(prev => ({ ...prev, organization: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddRecommender}
                disabled={!newRecommender.name || !newRecommender.email || sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Validation message */}
      {!canAddMore && (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxRecommenders} recommenders allowed
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

// Response viewer component
function ResponseViewer({ 
  response, 
  questions 
}: { 
  response: Record<string, any>; 
  questions?: RecommendationQuestion[];
}) {
  const questionMap = new Map(questions?.map(q => [q.id, q]) || []);

  return (
    <div className="space-y-3 text-sm">
      {Object.entries(response).map(([key, value]) => {
        const question = questionMap.get(key);
        const label = question?.label || key;
        
        // Rating display
        if (question?.type === 'rating' && typeof value === 'number') {
          const maxRating = question.max_rating || 5;
          return (
            <div key={key}>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <div className="flex gap-0.5">
                {Array.from({ length: maxRating }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-4 w-4',
                      i < value
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                ))}
                <span className="ml-2 text-muted-foreground">
                  ({value}/{maxRating})
                </span>
              </div>
            </div>
          );
        }
        
        // Checkbox display
        if (question?.type === 'checkbox') {
          return (
            <div key={key} className="flex items-center gap-2">
              {value ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>{label}</span>
            </div>
          );
        }
        
        // Default text display
        return (
          <div key={key}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="whitespace-pre-wrap bg-white p-2 rounded border">
              {String(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default RecommendationRenderer;
