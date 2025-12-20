'use client';

import { Application, ApplicationStatus, PipelineHeaderProps, Stage } from './types';
import { Download, ChevronDown, Mail } from 'lucide-react';

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
            <button 
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="Export"
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
