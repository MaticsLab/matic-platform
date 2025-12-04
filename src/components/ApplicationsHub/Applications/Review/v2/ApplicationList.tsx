'use client';

import { Application, ApplicationListProps } from './types';
import { Users, ChevronDown, Star, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
  onSortChange
}: ApplicationListProps) {
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const sortOptions = [
    { value: 'recent', label: 'Most Recent' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'score', label: 'Highest Score' },
    { value: 'name', label: 'Name (A-Z)' },
  ];

  const currentSort = sortOptions.find(s => s.value === sortBy) || sortOptions[0];

  return (
    <div className="bg-white border-r overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-900 font-medium">{applications.length}</span>
            <span className="text-gray-500">applications</span>
          </div>
          <div className="flex items-center gap-2 relative">
            <span className="text-gray-500 text-sm">Sort by:</span>
            <button 
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 text-gray-700 hover:text-gray-900 text-sm"
            >
              <span>{currentSort.label}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                {sortOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange?.(option.value as any);
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                      sortBy === option.value && "bg-blue-50 text-blue-600"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <div className="text-sm">Loading applications...</div>
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-gray-400 mb-2">No applications found</div>
            <div className="text-gray-400 text-sm">Try adjusting your filters</div>
          </div>
        ) : (
          applications.map((app, index) => (
            <button
              key={app.id}
              onClick={() => onSelect(app)}
              className={cn(
                "w-full text-left p-4 border-b hover:bg-gray-50 transition-colors relative group",
                selectedId === app.id && "bg-blue-50 border-l-4 border-l-blue-600"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Index & Avatar */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <span className="text-xs text-gray-400 min-w-[20px]">{index + 1}</span>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
                    getStatusIndicator(app.status)
                  )}>
                    {app.avatar || app.firstName?.[0] || '?'}
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  {/* Header Row: Name, Priority, Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-gray-900 font-medium truncate">
                        {app.firstName} {app.lastName}
                      </h3>
                      {getPriorityIcon(app.priority)}
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-md border whitespace-nowrap",
                      getStatusColor(app.status)
                    )}>
                      {app.stageName || app.status}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="text-sm text-gray-500 truncate mb-2">
                    {app.email}
                  </div>

                  {/* Meta Information Row */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {/* Review Progress */}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>{app.reviewedCount}/{app.totalReviewers}</span>
                    </div>

                    {/* Score (if available) */}
                    {app.score != null && (
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                        <span>{app.score}</span>
                      </div>
                    )}

                    {/* Last Activity */}
                    {app.lastActivity && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{app.lastActivity}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {app.tags && app.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {app.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tag}
                        </span>
                      ))}
                      {app.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{app.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
