'use client';

import React from 'react';
import { MessageSquare, UserPlus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecommendationRequest } from '@/lib/api/recommendations-client';

interface ApplicationActionIconRailProps {
  isExternalReviewer: boolean;
  showActivityPanel: boolean;
  setShowActivityPanel: (value: boolean) => void;
  showRecommendersPanel: boolean;
  setShowRecommendersPanel: (value: boolean) => void;
  showDocumentsPanel: boolean;
  setShowDocumentsPanel: (value: boolean) => void;
  recommendations: RecommendationRequest[];
  documentCounts: { uploaded: number; missing: number };
}

export function ApplicationActionIconRail({
  isExternalReviewer,
  showActivityPanel,
  setShowActivityPanel,
  showRecommendersPanel,
  setShowRecommendersPanel,
  showDocumentsPanel,
  setShowDocumentsPanel,
  recommendations,
  documentCounts,
}: ApplicationActionIconRailProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-2 border-l border-gray-200 bg-gray-50 flex-shrink-0">
      {!isExternalReviewer && (
        <button
          onClick={() => {
            setShowActivityPanel(!showActivityPanel);
            setShowRecommendersPanel(false);
            setShowDocumentsPanel(false);
          }}
          className={cn(
            "p-1.5 hover:bg-gray-100 rounded transition-colors",
            showActivityPanel && "bg-blue-50"
          )}
          title="Activity"
        >
          <MessageSquare className="w-4 h-4 text-gray-500" />
        </button>
      )}
      <button
        onClick={() => {
          setShowRecommendersPanel(!showRecommendersPanel);
          setShowActivityPanel(false);
          setShowDocumentsPanel(false);
        }}
        className={cn(
          "p-1.5 hover:bg-gray-100 rounded transition-colors relative",
          showRecommendersPanel && "bg-blue-50"
        )}
        title="References"
      >
        <UserPlus className="w-4 h-4 text-gray-500" />
        {recommendations.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
            {recommendations.filter(r => r.status === 'pending').length}
          </span>
        )}
      </button>
      <button
        onClick={() => {
          setShowDocumentsPanel(!showDocumentsPanel);
          setShowActivityPanel(false);
          setShowRecommendersPanel(false);
        }}
        className={cn(
          "p-1.5 hover:bg-gray-100 rounded transition-colors relative",
          showDocumentsPanel && "bg-blue-50"
        )}
        title="Documents"
      >
        <FileText className="w-4 h-4 text-gray-500" />
        {documentCounts.uploaded > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
            {documentCounts.uploaded}
          </span>
        )}
      </button>
    </div>
  );
}
