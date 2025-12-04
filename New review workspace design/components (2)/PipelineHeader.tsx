import { Circle, Search, SlidersHorizontal, Download, Plus, ChevronDown, ChevronUp, X, Users } from 'lucide-react';
import { Application, ApplicationStatus } from '../App';
import { useState } from 'react';

interface PipelineHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  applications: Application[];
  filterStatus: ApplicationStatus | 'all';
  onFilterChange: (status: ApplicationStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  committee: string;
  onCommitteeChange: (value: string) => void;
  onOpenPipelineActivity: () => void;
}

/**
 * Pipeline Header Component
 * 
 * Design Justification:
 * 1. Visual Pipeline: Shows application counts at each stage for quick status overview
 * 2. Color-coded stages: Consistent color system helps users quickly identify stages
 * 3. Search & Filter: Placed prominently for easy access (common user task)
 * 4. Progressive disclosure: Advanced filters hidden behind button to reduce clutter
 */
export function PipelineHeader({ 
  activeTab, 
  onTabChange, 
  applications,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
  committee,
  onCommitteeChange,
  onOpenPipelineActivity
}: PipelineHeaderProps) {
  const [showFilters, setShowFilters] = useState(false);
  
  // Calculate counts for each stage
  const stageCounts = {
    submitted: applications.filter(a => a.status === 'Submitted').length,
    initial: applications.filter(a => a.status === 'Initial Review').length,
    under: applications.filter(a => a.status === 'Under Review').length,
    final: applications.filter(a => a.status === 'Final Review').length,
    approved: applications.filter(a => a.status === 'Approved').length,
    rejected: applications.filter(a => a.status === 'Rejected').length,
  };

  const stages: Array<{
    label: string;
    value: ApplicationStatus | 'all';
    count: number;
    color: string;
    bgColor: string;
    dotColor: string;
  }> = [
    { label: 'All', value: 'all', count: applications.length, color: 'text-gray-700', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' },
    { label: 'Submitted', value: 'Submitted', count: stageCounts.submitted, color: 'text-slate-700', bgColor: 'bg-slate-100', dotColor: 'bg-slate-500' },
    { label: 'Initial Review', value: 'Initial Review', count: stageCounts.initial, color: 'text-purple-700', bgColor: 'bg-purple-100', dotColor: 'bg-purple-500' },
    { label: 'Under Review', value: 'Under Review', count: stageCounts.under, color: 'text-blue-700', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
    { label: 'Final Review', value: 'Final Review', count: stageCounts.final, color: 'text-orange-700', bgColor: 'bg-orange-100', dotColor: 'bg-orange-500' },
    { label: 'Approved', value: 'Approved', count: stageCounts.approved, color: 'text-green-700', bgColor: 'bg-green-100', dotColor: 'bg-green-500' },
    { label: 'Rejected', value: 'Rejected', count: stageCounts.rejected, color: 'text-red-700', bgColor: 'bg-red-100', dotColor: 'bg-red-500' },
  ];

  const activeFiltersCount = filterStatus !== 'all' ? 1 : 0;

  return (
    <div className="bg-white border-b">
      {/* Main Header Row */}
      <div className="px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Committee Selector */}
            <div className="relative">
              <select
                value={committee}
                onChange={(e) => onCommitteeChange(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-9 text-gray-900 hover:border-gray-300 transition-colors cursor-pointer text-sm"
              >
                <option value="reading committee">reading committee</option>
                <option value="review committee">review committee</option>
                <option value="final committee">final committee</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors text-sm ${
                showFilters || activeFiltersCount > 0
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
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
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm" onClick={onOpenPipelineActivity}>
              <Users className="w-3.5 h-3.5" />
              <span>Activity</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="space-y-3">
            {/* Stage Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-700 text-sm">Stage</label>
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
                {stages.map((stage) => (
                  <button
                    key={stage.value}
                    onClick={() => onFilterChange(stage.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-sm ${
                      filterStatus === stage.value
                        ? `${stage.bgColor} ${stage.color} border-${stage.color.split('-')[1]}-300 ring-2 ring-${stage.color.split('-')[1]}-100`
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${stage.dotColor}`} />
                    <span>{stage.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      filterStatus === stage.value ? stage.bgColor : 'bg-gray-100 text-gray-600'
                    }`}>
                      {stage.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Filters */}
            <div>
              <label className="text-gray-700 text-sm mb-2 block">Priority</label>
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
                  <option>John Doe</option>
                  <option>Jane Smith</option>
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