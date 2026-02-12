'use client';

import { useState } from 'react';
import {
  MoreHorizontal,
  Mail,
  Eye,
  Trash2,
  Phone,
  Calendar,
  FileText,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { Card, CardContent } from '@/ui-components/card';
import { Checkbox } from '@/ui-components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu';
import { Submission, FormField } from './types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface GalleryViewProps {
  submissions: Submission[];
  fields: FormField[];
  hiddenFields: Set<string>;
  onSubmissionClick: (submission: Submission) => void;
  selectedRows: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800 border-blue-300',
  'in-review': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  pending: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function GalleryView({
  submissions,
  fields,
  hiddenFields,
  onSubmissionClick,
  selectedRows,
  onSelectionChange,
}: GalleryViewProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const visibleFields = fields.filter(f => !hiddenFields.has(f.field_key));

  const toggleRow = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const getFieldValue = (submission: Submission, fieldKey: string) => {
    const value = submission.raw_data?.[fieldKey];
    if (value === null || value === undefined || value === '') return null;
    
    // Truncate long values
    const strValue = String(value);
    return strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      {submissions.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {submissions.map((submission) => {
            const status = submission.status.toLowerCase().replace(/\s+/g, '-');
            const isSelected = selectedRows.has(submission.id);
            const isHovered = hoveredCard === submission.id;

            return (
              <Card
                key={submission.id}
                className={cn(
                  'relative overflow-hidden cursor-pointer transition-all hover:shadow-lg',
                  isSelected && 'ring-2 ring-blue-500',
                  isHovered && 'shadow-xl scale-[1.02]'
                )}
                onMouseEnter={() => setHoveredCard(submission.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => onSubmissionClick(submission)}
              >
                {/* Selection Checkbox - Top Left */}
                <div
                  className="absolute top-3 left-3 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRow(submission.id)}
                    className="bg-white shadow-md"
                  />
                </div>

                {/* Actions Menu - Top Right */}
                <div className="absolute top-3 right-3 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 bg-white shadow-md hover:bg-gray-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmissionClick(submission);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CardContent className="p-6">
                  {/* Avatar and Header */}
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
                      {submission.firstName?.[0] || submission.name?.[0] || '?'}
                    </div>
                    <h3 className="font-semibold text-lg mb-1">
                      {submission.name || `${submission.firstName} ${submission.lastName}`.trim()}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'capitalize mb-2',
                        STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {submission.status}
                    </Badge>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    {submission.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{submission.email}</span>
                      </div>
                    )}
                    {submission.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{submission.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>{formatDate(submission.submittedDate)}</span>
                    </div>
                  </div>

                  {/* Preview Fields */}
                  {visibleFields.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      {visibleFields.slice(0, 3).map((field) => {
                        const value = getFieldValue(submission, field.field_key);
                        if (!value) return null;

                        return (
                          <div key={field.field_key} className="text-sm">
                            <span className="font-medium text-gray-700">
                              {field.label}:
                            </span>{' '}
                            <span className="text-gray-600">{value}</span>
                          </div>
                        );
                      })}
                      {visibleFields.length > 3 && (
                        <p className="text-xs text-gray-500 pt-1">
                          +{visibleFields.length - 3} more field(s)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Documents Badge */}
                  {submission.documents && submission.documents.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <Badge variant="outline" className="gap-1">
                        <Paperclip className="h-3 w-3" />
                        {submission.documents.length} attachment(s)
                      </Badge>
                    </div>
                  )}

                  {/* Review Progress */}
                  {submission.reviewedCount !== undefined &&
                    submission.totalReviewers !== undefined && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Review Progress</span>
                          <span>
                            {submission.reviewedCount}/{submission.totalReviewers}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                (submission.reviewedCount / submission.totalReviewers) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
