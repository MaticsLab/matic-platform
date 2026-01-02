'use client';

import { Application, ApplicationListProps, ApplicationStatus } from './types';
import { Users, ChevronDown, Star, Clock, AlertCircle, SlidersHorizontal, ChevronUp, X } from 'lucide-react';
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
  onSortChange,
  filterStatus = 'all',
  onFilterChange,
  stages = []
}: ApplicationListProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = filterStatus !== 'all' ? 1 : 0;

  // Build filter options from stages
  const filterOptions: Array<{
    label: string;
    value: ApplicationStatus | 'all';
    count: number;
    color: string;
    bgColor: string;
    dotColor: string;
  }> = [
    { label: 'All', value: 'all', count: applications.length, color: 'text-gray-700', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' },
    ...stages.map((stage, idx) => {
      const colors = [
        { color: 'text-slate-700', bgColor: 'bg-slate-100', dotColor: 'bg-slate-500' },
        { color: 'text-purple-700', bgColor: 'bg-purple-100', dotColor: 'bg-purple-500' },
        { color: 'text-blue-700', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
        { color: 'text-orange-700', bgColor: 'bg-orange-100', dotColor: 'bg-orange-500' },
        { color: 'text-green-700', bgColor: 'bg-green-100', dotColor: 'bg-green-500' },
      ];
      const colorSet = colors[idx % colors.length];
      const count = applications.filter(a => 
        a.stageId === stage.id || a.stageName === stage.name || a.status === stage.name
      ).length;
      return {
        label: stage.name,
        value: stage.name as ApplicationStatus,
        count,
        ...colorSet
      };
    }),
  ];

  return (
    <div className="bg-white border-r overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-900 font-medium">{applications.length}</span>
            <span className="text-gray-500">applications</span>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors text-sm",
              showFilters || activeFiltersCount > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-xs">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        
        {/* Expandable Filter Panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-700 text-sm font-medium">Stage</label>
              {filterStatus !== 'all' && (
                <button
                  onClick={() => onFilterChange?.('all')}
                  className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onFilterChange?.(option.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                    filterStatus === option.value
                      ? `${option.bgColor} ${option.color} border-current`
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", option.dotColor)} />
                  <span>{option.label}</span>
                  <span className="text-gray-400">({option.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
                {/* Index */}
                <div className="flex flex-col items-center pt-1">
                  <span className="text-xs text-gray-400 min-w-[20px]">{index + 1}</span>
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
