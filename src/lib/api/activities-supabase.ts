/**
 * Activities Hub - Supabase Implementation
 * 
 * Uses existing data_tables architecture:
 * - Activities stored as rows in a special "Activities" table
 * - Each workspace has its own activities table
 * - Attendance/Reports/Requests are separate linked tables
 */

import { supabase } from '@/lib/supabase';
import type { Activity, CreateActivityInput, UpdateActivityInput } from '@/types/activities-hubs';

const ACTIVITIES_TABLE_NAME = 'Activities';

// ============================================================================
// Helper: Get or Create Activities Table for Workspace
// ============================================================================

async function getActivitiesTable(workspaceId: string): Promise<string> {
  // Check if activities table exists for this workspace
  const { data: existingTables, error: searchError } = await supabase
    .from('data_tables')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('name', ACTIVITIES_TABLE_NAME)
    .single();

  if (existingTables && !searchError) {
    return existingTables.id;
  }

  // Get current user for created_by field
  const { authClient } = await import('@/lib/better-auth-client')
  const session = await authClient.getSession()
  const user = session?.data?.user
  if (!user) {
    throw new Error('User must be authenticated to create activities table');
  }

  // Create activities table if it doesn't exist
  const { data: newTable, error: createError } = await supabase
    .from('data_tables')
    .insert({
      workspace_id: workspaceId,
      name: ACTIVITIES_TABLE_NAME,
      slug: 'activities',
      description: 'Activities and events for this workspace',
      icon: 'calendar',
      color: '#3B82F6',
      settings: {},
      is_archived: false,
      created_by: user.id,
    })
    .select()
    .single();

  if (createError || !newTable) {
    throw new Error(`Failed to create activities table: ${createError?.message}`);
  }

  // Create default columns for activities
  const defaultColumns = [
    {
      table_id: newTable.id,
      name: 'name',
      label: 'Activity Name',
      column_type: 'text',
      position: 0,
      is_visible: true,
      width: 200,
    },
    {
      table_id: newTable.id,
      name: 'description',
      label: 'Description',
      column_type: 'text',
      position: 1,
      is_visible: true,
      width: 300,
    },
    {
      table_id: newTable.id,
      name: 'category',
      label: 'Category',
      column_type: 'select',
      position: 2,
      is_visible: true,
      width: 150,
      settings: {
        options: ['Academic', 'Sports', 'Arts', 'Social', 'Other']
      }
    },
    {
      table_id: newTable.id,
      name: 'begin_date',
      label: 'Start Date',
      column_type: 'date',
      position: 3,
      is_visible: true,
      width: 150,
    },
    {
      table_id: newTable.id,
      name: 'end_date',
      label: 'End Date',
      column_type: 'date',
      position: 4,
      is_visible: true,
      width: 150,
    },
    {
      table_id: newTable.id,
      name: 'status',
      label: 'Status',
      column_type: 'select',
      position: 5,
      is_visible: true,
      width: 120,
      settings: {
        options: ['upcoming', 'active', 'completed']
      }
    },
    {
      table_id: newTable.id,
      name: 'participants',
      label: 'Participants',
      column_type: 'number',
      position: 6,
      is_visible: true,
      width: 120,
    },
  ];

  const { error: columnsError } = await supabase
    .from('table_fields')
    .insert(defaultColumns);

  if (columnsError) {
    console.error('Failed to create default columns:', columnsError);
  }

  return newTable.id;
}

// ============================================================================
// Activity CRUD Operations
// ============================================================================

