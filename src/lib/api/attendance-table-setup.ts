/**
 * Attendance Tables Setup
 * Creates tables for storing attendance sessions and records using the data_tables architecture
 */

import { tablesSupabase } from './tables-supabase'
import { supabase } from '@/lib/supabase'

export const ATTENDANCE_SESSIONS_TABLE_NAME = 'Attendance Sessions'
export const ATTENDANCE_SESSIONS_TABLE_SLUG = 'attendance_sessions'
export const ATTENDANCE_RECORDS_TABLE_NAME = 'Attendance Records'
export const ATTENDANCE_RECORDS_TABLE_SLUG = 'attendance_records'

/**
 * Get attendance sessions table columns
 */
function getAttendanceSessionsColumns(activitiesTableId?: string): any[] {
  return [
    {
      name: 'session_name',
      label: 'Session Name',
      column_type: 'text',
      is_primary: true,
      is_visible: true,
      position: 0,
      width: 200,
      validation: { required: true }
    },
    {
      name: 'activity',
      label: 'Activity',
      column_type: 'link',
      is_visible: true,
      position: 1,
      width: 200,
      linked_table_id: activitiesTableId,
      settings: {
        allowMultiple: false,
        linkedTableName: 'Activities'
      },
      validation: { required: true }
    },
    {
      name: 'session_date',
      label: 'Date',
      column_type: 'date',
      is_visible: true,
      position: 2,
      width: 120,
      validation: { required: true }
    },
    {
      name: 'begin_time',
      label: 'Start Time',
      column_type: 'text',
      is_visible: true,
      position: 3,
      width: 120,
      validation: { required: true }
    },
    {
      name: 'end_time',
      label: 'End Time',
      column_type: 'text',
      is_visible: true,
      position: 4,
      width: 120,
      validation: {}
    },
    {
      name: 'total_enrolled',
      label: 'Total Enrolled',
      column_type: 'number',
      is_visible: true,
      position: 5,
      width: 120,
      settings: {},
      validation: {}
    },
    {
      name: 'total_present',
      label: 'Total Present',
      column_type: 'number',
      is_visible: true,
      position: 6,
      width: 120,
      settings: {},
      validation: {}
    },
    {
      name: 'attendance_rate',
      label: 'Attendance Rate',
      column_type: 'percent',
      is_visible: true,
      position: 7,
      width: 120,
      settings: {},
      validation: {}
    },
    {
      name: 'notes',
      label: 'Notes',
      column_type: 'textarea',
      is_visible: false,
      position: 8,
      width: 300,
      validation: {}
    }
  ]
}

/**
 * Get attendance records table columns
 */
function getAttendanceRecordsColumns(sessionsTableId?: string, participantsTableId?: string): any[] {
  return [
    {
      name: 'session',
      label: 'Session',
      column_type: 'link',
      is_primary: false,
      is_visible: true,
      position: 0,
      width: 200,
      linked_table_id: sessionsTableId,
      settings: {
        allowMultiple: false,
        linkedTableName: 'Attendance Sessions'
      },
      validation: { required: true }
    },
    {
      name: 'participant',
      label: 'Participant',
      column_type: 'link',
      is_visible: true,
      position: 1,
      width: 200,
      linked_table_id: participantsTableId,
      settings: {
        allowMultiple: false,
        linkedTableName: 'Participants'
      },
      validation: { required: true }
    },
    {
      name: 'status',
      label: 'Status',
      column_type: 'select',
      is_visible: true,
      position: 2,
      width: 120,
      settings: {
        options: [
          { value: 'present', label: 'Present', color: '#10B981' },
          { value: 'absent', label: 'Absent', color: '#EF4444' },
          { value: 'late', label: 'Late', color: '#F59E0B' },
          { value: 'excused', label: 'Excused', color: '#6B7280' }
        ]
      },
      validation: { required: true }
    },
    {
      name: 'recorded_at',
      label: 'Recorded At',
      column_type: 'datetime',
      is_visible: true,
      position: 3,
      width: 180,
      validation: {}
    },
    {
      name: 'notes',
      label: 'Notes',
      column_type: 'textarea',
      is_visible: false,
      position: 4,
      width: 300,
      validation: {}
    }
  ]
}

/**
 * Check if attendance sessions table exists
 */
export async function attendanceSessionsTableExists(workspaceId: string): Promise<string | null> {
  try {
    const tables = await tablesSupabase.getTablesByWorkspace(workspaceId)
    const sessionsTable = tables?.find(t => t.slug === ATTENDANCE_SESSIONS_TABLE_SLUG)
    return sessionsTable?.id || null
  } catch (error) {
    console.error('Error checking attendance sessions table:', error)
    return null
  }
}

/**
 * Check if attendance records table exists
 */
