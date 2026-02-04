'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { goClient } from '@/lib/api/go-client';
import { Form } from '@/types/forms';
import { SubmissionTable } from './ApplicationTable';
import { SubmissionPanel } from './SubmissionPanel';
import { Search, Filter, Download } from 'lucide-react';
import { Input } from '@/ui-components/input';
import { Button } from '@/ui-components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';

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

interface SubmissionViewerProps {
  workspaceId: string;
  formId: string;
  onBack?: () => void;
}

export function SubmissionViewer({ workspaceId, formId, onBack }: SubmissionViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Load form and submissions
  useEffect(() => {
    if (workspaceId && formId) {
      loadData();
    }
  }, [workspaceId, formId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load form details
      const formData = await goClient.get(`/forms/${formId}`) as Form;
      setForm(formData);

      // Load submissions
      const submissionsData = await goClient.get(
        `/forms/${formId}/submissions?workspace_id=${workspaceId}`
      ) as any[];

      // Transform submissions data
      const transformedSubmissions: Submission[] = (submissionsData || []).map((sub: any) => {
        // Extract applicant name from various sources
        let applicantName = sub.applicant_full_name || '';
        if (!applicantName && sub.data) {
          const data = sub.data;
          applicantName = data.name || data.full_name || data.fullName || 
                        `${data.first_name || data.firstName || ''} ${data.last_name || data.lastName || ''}`.trim() ||
                        data.applicant_name || '';
        }

        // Extract email
        const email = sub.applicant_email || sub.data?.email || sub.data?.Email || '';

        // Extract documents from form data
        const documents: { name: string; url: string; type: string }[] = [];
        if (sub.data) {
          Object.entries(sub.data).forEach(([key, value]) => {
            if (value && typeof value === 'object' && (value as any).url && (value as any).name) {
              documents.push({
                name: (value as any).name,
                url: (value as any).url,
                type: (value as any).type || 'document'
              });
            }
          });
        }

        return {
          id: sub.id,
          applicant_name: applicantName || email || 'Unknown',
          applicant_email: email,
          form_name: formData.name || 'Unknown Form',
          status: sub.status || 'Submitted',
          submitted_at: sub.submitted_at || sub.created_at,
          data: sub.data || {},
          documents
        };
      });

      setSubmissions(transformedSubmissions);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter submissions based on search and status
  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = searchQuery === '' || 
      submission.applicant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.applicant_email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || submission.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Get unique statuses for filter
  const availableStatuses = Array.from(new Set(submissions.map(s => s.status)));

  const handleExportCSV = () => {
    // Basic CSV export functionality
    const csvData = filteredSubmissions.map(sub => ({
      Name: sub.applicant_name,
      Email: sub.applicant_email,
      Form: sub.form_name,
      Status: sub.status,
      'Submitted At': new Date(sub.submitted_at).toLocaleDateString(),
      Documents: sub.documents?.length || 0
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form?.name || 'submissions'}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {form?.name || 'Form Submissions'}
            </h1>
            <p className="text-gray-500">
              {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {availableStatuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Submissions Table */}
        <div className="flex-1 p-6">
          <SubmissionTable
            submissions={filteredSubmissions}
            selectedId={selectedSubmission?.id}
            onSelect={setSelectedSubmission}
            isLoading={isLoading}
            searchQuery={searchQuery}
          />
        </div>

        {/* Submission Panel */}
        {selectedSubmission && (
          <div className="w-1/2 border-l bg-white">
            <SubmissionPanel
              submission={selectedSubmission}
              form={form}
              onClose={() => setSelectedSubmission(null)}
              onStatusChange={(newStatus) => {
                // Handle status change
                setSelectedSubmission(prev => prev ? { ...prev, status: newStatus } : null);
                setSubmissions(prev => prev.map(sub => 
                  sub.id === selectedSubmission.id ? { ...sub, status: newStatus } : sub
                ));
                toast.success('Status updated successfully');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}