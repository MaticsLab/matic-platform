'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Trash2, Calendar, Users, MapPin, ChevronDown, ChevronUp, ClipboardCheck, GraduationCap, Target, Edit2, Save, XCircle, UserPlus, UserMinus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui-components/dialog';
import { Input } from '@/ui-components/input';
import { Textarea } from '@/ui-components/textarea';
import { toast } from 'sonner';
import { deleteActivitiesHub, formatDate } from '@/lib/api/activities-hubs-client';
import { activitiesSupabase } from '@/lib/api/activities-supabase';
import type { ActivitiesHub, ActivitiesHubWithTabs, UpdateActivityInput } from '@/types/activities-hubs';

type ActivityDetailPanelProps = {
  activity: ActivitiesHub;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: (updatedActivity: ActivitiesHub | ActivitiesHubWithTabs) => void;
};

type SectionKey = 
  | 'program' 
  | 'categories' 
  | 'provider'
  | 'eligibility'
  | 'enrollment'
  | 'location'
  | 'description';

export function ActivityDetailPanel({
  activity,
  isFullScreen = false,
  onToggleFullScreen,
  onClose,
  onDeleted,
  onUpdated
}: ActivityDetailPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['program', 'description', 'location'])
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedActivity, setEditedActivity] = useState<ActivitiesHub>(activity);
  const [enrolledParticipants, setEnrolledParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [activitiesTableId, setActivitiesTableId] = useState<string | null>(null);
  const [participantsTableId, setParticipantsTableId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [participantsColumn, setParticipantsColumn] = useState<any>(null);

  // Update editedActivity when activity prop changes
  useEffect(() => {
    setEditedActivity(activity);
  }, [activity]);

  // Load enrolled participants when activity changes
  useEffect(() => {
    loadEnrolledParticipants();
  }, [activity.id, activity.workspace_id]);

  // Set up real-time subscription for table_row_links changes
  useEffect(() => {
    if (!linkId || !activity.id || !activitiesTableId) return;

    let channel: any = null;
    
    const setupSubscription = async () => {
      const { supabase } = await import('@/lib/supabase');
      
      // Subscribe to changes in table_row_links for this activity
      channel = supabase
        .channel(`activity-participants-${activity.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'table_row_links',
            filter: `link_id=eq.${linkId}`
          },
          (payload: any) => {
            console.log('🔄 Table row link changed:', payload);
            // Check if this change affects the current activity
            const record = payload.new || payload.old;
            if (record && (
              record.source_row_id === activity.id || 
              record.target_row_id === activity.id
            )) {
              console.log('✅ Reloading participants due to link change');
              // Debounce reload to avoid multiple rapid reloads
              setTimeout(() => {
                loadEnrolledParticipants();
              }, 500);
            }
          }
        )
        .subscribe();

      console.log(`📡 Subscribed to table_row_links changes for activity ${activity.id}`);
    };

    setupSubscription();

    return () => {
      if (channel) {
        const { supabase } = require('@/lib/supabase');
        supabase.removeChannel(channel);
      }
    };
  }, [linkId, activity.id, activitiesTableId]);

  const loadEnrolledParticipants = async () => {
    try {
      setLoadingParticipants(true);
      console.log('🔄 Loading enrolled participants for activity:', activity.id, activity.name);
      
      // Get activities and participants tables
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup');
      const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup');
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('❌ No user found');
        return;
      }
      
      const activitiesTable = await getOrCreateActivitiesTable(activity.workspace_id, user.id);
      const participantsTable = await getOrCreateParticipantsTable(activity.workspace_id, user.id);
      
      console.log('📊 Tables:', { activitiesTableId: activitiesTable.id, participantsTableId: participantsTable.id });
      
      setActivitiesTableId(activitiesTable.id);
      setParticipantsTableId(participantsTable.id);
      
      // Get table link - check both directions
      const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client');
      
      // Check links from participants table (this is the primary direction)
      let links = await tableLinksGoClient.getTableLinks(participantsTable.id);
      let link = links.find((l: any) => 
        l.source_table_id === participantsTable.id && 
        l.target_table_id === activitiesTable.id &&
        l.link_type === 'many_to_many'
      );
      
      // If not found, check links from activities table
      if (!link) {
        console.log('⚠️ Link not found from participants table, checking activities table...');
        links = await tableLinksGoClient.getTableLinks(activitiesTable.id);
        link = links.find((l: any) => 
          ((l.source_table_id === participantsTable.id && l.target_table_id === activitiesTable.id) ||
           (l.source_table_id === activitiesTable.id && l.target_table_id === participantsTable.id)) &&
          l.link_type === 'many_to_many'
        );
      }
      
      if (!link) {
        console.error('❌ No table link found between activities and participants');
        console.log('Available links from participants table:', links);
        setEnrolledParticipants([]);
        setLoadingParticipants(false);
        return;
      }
      
      console.log('✅ Found table link:', link.id);
      setLinkId(link.id);
      
      // Find the activity row in the activities table
      // The activity.id might be the legacy_activity_id, so we need to find the row by matching
      const { tablesGoClient } = await import('@/lib/api/tables-go-client');
      const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id);
      
      // Try to find the activity row by:
      // 1. Direct ID match
      // 2. legacy_activity_id match
      // 3. Name match (fallback)
      let activityRow = activityRows.find((row: any) => row.id === activity.id);
      
      if (!activityRow) {
        activityRow = activityRows.find((row: any) => 
          row.data?.legacy_activity_id === activity.id ||
          row.data?.name === activity.name
        );
      }
      
      if (!activityRow || !activityRow.id) {
        console.error('❌ Activity row not found in activities table');
        console.log('Activity ID:', activity.id);
        console.log('Activity name:', activity.name);
        console.log('Available rows:', activityRows.map((r: any) => ({ id: r.id, name: r.data?.name })));
        setEnrolledParticipants([]);
        setLoadingParticipants(false);
        return;
      }
      
      console.log('✅ Found activity row:', activityRow.id, activityRow.data?.name);
      
      // Get linked participants using Go API
      // The link direction is: participants (source) -> activities (target)
      // So we query where target_row_id = activityRow.id
      const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id);
      
      console.log(`📊 Got ${linkedRows.length} linked rows from API`);
      
      // Filter to get participant rows (where source_row_id is a participant)
      // The API returns all linked rows, so we need to identify which are participants
      const participantRows = linkedRows
        .filter((lr: any) => {
          // The linked row should have the participant as the source
          // When we query with activityRow.id, we get rows where activityRow.id is either source or target
          // Since link is participants->activities, activityRow.id should be the target
          // So the source_row_id should be the participant
          return lr.row && lr.row.id !== activityRow.id;
        })
        .map((lr: any) => ({
          ...lr.row,
          enrollment: lr.link_data || {}
        }));
      
      console.log(`✅ Found ${participantRows.length} participant rows`);
      
      const participants = participantRows.map((row: any) => {
        const data = row.data || {};
        // Try multiple fields for name
        const name = data.full_name || 
                     data.name || 
                     `${(data.first_name || '').trim()} ${(data.last_name || '').trim()}`.trim() ||
                     data.display_name ||
                     data.title ||
                     `Participant ${row.id.substring(0, 8)}`;
        
        return {
          id: row.id,
          name: name,
          email: data.contact_email || data.email || '',
          student_id: data.student_id || '',
          enrollment_date: row.enrollment?.enrolled_date || row.enrollment?.created_at || null,
          enrollment_status: row.enrollment?.status || 'active'
        };
      });
      
      console.log('✅ Participants loaded:', participants.length, participants.map(p => p.name));
      setEnrolledParticipants(participants);
    } catch (error) {
      console.error('❌ Error loading enrolled participants:', error);
      setEnrolledParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleAddParticipant = async (participantId: string) => {
    if (!linkId) return;
    
    try {
      // Link is from participants (source) to activities (target)
      const { enrollParticipantInActivity } = await import('@/lib/api/participants-activities-link');
      await enrollParticipantInActivity(
        participantId, // source_row_id (participant)
        activity.id, // target_row_id (activity)
        linkId,
        {
          enrolled_date: new Date().toISOString(),
          status: 'active'
        }
      );
      
      // Reload participants
      await loadEnrolledParticipants();
      
      // Update activity participants count
      if (onUpdated) {
        const updated = { ...activity, participants: enrolledParticipants.length + 1 };
        onUpdated(updated);
      }
      
      toast.success('Participant enrolled successfully');
    } catch (error) {
      console.error('Error enrolling participant:', error);
      toast.error('Failed to enroll participant');
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!linkId) return;
    
    try {
      // Link is from participants (source) to activities (target)
      const { unenrollParticipantFromActivity } = await import('@/lib/api/participants-activities-link');
      await unenrollParticipantFromActivity(
        participantId, // source_row_id (participant)
        activity.id, // target_row_id (activity)
        linkId
      );
      
      // Reload participants
      await loadEnrolledParticipants();
      
      // Update activity participants count
      if (onUpdated) {
        const updated = { ...activity, participants: Math.max(0, enrolledParticipants.length - 1) };
        onUpdated(updated);
      }
      
      toast.success('Participant removed successfully');
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Failed to remove participant');
    }
  };

  const toggleSection = (section: SectionKey) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteActivitiesHub(activity.id);
      
      toast.success(`Activity "${activity.name}" deleted successfully`);
      
      if (onDeleted) {
        onDeleted();
      }
      onClose();
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Format dates properly - ensure they're in ISO format or null
      const formatDateForAPI = (date: string | null | undefined): string | null => {
        if (!date) return null;
        // If it's already in ISO format, return as is
        if (date.includes('T')) return date;
        // If it's just a date (YYYY-MM-DD), convert to ISO
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return `${date}T00:00:00Z`;
        }
        return date;
      };

      const updateData: UpdateActivityInput = {
        name: editedActivity.name,
        description: editedActivity.description || null,
        category: editedActivity.category || null,
        status: editedActivity.status,
        begin_date: formatDateForAPI(editedActivity.begin_date),
        end_date: formatDateForAPI(editedActivity.end_date),
      };

      console.log('Saving activity update:', { activityId: activity.id, updateData });

      const updated = await activitiesSupabase.updateActivity(activity.id, activity.workspace_id, updateData);
      
      console.log('Activity updated successfully:', updated);
      
      toast.success('Activity updated successfully');
      setIsEditing(false);
      // Convert Activity to ActivitiesHub format for state
      setEditedActivity({
        ...updated,
        tabs: activity.tabs || []
      } as ActivitiesHub);
      
      if (onUpdated) {
        onUpdated({
          ...updated,
          tabs: activity.tabs || []
        } as ActivitiesHub);
      }
    } catch (error: any) {
      console.error('Error updating activity:', error);
      toast.error(`Failed to update activity: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedActivity(activity);
    setIsEditing(false);
  };

  const CollapsibleSection = ({ 
    title, 
    sectionKey,
    icon: Icon,
    badge,
    children 
  }: { 
    title: string; 
    sectionKey: SectionKey;
    icon?: any;
    badge?: string;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.has(sectionKey);
    
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSection(sectionKey);
          }}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-violet-600" />
              </div>
            )}
            <div className="text-left">
              <h3 className="text-sm font-medium text-gray-900">{title}</h3>
              {badge && !isExpanded && (
                <p className="text-xs text-gray-500 mt-0.5">{badge}</p>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        
        {isExpanded && (
          <div 
            className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
              }
            }}
            onScroll={(e) => {
              // Prevent scroll events from bubbling up
              e.stopPropagation();
            }}
          >
            {children}
          </div>
        )}
      </div>
    );
  };

  const InfoRow = ({ 
    label, 
    value,
    fullWidth = false,
    editable = false,
    fieldName,
    type = 'text'
  }: { 
    label: string; 
    value: string | number; 
    fullWidth?: boolean;
    editable?: boolean;
    fieldName?: keyof ActivitiesHub;
    type?: 'text' | 'textarea' | 'date' | 'select';
  }) => {
    if (editable && fieldName) {
      const fieldValue = editedActivity[fieldName];
      
      if (type === 'textarea') {
        return (
          <div className={fullWidth ? 'col-span-2' : ''}>
            <label className="text-xs text-gray-500 mb-1 block">{label}</label>
            <Textarea
              ref={fieldName === 'description' ? descriptionTextareaRef : undefined}
              value={fieldValue as string || ''}
              onChange={(e) => {
                const newValue = e.target.value;
                setEditedActivity(prev => ({ ...prev, [fieldName]: newValue }));
              }}
              onKeyDown={(e) => {
                // Only prevent Enter from submitting, allow all other keys to work normally
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                }
                // Don't stop propagation - let typing work normally
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onFocus={(e) => {
                // Ensure the section stays expanded when focusing
                if (!expandedSections.has('description')) {
                  toggleSection('description');
                }
              }}
              className="text-sm text-gray-900 min-h-[80px]"
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          </div>
        );
      }
      
      if (type === 'date') {
        return (
          <div className={fullWidth ? 'col-span-2' : ''}>
            <label className="text-xs text-gray-500 mb-1 block">{label}</label>
            <Input
              type="date"
              value={fieldValue ? (fieldValue as string).split('T')[0] : ''}
              onChange={(e) => setEditedActivity({ ...editedActivity, [fieldName]: e.target.value || null })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-gray-900"
            />
          </div>
        );
      }

      if (type === 'select' && fieldName === 'status') {
        return (
          <div className={fullWidth ? 'col-span-2' : ''}>
            <label className="text-xs text-gray-500 mb-1 block">{label}</label>
            <select
              value={fieldValue as string || ''}
              onChange={(e) => setEditedActivity({ ...editedActivity, [fieldName]: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        );
      }
      
      return (
        <div className={fullWidth ? 'col-span-2' : ''}>
          <label className="text-xs text-gray-500 mb-1 block">{label}</label>
          <Input
            type="text"
            value={fieldValue as string || ''}
            onChange={(e) => setEditedActivity({ ...editedActivity, [fieldName]: e.target.value })}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-gray-900"
            placeholder={`Enter ${label.toLowerCase()}`}
            autoFocus={false}
          />
        </div>
      );
    }
    
    return (
      <div className={fullWidth ? 'col-span-2' : ''}>
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-sm text-gray-900">{value}</div>
      </div>
    );
  };

  const targetEnrollment = 50; // This could come from activity.settings

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 md:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            {isEditing ? (
              <Input
                value={editedActivity.name}
                onChange={(e) => setEditedActivity({ ...editedActivity, name: e.target.value })}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-xl md:text-2xl font-bold h-auto py-2 flex-1"
                placeholder="Activity name"
                autoFocus={false}
              />
            ) : (
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{activity.name}</h1>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors ml-4"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Quick Stats - Only Enrolled and Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Users className="h-3 w-3 text-emerald-600" />
                <span className="text-[10px] text-emerald-700 font-medium">Enrolled</span>
              </div>
              <div className="text-sm font-bold text-emerald-900 leading-tight">{enrolledParticipants.length}</div>
              <div className="text-[10px] text-emerald-600">of {targetEnrollment}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <ClipboardCheck className="h-3 w-3 text-blue-600" />
                <span className="text-[10px] text-blue-700 font-medium">Duration</span>
              </div>
              <div className="text-sm font-bold text-blue-900 leading-tight">
                {activity.begin_date && activity.end_date ? (
                  <>
                    {Math.ceil((new Date(activity.end_date).getTime() - new Date(activity.begin_date).getTime()) / (1000 * 60 * 60 * 24))}
                    <span className="text-[10px] font-normal ml-1">Days</span>
                  </>
                ) : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div 
          ref={scrollContainerRef}
          className="px-6 md:px-8 py-6 space-y-6"
          onScroll={(e) => {
            // Prevent scroll events from bubbling
            e.stopPropagation();
          }}
        >
        
        {/* Program Information */}
        <CollapsibleSection 
          title="Program Information" 
          sectionKey="program"
          icon={GraduationCap}
          badge={activity.category || 'No category'}
        >
          <div className="space-y-4 pt-2">
            <InfoRow 
              label="Program Category" 
              value={activity.category || 'Not specified'} 
              fullWidth 
              editable={isEditing}
              fieldName="category"
            />
            <InfoRow 
              label="Activity Name" 
              value={activity.name} 
              fullWidth 
              editable={isEditing}
              fieldName="name"
            />
            <InfoRow 
              label="Status" 
              value={activity.status} 
              fullWidth 
              editable={isEditing}
              fieldName="status"
              type="select"
            />
          </div>
        </CollapsibleSection>

        {/* Activity Categories */}
        <CollapsibleSection 
          title="Activity Categories" 
          sectionKey="categories"
          icon={Target}
          badge={activity.category || 'Not specified'}
        >
          <div className="space-y-4 pt-2">
            <div>
              <div className="text-xs text-gray-500 mb-2">Primary Category</div>
              {isEditing ? (
                <Input
                  value={editedActivity.category || ''}
                  onChange={(e) => setEditedActivity({ ...editedActivity, category: e.target.value })}
                  className="text-sm"
                  placeholder="Enter category"
                />
              ) : (
                <div className="inline-flex items-center px-3 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm">
                  {activity.category || 'Not specified'}
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* Service Provider */}
        <CollapsibleSection 
          title="Service Provider" 
          sectionKey="provider"
          icon={Users}
          badge="Activity Provider"
        >
          <div className="space-y-4 pt-2">
            <InfoRow label="Provider Name" value="Not specified" fullWidth />
            <InfoRow label="Contact Information" value="Not specified" fullWidth />
          </div>
        </CollapsibleSection>

        {/* Eligibility */}
        <CollapsibleSection 
          title="Eligibility Requirements" 
          sectionKey="eligibility"
          icon={GraduationCap}
          badge="Participant Information"
        >
          <div className="grid grid-cols-2 gap-6 pt-2">
            <InfoRow label="Target Group" value="General" />
            <InfoRow label="Fee Scale" value="Free" />
          </div>
        </CollapsibleSection>

        {/* Enrollment */}
        <CollapsibleSection 
          title="Enrolled Participants" 
          sectionKey="enrollment"
          icon={Users}
          badge={`${enrolledParticipants.length}/${targetEnrollment} enrolled`}
        >
          <div className="space-y-5 pt-2">
            <div>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-gray-600">Enrollment Progress</span>
                <span className="font-medium text-gray-900">{Math.round((enrolledParticipants.length / targetEnrollment) * 100)}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full transition-all duration-500"
                  style={{ width: `${(enrolledParticipants.length / targetEnrollment) * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {targetEnrollment - enrolledParticipants.length} spots remaining
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <InfoRow label="Target Total" value={targetEnrollment} />
              <InfoRow label="Current Enrolled" value={enrolledParticipants.length} />
              <InfoRow label="Waitlist" value="0" />
            </div>
            
            {/* Enrolled Participants List */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold text-gray-900">Enrolled Students</h4>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadEnrolledParticipants}
                    disabled={loadingParticipants}
                    className="h-9 px-3"
                    title="Refresh participants list"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingParticipants ? 'animate-spin' : ''}`} />
                  </Button>
                  {participantsTableId && linkId && (
                    <EnrollParticipantDialog
                      activityId={activity.id}
                      participantsTableId={participantsTableId}
                      linkId={linkId}
                      enrolledParticipantIds={enrolledParticipants.map(p => p.id)}
                      onEnroll={handleAddParticipant}
                      onReload={loadEnrolledParticipants}
                    />
                  )}
                </div>
              </div>
              
              {loadingParticipants ? (
                <div className="text-sm text-gray-500 py-8 text-center">Loading participants...</div>
              ) : enrolledParticipants.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center">No participants enrolled yet</div>
              ) : (
                <div className="space-y-3">
                  {enrolledParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-base font-medium text-gray-900 mb-1">{participant.name}</div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {participant.student_id && (
                            <span>ID: {participant.student_id}</span>
                          )}
                          {participant.email && (
                            <span className="truncate">{participant.email}</span>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveParticipant(participant.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* Location */}
        <CollapsibleSection 
          title="Location Details" 
          sectionKey="location"
          icon={MapPin}
          badge="Activity Location"
        >
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2">Location</div>
              <div className="text-sm text-gray-900">
                To be determined
              </div>
            </div>
            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full justify-center"
                onClick={() => window.open('https://maps.google.com', '_blank')}
              >
                <MapPin className="h-4 w-4 mr-2" />
                View on Map
              </Button>
            </div>
          </div>
        </CollapsibleSection>

        {/* Description */}
        <CollapsibleSection 
          title="Activity Description" 
          sectionKey="description"
          badge="Full details"
        >
          {isEditing ? (
            <div className="space-y-3">
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <Textarea
                ref={descriptionTextareaRef}
                value={editedActivity.description || ''}
                onChange={(e) => {
                  setEditedActivity(prev => ({ ...prev, description: e.target.value }));
                }}
                onKeyDown={(e) => {
                  // Only prevent Enter from submitting, allow all other keys to work normally
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                  }
                }}
                onFocus={(e) => {
                  // Save scroll position immediately when focus happens
                  const savedScrollTop = scrollContainerRef.current?.scrollTop || 0;
                  
                  // Prevent browser's default scroll-into-view behavior
                  // Use multiple strategies to ensure it works
                  const restoreScroll = () => {
                    if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollTop = savedScrollTop;
                    }
                  };
                  
                  // Restore immediately and after browser tries to scroll
                  requestAnimationFrame(restoreScroll);
                  setTimeout(restoreScroll, 0);
                  setTimeout(restoreScroll, 10);
                  setTimeout(restoreScroll, 50);
                }}
                className="text-sm text-gray-900 min-h-[80px]"
                placeholder="Enter description"
                style={{ scrollMargin: '0', scrollPadding: '0' }}
              />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {activity.description || 'No description provided'}
              </p>
            </div>
          )}
        </CollapsibleSection>

        {/* Schedule Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            Schedule
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Start Date</div>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editedActivity.begin_date ? editedActivity.begin_date.split('T')[0] : ''}
                    onChange={(e) => setEditedActivity({ ...editedActivity, begin_date: e.target.value || null })}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-900">
                    {activity.begin_date ? formatDate(activity.begin_date) : 'Not set'}
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-violet-600" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">End Date</div>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editedActivity.end_date ? editedActivity.end_date.split('T')[0] : ''}
                    onChange={(e) => setEditedActivity({ ...editedActivity, end_date: e.target.value || null })}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-900">
                    {activity.end_date ? formatDate(activity.end_date) : 'Not set'}
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-violet-600" />
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Bottom Actions */}
        <div className="bg-white border-t border-gray-200 p-4 space-y-2">
        {isEditing ? (
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              className="h-11"
              onClick={handleCancel}
              disabled={saving}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              className="h-11 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        ) : (
          <>
            <Button 
              className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 text-base"
            >
              <ClipboardCheck className="h-5 w-5 mr-2" />
              Setup Attendance
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline"
                className="h-11"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
              <Button 
                variant="outline"
                className="h-11 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <DialogHeader>
            <DialogTitle>Delete Activity?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{activity.name}" and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white h-11"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Activity'}
            </Button>
            <Button 
              variant="outline"
              className="w-full h-11"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Enroll Participant Dialog Component
function EnrollParticipantDialog({
  activityId,
  participantsTableId,
  linkId,
  enrolledParticipantIds,
  onEnroll,
  onReload
}: {
  activityId: string;
  participantsTableId: string;
  linkId: string;
  enrolledParticipantIds: string[];
  onEnroll: (participantId: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [availableParticipants, setAvailableParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && participantsTableId) {
      loadParticipants();
    }
  }, [open, participantsTableId]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const { tablesGoClient } = await import('@/lib/api/tables-go-client');
      const rows = await tablesGoClient.getRowsByTable(participantsTableId);
      
      const participants = rows.map((row: any) => ({
        id: row.id,
        name: row.data?.full_name || row.data?.name || 'Unknown',
        email: row.data?.contact_email || row.data?.email || '',
        student_id: row.data?.student_id || ''
      }));
      
      setAvailableParticipants(participants);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast.error('Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const filteredParticipants = availableParticipants.filter(p => {
    if (enrolledParticipantIds.includes(p.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower) ||
      p.student_id.toLowerCase().includes(searchLower)
    );
  });

  const handleEnroll = async (participantId: string) => {
    await onEnroll(participantId);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-violet-600 border-violet-200 hover:bg-violet-50"
      >
        <UserPlus className="h-4 w-4 mr-1" />
        Enroll Student
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Enroll Student</DialogTitle>
            <DialogDescription>
              Search and select a student to enroll in this activity
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name, email, or student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading participants...</div>
              ) : filteredParticipants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {search ? 'No matching participants found' : 'No available participants'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredParticipants.map((participant) => (
                    <button
                      key={participant.id}
                      onClick={() => handleEnroll(participant.id)}
                      className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{participant.name}</div>
                      {participant.student_id && (
                        <div className="text-sm text-gray-500">ID: {participant.student_id}</div>
                      )}
                      {participant.email && (
                        <div className="text-sm text-gray-500">{participant.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