export async function attendanceRecordsTableExists(workspaceId: string): Promise<string | null> {
  try {
    const tables = await tablesSupabase.getTablesByWorkspace(workspaceId)
    const recordsTable = tables?.find(t => t.slug === ATTENDANCE_RECORDS_TABLE_SLUG)
    return recordsTable?.id || null
  } catch (error) {
    console.error('Error checking attendance records table:', error)
    return null
  }
}

/**
 * Create attendance sessions table
 */
export async function createAttendanceSessionsTable(
  workspaceId: string,
  userId: string,
  activitiesTableId?: string
) {
  try {
    const table = await tablesSupabase.createTable({
      workspace_id: workspaceId,
      name: ATTENDANCE_SESSIONS_TABLE_NAME,
      slug: ATTENDANCE_SESSIONS_TABLE_SLUG,
      description: 'Track attendance sessions for activities',
      icon: 'calendar',
      color: '#8B5CF6',
      settings: {
        defaultView: 'grid',
        allowComments: true
      },
      is_archived: false,
      created_by: userId
    })

    // Create columns
    const columns = getAttendanceSessionsColumns(activitiesTableId)
    for (const column of columns) {
      const columnData: any = {
        table_id: table.id,
        ...column
      }
      
      // Set linked_table_id for activity link column
      if (column.name === 'activity' && column.column_type === 'link' && activitiesTableId) {
        columnData.linked_table_id = activitiesTableId
      }
      
      await tablesSupabase.createColumn(columnData)
    }

    // Create default view
    await supabase.from('table_views').insert({
      table_id: table.id,
      name: 'All Sessions',
      view_type: 'grid',
      settings: {},
      filters: [],
      sorts: [{ columnId: 'session_date', direction: 'desc' }],
      created_by: userId
    })

    return table
  } catch (error) {
    console.error('Error creating attendance sessions table:', error)
    throw error
  }
}

/**
 * Create attendance records table
 */
export async function createAttendanceRecordsTable(
  workspaceId: string,
  userId: string,
  sessionsTableId?: string,
  participantsTableId?: string
) {
  try {
    const table = await tablesSupabase.createTable({
      workspace_id: workspaceId,
      name: ATTENDANCE_RECORDS_TABLE_NAME,
      slug: ATTENDANCE_RECORDS_TABLE_SLUG,
      description: 'Individual attendance records for participants',
      icon: 'clipboard-check',
      color: '#10B981',
      settings: {
        defaultView: 'grid',
        allowComments: true
      },
      is_archived: false,
      created_by: userId
    })

    // Create columns
    const columns = getAttendanceRecordsColumns(sessionsTableId, participantsTableId)
    for (const column of columns) {
      const columnData: any = {
        table_id: table.id,
        ...column
      }
      
      // Set linked_table_id for link columns
      if (column.name === 'session' && column.column_type === 'link' && sessionsTableId) {
        columnData.linked_table_id = sessionsTableId
      }
      if (column.name === 'participant' && column.column_type === 'link' && participantsTableId) {
        columnData.linked_table_id = participantsTableId
      }
      
      await tablesSupabase.createColumn(columnData)
    }

    // Create default view
    await supabase.from('table_views').insert({
      table_id: table.id,
      name: 'All Records',
      view_type: 'grid',
      settings: {},
      filters: [],
      sorts: [{ columnId: 'recorded_at', direction: 'desc' }],
      created_by: userId
    })

    return table
  } catch (error) {
    console.error('Error creating attendance records table:', error)
    throw error
  }
}

/**
 * Get or create attendance sessions table
 */
export async function getOrCreateAttendanceSessionsTable(
  workspaceId: string,
  userId: string
) {
  const existingTableId = await attendanceSessionsTableExists(workspaceId)
  
  if (existingTableId) {
    return await tablesSupabase.getTableById(existingTableId)
  }
  
  // Get activities table for linking
  const { getOrCreateActivitiesTable } = await import('./activities-table-setup')
  const activitiesTable = await getOrCreateActivitiesTable(workspaceId, userId)
  
  return await createAttendanceSessionsTable(workspaceId, userId, activitiesTable?.id)
}

/**
 * Get or create attendance records table
 */
export async function getOrCreateAttendanceRecordsTable(
  workspaceId: string,
  userId: string
) {
  const existingTableId = await attendanceRecordsTableExists(workspaceId)
  
  if (existingTableId) {
    return await tablesSupabase.getTableById(existingTableId)
  }
  
  // Get related tables for linking
  const sessionsTable = await getOrCreateAttendanceSessionsTable(workspaceId, userId)
  const { getOrCreateParticipantsTable } = await import('./participants-setup')
  const participantsTable = await getOrCreateParticipantsTable(workspaceId, userId)
  
  return await createAttendanceRecordsTable(
    workspaceId,
    userId,
    sessionsTable?.id,
    participantsTable?.id
  )
}

