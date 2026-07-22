'use client';

import React, { KeyboardEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field } from '@/types/portal';

// ============================================================================
// BLOCK LAYOUT CONTENT - Inline editable content for "layout" field types
// (heading/paragraph/divider/callout), extracted out of Block's
// renderInlineContent() closure.
// ============================================================================

interface BlockLayoutContentProps {
  field: Field;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onUpdate: (updates: Partial<Field>) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function BlockLayoutContent({ field, isEditing, onStartEditing, onStopEditing, onUpdate, inputRef, handleKeyDown }: BlockLayoutContentProps) {
  if (field.type === 'heading') {
    const content = field.label || '';
    if (isEditing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={content}
          onChange={(e) => onUpdate({ label: e.target.value })}
          onBlur={onStopEditing}
          onKeyDown={handleKeyDown}
          className="w-full text-2xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 focus:ring-0"
          placeholder="Enter a heading..."
        />
      );
    }
    return (
      <h2
        className="text-2xl font-bold text-gray-900 cursor-text min-h-[36px] hover:text-gray-700 transition-colors"
        onClick={onStartEditing}
      >
        {content || <span className="text-gray-300 italic font-normal">Click to add heading...</span>}
      </h2>
    );
  }

  if (field.type === 'paragraph') {
    const content = field.description || field.label || '';
    if (isEditing) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={content}
          onChange={(e) => onUpdate({ description: e.target.value, label: e.target.value })}
          onBlur={onStopEditing}
          onKeyDown={handleKeyDown}
          className="w-full text-gray-600 bg-transparent border-none outline-none resize-none placeholder:text-gray-400 min-h-[80px] focus:ring-0"
          placeholder="Write your content here..."
          rows={4}
        />
      );
    }
    return (
      <p
        className="text-gray-600 cursor-text min-h-[24px] whitespace-pre-wrap leading-relaxed hover:text-gray-500 transition-colors"
        onClick={onStartEditing}
      >
        {content || <span className="text-gray-400 italic">Click to add content...</span>}
      </p>
    );
  }

  if (field.type === 'divider') {
    return (
      <div className="py-2">
        <hr className="border-gray-200 hover:border-gray-300 transition-colors" />
      </div>
    );
  }

  if (field.type === 'callout') {
    const colorConfig: Record<string, { bg: string; border: string; icon: string; text: string; placeholder: string }> = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', text: 'text-blue-900', placeholder: 'text-blue-400' },
      green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-900', placeholder: 'text-emerald-400' },
      yellow: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', text: 'text-amber-900', placeholder: 'text-amber-400' },
      red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-900', placeholder: 'text-red-400' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', text: 'text-purple-900', placeholder: 'text-purple-400' },
      gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-500', text: 'text-gray-900', placeholder: 'text-gray-400' },
    };
    const color = (field.config?.color as string) || 'blue';
    const colors = colorConfig[color] || colorConfig.blue;

    return (
      <div className={cn("flex gap-3 p-4 rounded-xl border", colors.bg, colors.border)}>
        <AlertCircle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", colors.icon)} />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={field.label || ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
              onBlur={onStopEditing}
              onKeyDown={handleKeyDown}
              className={cn("w-full bg-transparent border-none outline-none resize-none focus:ring-0", colors.text)}
              placeholder="Add your callout message..."
              rows={2}
            />
          ) : (
            <p
              className={cn("cursor-text leading-relaxed", colors.text)}
              onClick={onStartEditing}
            >
              {field.label || <span className={cn("italic", colors.placeholder)}>Click to add callout message...</span>}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
