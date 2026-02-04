'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { goClient } from '@/lib/api/go-client';
import { Form } from '@/types/forms';
import { SubmissionTable } from './ApplicationTable';
import { ApplicationDetail } from './ApplicationDetail';
import { Search, Filter, Download, X } from 'lucide-react';
import { Input } from '@/ui-components/input';
import { Button } from '@/ui-components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover';
import { cn } from '@/lib/utils';

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
  const [showSearch, setShowSearch] = useState(false);

  // Load form and submissions
  useEffect(() => {
    if (workspaceId && formId) {
      loadData();
    }
  }, [workspaceId, formId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load form details first
      const formData = await goClient.get(`/forms/${formId}`) as Form & { settings?: any };
      
      console.log('Form data loaded:', formData);
      console.log('Form settings:', formData.settings);
      
      // Extract sections from settings and fields from response
      const sections = formData.settings?.sections || [];
      const fields = (formData as any).fields || [];
      
      console.log('Extracted sections from settings:', sections);
      console.log('Extracted fields from response:', fields);
      
      // Merge the data
      const enhancedFormData = {
        ...formData,
        sections,
        fields
      };
      
      setForm(enhancedFormData);

      // Load submissions with Better Auth user data
      const submissionsData = await goClient.get(
        `/forms/${formId}/submissions?workspace_id=${workspaceId}&include_user=true`
      ) as any[];

      // Transform submissions data to match Application interface
      const transformedSubmissions: Submission[] = (submissionsData || []).map((sub: any) => {
        // Get Better Auth user name - the backend now returns ba_user object
        let applicantName = '';
        let firstName = '';
        let lastName = '';
        let email = '';
        
        // First priority: Better Auth user from backend join
        if (sub.ba_user?.name) {
          applicantName = sub.ba_user.name;
          const nameParts = applicantName.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        // Get email from Better Auth user or form data
        if (sub.ba_user?.email) {
          email = sub.ba_user.email;
        } else if (sub.data) {
          const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
          email = data.email || data.Email || '';
        }
        
        // If no Better Auth name, try form data
        if (!applicantName && sub.data) {
          const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
          firstName = data.first_name || data.firstName || data.fname || '';
          lastName = data.last_name || data.lastName || data.lname || '';
          
          if (firstName && lastName) {
            applicantName = `${firstName} ${lastName}`.trim();
          } else {
            applicantName = data.name || data.full_name || data.fullName || data.applicant_name || '';
          }
        }
        
        // Final fallback
        if (!applicantName) {
          applicantName = email || 'Unknown User';
        }

        // Parse form data for additional fields
        const rawData = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {});
        const metadata = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : (sub.metadata || {});

        return {
          id: sub.id,
          firstName,
          lastName, 
          name: applicantName,
          email,
          phone: rawData?.phone || rawData?.Phone || '',
          status: sub.status || metadata.status || 'Submitted',
          submittedDate: sub.submitted_at || sub.created_at,
          raw_data: rawData,
          reviewedCount: 0,
          totalReviewers: 1,
          // Keep compatibility fields
          applicant_name: applicantName,
          applicant_email: email,
          form_name: formData.name || 'Unknown Form',
          submitted_at: sub.submitted_at || sub.created_at
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
      (submission.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || submission.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Get unique statuses for filter
  const availableStatuses = Array.from(new Set(submissions.map(s => s.status)));

  const handleExportCSV = () => {
    // Basic CSV export functionality
    const csvData = filteredSubmissions.map(sub => ({
      Name: sub.name || 'Unknown',
      Email: sub.email,
      Form: form?.name || 'Unknown Form',
      Status: sub.status,
      'Submitted At': new Date(sub.submittedDate).toLocaleDateString(),
      Phone: sub.phone || ''
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
      {/* Compressed Header */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!showSearch ? (
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {form?.name || 'Form Submissions'}
                </h1>
                <p className="text-xs text-gray-500">
                  {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </div>
            ) : (
              <div className="flex-1 max-w-lg">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Search Toggle */}
            {!showSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSearch(true)}
                className="h-8 w-8 p-0"
              >
                <Search className="w-4 h-4" />
              </Button>
            )}
            
            {/* Status Filter - Icon only */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0",
                    filterStatus !== 'all' && "bg-blue-50 text-blue-600"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  {filterStatus !== 'all' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500 px-2 py-1">Filter by status</div>
                  <Button
                    variant={filterStatus === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setFilterStatus('all')}
                  >
                    All
                  </Button>
                  {availableStatuses.map(status => (
                    <Button
                      key={status}
                      variant={filterStatus === status ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setFilterStatus(status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <Button variant="ghost" size="sm" onClick={handleExportCSV} className="h-8 w-8 p-0">
              <Download className="w-4 h-4" />
            </Button>
            
            {onBack && (
              <Button variant="outline" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Submissions Table - Full Width */}
        <div className="absolute inset-0 p-6 overflow-auto">
          <SubmissionTable
            submissions={filteredSubmissions}
            selectedId={selectedSubmission?.id}
            onSelect={setSelectedSubmission}
            isLoading={isLoading}
            searchQuery={searchQuery}
          />
        </div>

        {/* Sliding Review Panel - Overlay from right */}
        {selectedSubmission && (
          <>
            <div className={`fixed top-0 right-0 h-full w-2/3 max-w-4xl bg-white shadow-2xl border-l z-50 transform transition-transform duration-300 ease-in-out ${
              selectedSubmission ? 'translate-x-0' : 'translate-x-full'
            }`}>
              <div className="h-full w-full overflow-hidden relative">
                <ApplicationDetail
                  application={{
                    ...selectedSubmission,
                    reviewedCount: selectedSubmission.reviewedCount || 0,
                    totalReviewers: selectedSubmission.totalReviewers || 0
                  }}
                  reviewersMap={{}}
                  onStatusChange={(appId: string, newStatus: string) => {
                    // Handle status change
                    setSelectedSubmission(prev => prev ? { ...prev, status: newStatus } : null);
                    setSubmissions(prev => prev.map(sub => 
                      sub.id === appId ? { ...sub, status: newStatus } : sub
                    ));
                  }}
                  onClose={() => setSelectedSubmission(null)}
                  workspaceId={workspaceId}
                  formId={formId}
                  fields={(form as any)?.fields || []}
                  sections={(form as any)?.sections || []}
                />
              </div>
            </div>
            
            {/* CSS Override to make ApplicationDetail modal/fullscreen work within our panel */}
            <style jsx global>{`
              .fixed.inset-0.z-50:not(.w-2\\/3) {
                z-index: 60 !important;
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}