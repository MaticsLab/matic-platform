'use client';

import { Application, ApplicationStatus, PipelineHeaderProps, Stage } from './types';
import { Download, ChevronDown, Mail, SlidersHorizontal, FileText } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";

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
  onWorkflowChange,
  onDownload,
  workspaceSlug,
  formId
}: PipelineHeaderProps) {
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  
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
    ...(stages || []).map((stage, idx) => {
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

  const activeFiltersCount = filterStatus !== 'all' ? 1 : 0;

  return (
    <div className="bg-white border-b">
      {/* Main Header Row */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          </div>

          <div className="flex items-center gap-1">
            <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
              <PopoverTrigger asChild>
                <button 
                  className={cn(
                    "p-2 rounded-lg hover:bg-gray-100 transition-colors relative",
                    activeFiltersCount > 0 ? "text-blue-600" : "text-gray-500"
                  )}
                  title="Filter"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-700 text-sm font-medium">Stage</label>
                    {filterStatus !== 'all' && (
                      <button
                        onClick={() => {
                          onFilterChange?.('all');
                          setShowFilterPopover(false);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {filterOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onFilterChange?.(option.value);
                          setShowFilterPopover(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-left",
                          filterStatus === option.value
                            ? `${option.bgColor} ${option.color}`
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", option.dotColor)} />
                        <span className="flex-1">{option.label}</span>
                        <span className="text-gray-400">({option.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {workspaceSlug && formId && (
              <button 
                onClick={() => window.location.href = `/workspace/${workspaceSlug}/portal-editor?formId=${formId}`}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                title="Portal Editor"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => onDownload?.()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={onOpenPipelineActivity}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="Activity"
            >
              <Mail className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
