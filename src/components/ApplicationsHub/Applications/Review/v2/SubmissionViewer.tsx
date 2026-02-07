'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { goClient } from '@/lib/api/go-client';
import { Form, isLayoutField } from '@/types/forms';
import { SubmissionTable } from './ApplicationTable';
import { ApplicationDetail } from './ApplicationDetail';
import { Search, Filter, Download, X, FileText, ChevronDown, ArrowUpDown, EyeOff, Clock, BarChart3, Database, Table2, FileStack, Trash2 } from 'lucide-react';
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
  workspaceSlug?: string;
  formId: string;
}

export function SubmissionViewer({ workspaceId, workspaceSlug, formId }: SubmissionViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [activeView, setActiveView] = useState<'submissions' | 'in-progress' | 'summary' | 'analytics'>('submissions');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());

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
      
      console.log('📋 Form fields:', fields);
      console.log('📋 Field keys:', fields.map((f: any) => f.field_key));
      
      setForm(enhancedFormData);

      // Load submissions with Better Auth user data
      const submissionsData = await goClient.get(
        `/forms/${formId}/submissions?workspace_id=${workspaceId}&include_user=true`
      ) as any[];

      console.log('📊 Raw submissions from backend:', submissionsData);

      // Transform submissions data to match Application interface
      const transformedSubmissions: Submission[] = (submissionsData || []).map((sub: any) => {
        // Parse data — new schema returns a flat object, legacy returns JSON string
        const dataField = sub.data || sub.Data || {};
        const rawData = typeof dataField === 'string' ? JSON.parse(dataField) : (dataField || {});

        // Get user info from ba_user join (works with both new and legacy paths)
        let applicantName = '';
        let firstName = '';
        let lastName = '';
        let email = '';
        
        if (sub.ba_user?.name) {
          applicantName = sub.ba_user.name;
          const nameParts = applicantName.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        
        if (sub.ba_user?.email) {
          email = sub.ba_user.email;
        }
        
        // Fallback: try extracting from form data if no ba_user
        if (!applicantName) {
          firstName = rawData.first_name || rawData.firstName || rawData.fname || '';
          lastName = rawData.last_name || rawData.lastName || rawData.lname || '';
          if (firstName || lastName) {
            applicantName = `${firstName} ${lastName}`.trim();
          } else {
            applicantName = rawData.name || rawData.full_name || rawData.applicant_name || '';
          }
        }
        if (!email) {
          email = rawData.email || rawData.Email || rawData._applicant_email || '';
        }
        if (!applicantName) {
          applicantName = email || 'Unknown User';
        }

        // Status: new schema has it directly, legacy has it in metadata
        const metadataField = sub.metadata || sub.Metadata || {};
        const metadata = typeof metadataField === 'string' ? JSON.parse(metadataField) : (metadataField || {});
        const status = sub.status || metadata.status || 'Submitted';

        return {
          id: sub.id,
          firstName,
          lastName, 
          name: applicantName,
          email,
          phone: rawData?.phone || rawData?.Phone || '',
          status,
          submittedDate: sub.submitted_at || sub.created_at,
          raw_data: rawData,
          reviewedCount: 0,
          totalReviewers: 1,
          applicant_name: applicantName,
          applicant_email: email,
          form_name: formData.name || 'Unknown Form',
          submitted_at: sub.submitted_at || sub.created_at
        };
      });

      console.log('✅ Loaded', transformedSubmissions.length, 'submissions');

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

  const handleToggleRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedRows.size === filteredSubmissions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredSubmissions.map(s => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} submission(s)? This action cannot be undone.`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const response = await goClient.post(`/forms/${formId}/submissions/bulk-delete`, {
        submission_ids: Array.from(selectedRows)
      });
      
      toast.success(`Successfully deleted ${selectedRows.size} submission(s)`);
      setSelectedRows(new Set());
      loadData(); // Reload data
    } catch (error: any) {
      console.error('Failed to delete submissions:', error);
      toast.error(error.message || 'Failed to delete submissions');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFieldVisibility = (fieldId: string) => {
    const newHidden = new Set(hiddenFields);
    if (newHidden.has(fieldId)) {
      newHidden.delete(fieldId);
    } else {
      newHidden.add(fieldId);
    }
    setHiddenFields(newHidden);
  };

  // Calculate counts for sidebar
  const submissionsCount = filteredSubmissions.length;
  const inProgressCount = submissions.filter(s => s.status === 'In Progress' || s.status === 'in_progress').length;

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-60 bg-white border-r flex flex-col">
        <div className="flex-1 p-3 space-y-1">
          {/* Submissions */}
          <button
            onClick={() => setActiveView('submissions')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'submissions'
                ? "bg-amber-50 text-amber-900"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-2">
              <FileStack className="w-4 h-4 text-amber-600" />
              <span>Submissions</span>
            </div>
            <span className="text-xs text-gray-500">{submissionsCount}</span>
          </button>

          {/* In progress */}
          <button
            onClick={() => setActiveView('in-progress')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'in-progress'
                ? "bg-amber-50 text-amber-900"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>In progress</span>
            </div>
            <span className="text-xs text-gray-500">{inProgressCount}</span>
          </button>

          {/* Summary */}
          <button
            onClick={() => setActiveView('summary')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'summary'
                ? "bg-amber-50 text-amber-900"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-gray-600" />
              <span>Summary</span>
            </div>
          </button>

          {/* Analytics */}
          <button
            onClick={() => setActiveView('analytics')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'analytics'
                ? "bg-amber-50 text-amber-900"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>Analytics</span>
            </div>
          </button>
        </div>

        {/* Link to database button */}
        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-sm"
            onClick={() => toast.info('Link to database coming soon')}
          >
            <Database className="w-4 h-4 mr-2 text-green-600" />
            Link to database
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with title and toolbar */}
        <div className="bg-white border-b">
          {/* Title row */}
          <div className="px-6 py-3 border-b">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">
                {activeView === 'submissions' && 'Submissions'}
                {activeView === 'in-progress' && 'In progress'}
                {activeView === 'summary' && 'Summary'}
                {activeView === 'analytics' && 'Analytics'}
              </h1>
              {workspaceSlug && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = `/workspace/${workspaceSlug}/portal-editor?formId=${formId}`}
                  className="h-8 text-xs"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Edit Form
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar row */}
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Delete button - shown when rows are selected */}
                {selectedRows.size > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-9"
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''}
                  </Button>
                )}

                {/* Sort */}
                <Button variant="outline" size="sm" className="h-9">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Sort
                </Button>

                {/* Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
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

                {/* Hide fields */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide fields
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-500 mb-2">Toggle column visibility</div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {((form as any)?.fields || [])
                          .filter((field: any) => {
                            // Exclude layout-only fields and file uploads from visibility toggle
                            if (field.field_type === 'file_upload' || field.field_type === 'document') return false;
                            return !isLayoutField(field);
                          })
                          .map((field: any) => (
                          <label key={field.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={!hiddenFields.has(field.id)}
                              onChange={() => handleToggleFieldVisibility(field.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-10 w-64"
                  />
                </div>

                {/* All time filter */}
                <Button variant="outline" size="sm" className="h-9">
                  <Clock className="w-4 h-4 mr-2" />
                  All time
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>

                {/* Download */}
                <Button variant="ghost" size="sm" onClick={handleExportCSV} className="h-9 w-9 p-0">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 relative overflow-hidden bg-white">
        {/* Submissions Table - Full Width */}
        <div className="absolute inset-0 p-6 overflow-auto">
          <SubmissionTable
            submissions={filteredSubmissions}
            selectedId={selectedSubmission?.id}
            onSelect={setSelectedSubmission}
            isLoading={isLoading}
            searchQuery={searchQuery}
            selectedRows={selectedRows}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
            fields={(form as any)?.fields || []}
            hiddenFields={hiddenFields}
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
  </div>
  );
}