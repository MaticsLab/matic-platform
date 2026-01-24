
'use client';
import { UNKNOWN } from '@/constants/fallbacks';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { goClient } from '@/lib/api/go-client';
import { workflowsClient, ReviewWorkflow, ApplicationStage, Rubric } from '@/lib/api/workflows-client';
import { Form, FormSubmission } from '@/types/forms';
import { useApplicationsRealtime, RealtimeApplication } from '@/hooks/useApplicationsRealtime';
import { 
  Application, 
  ApplicationStatus, 
  Stage, 
  Reviewer, 
  ReviewersMap,
  ActivityItem 
} from './types';
import { Header } from './Header';
import { PipelineHeader } from './PipelineHeader';
import { ApplicationList } from './ApplicationList';
import { ApplicationDetail } from './ApplicationDetail';
import { PipelineActivityPanel } from './PipelineActivityPanel';
import { ReviewPanel } from './ReviewPanel';
import { cn } from '@/lib/utils';

interface ReviewWorkspaceV2Props {
  workspaceId: string;
  formId: string | null;
  onBack?: () => void;
  onViewChange?: (view: 'review' | 'workflows' | 'analytics' | 'team' | 'portal' | 'share') => void;
}

export function ReviewWorkspaceV2({ 
  workspaceId, 
  formId, 
  onBack,
  onViewChange 
}: ReviewWorkspaceV2Props) {
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [workflows, setWorkflows] = useState<ReviewWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReviewWorkflow | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviewersMap, setReviewersMap] = useState<ReviewersMap>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  
  // Refs to prevent infinite loops
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
  // UI state
  const [activeView, setActiveView] = useState<'review' | 'workflows' | 'analytics' | 'team' | 'portal' | 'share'>('review');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showPipelineActivity, setShowPipelineActivity] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [committee, setCommittee] = useState('reading committee');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'score' | 'name'>('recent');
  
  // Infinite scroll state
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const currentOffsetRef = useRef(100); // Start at 100 since we load 100 initially

  // Transform submission to Application format
  const mapSubmissionToApplication = useCallback((sub: FormSubmission, stagesData: Stage[], revMap: ReviewersMap): Application => {
    // OPTIMIZATION: Cache parsed data/metadata to avoid re-parsing
    // Most submissions already have parsed objects, only parse if string
    const data = typeof sub.data === 'string' 
      ? (() => {
          try { return JSON.parse(sub.data) } 
          catch { return {} }
        })()
      : (sub.data || {});
    const metadata = typeof sub.metadata === 'string'
      ? (() => {
          try { return JSON.parse(sub.metadata) }
          catch { return {} }
        })()
      : (sub.metadata || {});
    
    // Use the full_name from portal_applicants table (from portal signup)
    // This is the primary source of truth for applicant names
    const fullName = sub.applicant_full_name || UNKNOWN;
    const nameParts = fullName.trim().split(/\s+/);
    const fName = nameParts[0] || UNKNOWN;
    const lName = nameParts.slice(1).join(' ') || '';
    
    // Get email - check multiple locations
    let email = data._applicant_email || '';
    if (!email) {
      // Helper function to find email
      const findEmail = (keys: string[]): string => {
        for (const key of keys) {
          if (data[key] && typeof data[key] === 'string') return data[key];
        }
        return '';
      };
      email = findEmail(['email', 'Email', 'personal_email', 'personalEmail', 'applicant_email']);
      // Also check nested personal object
      if (!email && data.personal && typeof data.personal === 'object') {
        email = (data.personal as any).personalEmail || (data.personal as any).email || '';
      }
    }
    
    // Get stage info
    const stageId = metadata.current_stage_id || (stagesData.length > 0 ? stagesData[0].id : '');
    const stage = stagesData.find(s => s.id === stageId);
    
    // Get review history and count
    const reviewHistory = Array.isArray(metadata.review_history) ? metadata.review_history : [];
    const reviewCount = reviewHistory.length;
    const requiredReviews = metadata.required_reviews || 2;
    
    // Get score
    const score = metadata.total_score ?? metadata.score ?? null;
    
    // Get assigned reviewers - check both revMap and submission's own reviewer_info
    const assignedReviewerIds = metadata.assigned_reviewers || [];
    const submissionReviewerInfo = metadata.reviewer_info || {};
    const assignedTo = assignedReviewerIds.map((id: string) => {
      // Try revMap first, then submission's reviewer_info, then fallback
      return revMap[id]?.name || submissionReviewerInfo[id]?.name || 'Reviewer';
    });
    
    // Determine priority based on score or flags
    let priority: 'high' | 'medium' | 'low' | undefined;
    if (metadata.flagged) priority = 'high';
    else if (score && score >= 8) priority = 'high';
    else if (score && score >= 5) priority = 'medium';
    else if (score) priority = 'low';
    
    // Calculate relative time for last activity
    const submittedDate = new Date(sub.submitted_at);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60));
    let lastActivity = 'Just now';
    if (diffHours > 24 * 30) lastActivity = `${Math.floor(diffHours / (24 * 30))} months ago`;
    else if (diffHours > 24) lastActivity = `${Math.floor(diffHours / 24)} days ago`;
    else if (diffHours > 0) lastActivity = `${diffHours} hours ago`;
    
    return {
      id: sub.id,
      firstName: fName,
      lastName: lName,
      name: fullName,
      email,
      dateOfBirth: data.date_of_birth || data.dob || data['Date of Birth'],
      gender: data.gender || data.Gender,
      status: metadata.status || stage?.name || 'Submitted',
      submittedDate: sub.submitted_at,
      reviewedCount: reviewCount,
      totalReviewers: requiredReviews,
      avatar: (fName?.[0] || '?').toUpperCase(),
      priority,
      score,
      maxScore: metadata.max_score || 100,
      assignedTo,
      assignedReviewerIds,
      tags: metadata.tags || [],
      lastActivity,
      stageId,
      stageName: stage?.name || metadata.status || 'Submitted',
      raw_data: data,
      scores: metadata.scores || {},
      comments: metadata.comments || '',
      flagged: metadata.flagged || false,
      workflowId: selectedWorkflow?.id,
      reviewHistory: reviewHistory.map((rh: any) => ({
        id: rh.id,
        reviewer_id: rh.reviewer_id || '',
        reviewer_name: rh.reviewer_name || revMap[rh.reviewer_id]?.name || 'Reviewer',
        reviewer_type_id: rh.reviewer_type_id,
        stage_id: rh.stage_id,
        scores: rh.scores || {},
        total_score: rh.total_score || 0,
        notes: rh.notes,
        comments: rh.comments,
        reviewed_at: rh.submitted_at || rh.reviewed_at
      })),
      stageHistory: metadata.stage_history || [],
    };
  }, [form, selectedWorkflow]);

  // Load data - optimized with progressive loading
  const loadData = useCallback(async () => {
    if (!formId || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    
    try {
      // OPTIMIZATION: Fetch submissions FIRST (most important data) to show list immediately
      // Then fetch other data in parallel without blocking
      const submissionsPromise = goClient.get<FormSubmission[]>(`/forms/${formId}/submissions?limit=25&offset=0`);
      
      // Fetch form, workflows, and rubrics in parallel (but don't wait for them)
      const formPromise = goClient.get<Form>(`/forms/${formId}`);
      const workflowsPromise = workflowsClient.listWorkflows(workspaceId, formId || undefined);
      const rubricsPromise = workflowsClient.listRubrics(workspaceId).catch(() => []);
      
      // Wait for submissions first (critical path)
      const submissions = await submissionsPromise;
      
      // Set empty reviewers map initially (will be populated later)
      setReviewersMap({});
      
      // OPTIMIZATION: Set loading to false IMMEDIATELY after getting submissions
      // This shows the list right away, even if it's empty initially
      setIsLoading(false);
      isLoadingRef.current = false;
      
      // Process and show submissions immediately (even without full metadata)
      if (submissions.length > 0) {
        // Use minimal stages data for initial render
        const minimalStages: Stage[] = [];
        const minimalRevMap: ReviewersMap = {};
        
        // Process submissions with minimal data
        const processSubmissions = () => {
          const apps = submissions.map(sub => mapSubmissionToApplication(sub, minimalStages, minimalRevMap));
          setApplications(apps);
        };
        
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processSubmissions, { timeout: 50 });
        } else {
          setTimeout(processSubmissions, 0);
        }
      } else {
        setApplications([]);
      }
      
      // Now fetch and process the rest of the data in the background
      const [loadedForm, workflowsData, rubricsData] = await Promise.all([
        formPromise,
        workflowsPromise,
        rubricsPromise
      ]);
      
      setForm(loadedForm);
      setWorkflows(workflowsData);
      setRubrics(rubricsData || []);
      
      // Build reviewers map from form settings
      const formReviewers = (loadedForm.settings as any)?.reviewers || [];
      let revMap: ReviewersMap = {};
      formReviewers.forEach((r: any) => {
        if (r.id && !r.removed && r.status !== 'removed') {
          revMap[r.id] = { name: r.name || UNKNOWN, email: r.email, role: r.role };
        }
      });
      
      // Fetch stages if workflows exist
      let stagesData: Stage[] = [];
      if (workflowsData.length > 0) {
        const wf = workflowsData[0];
        setSelectedWorkflow(wf);
        
        const stagesList = await workflowsClient.listStages(workspaceId, wf.id);
        stagesData = stagesList.map((s: ApplicationStage) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          order: s.order_index
        }));
        setStages(stagesData);
      }
      
      // Build reviewers map from submission metadata (in background, don't block)
      const processedReviewerIds = new Set<string>();
      (submissions || []).slice(0, 10).forEach((sub: FormSubmission) => {
        const metadata = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : (sub.metadata || {});
        
        const reviewerInfo = metadata.reviewer_info || {};
        Object.entries(reviewerInfo).forEach(([reviewerId, info]: [string, any]) => {
          if (reviewerId && !revMap[reviewerId] && !processedReviewerIds.has(reviewerId)) {
            revMap[reviewerId] = {
              name: info?.name || 'Reviewer',
              email: info?.email,
              role: info?.role
            };
            processedReviewerIds.add(reviewerId);
          }
        });
        
        const reviewHistory = Array.isArray(metadata.review_history) ? metadata.review_history : [];
        reviewHistory.forEach((rh: any) => {
          if (rh.reviewer_id && rh.reviewer_name && !revMap[rh.reviewer_id] && !processedReviewerIds.has(rh.reviewer_id)) {
            revMap[rh.reviewer_id] = { 
              name: rh.reviewer_name, 
              role: rh.reviewer_role || undefined 
            };
            processedReviewerIds.add(rh.reviewer_id);
          }
        });
        
        const reviewerAssignments = metadata.reviewer_assignments || {};
        Object.entries(reviewerAssignments).forEach(([reviewerId, info]: [string, any]) => {
          if (reviewerId && !revMap[reviewerId] && !processedReviewerIds.has(reviewerId)) {
            revMap[reviewerId] = {
              name: info?.name || info?.reviewer_name || `Reviewer`,
              email: info?.email,
              role: info?.role
            };
            processedReviewerIds.add(reviewerId);
          }
        });
      });
      
      setReviewersMap(revMap);
      
      // Re-process submissions with complete data (stages and reviewers) in background
      if (submissions.length > 0) {
        const processWithCompleteData = () => {
          const apps = submissions.map(sub => mapSubmissionToApplication(sub, stagesData, revMap));
          setApplications(apps);
        };
        
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processWithCompleteData, { timeout: 100 });
        } else {
          setTimeout(processWithCompleteData, 0);
        }
      }
      
      // Update pagination state
      setHasMore(submissions.length === 25); // If we got 25, there might be more
      currentOffsetRef.current = 25;
      
      // OPTIMIZATION: Defer activity building - only build when needed (lazy loading)
      // Activities are expensive to compute and not needed for initial render
      // They'll be built on-demand when the activity panel is opened
      setActivities([]);
      hasLoadedRef.current = true;
      
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load applications');
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [formId, workspaceId, mapSubmissionToApplication]);

  // Load more applications for infinite scroll
  const loadMoreApplications = useCallback(async () => {
    if (!formId || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const offset = currentOffsetRef.current;
      const submissions = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions?limit=100&offset=${offset}`);
      
      if (submissions.length === 0) {
        setHasMore(false);
        return;
      }
      
      // Get current stages and reviewers map
      const stagesData = stages;
      const revMap = reviewersMap;
      
      // Map new submissions to application format
      const newApps = submissions.map(sub => mapSubmissionToApplication(sub, stagesData, revMap));
      
      // Append to existing applications
      setApplications(prev => [...prev, ...newApps]);
      
      // Update pagination state
      setHasMore(submissions.length === 100);
      currentOffsetRef.current = offset + submissions.length;
    } catch (error) {
      console.error('Failed to load more applications:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [formId, stages, reviewersMap, mapSubmissionToApplication, isLoadingMore, hasMore]);

  // Initial load - only run once when formId changes
  useEffect(() => {
    if (formId && !hasLoadedRef.current) {
      loadData();
    }
    
    // Reset on formId change
    return () => {
      hasLoadedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  // Setup realtime subscription
  const handleRealtimeInsert = useCallback((app: RealtimeApplication) => {
    const data = typeof app.data === 'string' ? JSON.parse(app.data) : (app.data || {});
    const metadata = typeof app.metadata === 'string' ? JSON.parse(app.metadata) : (app.metadata || {});
    
    const newApp = mapSubmissionToApplication({
      id: app.id,
      form_id: formId || '',
      data,
      metadata,
      status: metadata.status || 'pending',
      submitted_at: app.submitted_at || new Date().toISOString(),
      created_at: app.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as FormSubmission, stages, reviewersMap);
    
    setApplications(prev => [newApp, ...prev]);
    toast.success(`New application from ${newApp.name || `${newApp.firstName} ${newApp.lastName}`.trim()}`);
  }, [formId, stages, reviewersMap, mapSubmissionToApplication]);

  const handleRealtimeUpdate = useCallback((app: RealtimeApplication) => {
    const data = typeof app.data === 'string' ? JSON.parse(app.data) : (app.data || {});
    const metadata = typeof app.metadata === 'string' ? JSON.parse(app.metadata) : (app.metadata || {});
    
    const updatedApp = mapSubmissionToApplication({
      id: app.id,
      form_id: formId || '',
      data,
      metadata,
      status: metadata.status || 'pending',
      submitted_at: app.submitted_at || new Date().toISOString(),
      created_at: app.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as FormSubmission, stages, reviewersMap);
    
    setApplications(prev => prev.map(a => a.id === app.id ? updatedApp : a));
    
    // Update selected app if it's the same
    if (selectedApp?.id === app.id) {
      setSelectedApp(updatedApp);
    }
  }, [formId, stages, reviewersMap, selectedApp, mapSubmissionToApplication]);

  const handleRealtimeDelete = useCallback((id: string) => {
    setApplications(prev => prev.filter(a => a.id !== id));
    if (selectedApp?.id === id) {
      setSelectedApp(null);
    }
  }, [selectedApp]);

  useApplicationsRealtime({
    formId,
    workspaceId,
    enabled: !!formId,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete
  });

  // Filter applications
  const filteredApplications = useMemo(() => {
    let result = applications;
    
    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(app => 
        app.status === filterStatus || 
        app.stageName === filterStatus
      );
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(app =>
        (app.name || `${app.firstName} ${app.lastName}`.trim()).toLowerCase().includes(query) ||
        app.email.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime();
        case 'oldest':
          return new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime();
        case 'score':
          return (b.score || 0) - (a.score || 0);
        case 'name':
          return (a.name || `${a.firstName} ${a.lastName}`.trim()).localeCompare(b.name || `${b.firstName} ${b.lastName}`.trim());
        default:
          return 0;
      }
    });
    
    return result;
  }, [applications, filterStatus, searchQuery, sortBy]);

  // Download CSV handler
  const handleDownloadCSV = useCallback((appsToDownload: Application[]) => {
    if (appsToDownload.length === 0) {
      toast.error('No applications to download');
      return;
    }

    // Collect all unique field keys from raw_data across all applications
    const allFieldKeys = new Set<string>();
    appsToDownload.forEach(app => {
      if (app.raw_data) {
        Object.keys(app.raw_data).forEach(key => {
          // Skip internal fields that start with underscore
          if (!key.startsWith('_')) {
            allFieldKeys.add(key);
          }
        });
      }
    });

    // Build CSV headers
    const baseHeaders = [
      'ID',
      'First Name',
      'Last Name',
      'Full Name',
      'Email',
      'Phone',
      'Date of Birth',
      'Gender',
      'Status',
      'Stage',
      'Submitted Date',
      'Score',
      'Max Score',
      'Reviewed Count',
      'Total Reviewers',
      'Assigned Reviewers',
      'Tags',
      'Flagged',
      'Priority',
      'Last Activity'
    ];
    
    // Add dynamic form field headers
    const formFieldHeaders = Array.from(allFieldKeys).sort();
    const headers = [...baseHeaders, ...formFieldHeaders];

    // Build CSV rows
    const rows = appsToDownload.map(app => {
      // Map reviewer IDs to names using reviewersMap
      const reviewerNames = (app.assignedReviewerIds || [])
        .map(id => reviewersMap[id]?.name || id) // Use name from map, fallback to ID
        .filter(Boolean)
        .join('; ');
      
      const row: string[] = [
        app.id || '',
        app.firstName || '',
        app.lastName || '',
        app.name || `${app.firstName} ${app.lastName}`.trim() || '',
        app.email || '',
        app.phone || '',
        app.dateOfBirth || '',
        app.gender || '',
        app.status || '',
        app.stageName || '',
        app.submittedDate || '',
        app.score?.toString() || '',
        app.maxScore?.toString() || '',
        app.reviewedCount?.toString() || '',
        app.totalReviewers?.toString() || '',
        reviewerNames,
        app.tags?.join('; ') || '',
        app.flagged ? 'Yes' : 'No',
        app.priority || '',
        app.lastActivity || ''
      ];

      // Add form field values in the same order as headers
      formFieldHeaders.forEach(key => {
        const value = app.raw_data?.[key];
        // Handle different value types
        let cellValue = '';
        if (value === null || value === undefined) {
          cellValue = '';
        } else if (typeof value === 'object') {
          cellValue = JSON.stringify(value);
        } else if (Array.isArray(value)) {
          cellValue = value.join('; ');
        } else {
          cellValue = String(value);
        }
        row.push(cellValue);
      });

      return row;
    });

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Convert to CSV string
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `applications_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${appsToDownload.length} application(s)`);
  }, []);

  // Handle status change
  const handleStatusChange = useCallback(async (appId: string, newStatus: ApplicationStatus) => {
    try {
      // Find the stage ID for this status
      const stage = stages.find(s => s.name === newStatus);
      
      // Update via API
      await goClient.patch(`/forms/${formId}/submissions/${appId}`, {
        metadata: {
          status: newStatus,
          current_stage_id: stage?.id
        }
      });
      
      // Update local state
      setApplications(prev => prev.map(app => 
        app.id === appId 
          ? { ...app, status: newStatus, stageName: newStatus, stageId: stage?.id, lastActivity: 'Just now' }
          : app
      ));
      
      if (selectedApp?.id === appId) {
        setSelectedApp(prev => prev ? { 
          ...prev, 
          status: newStatus, 
          stageName: newStatus,
          stageId: stage?.id,
          lastActivity: 'Just now' 
        } : null);
      }
      
      // Add activity
      setActivities(prev => [{
        id: `status-${appId}-${Date.now()}`,
        type: 'status',
        message: `Application moved to ${newStatus}`,
        user: 'You',
        time: 'Just now',
        applicationId: appId
      }, ...prev]);
      
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update application status');
    }
  }, [formId, stages, selectedApp]);

  // Handle view change
  const handleViewChange = useCallback((view: 'review' | 'workflows' | 'analytics' | 'team' | 'portal' | 'share') => {
    setActiveView(view);
    onViewChange?.(view);
  }, [onViewChange]);

  // Handle workflow change
  const handleWorkflowChange = useCallback(async (workflowId: string) => {
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf) return;
    
    setSelectedWorkflow(wf);
    
    try {
      const stagesList = await workflowsClient.listStages(workspaceId, workflowId);
      const stagesData = stagesList.map((s: ApplicationStage) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        order: s.order_index
      }));
      setStages(stagesData);
    } catch (error) {
      console.error('Failed to load stages:', error);
    }
  }, [workflows, workspaceId]);

  return (
    <div className="bg-gray-50 flex flex-col h-full">
      <div className={cn(
        "flex-1 min-h-0 overflow-hidden",
        (selectedApp || showPipelineActivity) ? "flex" : ""
      )}>
        <div className={cn(
          "h-full overflow-hidden flex flex-col",
          (selectedApp || showPipelineActivity) ? "hidden md:flex md:w-[400px] lg:w-[480px] flex-shrink-0" : "w-full"
        )}>
          {/* Pipeline Header - only on left side */}
          <PipelineHeader 
            activeTab="Queue"
            onTabChange={() => {}}
            applications={applications}
            stages={stages}
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            committee={committee}
            onCommitteeChange={setCommittee}
            onOpenPipelineActivity={() => setShowPipelineActivity(true)}
            workflows={workflows.map(w => ({ id: w.id, name: w.name }))}
            selectedWorkflowId={selectedWorkflow?.id}
            onWorkflowChange={handleWorkflowChange}
            onDownload={() => handleDownloadCSV(filteredApplications)}
          />
          
          <div className="flex-1 overflow-y-auto">
            <ApplicationList 
              applications={filteredApplications}
              selectedId={selectedApp?.id}
              onSelect={setSelectedApp}
              isLoading={isLoading}
              sortBy={sortBy}
              onSortChange={setSortBy}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              stages={stages}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMoreApplications}
            />
          </div>
        </div>
        
        {selectedApp && !showPipelineActivity && !isReviewMode && (
          <div className="flex-1 min-h-0 h-full overflow-hidden bg-white flex flex-col">
            <ApplicationDetail 
              application={selectedApp}
              stages={stages}
              reviewersMap={reviewersMap}
              onStatusChange={handleStatusChange}
              onClose={() => setSelectedApp(null)}
              onStartReview={(appId) => {
                setIsReviewMode(true);
              }}
              onDelete={async (appId) => {
                try {
                  await goClient.delete(`/forms/${formId}/submissions/${appId}`);
                  setApplications(prev => prev.filter(a => a.id !== appId));
                  setSelectedApp(null);
                  toast.success('Application deleted');
                } catch (error) {
                  toast.error('Failed to delete application');
                }
              }}
              workspaceId={workspaceId || undefined}
              formId={formId || undefined}
              fields={form?.fields || []}
            />
          </div>
        )}
        
        {showPipelineActivity && (
          <div className="flex-1 min-h-0 h-full overflow-hidden bg-white flex flex-col">
            <PipelineActivityPanel 
              applications={applications}
              activities={activities}
              onClose={() => setShowPipelineActivity(false)}
              workspaceId={workspaceId || undefined}
              formId={formId || undefined}
              fields={form?.fields?.map(f => ({ id: f.id, name: f.name, label: f.label })) || []}
              onSendEmail={(to, subject, body, options) => {
                // Email already sent by PipelineActivityPanel - just log activity
                setActivities(prev => [{
                  id: `email-${Date.now()}`,
                  type: 'email',
                  message: `Email sent: "${subject}" to ${options?.submissionIds?.length || 1} recipient(s)`,
                  user: 'You',
                  time: 'Just now',
                  applicationId: null
                }, ...prev]);
              }}
              onAddComment={(comment) => {
                setActivities(prev => [{
                  id: `comment-${Date.now()}`,
                  type: 'comment',
                  message: comment,
                  user: 'You',
                  time: 'Just now',
                  applicationId: null
                }, ...prev]);
              }}
            />
          </div>
        )}
        
        {selectedApp && isReviewMode && (
          <div className="flex-1 min-h-0 h-full overflow-hidden bg-white flex flex-col">
            <ReviewPanel
              application={selectedApp}
              form={form}
              rubrics={rubrics}
              stages={stages}
              workspaceId={workspaceId}
              formId={formId || ''}
              onClose={() => setIsReviewMode(false)}
              onSaveReview={async (scores: Record<string, number>, comments: string, decision?: string) => {
                try {
                  // Save the review to the backend
                  await goClient.patch(`/forms/${formId}/submissions/${selectedApp.id}/review-data`, {
                    review_scores: scores,
                    review_comments: comments,
                    decision: decision
                  });
                  
                  // Update local state
                  setApplications(prev => prev.map(app => {
                    if (app.id === selectedApp.id) {
                      return {
                        ...app,
                        scores: { ...app.scores, ...scores },
                        comments,
                        reviewedCount: app.reviewedCount + 1
                      };
                    }
                    return app;
                  }));
                  
                  // Log activity
                  setActivities(prev => [{
                    id: `review-${Date.now()}`,
                    type: 'review',
                    message: `Review submitted for ${selectedApp.name || `${selectedApp.firstName} ${selectedApp.lastName}`.trim()}`,
                    user: 'You',
                    time: 'Just now',
                    applicationId: selectedApp.id
                  }, ...prev]);
                  
                  toast.success('Review saved successfully');
                  setIsReviewMode(false);
                  
                  // Move to next application
                  const currentIndex = filteredApplications.findIndex(a => a.id === selectedApp.id);
                  if (currentIndex < filteredApplications.length - 1) {
                    setSelectedApp(filteredApplications[currentIndex + 1]);
                    setIsReviewMode(true);
                  }
                } catch (error) {
                  console.error('Failed to save review:', error);
                  toast.error('Failed to save review');
                }
              }}
              onNext={() => {
                const currentIndex = filteredApplications.findIndex(a => a.id === selectedApp.id);
                if (currentIndex < filteredApplications.length - 1) {
                  setSelectedApp(filteredApplications[currentIndex + 1]);
                }
              }}
              onPrevious={() => {
                const currentIndex = filteredApplications.findIndex(a => a.id === selectedApp.id);
                if (currentIndex > 0) {
                  setSelectedApp(filteredApplications[currentIndex - 1]);
                }
              }}
              currentIndex={filteredApplications.findIndex(a => a.id === selectedApp.id)}
              totalApplications={filteredApplications.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}
