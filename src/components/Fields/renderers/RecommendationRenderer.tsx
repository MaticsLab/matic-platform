'use client';

/**
 * Simplified Recommendation Field Renderer
 * 
 * Collects recommender contact information (name, email, relationship).
 * Emails are sent via the Gmail integration from the admin side.
 */

import React, { useCallback } from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { cn } from '@/lib/utils';
import { UserPlus, Trash2, Mail, User, Briefcase } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

export const RECOMMENDATION_FIELD_TYPES = [
  FIELD_TYPES.RECOMMENDATION,
] as const;

interface Recommender {
  id: string;
  name: string;
  email: string;
  relationship: string;
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
  disabled = false,
  required = false,
  error,
  className,
}: FieldRendererProps) {
  const config = (field.config || {}) as RecommendationConfig;
  
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
    };
    
    onChange?.([...recommenders, newRecommender]);
  }, [recommenders, canAddMore, onChange]);

  const handleUpdateRecommender = useCallback((id: string, fieldName: keyof Recommender, newValue: string) => {
    const updated = recommenders.map(rec => 
      rec.id === id ? { ...rec, [fieldName]: newValue } : rec
    );
    onChange?.(updated);
  }, [recommenders, onChange]);

  const handleRemoveRecommender = useCallback((id: string) => {
    const updated = recommenders.filter(rec => rec.id !== id);
    onChange?.(updated);
  }, [recommenders, onChange]);

  // Display/compact mode - just show summary
  if (mode === 'display' || mode === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-sm text-muted-foreground">{fieldLabel}</Label>
        {recommenders.length === 0 ? (
          <p className="text-sm text-gray-500">No recommenders added</p>
        ) : (
          <div className="space-y-1">
            {recommenders.map((rec, idx) => (
              <div key={rec.id || idx} className="text-sm">
                <span className="font-medium">{rec.name || 'Unnamed'}</span>
                {rec.email && <span className="text-gray-500"> • {rec.email}</span>}
                {rec.relationship && <span className="text-gray-400"> ({rec.relationship})</span>}
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
          who can provide a letter of recommendation. We will contact them via email.
        </p>
      </div>

      {/* List of recommenders */}
      {recommenders.length > 0 && (
        <div className="space-y-4">
          {recommenders.map((rec, index) => (
            <div 
              key={rec.id} 
              className="border rounded-lg p-4 bg-white space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Recommender {index + 1}
                </span>
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
                    disabled={disabled}
                    className="h-9"
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
                    disabled={disabled}
                    className="h-9"
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
                    disabled={disabled}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          ))}
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
