import { Application } from '../App';
import { Users, ChevronDown, Star, Clock, AlertCircle } from 'lucide-react';

interface ApplicationListProps {
  applications: Application[];
  selectedId: string | undefined;
  onSelect: (app: Application) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Submitted':
      return 'text-slate-600 bg-slate-50 border-slate-200';
    case 'Initial Review':
      return 'text-purple-600 bg-purple-50 border-purple-200';
    case 'Under Review':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'Final Review':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'Approved':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'Rejected':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getStatusIndicator = (status: string) => {
  switch (status) {
    case 'Submitted':
      return 'bg-slate-500';
    case 'Initial Review':
      return 'bg-purple-500';
    case 'Under Review':
      return 'bg-blue-500';
    case 'Final Review':
      return 'bg-orange-500';
    case 'Approved':
      return 'bg-green-500';
    case 'Rejected':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getPriorityIcon = (priority?: 'high' | 'medium' | 'low') => {
  if (priority === 'high') {
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  }
  return null;
};

/**
 * Application List Component
 * 
 * Design Best Practices:
 * 1. Visual Hierarchy: Most important info (name, status) is prominent
 * 2. Progressive Disclosure: Additional details revealed on hover/selection
 * 3. Scannable Layout: Consistent spacing and alignment for easy scanning
 * 4. Status Indicators: Color-coded avatars + badges for quick recognition
 * 5. Contextual Information: Shows review progress, priority, and last activity
 */
export function ApplicationList({ applications, selectedId, onSelect }: ApplicationListProps) {
  return (
    <div className="bg-white border-r overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-900">{applications.length}</span>
            <span className="text-gray-500">applications</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Sort by:</span>
            <button className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
              <span>Most Recent</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-gray-400 mb-2">No applications found</div>
            <div className="text-gray-400">Try adjusting your filters</div>
          </div>
        ) : (
          applications.map((app, index) => (
            <button
              key={app.id}
              onClick={() => onSelect(app)}
              className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors relative group ${
                selectedId === app.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Index & Avatar */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <span className="text-gray-400 min-w-[20px]">{index + 1}</span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                    getStatusIndicator(app.status)
                  }`}>
                    {app.avatar}
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  {/* Header Row: Name, Priority, Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-gray-900 truncate">
                        {app.firstName} {app.lastName}
                      </h3>
                      {getPriorityIcon(app.priority)}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md border whitespace-nowrap ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="text-gray-500 truncate mb-2">
                    {app.email}
                  </div>

                  {/* Meta Information Row */}
                  <div className="flex items-center gap-4 text-gray-500">
                    {/* Review Progress */}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>{app.reviewedCount}/{app.totalReviewers}</span>
                    </div>

                    {/* Score (if available) */}
                    {app.score && (
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{app.score}</span>
                      </div>
                    )}

                    {/* Last Activity */}
                    {app.lastActivity && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>{app.lastActivity}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {app.tags && app.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {app.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selection Indicator */}
              {selectedId === app.id && (
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-blue-600" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}