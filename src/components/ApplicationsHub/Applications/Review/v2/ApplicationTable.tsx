'use client';

import { FileText, AlertCircle, Calendar, Mail, Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui-components/table';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { Checkbox } from '@/ui-components/checkbox';

interface Submission {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  status: string;
  submittedDate: string;
  raw_data: Record<string, any>;
  reviewedCount?: number;
  totalReviewers?: number;
  // Keep these for compatibility
  applicant_name?: string;
  applicant_email?: string;
  form_name?: string;
  submitted_at?: string;
  documents?: { name: string; url: string; type: string }[];
}

interface SubmissionTableProps {
  submissions: Submission[];
  selectedId?: string;
  onSelect: (submission: Submission) => void;
  isLoading: boolean;
  searchQuery?: string;
  selectedRows: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
}

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

const getStatusBadge = (status: string) => {
  return (
    <span className={cn(
      "text-xs px-2 py-1 rounded-full border font-medium",
      getStatusColor(status)
    )}>
      {status}
    </span>
  );
};

const getBetterAuthDisplayName = (submission: Submission) => {
  // First check the name field (from Better Auth ba_users table)
  if (submission.name && submission.name.trim() && submission.name !== submission.email) {
    return submission.name.trim();
  }
  
  // Try constructing from firstName/lastName
  if (submission.firstName || submission.lastName) {
    const fullName = `${submission.firstName || ''} ${submission.lastName || ''}`.trim();
    if (fullName) return fullName;
  }
  
  // Fallback to applicant_name for compatibility
  if (submission.applicant_name && submission.applicant_name !== submission.email) {
    return submission.applicant_name;
  }
  
  // Final fallback to email
  return submission.email || 'Unknown User';
};

const getDocumentCount = (submission: Submission) => {
  if (!submission.documents) {
    // Count documents from form raw_data
    const data = submission.raw_data || {};
    let count = 0;
    Object.values(data).forEach(value => {
      if (value && typeof value === 'object' && (value as any).url && (value as any).name) {
        count++;
      }
    });
    return count;
  }
  return submission.documents.length;
};

const getDocumentsFromData = (submission: Submission) => {
  if (submission.documents) return submission.documents;
  
  const docs: { name: string; url: string; type: string }[] = [];
  const data = submission.raw_data || {};
  
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'object' && (value as any).url && (value as any).name) {
      docs.push({
        name: (value as any).name,
        url: (value as any).url,
        type: (value as any).type || 'document'
      });
    }
  });
  
  return docs;
};

export function SubmissionTable({
  submissions,
  selectedId,
  onSelect,
  isLoading,
  searchQuery,
  selectedRows,
  onToggleRow,
  onToggleAll,
}: SubmissionTableProps) {
  const allSelected = submissions.length > 0 && submissions.every(s => selectedRows.has(s.id));
  const someSelected = submissions.some(s => selectedRows.has(s.id)) && !allSelected;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        <div className="text-sm text-gray-500">Loading applications...</div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-gray-400 mb-2">No submissions found</div>
        <div className="text-gray-400 text-sm">
          {searchQuery ? 'Try adjusting your search or filters' : 'No submissions have been made yet'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="bg-white border rounded-lg flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleAll}
                    aria-label="Select all"
                    className={someSelected ? "data-[state=checked]:bg-gray-400" : ""}
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission, index) => (
                <TableRow
                  key={submission.id}
                  className={cn(
                    "group cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedId === submission.id && "bg-blue-50",
                    selectedRows.has(submission.id) && "bg-blue-50"
                  )}
                  onClick={() => onSelect(submission)}
                >
                  <TableCell className="w-14 pl-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-6 h-6 flex items-center justify-center">
                      {/* Row number - hidden on hover or when selected */}
                      <span className={cn(
                        "text-sm text-gray-400 absolute inset-0 flex items-center justify-center transition-opacity",
                        selectedRows.has(submission.id) ? "opacity-0" : "group-hover:opacity-0"
                      )}>
                        {index + 1}
                      </span>
                      {/* Checkbox - shown on hover or when selected */}
                      <div className={cn(
                        "absolute inset-0 flex items-center justify-center transition-opacity",
                        selectedRows.has(submission.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        <Checkbox
                          checked={selectedRows.has(submission.id)}
                          onCheckedChange={() => onToggleRow(submission.id)}
                          aria-label={`Select ${getBetterAuthDisplayName(submission)}`}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">
                      {getBetterAuthDisplayName(submission)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Mail className="w-3 h-3" />
                      {submission.email}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getStatusBadge(submission.status)}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {getDocumentCount(submission)} documents
                      </span>
                      {getDocumentCount(submission) > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle document viewing
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <Calendar className="w-3 h-3" />
                      {new Date(submission.submittedDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}