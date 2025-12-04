'use client';

import { useState } from 'react';
import { Application, ApplicationStatus, PipelineHeaderProps, Stage } from './types';
import { SlidersHorizontal, Download, ChevronDown, ChevronUp, X, Users, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PipelineHeader({ 
  activeTab, 
  onTabChange, 
  applications,
  stages,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
  committee,
  onCommitteeChange,
  onOpenPipelineActivity,
  workflows,
  selectedWorkflowId,
  onWorkflowChange
}: PipelineHeaderProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // Calculate counts for each stage
  const getStageCounts = () => {
    const counts: Record<string, number> = { all: applications.length };
    
    // Count by stage
    stages.forEach(stage => {
      counts[stage.id] = applications.filter(a => 
        a.stageId === stage.id || a.stageName === stage.name || a.status === stage.name
      ).length;
    });
    
    // Count rejected separately
    counts['rejected'] = applications.filter(a => 
      a.status.toLowerCase() === 'rejected' || a.status.toLowerCase() === 'denied'
    ).length;
    
    return counts;
  };

  const stageCounts = getStageCounts();

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
      return {
        label: stage.name,
        value: stage.name as ApplicationStatus,
        count: stageCounts[stage.id] || 0,
        ...colorSet
      };
    }),
    { label: 'Rejected', value: 'Rejected', count: stageCounts['rejected'] || 0, color: 'text-red-700', bgColor: 'bg-red-100', dotColor: 'bg-red-500' },
  ];

  const activeFiltersCount = filterStatus !== 'all' ? 1 : 0;

  return (
    <div className="bg-white border-b">
      {/* Main Header Row */}
      <div className="px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Workflow/Committee Selector */}
            {workflows && workflows.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedWorkflowId || ''}
                  onChange={(e) => onWorkflowChange?.(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-9 text-gray-900 hover:border-gray-300 transition-colors cursor-pointer text-sm font-medium"
                >
                  {workflows.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={committee}
                  onChange={(e) => onCommitteeChange(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-9 text-gray-900 hover:border-gray-300 transition-colors cursor-pointer text-sm"
                >
                  <option value="reading committee">Reading Committee</option>
                  <option value="review committee">Review Committee</option>
                  <option value="final committee">Final Committee</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                "p-2 rounded-lg border transition-colors",
                showSearch ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              )}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
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
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button 
              onClick={onOpenPipelineActivity}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Activity</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-6 py-2 border-t border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search applications by name, email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="space-y-3">
            {/* Stage Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-700 text-sm font-medium">Stage</label>
                {filterStatus !== 'all' && (
                  <button
                    onClick={() => onFilterChange('all')}
                    className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onFilterChange(option.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-sm",
                      filterStatus === option.value
                        ? `${option.bgColor} ${option.color} border-current ring-2 ring-current ring-opacity-20`
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", option.dotColor)} />
                    <span>{option.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-xs",
                      filterStatus === option.value ? option.bgColor : 'bg-gray-100 text-gray-600'
                    )}>
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Filters */}
            <div>
              <label className="text-gray-700 text-sm font-medium mb-2 block">Priority</label>
              <div className="flex flex-wrap gap-1.5">
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>High</span>
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {applications.filter(a => a.priority === 'high').length}
                  </span>
                </button>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <span>Medium</span>
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {applications.filter(a => a.priority === 'medium').length}
                  </span>
                </button>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  <span>Low</span>
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {applications.filter(a => a.priority === 'low').length}
                  </span>
                </button>
              </div>
            </div>

            {/* Additional Filters Row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-gray-700 text-sm mb-1.5 block">Assigned To</label>
                <select className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 pr-8 text-gray-900 hover:border-gray-300 transition-colors cursor-pointer text-sm">
                  <option>Anyone</option>
                  <option>Unassigned</option>
                </select>
              </div>
              <div>
                <label className="text-gray-700 text-sm mb-1.5 block">Submitted</label>
                <select className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 pr-8 text-gray-900 hover:border-gray-300 transition-colors cursor-pointer text-sm">
                  <option>Any time</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                </select>
              </div>
              <div>
                <label className="text-gray-700 text-sm mb-1.5 block">Score</label>
                <select className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 pr-8 text-gray-900 hover:border-gray-300 transition-colors cursor-pointer text-sm">
                  <option>Any score</option>
                  <option>9.0 - 10.0</option>
                  <option>8.0 - 8.9</option>
                  <option>7.0 - 7.9</option>
                  <option>Below 7.0</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
