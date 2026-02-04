'use client';

import { useState } from 'react';
import { X, FileText, Download, Mail, Calendar, User, Tag, Eye } from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { ScrollArea } from '@/ui-components/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';
import { cn } from '@/lib/utils';
import { Form } from '@/types/forms';

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

interface SubmissionPanelProps {
  submission: Submission;
  form: Form | null;
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
}

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'submitted') return 'text-slate-600 bg-slate-50 border-slate-200';
  if (statusLower.includes('review')) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (statusLower === 'approved' || statusLower === 'accepted') return 'text-green-600 bg-green-50 border-green-200';
  if (statusLower === 'rejected' || statusLower === 'denied') return 'text-red-600 bg-red-50 border-red-200';
  if (statusLower === 'pending') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
};

const formatFieldValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value.url && value.name) return value.name; // File upload
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const isFileField = (value: any) => {
  return value && typeof value === 'object' && value.url && value.name;
};

export function SubmissionPanel({ 
  submission, 
  form, 
  onClose, 
  onStatusChange 
}: SubmissionPanelProps) {
  const [newStatus, setNewStatus] = useState(submission.status);

  // Get documents from submission data
  const documents = submission.documents || [];
  const dataFields = Object.entries(submission.data || {}).filter(([key, value]) => {
    // Filter out system fields and empty values
    return !key.startsWith('_') && value !== null && value !== undefined && value !== '';
  });

  const fileFields = dataFields.filter(([_, value]) => isFileField(value));
  const regularFields = dataFields.filter(([_, value]) => !isFileField(value));

  const handleStatusUpdate = () => {
    if (newStatus !== submission.status) {
      onStatusChange(newStatus);
    }
  };

  const handleDownloadDocument = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {submission.applicant_name}
          </h2>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {submission.applicant_email}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(submission.submitted_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Status and Actions */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Status
            </label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newStatus !== submission.status && (
            <Button onClick={handleStatusUpdate}>
              Update Status
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(submission.status)}>
            {submission.status}
          </Badge>
          <span className="text-sm text-gray-500">•</span>
          <span className="text-sm text-gray-500">{submission.form_name}</span>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Documents Section */}
          {(documents.length > 0 || fileFields.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents ({documents.length + fileFields.length})
              </h3>
              <div className="space-y-2">
                {/* Documents from documents array */}
                {documents.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">{doc.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {doc.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownloadDocument(doc.url, doc.name)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* File fields from form data */}
                {fileFields.map(([fieldName, fileValue]) => (
                  <div key={fieldName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <span className="text-sm font-medium">{(fileValue as any).name}</span>
                        <div className="text-xs text-gray-500">{fieldName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open((fileValue as any).url, '_blank')}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownloadDocument((fileValue as any).url, (fileValue as any).name)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Data */}
          {regularFields.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Form Data
              </h3>
              <div className="space-y-3">
                {regularFields.map(([fieldName, value]) => (
                  <div key={fieldName} className="border-b border-gray-100 pb-3 last:border-b-0">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      {fieldName.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm text-gray-900">
                      {formatFieldValue(value) || 'No response'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}