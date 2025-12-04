/**
 * Activities Hub Types
 * Based on the Activities hub folder UI/UX design
 */

export type ActivityStatus = 'active' | 'upcoming' | 'completed';

export type Activity = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  begin_date: string | null;
  end_date: string | null;
  status: ActivityStatus;
  participants: number;
  settings: Record<string, any>;
  is_active: boolean;
  is_hidden?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ActivitiesHubTab = {
  id: string;
  hub_id: string;
  name: string;
  slug: string;
  type: 'dashboard' | 'attendance' | 'participants' | 'documents' | 'reports' | 'custom';
  icon?: string;
  position: number;
  is_visible: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type ActivitiesHub = Activity;

export type ActivitiesHubWithTabs = Activity & {
  tabs: ActivitiesHubTab[];
};

// Input types for API requests
export type CreateActivityInput = {
  name: string;
  description?: string;
  category?: string;
  status?: ActivityStatus;
  begin_date?: string | null;
  end_date?: string | null;
  participants?: number;
  settings?: Record<string, any>;
};

export type UpdateActivityInput = Partial<CreateActivityInput>;

export type CreateActivityTabInput = {
  name: string;
  slug: string;
  type: ActivitiesHubTab['type'];
  icon?: string;
  position?: number;
  is_visible?: boolean;
  config?: Record<string, any>;
};

export type UpdateActivityTabInput = Partial<CreateActivityTabInput>;

export type ReorderTabsInput = {
  tabs: Array<{
    id: string;
    position: number;
  }>;
};

// Filter and query options
export type ActivityFilters = {
  status?: ActivityStatus | 'all';
  category?: string;
  search?: string;
  includeInactive?: boolean;
};

// Attendance types (for future attendance module integration)
export type AttendanceSession = {
  id: string;
  activity_id: string;
  session_date: string;
  begin_time: string;
  end_time: string;
  notes?: string;
};

export type AttendanceRecord = {
  id: string;
  session_id: string;
  participant_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  recorded_at: string;
};

export type AttendanceSchedule = {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  days_of_week?: number[]; // 0-6 for Sun-Sat
  begin_time: string;
  end_time: string;
  start_date: string;
  end_date?: string;
};
