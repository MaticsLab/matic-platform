'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ViewToolbar } from './ViewToolbar';
import { GridView } from './GridView';
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { ViewType, Submission, FormField, FilterConfig } from './types';
import { goClient } from '@/lib/api/go-client';
import { reviewExportClient } from '@/lib/api/review-export-client';

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
      // Load form and submissions in parallel
      const [formData, submissionsData] = await Promise.all([
        goClient.get(`/forms/${formId}`), // V1: Handles both legacy and new schema
        goClient.get(
          `/forms/${formId}/submissions?workspace_id=${workspaceId}&include_user=true`
        ),
      ]);

      console.log('🔍 API Response - Form Data:', formData);
      console.log('🔍 Form ID used in query:', formId);
      console.log('🔍 Actual Form ID from response:', (formData as any)?.id);
      console.log('🔍 API Response - Submissions Data:', submissionsData);
      console.log('🔍 Submissions count:', (submissionsData as any[])?.length || 0);
      console.log('🔍 First submission FULL:', JSON.stringify((submissionsData as any[])?.[0], null, 2));
      console.log('🔍 First submission raw structure:', (submissionsData as any[])?.[0]);

      // Extract fields from form
      const formFields = (formData as any).fields || [];
      console.log('🔍 Form fields extracted:', formFields.slice(0, 3));
      
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
        (submissionsData as any[]) || []
      ).map((sub: any, index: number) => {
        // Backend returns 'Data' (capital D) from form_submissions.raw_data
        const dataField = sub.Data || sub.data || {};
        const rawData =
          typeof dataField === 'string' ? JSON.parse(dataField) : dataField || {};
        
        // Enhanced debug for first submission
        if (index === 0) {
          console.log('🔴 CRITICAL DEBUG - First Submission:');
          console.log('  sub.Data exists?', !!sub.Data);
          console.log('  sub.Data type:', typeof sub.Data);
          console.log('  sub.Data keys:', sub.Data ? Object.keys(sub.Data).length : 0);
          console.log('  sub.data exists?', !!sub.data);
          console.log('  dataField:', dataField);
          console.log('  rawData keys:', Object.keys(rawData));
          console.log('  rawData sample:', Object.fromEntries(Object.entries(rawData).slice(0, 5)));
        }

        // Debug: Log the first submission to see data structure
        if (sub === (submissionsData as any[])[0]) {
          console.log('🔍 First submission structure:', {
            id: sub.id,
            hasData: !!sub.Data,
            hasdata: !!sub.data,
            dataFieldType: typeof dataField,
            isEmptyObject: Object.keys(rawData).length === 0,
            dataFieldKeys: Object.keys(rawData).slice(0, 10),
            dataFieldSample: Object.fromEntries(Object.entries(rawData).slice(0, 3)),
            fullDataFieldSample: dataField  // Show full structure for first one
          });
        }

        let firstName = '';
        let lastName = '';
        let name = '';
        let email = '';

        // Get user info from ba_user
        if (sub.ba_user?.name) {
          name = sub.ba_user.name;
          const nameParts = name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }
        if (sub.ba_user?.email) {
          email = sub.ba_user.email;
        }

        // Fallback to form data
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

        const metadataField = sub.metadata || sub.Metadata || {};
        const metadata =
          typeof metadataField === 'string'
            ? JSON.parse(metadataField)
            : metadataField || {};
        const status = sub.status || metadata.status || 'Submitted';

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
          form_name: (formData as any).name || 'Unknown Form',
          submitted_at: sub.submitted_at || sub.created_at,
          documents: rawData.documents || [],
        };
      });

      console.log('🔍 First transformed submission:', transformedSubmissions[0]);
      console.log('🔍 First submission raw_data keys:', transformedSubmissions[0] ? Object.keys(transformedSubmissions[0].raw_data).slice(0, 10) : []);
      console.log('🔍 Form fields:', transformedFields.slice(0, 5).map(f => ({ 
        id: f.id, 
        field_key: f.field_key,
        label: f.label 
      })));
      
      // Create a comparison to see all possible key matching scenarios
      if (transformedSubmissions[0] && transformedFields.length > 0) {
        const firstSub = transformedSubmissions[0];
        const dataKeys = Object.keys(firstSub.raw_data);
        
        console.log('🔍 FIELD MATCHING ANALYSIS:');
        console.log('Data keys in submission:', dataKeys.slice(0, 10));
        
        // Test first 5 fields to see what matches
        const matchTest = transformedFields.slice(0, 5).map(f => ({
          label: f.label,
          field_id: f.id,
          field_key: f.field_key,
          id_matches: dataKeys.includes(f.id),
          key_matches: dataKeys.includes(f.field_key),
          label_matches: dataKeys.includes(f.label),
          value_by_id: firstSub.raw_data[f.id],
          value_by_key: firstSub.raw_data[f.field_key],
          value_by_label: firstSub.raw_data[f.label]
        }));
        console.table(matchTest);
      }

      setSubmissions(transformedSubmissions);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load submissions');
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
