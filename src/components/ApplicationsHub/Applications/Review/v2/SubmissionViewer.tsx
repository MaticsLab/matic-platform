'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { goClient } from '@/lib/api/go-client';
import { Form, isLayoutField } from '@/types/forms';
import { ViewContainer } from '@/components/SubmissionViews';
import { ApplicationDetail } from './ApplicationDetail';
import { cn } from '@/lib/utils';

interface Submission {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  status: string;
  submittedDate: string;
  raw_data: Record<string, any>;
  reviewedCount?: number;
  totalReviewers?: number;
  // Keep these for compatibility
  applicant_name?: string;
  applicant_email?: string;
  form_name?: string;
  submitted_at?: string;
  documents?: { name: string; url: string; type: string }[];
}

interface SubmissionViewerProps {
  workspaceId: string;
  workspaceSlug?: string;
  formId: string;
}

export function SubmissionViewer({ workspaceId, workspaceSlug, formId }: SubmissionViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Load form details
  useEffect(() => {
    if (workspaceId && formId) {
      loadFormData();
    }
  }, [workspaceId, formId]);

  const loadFormData = async () => {
    setIsLoading(true);
    try {
      const formData = await goClient.get(`/forms/${formId}`) as Form & { settings?: any };
      
      // Extract sections from settings and fields from response
      const sections = formData.settings?.sections || [];
      let fields = (formData as any).fields || [];

      // Transform legacy Field structure to FormField structure
      fields = fields.map((field: any) => ({
        ...field,
        field_key: field.field_key || field.name,
        field_type: field.field_type || field.type,
      }));
      
      const enhancedFormData = {
        ...formData,
        sections,
        fields
      };
      
      setForm(enhancedFormData);
    } catch (error) {
      console.error('Failed to load form:', error);
      toast.error('Failed to load form');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Main Content - New ViewContainer */}
      <ViewContainer
        workspaceId={workspaceId}
        formId={formId}
        onSubmissionClick={setSelectedSubmission}
      />

      {/* Sliding Review Panel - Overlay from right */}
      {selectedSubmission && (
        <>
          <div className={cn(
            "fixed top-0 right-0 h-full w-2/3 max-w-4xl bg-white shadow-2xl border-l z-50",
            "transform transition-transform duration-300 ease-in-out",
            selectedSubmission ? 'translate-x-0' : 'translate-x-full'
          )}>
            <div className="h-full w-full overflow-hidden relative">
              <ApplicationDetail
                application={{
                  ...selectedSubmission,
                  reviewedCount: selectedSubmission.reviewedCount || 0,
                  totalReviewers: selectedSubmission.totalReviewers || 0
                }}
                reviewersMap={{}}
                onStatusChange={(appId: string, newStatus: string) => {
                  setSelectedSubmission(prev => prev ? { ...prev, status: newStatus } : null);
                }}
                onClose={() => setSelectedSubmission(null)}
                workspaceId={workspaceId}
                formId={formId}
                fields={(form as any)?.fields || []}
                sections={(form as any)?.sections || []}
              />
            </div>
          </div>
          
          {/* CSS Override for nested modals */}
          <style jsx global>{`
            .fixed.inset-0.z-50:not(.w-2\\/3) {
              z-index: 60 !important;
            }
          `}</style>
        </>
      )}
    </div>
  );
}
