'use client';

import { SubmissionViewer } from './SubmissionViewer';

interface ReviewWorkspaceV2Props {
  workspaceId: string;
  workspaceSlug?: string;
  formId: string | null;
  onViewChange?: (view: string) => void;
}

export function ReviewWorkspaceV2({ 
  workspaceId, 
  workspaceSlug,
  formId, 
  onViewChange 
}: ReviewWorkspaceV2Props) {
  // Handle null formId
  if (!formId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Form Selected</h3>
          <p className="text-gray-500">Please select a form to view submissions</p>
        </div>
      </div>
    );
  }

  return (
    <SubmissionViewer
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      formId={formId}
    />
  );
}
