'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ViewToolbar } from './ViewToolbar';
import { GridView } from './GridView';
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { ViewType, Submission, FormField, FilterConfig } from './types';
import { reviewExportClient } from '@/lib/api/review-export-client';
import { formsClient } from '@/lib/api/forms-client';
import { goClient } from '@/lib/api/go-client';

interface ViewContainerProps {
  workspaceId: string;
  formId: string;
  onSubmissionClick: (submission: Submission) => void;
}

export function ViewContainer({
  workspaceId,
  formId,
  onSubmissionClick,
}: ViewContainerProps) {
  // View state
  const [currentView, setCurrentView] = useState<ViewType>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('submittedDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);

  // Load data
  useEffect(() => {
    loadData();
  }, [workspaceId, formId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Loading review workspace data from Go backend')

      // Load form and submissions in parallel through the Go backend
      const [formData, submissionsData] = await Promise.all([
        formsClient.get(formId),
        formsClient.getSubmissions(formId),
      ]);
      const submissionsArray = Array.isArray(submissionsData) ? submissionsData : [];

      console.log('✅ Loaded form and submissions:', {
        formName: formData?.name,
        formId: formData?.id,
        fieldsCount: (((formData as any)?.fields) || []).length,
        submissionsCount: submissionsArray.length
      });

      if (!formData) {
        toast.error('Form not found');
        setIsLoading(false);
        return;
      }

      // Extract fields from form
      const formFields = ((formData as any)?.fields) || [];
      
      const transformedFields: FormField[] = formFields.map((field: any) => ({
        id: field.id,
        field_key: field.field_key || field.name,
        field_type: field.field_type || field.type,
        label: field.label || field.name,
        placeholder: field.placeholder,
        required: field.required,
        options: field.options,
        validation: field.validation,
      }));

      setFields(transformedFields);

      // Transform submissions
      const transformedSubmissions: Submission[] = (
        submissionsArray as any[]
      ).map((sub: any) => {
        const rawData = sub.data || sub.raw_data || {};

        // Use applicant info from query (already extracted from ba_user)
        let name = sub.applicant_name || '';
        let email = sub.applicant_email || '';
        let firstName = '';
        let lastName = '';

        if (name) {
          const nameParts = name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }

        // Fallback to form data if not provided by query
        if (!name) {
          firstName =
            rawData.first_name || rawData.firstName || rawData.fname || '';
          lastName = rawData.last_name || rawData.lastName || rawData.lname || '';
          name = `${firstName} ${lastName}`.trim() || rawData.name || '';
        }
        if (!email) {
          email = rawData.email || rawData.Email || '';
        }
        if (!name) {
          name = email || 'Unknown User';
        }

        const status = sub.status || 'draft';

        return {
          id: sub.id,
          firstName,
          lastName,
          name,
          email,
          phone: rawData?.phone || rawData?.Phone || '',
          status,
          submittedDate: sub.submitted_at || sub.created_at,
          raw_data: rawData,
          reviewedCount: 0,
          totalReviewers: 1,
          applicant_name: name,
          applicant_email: email,
          form_name: formData.name || 'Unknown Form',
          submitted_at: sub.submitted_at || sub.created_at,
          documents: rawData.documents || [],
          applicant_id: sub.ba_user?.id,
        };
      });

      console.log('✅ Transformed submissions:', {
        total: transformedSubmissions.length,
        firstHasData: transformedSubmissions[0] ? Object.keys(transformedSubmissions[0].raw_data).length > 0 : false,
        dataKeyCount: transformedSubmissions[0] ? Object.keys(transformedSubmissions[0].raw_data).length : 0
      });

      setSubmissions(transformedSubmissions);
    } catch (error: any) {
      console.error('❌ Failed to load review workspace data:', {
        message: error.message,
        stack: error.stack,
        error,
      });
      toast.error(`Failed to load submissions: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    let result = [...submissions];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (sub) =>
          sub.name?.toLowerCase().includes(query) ||
          sub.email?.toLowerCase().includes(query) ||
          sub.phone?.toLowerCase().includes(query) ||
          Object.values(sub.raw_data || {}).some((val) =>
            String(val).toLowerCase().includes(query)
          )
      );
    }

    // Apply custom filters
    filters.forEach((filter) => {
      result = result.filter((sub) => {
        const value = sub.raw_data?.[filter.field];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'startsWith':
            return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          case 'endsWith':
            return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
          case 'gt':
            return Number(value) > Number(filter.value);
          case 'lt':
            return Number(value) < Number(filter.value);
          default:
            return true;
        }
      });
    });

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      // Get values based on sort field
      switch (sortBy) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'submittedDate':
          aVal = new Date(a.submittedDate).getTime();
          bVal = new Date(b.submittedDate).getTime();
          break;
        default:
          aVal = a.raw_data?.[sortBy] || '';
          bVal = b.raw_data?.[sortBy] || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [submissions, searchQuery, filters, sortBy, sortDirection]);

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortBy(field);
    setSortDirection(direction);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const handleToggleField = (fieldKey: string) => {
    const newHidden = new Set(hiddenFields);
    if (newHidden.has(fieldKey)) {
      newHidden.delete(fieldKey);
    } else {
      newHidden.add(fieldKey);
    }
    setHiddenFields(newHidden);
  };

  const handleExport = async () => {
    try {
      // Use new review export API with comprehensive data
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `review-export-${formId}-${timestamp}.csv`;

      await reviewExportClient.downloadCSV(
        {
          workspace_id: workspaceId,
          form_id: formId,
        },
        filename
      );

      toast.success('Successfully exported to CSV');
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Export failed: ${errorMessage}`);
    }
  };

  const handleStatusChange = async (submissionId: string, newStatus: string) => {
    try {
      // Update via API
      await goClient.patch(`/forms/${formId}/submissions/${submissionId}`, {
        status: newStatus,
      });

      // Update local state
      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === submissionId ? { ...sub, status: newStatus } : sub
        )
      );

      toast.success('Status updated');
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ViewToolbar
        currentView={currentView}
        onViewChange={setCurrentView}
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        fields={fields}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        hiddenFields={hiddenFields}
        onToggleField={handleToggleField}
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
        selectedCount={selectedRows.size}
      />

      {currentView === 'grid' && (
        <GridView
          submissions={filteredAndSortedSubmissions}
          fields={fields}
          hiddenFields={hiddenFields}
          onSubmissionClick={onSubmissionClick}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}

      {currentView === 'kanban' && (
        <KanbanView
          submissions={filteredAndSortedSubmissions}
          onSubmissionClick={onSubmissionClick}
          onStatusChange={handleStatusChange}
        />
      )}

      {currentView === 'calendar' && (
        <CalendarView
          submissions={filteredAndSortedSubmissions}
          onSubmissionClick={onSubmissionClick}
        />
      )}

      {currentView === 'gallery' && (
        <GalleryView
          submissions={filteredAndSortedSubmissions}
          fields={fields}
          hiddenFields={hiddenFields}
          onSubmissionClick={onSubmissionClick}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
        />
      )}
    </div>
  );
}
