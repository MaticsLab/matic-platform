'use client';

import { useState, useMemo } from 'react';
import { MoreHorizontal, Plus, Mail, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { Card } from '@/ui-components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu';
import { Submission } from './types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface KanbanViewProps {
  submissions: Submission[];
  onSubmissionClick: (submission: Submission) => void;
  onStatusChange?: (submissionId: string, newStatus: string) => void;
}

const DEFAULT_COLUMNS = [
  { id: 'submitted', label: 'Submitted', color: 'bg-blue-100 border-blue-300' },
  { id: 'in-review', label: 'In Review', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'approved', label: 'Approved', color: 'bg-green-100 border-green-300' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-100 border-red-300' },
];

export function KanbanView({
  submissions,
  onSubmissionClick,
  onStatusChange,
}: KanbanViewProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Group submissions by status
  const groupedSubmissions = useMemo(() => {
    const groups: Record<string, Submission[]> = {};
    DEFAULT_COLUMNS.forEach(col => {
      groups[col.id] = [];
    });

    submissions.forEach(sub => {
      const status = sub.status.toLowerCase().replace(/\s+/g, '-');
      if (groups[status]) {
        groups[status].push(sub);
      } else {
        // Default to submitted if status doesn't match
        groups['submitted'].push(sub);
      }
    });

    return groups;
  }, [submissions]);

  const handleDragStart = (e: React.DragEvent, submissionId: string) => {
    setDraggedItem(submissionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', submissionId);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (columnId: string) => {
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedItem && onStatusChange) {
      onStatusChange(draggedItem, columnId);
    }
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-gray-50">
      <div className="flex gap-4 h-full min-w-max">
        {DEFAULT_COLUMNS.map((column) => {
          const columnSubmissions = groupedSubmissions[column.id] || [];
          const isOver = dragOverColumn === column.id;

          return (
            <div
              key={column.id}
              className="flex flex-col w-80 flex-shrink-0"
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{column.label}</h3>
                  <Badge variant="secondary" className="rounded-full">
                    {columnSubmissions.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Cards Container */}
              <div
                className={cn(
                  'flex-1 rounded-lg border-2 border-dashed p-2 space-y-2 overflow-y-auto transition-colors min-h-[200px]',
                  isOver ? `${column.color}` : 'border-gray-200 bg-gray-50'
                )}
              >
                {columnSubmissions.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                    No submissions
                  </div>
                ) : (
                  columnSubmissions.map((submission) => (
                    <Card
                      key={submission.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, submission.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'p-4 cursor-pointer hover:shadow-md transition-all bg-white',
                        draggedItem === submission.id && 'opacity-50'
                      )}
                      onClick={() => onSubmissionClick(submission)}
                    >
                      {/* Header with Avatar and Menu */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                            {submission.firstName?.[0] || submission.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {submission.name || `${submission.firstName} ${submission.lastName}`.trim()}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onSubmissionClick(submission);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Content */}
                      <div className="space-y-2">
                        {submission.email && (
                          <p className="text-sm text-gray-600 truncate">{submission.email}</p>
                        )}
                        
                        {submission.phone && (
                          <p className="text-sm text-gray-600">{submission.phone}</p>
                        )}

                        {/* Show a preview of form data */}
                        {submission.raw_data && Object.keys(submission.raw_data).length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            {Object.entries(submission.raw_data)
                              .slice(0, 2)
                              .map(([key, value]) => {
                                if (!value || typeof value === 'object') return null;
                                return (
                                  <div key={key} className="text-xs text-gray-500 truncate">
                                    <span className="font-medium">{key}:</span> {String(value)}
                                  </div>
                                );
                              })}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                          <span>{formatDate(submission.submittedDate)}</span>
                          {submission.documents && submission.documents.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {submission.documents.length} file(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
