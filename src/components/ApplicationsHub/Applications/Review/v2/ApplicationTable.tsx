'use client';

import { FileText, AlertCircle, Calendar, Mail, Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NO_APPLICATIONS_FOUND } from '@/constants/fallbacks';
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

interface Submission {
  id: string;
  applicant_name: string;
  applicant_email: string;
  form_name: string;
  status: string;
  submitted_at: string;
  data: Record<string, any>;
  documents?: { name: string; url: string; type: string }[];
}

interface SubmissionTableProps {
  submissions: Submission[];
  selectedId?: string;
  onSelect: (submission: Submission) => void;
  isLoading: boolean;
  searchQuery?: string;
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
  if (submission.applicant_name && submission.applicant_name.trim() && submission.applicant_name !== submission.applicant_email) {
    return submission.applicant_name.trim();
  }
  return submission.applicant_email;
};

const getDocumentCount = (submission: Submission) => {
  if (!submission.documents) {
    // Count documents from form data
    const data = submission.data || {};
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
  const data = submission.data || {};
  
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
  searchQuery
}: SubmissionTableProps) {
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
                <TableHead>Applicant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow
                  key={submission.id}
                  className={cn(
                    "cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedId === submission.id && "bg-blue-50"
                  )}
                  onClick={() => onSelect(submission)}
                >
                  <TableCell>
                    <div className="font-medium text-gray-900">
                      {getBetterAuthDisplayName(submission)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Mail className="w-3 h-3" />
                      {submission.applicant_email}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">{submission.form_name}</span>
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
                      {new Date(submission.submitted_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(submission);
                      }}
                    >
                      View Details
                    </Button>
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