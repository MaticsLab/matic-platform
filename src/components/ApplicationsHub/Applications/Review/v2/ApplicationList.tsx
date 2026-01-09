'use client';

import { Application, ApplicationListProps, ApplicationStatus } from './types';
import { Users, Star, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn, getApplicantDisplayName } from '@/lib/utils';
import { NO_APPLICATIONS_FOUND } from '@/constants/fallbacks';
import { useEffect, useRef, useCallback } from 'react';

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'submitted') return 'text-slate-600 bg-slate-50 border-slate-200';
  if (statusLower.includes('initial')) return 'text-purple-600 bg-purple-50 border-purple-200';
  if (statusLower.includes('under') || statusLower.includes('review')) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (statusLower.includes('final')) return 'text-orange-600 bg-orange-50 border-orange-200';
  if (statusLower === 'approved' || statusLower === 'accepted') return 'text-green-600 bg-green-50 border-green-200';
  if (statusLower === 'rejected' || statusLower === 'denied') return 'text-red-600 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
};

const getStatusIndicator = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'submitted') return 'bg-slate-500';
  if (statusLower.includes('initial')) return 'bg-purple-500';
  if (statusLower.includes('under') || statusLower.includes('review')) return 'bg-blue-500';
  if (statusLower.includes('final')) return 'bg-orange-500';
  if (statusLower === 'approved' || statusLower === 'accepted') return 'bg-green-500';
  if (statusLower === 'rejected' || statusLower === 'denied') return 'bg-red-500';
  return 'bg-gray-500';
};

const getPriorityIcon = (priority?: 'high' | 'medium' | 'low') => {
  if (priority === 'high') {
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  }
  return null;
};

export function ApplicationList({ 
  applications, 
  selectedId, 
  onSelect,
  isLoading,
  sortBy = 'recent',
  onSortChange,
  filterStatus = 'all',
  onFilterChange,
  stages = [],
  hasMore = false,
  isLoadingMore = false,
  onLoadMore
}: ApplicationListProps) {
  const observerTarget = useRef<HTMLDivElement>(null);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div className="bg-white border-r overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <div className="text-sm">Loading applications...</div>
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-gray-400 mb-2">{NO_APPLICATIONS_FOUND}</div>
            <div className="text-gray-400 text-sm">Try adjusting your filters</div>
          </div>
        ) : (
          <>
            {applications.map((app, index) => (
            <button
              key={app.id}
              onClick={() => onSelect(app)}
              className={cn(
                "w-full text-left px-3 py-2 border-b hover:bg-gray-50 transition-colors relative group",
                selectedId === app.id && "bg-blue-50 border-l-4 border-l-blue-600"
              )}
            >
              <div className="flex items-start gap-2">
                {/* Index */}
                <div className="flex flex-col items-center pt-0.5">
                  <span className="text-xs text-gray-400 min-w-[16px]">{index + 1}</span>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  {/* Header Row: Name, Priority, Status */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm text-gray-900 font-medium truncate">
                        {getApplicantDisplayName(app)}
                      </h3>
                      {getPriorityIcon(app.priority)}
                    </div>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0",
                      getStatusColor(app.status)
                    )}>
                      {app.stageName || app.status}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="text-xs text-gray-500 truncate mb-1">
                    {app.email}
                  </div>

                  {/* Meta Information Row */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {/* Review Progress */}
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{app.reviewedCount}/{app.totalReviewers}</span>
                    </div>

                    {/* Score (if available) */}
                    {app.score != null && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span>{app.score}</span>
                      </div>
                    )}

                    {/* Last Activity */}
                    {app.lastActivity && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{app.lastActivity}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
            ))}
        
            {/* Infinite scroll trigger - only show if not in initial loading state */}
            {!isLoading && hasMore && (
              <div ref={observerTarget} className="py-4 flex items-center justify-center">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                ) : (
                  <div className="h-4" /> // Spacer to trigger observer
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
