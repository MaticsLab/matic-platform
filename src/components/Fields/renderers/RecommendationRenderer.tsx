'use client';

/**
 * Recommendation Field Renderer
 * 
 * Collects recommender contact information (name, email, relationship).
 * Sends recommendation request emails IMMEDIATELY when user clicks "Send Request".
 * Once sent, the recommender info is locked (can only be deleted, not edited).
 */

import React, { useCallback, useState } from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { cn } from '@/lib/utils';
import { UserPlus, Trash2, Mail, User, Briefcase, Send, Loader2, CheckCircle, Clock } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';
import { recommendationsClient } from '@/lib/api/recommendations-client';

export const RECOMMENDATION_FIELD_TYPES = [
  FIELD_TYPES.RECOMMENDATION,
] as const;

interface Recommender {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status?: 'draft' | 'pending' | 'submitted' | 'expired';
  requestId?: string; // Backend recommendation request ID
  sentAt?: string;
}

interface RecommendationConfig {
  min_recommenders?: number;
  max_recommenders?: number;
  instructions?: string;
}

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
  formId,
  submissionId,
}: FieldRendererProps) {
  const config = (field.config || {}) as RecommendationConfig;
  
  // Check if we're in portal context (applicant filling out form)
  const isPortalContext = context === 'portal';
  
  // Track loading state per recommender
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  
  // Safely get label and description as strings
  const fieldLabel = safeFieldString(field.label) || 'Letters of Recommendation';
  const fieldDescription = safeFieldString(field.description);
  
  // Parse value - can be array of recommenders or empty
  const recommenders: Recommender[] = Array.isArray(value) ? value : [];
  
  const maxRecommenders = config.max_recommenders || 3;
  const minRecommenders = config.min_recommenders || 1;
  const canAddMore = recommenders.length < maxRecommenders;

  // Generate unique ID for new recommender
  const generateId = () => `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddRecommender = useCallback(() => {
    if (!canAddMore) return;
    
    const newRecommender: Recommender = {
      id: generateId(),
      name: '',
      email: '',
      relationship: '',
      status: 'draft',
    };
    
    onChange?.([...recommenders, newRecommender]);
  }, [recommenders, canAddMore, onChange]);

  const handleUpdateRecommender = useCallback((id: string, fieldName: keyof Recommender, newValue: string) => {
    // Don't allow editing if already sent
    const rec = recommenders.find(r => r.id === id);
    if (rec?.status && rec.status !== 'draft') return;
    
    const updated = recommenders.map(rec => 
      rec.id === id ? { ...rec, [fieldName]: newValue } : rec
    );
    onChange?.(updated);
  }, [recommenders, onChange]);

  const handleRemoveRecommender = useCallback((id: string) => {
    const updated = recommenders.filter(rec => rec.id !== id);
    onChange?.(updated);
  }, [recommenders, onChange]);

  // Send recommendation request email
  const handleSendRequest = useCallback(async (rec: Recommender) => {
    // Validate required data
    if (!rec.name || !rec.email) {
      setErrorMessages(prev => ({ ...prev, [rec.id]: 'Please fill in name and email' }));
      return;
    }

    // Validate we have necessary IDs
    if (!formId || !submissionId) {
      setErrorMessages(prev => ({ 
        ...prev, 
        [rec.id]: 'Please save your application first before sending recommendation requests' 
      }));
      return;
    }

    // Clear previous error
    setErrorMessages(prev => {
      const { [rec.id]: _, ...rest } = prev;
      return rest;
    });

    // Start loading
    setLoadingIds(prev => new Set(prev).add(rec.id));

    try {
      // Use portal endpoint when in portal context (no main auth required)
      // Use regular endpoint when in admin/review context (requires main auth)
      const createMethod = isPortalContext 
        ? recommendationsClient.createFromPortal 
        : recommendationsClient.create;
      
      // Call the API to create recommendation request and send email
      const result = await createMethod({
        submission_id: submissionId,
        form_id: formId,
        field_id: field.id,
        recommender_name: rec.name,
        recommender_email: rec.email,
        recommender_relationship: rec.relationship,
      });

      // Update the recommender with the request ID and status
      const updated = recommenders.map(r => 
        r.id === rec.id 
          ? { 
              ...r, 
              status: 'pending' as const, 
              requestId: result.id,
              sentAt: new Date().toISOString()
            } 
          : r
      );
      onChange?.(updated);
    } catch (err: any) {
      console.error('Failed to send recommendation request:', err);
      setErrorMessages(prev => ({ 
        ...prev, 
        [rec.id]: err.message || 'Failed to send request. Please try again.' 
      }));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  }, [recommenders, onChange, formId, submissionId, field.id, isPortalContext]);

  // Check if a recommender is editable (only draft status)
  const isEditable = (rec: Recommender) => !rec.status || rec.status === 'draft';
  
  // Check if send button should be enabled
  const canSend = (rec: Recommender) => 
    rec.name.trim() && 
    rec.email.trim() && 
    isEditable(rec) && 
    formId && 
    submissionId;

  // Display/compact mode - just show summary with status
  if (mode === 'display' || mode === 'compact') {
    const getStatusBadge = (status?: string) => {
      switch (status) {
        case 'submitted':
          return <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded"><CheckCircle className="h-3 w-3" /> Submitted</span>;
        case 'pending':
          return <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"><Clock className="h-3 w-3" /> Pending</span>;
        case 'expired':
          return <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Expired</span>;
        default:
          return <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Draft</span>;
      }
    };

    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-sm text-muted-foreground">{fieldLabel}</Label>
        {recommenders.length === 0 ? (
          <p className="text-sm text-gray-500">No recommenders added</p>
        ) : (
          <div className="space-y-2">
            {recommenders.map((rec, idx) => (
              <div key={rec.id || idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{rec.name || 'Unnamed'}</span>
                {rec.email && <span className="text-gray-500">{rec.email}</span>}
                {getStatusBadge(rec.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div>
        <Label className="text-sm font-medium">
          {fieldLabel}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {fieldDescription && (
          <p className="text-sm text-muted-foreground mt-1">{fieldDescription}</p>
        )}
      </div>

      {/* Instructions */}
      {config.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">{config.instructions}</p>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-gray-50 border rounded-lg p-3">
        <p className="text-sm text-gray-600">
          Please provide contact information for {minRecommenders} to {maxRecommenders} people 
          who can provide a letter of recommendation. Click &quot;Send Request&quot; to email each recommender.
        </p>
      </div>

      {/* Warning if no submission ID */}
      {!submissionId && recommenders.some(r => isEditable(r)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Save your application at least once before sending recommendation requests.
          </p>
        </div>
      )}

      {/* List of recommenders */}
      {recommenders.length > 0 && (
        <div className="space-y-4">
          {recommenders.map((rec, index) => {
            const isLoading = loadingIds.has(rec.id);
            const isSent = rec.status && rec.status !== 'draft';
            const recError = errorMessages[rec.id];
            
            return (
              <div 
                key={rec.id} 
                className={cn(
                  "border rounded-lg p-4 bg-white space-y-3",
                  isSent && "bg-gray-50 border-green-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Recommender {index + 1}
                    </span>
                    {/* Status badge */}
                    {rec.status === 'submitted' && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3" /> Submitted
                      </span>
                    )}
                    {rec.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" /> Request Sent
                      </span>
                    )}
                  </div>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      onClick={() => handleRemoveRecommender(rec.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Full Name *
                    </Label>
                    <Input
                      placeholder="Dr. Jane Smith"
                      value={rec.name}
                      onChange={(e) => handleUpdateRecommender(rec.id, 'name', e.target.value)}
                      disabled={disabled || isSent}
                      className={cn("h-9", isSent && "bg-gray-100")}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email Address *
                    </Label>
                    <Input
                      type="email"
                      placeholder="jane.smith@university.edu"
                      value={rec.email}
                      onChange={(e) => handleUpdateRecommender(rec.id, 'email', e.target.value)}
                      disabled={disabled || isSent}
                      className={cn("h-9", isSent && "bg-gray-100")}
                    />
                  </div>

                  {/* Relationship */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      Relationship
                    </Label>
                    <Input
                      placeholder="e.g., Professor, Supervisor, Manager"
                      value={rec.relationship}
                      onChange={(e) => handleUpdateRecommender(rec.id, 'relationship', e.target.value)}
                      disabled={disabled || isSent}
                      className={cn("h-9", isSent && "bg-gray-100")}
                    />
                  </div>
                </div>

                {/* Error message for this recommender */}
                {recError && (
                  <p className="text-sm text-red-500">{recError}</p>
                )}

                {/* Send Request button - only show for draft recommenders */}
                {isEditable(rec) && !disabled && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleSendRequest(rec)}
                    disabled={!canSend(rec) || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Request
                      </>
                    )}
                  </Button>
                )}

                {/* Sent confirmation */}
                {isSent && rec.sentAt && (
                  <p className="text-xs text-gray-500 text-center">
                    Request sent on {new Date(rec.sentAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {recommenders.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <UserPlus className="h-10 w-10 mx-auto text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-700">No recommenders added yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Add at least {minRecommenders} recommender{minRecommenders > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Add button */}
      {!disabled && canAddMore && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleAddRecommender}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Recommender
          {recommenders.length > 0 && (
            <span className="ml-1 text-gray-500">
              ({recommenders.length}/{maxRecommenders})
            </span>
          )}
        </Button>
      )}

      {/* Validation message */}
      {!canAddMore && (
        <p className="text-xs text-gray-500 text-center">
          Maximum of {maxRecommenders} recommenders allowed
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Status hint */}
      {recommenders.length > 0 && recommenders.length < minRecommenders && (
        <p className="text-xs text-amber-600">
          Please add at least {minRecommenders - recommenders.length} more recommender{minRecommenders - recommenders.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export default RecommendationRenderer;
