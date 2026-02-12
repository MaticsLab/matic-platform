'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Eye,
  Trash2,
  Mail,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Checkbox } from '@/ui-components/checkbox';
import { Badge } from '@/ui-components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui-components/table';
import { Submission, FormField } from './types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface GridViewProps {
  submissions: Submission[];
  fields: FormField[];
  hiddenFields: Set<string>;
  onSubmissionClick: (submission: Submission) => void;
  selectedRows: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort: (field: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  'in-review': 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-800',
};

export function GridView({
  submissions,
  fields,
  hiddenFields,
  onSubmissionClick,
  selectedRows,
  onSelectionChange,
  sortBy,
  sortDirection,
  onSort,
}: GridViewProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Debug: Check data on mount
  console.log('🔍 GridView received:', {
    submissionsCount: submissions.length,
    fieldsCount: fields.length,
    firstSubmissionKeys: submissions[0] ? Object.keys(submissions[0].raw_data) : [],
    firstThreeFieldIds: fields.slice(0, 3).map(f => ({ id: f.id, field_key: f.field_key, label: f.label }))
  });

  const visibleFields = useMemo(
    () => fields.filter(f => !hiddenFields.has(f.field_key)),
    [fields, hiddenFields]
  );

  const allSelected = submissions.length > 0 && selectedRows.size === submissions.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < submissions.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(submissions.map(s => s.id)));
    }
  };

  const toggleRow = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const renderCellValue = (submission: Submission, field: FormField) => {
    // Use field.id to access raw_data since submissions store data with UUID keys
    const valueById = submission.raw_data?.[field.id];
    const valueByKey = submission.raw_data?.[field.field_key];
    const value = valueById || valueByKey;
    
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">—</span>;
    }

    // Handle different field types
    switch (field.field_type) {
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
            {value}
          </a>
        );
      case 'phone':
        return (
          <a href={`tel:${value}`} className="text-blue-600 hover:underline">
            {value}
          </a>
        );
      case 'url':
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {value}
          </a>
        );
      case 'boolean':
        return value ? '✓' : '✗';
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'array':
      case 'multi_select':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'file':
      case 'file_upload':
        return Array.isArray(value) ? (
          <span className="text-sm">{value.length} file(s)</span>
        ) : (
          <span className="text-sm">1 file</span>
        );
      default:
        // Truncate long text
        const strValue = String(value);
        return strValue.length > 50 ? (
          <span title={strValue}>{strValue.substring(0, 50)}...</span>
        ) : (
          strValue
        );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-white rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={toggleAll}
              />
            </TableHead>
            
            {/* Core columns */}
            <TableHead className="min-w-[200px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => onSort('name')}
              >
                Name
                {sortBy === 'name' && (
                  sortDirection === 'asc' ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )
                )}
              </Button>
            </TableHead>

            <TableHead className="min-w-[200px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8"
                onClick={() => onSort('email')}
              >
                Email
                {sortBy === 'email' && (
                  sortDirection === 'asc' ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )
                )}
              </Button>
            </TableHead>

            <TableHead className="min-w-[120px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8"
                onClick={() => onSort('status')}
              >
                Status
                {sortBy === 'status' && (
                  sortDirection === 'asc' ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )
                )}
              </Button>
            </TableHead>

            <TableHead className="min-w-[150px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8"
                onClick={() => onSort('submittedDate')}
              >
                Submitted
                {sortBy === 'submittedDate' && (
                  sortDirection === 'asc' ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )
                )}
              </Button>
            </TableHead>

            {/* Dynamic fields */}
            {visibleFields.map((field) => {
              // Debug: log field-data matching for first submission
              if (submissions[0]) {
                const testValue = submissions[0].raw_data?.[field.id];
                console.log(`🔍 Field "${field.label}" (${field.id}):`, {
                  hasValue: !!testValue,
                  value: testValue,
                  allDataKeys: Object.keys(submissions[0].raw_data || {}).slice(0, 5)
                });
              }
              
              return (
                <TableHead key={field.id} className="min-w-[150px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8 data-[state=open]:bg-accent"
                    onClick={() => onSort(field.field_key)}
                  >
                    {field.label}
                    {sortBy === field.field_key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-2 h-4 w-4" />
                      )
                    )}
                  </Button>
                </TableHead>
              );
            })}

            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5 + visibleFields.length + 1}
                className="h-24 text-center"
              >
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <p className="text-sm">No submissions found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            submissions.map((submission) => (
              <TableRow
                key={submission.id}
                className={cn(
                  'cursor-pointer transition-colors',
                  hoveredRow === submission.id && 'bg-gray-50',
                  selectedRows.has(submission.id) && 'bg-blue-50'
                )}
                onMouseEnter={() => setHoveredRow(submission.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => onSubmissionClick(submission)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedRows.has(submission.id)}
                    onCheckedChange={() => toggleRow(submission.id)}
                  />
                </TableCell>

                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                      {submission.firstName?.[0] || submission.name?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-medium">
                        {submission.name || `${submission.firstName} ${submission.lastName}`.trim()}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-gray-600">
                  {submission.email || <span className="text-gray-400">—</span>}
                </TableCell>

                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'capitalize',
                      STATUS_COLORS[submission.status.toLowerCase()] || 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {submission.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-gray-600 text-sm">
                  {formatDate(submission.submittedDate)}
                </TableCell>

                {/* Dynamic field values */}
                {visibleFields.map((field) => (
                  <TableCell key={field.field_key} className="text-gray-600">
                    {renderCellValue(submission, field)}
                  </TableCell>
                ))}

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSubmissionClick(submission)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
