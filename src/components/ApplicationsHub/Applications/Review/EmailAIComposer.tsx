'use client';

import React, { useState } from 'react';
import { X, Sparkles, ArrowUp, Loader2 } from 'lucide-react';
import { useCompletion } from '@ai-sdk/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui-components/dialog';
import { Button } from '@/ui-components/button';
import Markdown from 'react-markdown';

interface EmailAIComposerProps {
  open: boolean;
  onClose: () => void;
  currentSubject: string;
  currentBody: string;
  applicationData: {
    name?: string;
    email?: string;
    raw_data?: Record<string, any>;
  };
  fields?: Array<{ id: string; label: string }>;
  onApply: (subject: string, body: string) => void;
}

export function EmailAIComposer({
  open,
  onClose,
  currentSubject,
  currentBody,
  applicationData,
  fields = [],
  onApply,
}: EmailAIComposerProps) {
  const [inputValue, setInputValue] = useState('');
  const [editingMode, setEditingMode] = useState<'subject' | 'body' | 'both'>('both');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');

  // Build context with application data and merge tags
  const buildContext = () => {
    const mergeTags = fields.map(f => `{{${f.label}}}`).join(', ');
    const applicationInfo = [
      `Applicant Name: ${applicationData.name || 'N/A'}`,
      `Applicant Email: ${applicationData.email || 'N/A'}`,
    ];
    
    // Add key application data fields
    if (applicationData.raw_data) {
      Object.entries(applicationData.raw_data).slice(0, 10).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 100) {
          applicationInfo.push(`${key}: ${value}`);
        }
      });
    }

    return {
      mergeTags,
      applicationInfo: applicationInfo.join('\n'),
      currentSubject,
      currentBody: currentBody.replace(/<[^>]*>/g, '').substring(0, 500), // Plain text preview
    };
  };

  const { completion, complete, isLoading } = useCompletion({
    api: '/api/generate',
    streamProtocol: 'text',
    onError: (e) => {
      toast.error(e.message || 'Failed to generate content');
    },
    onFinish: (prompt, completion) => {
      // Parse the completion to extract subject and body
      const lines = completion.split('\n');
      let subject = '';
      let body = '';
      let inBody = false;

      for (const line of lines) {
        if (line.toLowerCase().startsWith('subject:') || line.toLowerCase().startsWith('subject :')) {
          subject = line.replace(/^subject:?\s*/i, '').trim();
        } else if (line.toLowerCase().startsWith('body:') || line.toLowerCase().startsWith('body :')) {
          inBody = true;
          body = line.replace(/^body:?\s*/i, '').trim();
        } else if (inBody || body) {
          body += (body ? '\n' : '') + line;
        } else if (!subject && line.trim()) {
          // If no explicit subject marker, first non-empty line might be subject
          if (editingMode === 'subject' || editingMode === 'both') {
            subject = line.trim();
          }
        }
      }

      // If we're only editing one, use the appropriate part
      if (editingMode === 'subject') {
        setGeneratedSubject(completion.trim());
      } else if (editingMode === 'body') {
        setGeneratedBody(completion.trim());
      } else {
        // Both - try to split intelligently
        if (subject) {
          setGeneratedSubject(subject);
        }
        if (body || (!subject && completion.trim())) {
          setGeneratedBody(body || completion.trim());
        }
      }
    },
  });

  const handleGenerate = () => {
    if (!inputValue.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    const context = buildContext();
    let prompt = '';

    if (editingMode === 'subject') {
      prompt = `Generate an email subject line for an application review system.

Current subject: ${currentSubject || '(empty)'}
Applicant: ${applicationData.name || 'N/A'} (${applicationData.email || 'N/A'})

Available merge tags: ${context.mergeTags}

Application data:
${context.applicationInfo}

User request: ${inputValue}

Generate a professional, concise email subject line. You can use merge tags like {{Field Name}} to include application data.`;
    } else if (editingMode === 'body') {
      prompt = `Generate an email body for an application review system.

Current body: ${context.currentBody || '(empty)'}
Applicant: ${applicationData.name || 'N/A'} (${applicationData.email || 'N/A'})

Available merge tags: ${context.mergeTags}

Application data:
${context.applicationInfo}

User request: ${inputValue}

Generate a professional email body. You can use merge tags like {{Field Name}} to include application data. Return the body as plain text or HTML.`;
    } else {
      prompt = `Generate an email subject and body for an application review system.

Current subject: ${currentSubject || '(empty)'}
Current body: ${context.currentBody || '(empty)'}
Applicant: ${applicationData.name || 'N/A'} (${applicationData.email || 'N/A'})

Available merge tags: ${context.mergeTags}

Application data:
${context.applicationInfo}

User request: ${inputValue}

Generate a professional email. Format your response as:
Subject: [subject line]
Body: [email body]

You can use merge tags like {{Field Name}} to include application data. Return the body as plain text or HTML.`;
    }

    complete(prompt);
  };

  const handleApply = () => {
    const finalSubject = editingMode === 'body' ? currentSubject : (generatedSubject || currentSubject);
    const finalBody = editingMode === 'subject' ? currentBody : (generatedBody || currentBody);
    
    onApply(finalSubject, finalBody);
    onClose();
    setInputValue('');
    setGeneratedSubject('');
    setGeneratedBody('');
  };

  const hasCompletion = completion.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Email Composer
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Editing Mode Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setEditingMode('both')}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                editingMode === 'both' ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Subject & Body
            </button>
            <button
              onClick={() => setEditingMode('subject')}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                editingMode === 'subject' ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Subject Only
            </button>
            <button
              onClick={() => setEditingMode('body')}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                editingMode === 'body' ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Body Only
            </button>
          </div>

          {/* Current Content Preview */}
          <div className="space-y-2">
            {(editingMode === 'subject' || editingMode === 'both') && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Current Subject:</label>
                <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600">
                  {currentSubject || '(empty)'}
                </div>
              </div>
            )}
            {(editingMode === 'body' || editingMode === 'both') && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Current Body:</label>
                <div className="p-2 bg-gray-50 rounded border text-sm text-gray-600 max-h-32 overflow-y-auto">
                  {currentBody.replace(/<[^>]*>/g, '').substring(0, 200) || '(empty)'}
                  {currentBody.length > 200 && '...'}
                </div>
              </div>
            )}
          </div>

          {/* Generated Content */}
          {hasCompletion && (
            <div className="space-y-2">
              {(editingMode === 'subject' || editingMode === 'both') && generatedSubject && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Generated Subject:</label>
                  <div className="p-3 bg-purple-50 rounded border border-purple-200">
                    <p className="text-sm text-gray-900">{generatedSubject}</p>
                  </div>
                </div>
              )}
              {(editingMode === 'body' || editingMode === 'both') && generatedBody && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Generated Body:</label>
                  <div className="p-3 bg-purple-50 rounded border border-purple-200 max-h-64 overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      <Markdown>{generatedBody}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">What would you like AI to do?</label>
            <div className="relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g., Write a professional follow-up email, Create a subject line for application review, Generate a personalized email using applicant's name..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
              <Button
                onClick={handleGenerate}
                disabled={isLoading || !inputValue.trim()}
                className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-purple-600 hover:bg-purple-700"
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Press Cmd/Ctrl + Enter to generate</p>
          </div>

          {/* Merge Tags Info */}
          {fields.length > 0 && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-1">Available Merge Tags:</p>
              <div className="flex flex-wrap gap-1">
                {fields.slice(0, 10).map((field) => (
                  <span key={field.id} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {`{{${field.label}}}`}
                  </span>
                ))}
                {fields.length > 10 && (
                  <span className="text-xs text-blue-600">+{fields.length - 10} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {hasCompletion && (
            <Button onClick={handleApply} className="bg-purple-600 hover:bg-purple-700">
              Apply Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

