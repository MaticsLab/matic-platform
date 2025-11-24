'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Users, ChevronRight, CheckCircle2, XCircle, ClipboardCheck, Search, Filter } from 'lucide-react';
import { Badge } from '@/ui-components/badge';
import { Input } from '@/ui-components/input';
import { toast } from 'sonner';
import { TakeAttendanceDialog } from './TakeAttendanceDialog';
import type { Activity } from '@/types/activities-hubs';
import type { Participant } from '@/types/participants';

interface AttendanceSession {
  id: string;
  date: string;
  beginTime: string;
  endTime: string;
  present: number;
  total: number;
}

interface AttendanceViewProps {
  activities: Activity[];
  workspaceId: string;
  onSelectActivity: (activity: Activity) => void;
}

export function AttendanceView({ activities, workspaceId, onSelectActivity }: AttendanceViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'empty'>('all');
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});

  // Load enrollment counts for all activities
  useEffect(() => {
    const loadEnrollmentCounts = async () => {
      try {
        const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup');
        const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup');
        const { supabase } = await import('@/lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        const participantsTable = await getOrCreateParticipantsTable(workspaceId, user.id);
        const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id);

        const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client');
        const { tablesGoClient } = await import('@/lib/api/tables-go-client');

        // Find the link
        let links = await tableLinksGoClient.getTableLinks(participantsTable.id);
        let link = links.find(l =>
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
          console.warn('No link found between participants and activities');
          return;
        }

        // Get all activity rows
        const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id);
        const counts: Record<string, number> = {};

        // Load enrollment count for each activity
        for (const activity of activities) {
          let activityRow = activityRows.find((row: any) => row.id === activity.id);
          if (!activityRow) {
            activityRow = activityRows.find((row: any) =>
              row.data?.legacy_activity_id === activity.id ||
              row.data?.name === activity.name
            );
          }

          if (activityRow?.id) {
            const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id);
            const count = linkedRows.filter((lr: any) => lr.row && lr.row.id !== activityRow.id).length;
            counts[activity.id] = count;
          } else {
            counts[activity.id] = 0;
          }
        }

        setEnrollmentCounts(counts);
      } catch (error) {
        console.error('Error loading enrollment counts:', error);
      }
    };

    if (activities.length > 0) {
      loadEnrollmentCounts();
    }
  }, [activities, workspaceId]);

  // Load attendance sessions for an activity
  const [activitySessions, setActivitySessions] = useState<Record<string, AttendanceSession[]>>({});
  
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;
        
        const { loadAttendanceSessions } = await import('@/lib/api/attendance-client');
        const sessionsMap: Record<string, AttendanceSession[]> = {};
        
        for (const activity of activities) {
          const sessions = await loadAttendanceSessions(workspaceId, user.id, activity.id);
          sessionsMap[activity.id] = sessions.map(s => ({
            id: s.id || `${activity.id}-${s.session_date}`,
            date: s.session_date,
            beginTime: s.begin_time,
            endTime: s.end_time,
            present: s.total_present || 0,
            total: s.total_enrolled || 0
          }));
        }
        
        setActivitySessions(sessionsMap);
      } catch (error) {
        console.error('Error loading attendance sessions:', error);
      }
    };
    
    if (activities.length > 0) {
      loadSessions();
    }
  }, [activities, workspaceId]);
  
  // Generate attendance sessions for an activity (combines saved + scheduled sessions)
  const getAttendanceSessions = (activity: Activity): AttendanceSession[] => {
    const startDate = activity.begin_date ? new Date(activity.begin_date) : new Date();
    const endDate = activity.end_date ? new Date(activity.end_date) : new Date();
    const enrollmentCount = enrollmentCounts[activity.id] || 0;
    
    // Get saved sessions
    const savedSessions = activitySessions[activity.id] || [];
    const savedSessionsMap = new Map(savedSessions.map(s => [s.date, s]));
    
    // Generate all scheduled sessions (weekly)
    const allSessions: AttendanceSession[] = [];
    let currentDate = new Date(startDate);
    let sessionId = 0;
    
    while (currentDate <= endDate && allSessions.length < 52) { // Max 52 weeks
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Check if we have a saved session for this date
      const savedSession = savedSessionsMap.get(dateStr);
      
      if (savedSession) {
        // Use saved session with actual data
        allSessions.push(savedSession);
      } else {
        // Create scheduled session (not yet taken)
        allSessions.push({
          id: `${activity.id}-${dateStr}`, // Use date-based ID for consistency
          date: dateStr,
          beginTime: '6:00 PM',
          endTime: '8:00 PM',
          present: 0, // No attendance taken yet
          total: enrollmentCount,
        });
      }
      
      // Add 7 days for weekly sessions
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return allSessions;
  };

  const getAttendanceStatus = (session: AttendanceSession) => {
    if (session.total === 0) {
      return { icon: XCircle, color: 'gray', label: 'No Participants', bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
    }
    if (session.present === 0) {
      return { icon: XCircle, color: 'red', label: 'Empty', bgColor: 'bg-red-100', textColor: 'text-red-600' };
    }
    const percentage = (session.present / session.total) * 100;
    if (percentage < 50) {
      return { icon: XCircle, color: 'amber', label: 'Low', bgColor: 'bg-amber-100', textColor: 'text-amber-600' };
    }
    if (percentage < 100) {
      return { icon: ClipboardCheck, color: 'blue', label: 'Incomplete', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };
    }
    return { icon: CheckCircle2, color: 'emerald', label: 'Complete', bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' };
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const handleSessionClick = async (activity: Activity, session: AttendanceSession) => {
    setSelectedActivity(activity);
    setSelectedSession(session);
    setLoadingParticipants(true);
    
    try {
      console.log('🔄 Loading participants for attendance:', activity.id, activity.name);
      
      const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup');
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup');
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('❌ No user found');
        setLoadingParticipants(false);
        return;
      }
      
      const participantsTable = await getOrCreateParticipantsTable(workspaceId, user.id);
      const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id);
      
      console.log('📊 Tables:', { activitiesTableId: activitiesTable.id, participantsTableId: participantsTable.id });
      
      const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client');
      
      let links = await tableLinksGoClient.getTableLinks(participantsTable.id);
      let link = links.find(l => 
        l.source_table_id === participantsTable.id && 
        l.target_table_id === activitiesTable.id &&
        l.link_type === 'many_to_many'
      );
      
      if (!link) {
        console.log('⚠️ Link not found from participants table, checking activities table...');
        links = await tableLinksGoClient.getTableLinks(activitiesTable.id);
        link = links.find(l => 
          ((l.source_table_id === participantsTable.id && l.target_table_id === activitiesTable.id) ||
           (l.source_table_id === activitiesTable.id && l.target_table_id === participantsTable.id)) &&
          l.link_type === 'many_to_many'
        );
      }
      
      if (!link) {
        console.error('❌ No link found between participants and activities');
        setParticipants([]);
        setLoadingParticipants(false);
        setAttendanceDialogOpen(true);
        return;
      }
      
      console.log('✅ Found table link:', link.id);
      
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
        console.error('❌ Activity not found in activities table');
        setParticipants([]);
        setLoadingParticipants(false);
        setAttendanceDialogOpen(true);
        return;
      }
      
      console.log('✅ Found activity row:', activityRow.id, activityRow.data?.name);
      
      const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id);
      
      console.log(`📊 Got ${linkedRows.length} linked rows from API`);
      
      const participantRows = linkedRows
        .filter((lr: any) => lr.row && lr.row.id !== activityRow.id)
        .map((lr: any) => lr.row);
      
      console.log(`✅ Found ${participantRows.length} participant rows`);
      
      const { tableRowToParticipant } = await import('@/lib/api/participants-helpers');
      const participantsData = await Promise.all(
        participantRows.map((row: any) => 
          tableRowToParticipant(row, participantsTable.id, link.id)
        )
      );
      
      // Load existing attendance records for this session (if session has an ID)
      if (session.id && session.id.includes('-') === false) {
        const { loadAttendanceRecordsMap } = await import('@/lib/api/attendance-client');
        try {
          const attendanceMap = await loadAttendanceRecordsMap(workspaceId, user.id, session.id);
          
          // Pre-populate attendance status for participants who already have records
          // Store status in a separate map since Participant type doesn't have _attendanceStatus
          const attendanceStatusMap = new Map<string, 'present' | 'absent' | 'excused'>();
          participantsData.forEach(participant => {
            const record = attendanceMap.get(participant.id);
            if (record) {
              attendanceStatusMap.set(participant.id, record.status);
            }
          });
          // Note: The TakeAttendanceDialog will handle loading existing records separately
        } catch (error) {
          console.warn('Could not load existing attendance records:', error);
        }
      }
      
      console.log('✅ Participants loaded:', participantsData.length);
      setParticipants(participantsData);
    } catch (error) {
      console.error('❌ Error loading participants:', error);
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
      setAttendanceDialogOpen(true);
    }
  };

  const handleSaveAttendance = async (session: AttendanceSession, records: any[]) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('User not authenticated');
        return;
      }
      
      const { saveAttendanceSession, saveAttendanceRecords } = await import('@/lib/api/attendance-client');
      
      // Calculate totals
      const totalEnrolled = records.length;
      const totalPresent = records.filter(r => r.status === 'present').length;
      const attendanceRate = totalEnrolled > 0 ? (totalPresent / totalEnrolled) * 100 : 0;
      
      // Save session - need to find activity_id from selectedActivity
      if (!selectedActivity) {
        toast.error('Activity not selected');
        return;
      }
      
      const sessionId = await saveAttendanceSession(workspaceId, user.id, {
        id: session.id,
        activity_id: selectedActivity.id,
        session_date: session.date,
        begin_time: session.beginTime,
        end_time: session.endTime,
        total_enrolled: totalEnrolled,
        total_present: totalPresent,
        attendance_rate: attendanceRate
      });
      
      // Save records
      const attendanceRecords = records.map(r => ({
        session_id: sessionId,
        participant_id: r.participantId,
        status: r.status,
        recorded_at: new Date().toISOString()
      }));
      
      await saveAttendanceRecords(workspaceId, user.id, sessionId, attendanceRecords);
      
      toast.success('Attendance saved successfully');
      
      // Reload enrollment counts to refresh the UI
      const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup');
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup');
      const participantsTable = await getOrCreateParticipantsTable(workspaceId, user.id);
      const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id);
      
      const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client');
      const { tablesGoClient } = await import('@/lib/api/tables-go-client');
      
      let links = await tableLinksGoClient.getTableLinks(participantsTable.id);
      let link = links.find(l =>
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
      
      if (link) {
        const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id);
        const counts: Record<string, number> = {};
        
        for (const activity of activities) {
          let activityRow = activityRows.find((row: any) => row.id === activity.id);
          if (!activityRow) {
            activityRow = activityRows.find((row: any) =>
              row.data?.legacy_activity_id === activity.id ||
              row.data?.name === activity.name
            );
          }
          
          if (activityRow?.id) {
            const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id);
            const count = linkedRows.filter((lr: any) => lr.row && lr.row.id !== activityRow.id).length;
            counts[activity.id] = count;
          } else {
            counts[activity.id] = 0;
          }
        }
        
        setEnrollmentCounts(counts);
      }
      
      // Reload sessions for this activity
      const { loadAttendanceSessions } = await import('@/lib/api/attendance-client');
      const updatedSessions = await loadAttendanceSessions(workspaceId, user.id, selectedActivity.id);
      setActivitySessions(prev => ({
        ...prev,
        [selectedActivity.id]: updatedSessions.map(s => ({
          id: s.id || `${selectedActivity.id}-${s.session_date}`,
          date: s.session_date,
          beginTime: s.begin_time,
          endTime: s.end_time,
          present: s.total_present || 0,
          total: s.total_enrolled || 0
        }))
      }));
      
      // Force re-render to show updated data
      setSelectedActivity(null);
      setTimeout(() => {
        const activity = activities.find(a => a.id === selectedActivity.id);
        if (activity) {
          setSelectedActivity(activity);
        }
      }, 100);
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    }
  };

  const filteredActivities = useMemo(() => {
    let filtered = activities.filter(activity => activity.status === 'active');
    
    if (searchQuery) {
      filtered = filtered.filter(activity => 
        activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [activities, searchQuery]);

  const getActivityStats = (activity: Activity) => {
    const sessions = getAttendanceSessions(activity);
    const incompleteSessions = sessions.filter(s => s.present === 0 || (s.present > 0 && s.present < s.total)).length;
    const emptySessions = sessions.filter(s => s.present === 0).length;
    
    // Calculate average attendance rate
    const totalPresent = sessions.reduce((sum, s) => sum + s.present, 0);
    const totalExpected = sessions.reduce((sum, s) => sum + s.total, 0);
    const avgAttendance = totalExpected > 0
      ? Math.round((totalPresent / totalExpected) * 100)
      : 0;
    
    return { sessions, incompleteSessions, emptySessions, avgAttendance };
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Attendance Tracking</h1>
          <p className="text-sm text-gray-600">Track and manage attendance for all active activities</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === 'incomplete'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Incomplete
            </button>
            <button
              onClick={() => setFilter('empty')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === 'empty'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Empty
            </button>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-auto px-6 md:px-8 py-6">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No activities found' : 'No active activities'}
            </h3>
            <p className="text-gray-500">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Create an activity and set it to active to start tracking attendance'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredActivities.map((activity) => {
              const { sessions, incompleteSessions, emptySessions, avgAttendance } = getActivityStats(activity);
              
              const filteredSessions = sessions.filter(session => {
                if (filter === 'incomplete') return session.present > 0 && session.present < session.total;
                if (filter === 'empty') return session.present === 0;
                return true;
              });
              
              return (
                <div key={activity.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Activity Header */}
                  <div className="bg-gradient-to-r from-violet-600 to-violet-700 text-white px-6 md:px-8 py-6">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl md:text-2xl font-bold mb-2 truncate">{activity.name}</h2>
                        {activity.category && (
                          <p className="text-sm text-violet-200">{activity.category}</p>
                        )}
                      </div>
                      {(incompleteSessions > 0 || emptySessions > 0) && (
                        <Badge className="bg-amber-500 text-white border-0 flex-shrink-0 px-3 py-1">
                          {incompleteSessions} incomplete
                        </Badge>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-xs text-violet-200 mb-2">Enrolled</div>
                        <div className="text-2xl font-bold">{enrollmentCounts[activity.id] ?? 0}</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-xs text-violet-200 mb-2">Avg Rate</div>
                        <div className="text-2xl font-bold">{avgAttendance}%</div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-xs text-violet-200 mb-2">Sessions</div>
                        <div className="text-2xl font-bold">{sessions.length}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sessions */}
                  {filteredSessions.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <p>No sessions match the current filter</p>
                    </div>
                  ) : (
                    <div className="p-6 space-y-3">
                      {filteredSessions.map((session) => {
                        const statusInfo = getAttendanceStatus(session);
                        const StatusIcon = statusInfo.icon;
                        const attendanceRate = session.total > 0 
                          ? Math.round((session.present / session.total) * 100) 
                          : 0;
                        
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleSessionClick(activity, session)}
                            className="w-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg p-5 transition-all text-left border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="text-base font-semibold text-gray-900">
                                    {formatFullDate(session.date)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 ml-7">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{session.beginTime} - {session.endTime}</span>
                                </div>
                              </div>
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.bgColor}`}>
                                <StatusIcon className={`h-4 w-4 ${statusInfo.textColor}`} />
                                <span className={`text-xs font-medium ${statusInfo.textColor}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span>
                                  <span className="font-semibold">{session.present}</span> of{' '}
                                  <span className="font-semibold">{session.total}</span> present
                                </span>
                              </div>
                              <div className={`text-base font-bold ${statusInfo.textColor}`}>
                                {attendanceRate}%
                              </div>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  attendanceRate >= 80 ? 'bg-emerald-500' :
                                  attendanceRate >= 50 ? 'bg-blue-500' :
                                  attendanceRate > 0 ? 'bg-amber-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${attendanceRate}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Take Attendance Dialog */}
      <TakeAttendanceDialog
        open={attendanceDialogOpen}
        onClose={() => setAttendanceDialogOpen(false)}
        activity={selectedActivity}
        sessionDate={selectedSession?.date || ''}
        sessionTime={{
          begin: selectedSession?.beginTime || '',
          end: selectedSession?.endTime || ''
        }}
        participants={participants}
        onSave={(records) => {
          if (selectedActivity && selectedSession) {
            handleSaveAttendance({
              activity_id: selectedActivity.id,
              session_date: selectedSession.date,
              begin_time: selectedSession.beginTime,
              end_time: selectedSession.endTime
            }, records);
          }
        }}
      />
    </div>
  );
}
