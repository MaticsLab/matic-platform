// Review Workspace V2 Types

export type ApplicationStatus = 
  | 'Submitted' 
  | 'Initial Review' 
  | 'Under Review' 
  | 'Final Review' 
  | 'Approved' 
  | 'Rejected'
  | string; // Support custom statuses

export interface ReviewHistoryEntry {
  id?: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_type_id?: string;
  scores: Record<string, number>;
  total_score?: number;
  notes?: string;
  comments?: string;
  criteria_comments?: Record<string, string>;
  reviewed_at?: string;
}

export interface Application {
  id: string;
  firstName: string;
  lastName: string;
  name?: string; // Full name if available
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  status: ApplicationStatus;
  submittedDate: string;
  reviewedCount: number;
  totalReviewers: number;
  avatar?: string;
  priority?: 'high' | 'medium' | 'low';
  score?: number | null;
  maxScore?: number;
  assignedTo?: string[]; // Reviewer names for display
  assignedReviewerIds?: string[]; // Reviewer IDs
  tags?: string[];
  lastActivity?: string;
  raw_data?: Record<string, any>;
  scores?: Record<string, number>;
  comments?: string;
  flagged?: boolean;
  reviewHistory?: ReviewHistoryEntry[];
}

export interface Reviewer {
  id: string;
  name: string;
  email?: string;
  role?: string;
  reviewer_type_id?: string;
}

export interface ActivityItem {
  id: string | number;
  type: 'status' | 'review' | 'comment' | 'email' | 'system';
  message: string;
  user: string;
  time: string;
  applicationId?: string | null;
}

export interface ReviewersMap {
  [key: string]: {
    name: string;
    email?: string;
    role?: string;
  };
}

// Props for components
export interface ApplicationListProps {
  applications: Application[];
  selectedId: string | undefined;
  onSelect: (app: Application) => void;
  isLoading?: boolean;
  sortBy?: 'recent' | 'oldest' | 'score' | 'name';
  onSortChange?: (sort: 'recent' | 'oldest' | 'score' | 'name') => void;
  filterStatus?: ApplicationStatus | 'all';
  onFilterChange?: (status: ApplicationStatus | 'all') => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export interface ApplicationDetailProps {
  application: Application;
  reviewersMap: ReviewersMap;
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void;
  onClose: () => void;
  onStartReview?: (appId: string) => void;
  onDelete?: (appId: string) => void;
  workspaceId?: string;
  formId?: string;
  fields?: Array<{ id: string; label: string; type: string; config?: Record<string, any>; name?: string }>;
  onActivityCreated?: () => void;
}

export interface PipelineHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  applications: Application[];
  filterStatus: ApplicationStatus | 'all';
  onFilterChange: (status: ApplicationStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  committee: string;
  onCommitteeChange: (value: string) => void;
  onOpenPipelineActivity: () => void;
  onDownload?: () => void;
  workspaceSlug?: string;
  formId?: string;
}

export interface PipelineActivityPanelProps {
  applications: Application[];
  activities: ActivityItem[];
  onClose: () => void;
  onSendEmail?: (to: string, subject: string, body: string, options?: { 
    cc?: string; 
    bcc?: string; 
    submissionIds?: string[];
    formId?: string;
  }) => void;
  onAddComment?: (comment: string) => void;
  workspaceId?: string;
  formId?: string;
  fields?: Array<{ id: string; name: string; label: string }>;
}

export interface HeaderProps {
  formName: string;
  onBack?: () => void;
  activeView?: 'review' | 'analytics' | 'team' | 'portal' | 'share';
  onViewChange?: (view: 'review' | 'analytics' | 'team' | 'portal' | 'share') => void;
