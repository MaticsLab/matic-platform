'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Calendar, 
  Users, 
  Activity as ActivityIcon,
  Database,
  Search,
  Filter,
  Grid3x3,
  List as ListIcon
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui-components/dialog';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select';
import { toast } from 'sonner';
import { activitiesSupabase } from '@/lib/api/activities-supabase';
import { ActivityDetailPanel } from './ActivityDetailPanel';
import { useTabContext } from '@/components/WorkspaceTabProvider';
import type { Activity, ActivityStatus, CreateActivityInput } from '@/types/activities-hubs';

// Helper function to format dates
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Not set';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Invalid date';
  }
};

// Activity Card Component
function ActivityCard({ activity, isSelected, onClick, workspaceId }: { 
  activity: Activity; 
  isSelected: boolean; 
  onClick: () => void;
  workspaceId: string;
}) {
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  useEffect(() => {
    loadEnrollmentCount();
  }, [activity.id, workspaceId]);

  const loadEnrollmentCount = async () => {
    try {
      setLoadingCount(true);
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup');
      const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup');
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id);
      const participantsTable = await getOrCreateParticipantsTable(workspaceId, user.id);
      
      const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client');
      
      let links = await tableLinksGoClient.getTableLinks(participantsTable.id);
      let link = links.find((l: any) => 
        l.source_table_id === participantsTable.id && 
        l.target_table_id === activitiesTable.id &&
        l.link_type === 'many_to_many'
      );
      
      if (!link) {
        links = await tableLinksGoClient.getTableLinks(activitiesTable.id);
        link = links.find((l: any) => 
          ((l.source_table_id === participantsTable.id && l.target_table_id === activitiesTable.id) ||
           (l.source_table_id === activitiesTable.id && l.target_table_id === participantsTable.id)) &&
          l.link_type === 'many_to_many'
        );
      }
      
      if (!link) {
        setEnrollmentCount(0);
        return;
      }
      
      const { tablesGoClient } = await import('@/lib/api/tables-go-client');
      const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id);
      
      let activityRow = activityRows.find((row: any) => row.id === activity.id);
      if (!activityRow) {
        activityRow = activityRows.find((row: any) => 
          row.data?.legacy_activity_id === activity.id ||
          row.data?.name === activity.name
        );
      }
      
      if (!activityRow?.id) {
        setEnrollmentCount(0);
        return;
      }
      
      const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id);
      const count = linkedRows.filter((lr: any) => lr.row && lr.row.id !== activityRow.id).length;
      setEnrollmentCount(count);
    } catch (error) {
      console.error('Error loading enrollment count:', error);
      setEnrollmentCount(null);
    } finally {
      setLoadingCount(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-6 border-2 transition-all cursor-pointer hover:shadow-lg ${
        isSelected
          ? 'border-violet-600 shadow-md'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 line-clamp-2 pr-3">
          {activity.name}
        </h3>
        <Badge 
          className={`
            text-xs px-2.5 py-1 border-0 flex-shrink-0
            ${activity.status === 'active' ? 'bg-emerald-100 text-emerald-700' : ''}
            ${activity.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : ''}
            ${activity.status === 'completed' ? 'bg-gray-100 text-gray-700' : ''}
          `}
        >
          {activity.status}
        </Badge>
      </div>
      
      {activity.category && (
        <div className="text-sm text-gray-500 mb-4">{activity.category}</div>
      )}
      
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span>{formatDate(activity.begin_date)} → {formatDate(activity.end_date)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span>
            {loadingCount ? '...' : (enrollmentCount !== null ? enrollmentCount : activity.participants)} enrolled
          </span>
        </div>
      </div>
      
      {activity.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{activity.description}</p>
      )}
    </div>
  );
}

// Activity List Item Component
function ActivityListItem({ activity, isSelected, onClick, workspaceId }: { 
  activity: Activity; 
  isSelected: boolean; 
  onClick: () => void;
  workspaceId: string;
}) {
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  useEffect(() => {
    loadEnrollmentCount();
  }, [activity.id, workspaceId]);

  const loadEnrollmentCount = async () => {
    try {
      setLoadingCount(true);
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup');
      const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup');
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id);
      const participantsTable = await getOrCreateParticipantsTable(workspaceId, user.id);
      
      const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client');
      
      let links = await tableLinksGoClient.getTableLinks(participantsTable.id);
      let link = links.find((l: any) => 
        l.source_table_id === participantsTable.id && 
        l.target_table_id === activitiesTable.id &&
        l.link_type === 'many_to_many'
      );
      
      if (!link) {
        links = await tableLinksGoClient.getTableLinks(activitiesTable.id);
        link = links.find((l: any) => 
          ((l.source_table_id === participantsTable.id && l.target_table_id === activitiesTable.id) ||
           (l.source_table_id === activitiesTable.id && l.target_table_id === participantsTable.id)) &&
          l.link_type === 'many_to_many'
        );
      }
      
      if (!link) {
        setEnrollmentCount(0);
        return;
      }
      
      const { tablesGoClient } = await import('@/lib/api/tables-go-client');
      const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id);
      
      let activityRow = activityRows.find((row: any) => row.id === activity.id);
      if (!activityRow) {
        activityRow = activityRows.find((row: any) => 
          row.data?.legacy_activity_id === activity.id ||
          row.data?.name === activity.name
        );
      }
      
      if (!activityRow?.id) {
        setEnrollmentCount(0);
        return;
      }
      
      const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id);
      const count = linkedRows.filter((lr: any) => lr.row && lr.row.id !== activityRow.id).length;
      setEnrollmentCount(count);
    } catch (error) {
      console.error('Error loading enrollment count:', error);
      setEnrollmentCount(null);
    } finally {
      setLoadingCount(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg p-5 border-2 transition-all cursor-pointer hover:shadow-md ${
        isSelected
          ? 'border-violet-600 shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {activity.name}
            </h3>
            <Badge 
              className={`
                text-xs px-2.5 py-1 border-0
                ${activity.status === 'active' ? 'bg-emerald-100 text-emerald-700' : ''}
                ${activity.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : ''}
                ${activity.status === 'completed' ? 'bg-gray-100 text-gray-700' : ''}
              `}
            >
              {activity.status}
            </Badge>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span>{formatDate(activity.begin_date)} → {formatDate(activity.end_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              <span>
                {loadingCount ? '...' : (enrollmentCount !== null ? enrollmentCount : activity.participants)} enrolled
              </span>
            </div>
            {activity.category && (
              <span className="text-gray-500">• {activity.category}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActivitiesHubListPageProps {
  workspaceId: string;
  onSelectActivity?: (activity: Activity) => void;
}

export function ActivitiesHubListPage({ workspaceId, onSelectActivity }: ActivitiesHubListPageProps) {
  const router = useRouter();
  const { setTabActions, setTabHeaderContent } = useTabContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [newActivity, setNewActivity] = useState<Partial<CreateActivityInput>>({
    name: '',
    category: '',
    status: 'upcoming',
    begin_date: '',
    end_date: '',
    participants: 0,
  });

  // Load activities
  useEffect(() => {
    loadActivities();
  }, [workspaceId]);

  // Track if we've already ensured the link for this workspace
  const linkEnsuredRef = useRef<Set<string>>(new Set());

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      // Ensure link exists between activities and participants tables (only once per workspace)
      if (!linkEnsuredRef.current.has(workspaceId)) {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { ensureParticipantsActivitiesLink } = await import('@/lib/api/participants-activities-link');
            await ensureParticipantsActivitiesLink(workspaceId, user.id);
            linkEnsuredRef.current.add(workspaceId);
          }
        } catch (linkError) {
          // Non-critical - just log warning
          console.warn('Could not ensure activities-participants link:', linkError);
        }
      }
      
      const data = await activitiesSupabase.listActivities(workspaceId);
      setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  // Register tab header content
  useEffect(() => {
    setTabHeaderContent({
      title: 'Activities Hub',
    });
    return () => setTabHeaderContent(null);
  }, [setTabHeaderContent]);

  // Register tab actions
  useEffect(() => {
    setTabActions([
      {
        label: 'Tables',
        icon: Database,
        onClick: () => router.push(`/workspace/${workspaceId}/tables`),
        variant: 'outline' as const
      },
      {
        label: 'Add Activity',
        icon: Plus,
        onClick: () => setAddDialogOpen(true),
        variant: 'default' as const
      }
    ]);
    return () => setTabActions([]);
  }, [workspaceId, router, setTabActions]);

  // Filter and search activities
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const matchesSearch = 
        activity.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (activity.category?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (activity.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || activity.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [activities, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: activities.length,
    active: activities.filter(a => a.status === 'active').length,
    upcoming: activities.filter(a => a.status === 'upcoming').length,
    completed: activities.filter(a => a.status === 'completed').length,
  }), [activities]);

  const handleAddActivity = async () => {
    if (!newActivity.name || !newActivity.begin_date || !newActivity.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const activityData: CreateActivityInput = {
        name: newActivity.name!,
        description: newActivity.description,
        category: newActivity.category || '',
        status: (newActivity.status as ActivityStatus) || 'upcoming',
        begin_date: newActivity.begin_date || undefined,
        end_date: newActivity.end_date || undefined,
        participants: newActivity.participants || 0,
      };

      const created = await activitiesSupabase.createActivity(workspaceId, activityData);
      
      setActivities([created, ...activities]);
      setAddDialogOpen(false);
      
      // Reset form
      setNewActivity({
        name: '',
        category: '',
        status: 'upcoming',
        begin_date: '',
        end_date: '',
        participants: 0,
      });

      toast.success(`Activity "${created.name}" created successfully`);
    } catch (error) {
      console.error('Error creating activity:', error);
      toast.error('Failed to create activity');
    }
  };

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    if (onSelectActivity) {
      onSelectActivity(activity);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <div className="text-gray-500">Loading activities...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Filters */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Grid3x3 className="h-4 w-4" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ListIcon className="h-4 w-4" />
              List
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">Status</div>
          <div className="space-y-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                filterStatus === 'all'
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>All Activities</span>
              <span className={`text-xs ${filterStatus === 'all' ? 'text-violet-600' : 'text-gray-400'}`}>{stats.total}</span>
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                filterStatus === 'active'
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>Active</span>
              <span className={`text-xs ${filterStatus === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>{stats.active}</span>
            </button>
            <button
              onClick={() => setFilterStatus('upcoming')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                filterStatus === 'upcoming'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>Upcoming</span>
              <span className={`text-xs ${filterStatus === 'upcoming' ? 'text-blue-600' : 'text-gray-400'}`}>{stats.upcoming}</span>
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-gray-100 text-gray-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>Completed</span>
              <span className={`text-xs ${filterStatus === 'completed' ? 'text-gray-600' : 'text-gray-400'}`}>{stats.completed}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative bg-white rounded-tl-xl rounded-bl-xl border-l border-gray-200">
        {/* Activities List */}
        <div className={`transition-all duration-300 overflow-auto ${
          selectedActivity && !isFullScreen ? 'md:w-2/3 w-full' : 'w-full'
        }`}>
          <div className="p-6">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-16">
                <ActivityIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No activities found' : 'No activities yet'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {searchQuery 
                    ? 'Try adjusting your search terms or filters'
                    : 'Get started by creating your first activity or connecting an existing data table'
                  }
                </p>
                {!searchQuery && (
                  <div className="flex items-center justify-center gap-3">
                    <Button 
                      onClick={() => setAddDialogOpen(true)} 
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Activity
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => router.push(`/workspace/${workspaceId}/tables`)}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Tables
                    </Button>
                  </div>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    isSelected={selectedActivity?.id === activity.id}
                    onClick={() => handleSelectActivity(activity)}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredActivities.map((activity) => (
                  <ActivityListItem
                    key={activity.id}
                    activity={activity}
                    isSelected={selectedActivity?.id === activity.id}
                    onClick={() => handleSelectActivity(activity)}
                    workspaceId={workspaceId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedActivity && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => {
                setSelectedActivity(null);
                setIsFullScreen(false);
              }}
            />
            
            <div className={`
              fixed md:absolute transition-all duration-300 z-50
              right-2 top-2 bottom-2 bg-white border border-gray-200 rounded-xl shadow-lg
              w-[calc(100%-1rem)] md:w-[420px]
              ${isFullScreen ? 'md:w-[600px]' : ''}
            `}>
              <ActivityDetailPanel
                activity={selectedActivity}
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                onClose={() => {
                  setSelectedActivity(null);
                  setIsFullScreen(false);
                }}
                onDeleted={() => {
                  loadActivities();
                  setSelectedActivity(null);
                }}
                onUpdated={(updatedActivity) => {
                  loadActivities();
                  setSelectedActivity(updatedActivity);
                }}
              />
            </div>
          </>
        )}
      </div>


      {/* Add Activity Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Activity</DialogTitle>
            <DialogDescription>
              Create a new activity or event for your workspace.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Activity Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Youth Basketball League"
                value={newActivity.name || ''}
                onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., After School Programs"
                value={newActivity.category || ''}
                onChange={(e) => setNewActivity({ ...newActivity, category: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={newActivity.status}
                onValueChange={(value: ActivityStatus) => 
                  setNewActivity({ ...newActivity, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="beginDate">Start Date *</Label>
                <Input
                  id="beginDate"
                  type="date"
                  value={newActivity.begin_date || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, begin_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newActivity.end_date || ''}
                  onChange={(e) => setNewActivity({ ...newActivity, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="participants">Initial Participants</Label>
              <Input
                id="participants"
                type="number"
                placeholder="0"
                value={newActivity.participants || 0}
                onChange={(e) => setNewActivity({ ...newActivity, participants: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the activity"
                value={newActivity.description || ''}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleAddActivity}
            >
              Create Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