export const activitiesSupabase = {
  /**
   * List all activities for a workspace
   */
  async listActivities(workspaceId: string): Promise<Activity[]> {
    try {
      const tableId = await getActivitiesTable(workspaceId);

      const { data: rows, error } = await supabase
        .from('table_rows')
        .select('*')
        .eq('table_id', tableId)
        .order('position', { ascending: true });

      if (error) throw error;

      console.log('Activities rows fetched:', rows?.length);
      if (rows && rows.length > 0) {
        console.log('First activity data:', rows[0].data);
      }

      return (rows || []).map(row => ({
        id: row.id,
        workspace_id: workspaceId,
        name: row.data?.name || 'Untitled Activity',
        slug: row.data?.slug || row.id,
        description: row.data?.description || '',
        category: row.data?.category || '',
        begin_date: row.data?.begin_date || null,
        end_date: row.data?.end_date || null,
        status: row.data?.status || 'upcoming',
        participants: row.data?.participants || 0,
        settings: row.data?.settings || {},
        is_active: true,
        created_by: row.created_by || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error) {
      console.error('Error listing activities:', error);
      throw error;
    }
  },

  /**
   * Get a single activity by ID
   */
  async getActivity(activityId: string, workspaceId: string): Promise<Activity | null> {
    try {
      const tableId = await getActivitiesTable(workspaceId);

      const { data: row, error } = await supabase
        .from('table_rows')
        .select('*')
        .eq('table_id', tableId)
        .eq('id', activityId)
        .single();

      if (error || !row) return null;

      return {
        id: row.id,
        workspace_id: workspaceId,
        name: row.data?.name || 'Untitled Activity',
        slug: row.data?.slug || row.id,
        description: row.data?.description || '',
        category: row.data?.category || '',
        begin_date: row.data?.begin_date || null,
        end_date: row.data?.end_date || null,
        status: row.data?.status || 'upcoming',
        participants: row.data?.participants || 0,
        settings: row.data?.settings || {},
        is_active: true,
        created_by: row.created_by || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      console.error('Error getting activity:', error);
      throw error;
    }
  },

  /**
   * Create a new activity
   */
  async createActivity(workspaceId: string, input: CreateActivityInput): Promise<Activity> {
    try {
      const tableId = await getActivitiesTable(workspaceId);

      // Get current user for created_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated to create activities');
      }

      // Generate slug from name
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Get current row count for position
      const { count } = await supabase
        .from('table_rows')
        .select('*', { count: 'exact', head: true })
        .eq('table_id', tableId);

      const { data: row, error } = await supabase
        .from('table_rows')
        .insert({
          table_id: tableId,
          data: {
            name: input.name,
            slug,
            description: input.description || '',
            category: input.category || '',
            begin_date: input.begin_date || null,
            end_date: input.end_date || null,
            status: input.status || 'upcoming',
            participants: input.participants || 0,
            settings: input.settings || {},
          },
          position: count || 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !row) {
        throw new Error(`Failed to create activity: ${error?.message}`);
      }

      return {
        id: row.id,
        workspace_id: workspaceId,
        name: row.data.name,
        slug: row.data.slug,
        description: row.data.description,
        category: row.data.category,
        begin_date: row.data.begin_date,
        end_date: row.data.end_date,
        status: row.data.status,
        participants: row.data.participants,
        settings: row.data.settings,
        is_active: true,
        created_by: row.created_by || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  },

  /**
   * Update an activity
   */
  async updateActivity(
    activityId: string,
    workspaceId: string,
    input: UpdateActivityInput
  ): Promise<Activity> {
    try {
      const tableId = await getActivitiesTable(workspaceId);

      // Get current row data
      const { data: currentRow } = await supabase
        .from('table_rows')
        .select('data')
        .eq('table_id', tableId)
        .eq('id', activityId)
        .single();

      if (!currentRow) {
        throw new Error('Activity not found');
      }

      // Merge updates
      const updatedData = {
        ...currentRow.data,
        ...input,
      };

      const { data: row, error } = await supabase
        .from('table_rows')
        .update({ data: updatedData })
        .eq('table_id', tableId)
        .eq('id', activityId)
        .select()
        .single();

      if (error || !row) {
        throw new Error(`Failed to update activity: ${error?.message}`);
      }

      return {
        id: row.id,
        workspace_id: workspaceId,
        name: row.data.name,
        slug: row.data.slug,
        description: row.data.description,
        category: row.data.category,
        begin_date: row.data.begin_date,
        end_date: row.data.end_date,
        status: row.data.status,
        participants: row.data.participants,
        settings: row.data.settings,
        is_active: true,
        created_by: row.created_by || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  },

  /**
   * Delete an activity
   */
  async deleteActivity(activityId: string, workspaceId: string): Promise<void> {
    try {
      const tableId = await getActivitiesTable(workspaceId);

      const { error } = await supabase
        .from('table_rows')
        .delete()
        .eq('table_id', tableId)
        .eq('id', activityId);

      if (error) {
        throw new Error(`Failed to delete activity: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  },

  /**
   * Get the activities table ID for a workspace
   * Useful for linking other tables (attendance, reports, etc.)
   */
  async getActivitiesTableId(workspaceId: string): Promise<string> {
    return getActivitiesTable(workspaceId);
  },
};
