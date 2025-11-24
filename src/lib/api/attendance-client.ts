/**
 * Attendance Client
 * Handles saving and loading attendance data
 */

import { tablesSupabase } from './tables-supabase'
import { tablesGoClient } from './tables-go-client'
import { tableLinksGoClient, rowLinksGoClient } from './participants-go-client'
import { getOrCreateAttendanceSessionsTable, getOrCreateAttendanceRecordsTable } from './attendance-table-setup'
import { getOrCreateActivitiesTable } from './activities-table-setup'
import { getOrCreateParticipantsTable } from './participants-setup'
import { supabase } from '@/lib/supabase'

export interface AttendanceSession {
  id?: string
  activity_id: string
  session_date: string
  begin_time: string
  end_time: string
  total_enrolled?: number
  total_present?: number
  attendance_rate?: number
  notes?: string
}

export interface AttendanceRecord {
  id?: string
  session_id: string
  participant_id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  recorded_at?: string
  notes?: string
}

/**
 * Create or update an attendance session
 */
export async function saveAttendanceSession(
  workspaceId: string,
  userId: string,
  session: AttendanceSession
): Promise<string> {
  const sessionsTable = await getOrCreateAttendanceSessionsTable(workspaceId, userId)
  const activitiesTable = await getOrCreateActivitiesTable(workspaceId, userId)
  
  // Find activity row
  const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id)
  let activityRow = activityRows.find((row: any) => row.id === session.activity_id)
  if (!activityRow) {
    activityRow = activityRows.find((row: any) =>
      row.data?.legacy_activity_id === session.activity_id ||
      row.data?.name === session.activity_id
    )
  }
  
  if (!activityRow) {
    throw new Error('Activity not found')
  }
  
  // Get columns
  const columns = await tablesSupabase.getTableColumns(sessionsTable.id)
  const activityColumn = columns?.find(c => c.name === 'activity')
  const dateColumn = columns?.find(c => c.name === 'session_date')
  const beginTimeColumn = columns?.find(c => c.name === 'begin_time')
  const endTimeColumn = columns?.find(c => c.name === 'end_time')
  const totalEnrolledColumn = columns?.find(c => c.name === 'total_enrolled')
  const totalPresentColumn = columns?.find(c => c.name === 'total_present')
  const attendanceRateColumn = columns?.find(c => c.name === 'attendance_rate')
  const notesColumn = columns?.find(c => c.name === 'notes')
  
  // Prepare row data
  const rowData: Record<string, any> = {}
  if (activityColumn) {
    rowData[activityColumn.name] = [activityRow.id] // Link to activity
  }
  if (dateColumn) {
    rowData[dateColumn.name] = session.session_date
  }
  if (beginTimeColumn) {
    rowData[beginTimeColumn.name] = session.begin_time
  }
  if (endTimeColumn) {
    rowData[endTimeColumn.name] = session.end_time
  }
  if (totalEnrolledColumn && session.total_enrolled !== undefined) {
    rowData[totalEnrolledColumn.name] = session.total_enrolled
  }
  if (totalPresentColumn && session.total_present !== undefined) {
    rowData[totalPresentColumn.name] = session.total_present
  }
  if (attendanceRateColumn && session.attendance_rate !== undefined) {
    rowData[attendanceRateColumn.name] = session.attendance_rate / 100 // Convert to decimal
  }
  if (notesColumn && session.notes) {
    rowData[notesColumn.name] = session.notes
  }
  
  // Generate session name
  const sessionName = `${new Date(session.session_date).toLocaleDateString()} - ${session.begin_time}`
  const nameColumn = columns?.find(c => c.name === 'session_name')
  if (nameColumn) {
    rowData[nameColumn.name] = sessionName
  }
  
  let sessionRowId: string
  
  if (session.id) {
    // Update existing session
    await tablesGoClient.updateRow(session.id, { data: rowData })
    sessionRowId = session.id
  } else {
    // Create new session
    const newRow = await tablesSupabase.createRow({
      table_id: sessionsTable.id,
      data: rowData,
      created_by: userId
    })
    sessionRowId = newRow.id
    
    // Link to activity if needed
    if (activityColumn && activityRow.id) {
      const links = await tableLinksGoClient.getTableLinks(sessionsTable.id)
      let link = links.find((l: any) =>
        l.source_table_id === sessionsTable.id &&
        l.target_table_id === activitiesTable.id
      )
      
      if (!link && activityColumn.id) {
        link = await tableLinksGoClient.createTableLink(
          sessionsTable.id,
          activityColumn.id,
          activitiesTable.id,
          'many_to_many',
          { label: 'Activity', reverseLabel: 'Sessions' }
        )
      }
      
      if (link) {
        await rowLinksGoClient.createRowLink(sessionRowId, activityRow.id, link.id, {})
      }
    }
  }
  
  return sessionRowId
}

/**
 * Save attendance records for a session (optimized for speed)
 * Uses batch operations and checks for existing records to avoid duplicates
 */
export async function saveAttendanceRecords(
  workspaceId: string,
  userId: string,
  sessionId: string,
  records: AttendanceRecord[]
): Promise<void> {
  const recordsTable = await getOrCreateAttendanceRecordsTable(workspaceId, userId)
  const sessionsTable = await getOrCreateAttendanceSessionsTable(workspaceId, userId)
  const participantsTable = await getOrCreateParticipantsTable(workspaceId, userId)
  
  // Get columns
  const columns = await tablesSupabase.getTableColumns(recordsTable.id)
  const sessionColumn = columns?.find(c => c.name === 'session')
  const participantColumn = columns?.find(c => c.name === 'participant')
  const statusColumn = columns?.find(c => c.name === 'status')
  const recordedAtColumn = columns?.find(c => c.name === 'recorded_at')
  const notesColumn = columns?.find(c => c.name === 'notes')
  
  // Get session row
  const sessionRows = await tablesGoClient.getRowsByTable(sessionsTable.id)
  const sessionRow = sessionRows.find((row: any) => row.id === sessionId)
  if (!sessionRow) {
    throw new Error('Session not found')
  }
  
  // Get all participant rows in one query (for fast lookup)
  const participantRows = await tablesGoClient.getRowsByTable(participantsTable.id)
  const participantMap = new Map(participantRows.map((row: any) => [row.id, row]))
  
  // Get or create links (cache these)
  let sessionLink = await tableLinksGoClient.getTableLinks(recordsTable.id)
    .then(links => links.find((l: any) =>
      l.source_table_id === recordsTable.id &&
      l.target_table_id === sessionsTable.id
    ))
  
  if (!sessionLink && sessionColumn?.id) {
    sessionLink = await tableLinksGoClient.createTableLink(
      recordsTable.id,
      sessionColumn.id,
      sessionsTable.id,
      'many_to_many',
      { label: 'Session', reverseLabel: 'Records' }
    )
  }
  
  let participantLink = await tableLinksGoClient.getTableLinks(recordsTable.id)
    .then(links => links.find((l: any) =>
      l.source_table_id === recordsTable.id &&
      l.target_table_id === participantsTable.id
    ))
  
  if (!participantLink && participantColumn?.id) {
    participantLink = await tableLinksGoClient.createTableLink(
      recordsTable.id,
      participantColumn.id,
      participantsTable.id,
      'many_to_many',
      { label: 'Participant', reverseLabel: 'Attendance Records' }
    )
  }
  
  // Load existing records for this session to avoid duplicates
  // Query directly from table_rows for faster lookup
  const allRecordsRows = await tablesGoClient.getRowsByTable(recordsTable.id)
  const existingRecordsMap = new Map<string, AttendanceRecord>()
  
  // Find existing records for this session
  for (const row of allRecordsRows) {
    const rowSessionId = row.data?.session_id
    const rowParticipantId = row.data?.participant_id
    
    if (rowSessionId === sessionId && rowParticipantId) {
      existingRecordsMap.set(rowParticipantId, {
        id: row.id,
        session_id: sessionId,
        participant_id: rowParticipantId,
        status: row.data?.[statusColumn?.name || 'status'] || 'absent',
        recorded_at: row.data?.[recordedAtColumn?.name || 'recorded_at'] || new Date().toISOString()
      })
    }
  }
  
  console.log(`📊 Found ${existingRecordsMap.size} existing records for session ${sessionId}`)
  
  // Prepare batch operations
  const updates: Promise<any>[] = []
  const creates: Array<{ rowData: any; participantId: string }> = []
  const linkCreates: Array<{ recordId: string; participantId: string }> = []
  
  const recordedAt = new Date().toISOString()
  
  // Process each record
  for (const record of records) {
    const participantRow = participantMap.get(record.participant_id)
    if (!participantRow) {
      console.warn(`Participant ${record.participant_id} not found, skipping`)
      continue
    }
    
    const rowData: Record<string, any> = {}
    if (sessionColumn) {
      rowData[sessionColumn.name] = [sessionRow.id]
    }
    if (participantColumn) {
      rowData[participantColumn.name] = [participantRow.id]
    }
    if (statusColumn) {
      rowData[statusColumn.name] = record.status
    }
    if (recordedAtColumn) {
      rowData[recordedAtColumn.name] = record.recorded_at || recordedAt
    }
    if (notesColumn && record.notes) {
      rowData[notesColumn.name] = record.notes
    }
    
    // Store participant_id directly in data for fast lookups
    rowData.participant_id = record.participant_id
    rowData.session_id = sessionId
    
    const existing = existingRecordsMap.get(record.participant_id)
    
    if (existing?.id) {
      // Update existing record
      console.log(`🔄 Updating existing record ${existing.id} for participant ${record.participant_id}`)
      updates.push(tablesGoClient.updateRow(existing.id, { data: rowData }))
    } else {
      // Queue for creation
      console.log(`➕ Creating new record for participant ${record.participant_id}`)
      creates.push({ rowData, participantId: record.participant_id })
    }
  }
  
  // Execute updates in parallel
  await Promise.all(updates)
  
  // Create new records (only if not already exists - double check for race conditions)
  for (const { rowData, participantId } of creates) {
    // Double-check we don't already have a record (race condition protection)
    const doubleCheck = existingRecordsMap.get(participantId)
    if (doubleCheck?.id) {
      console.log(`⚠️ Record already exists for participant ${participantId}, skipping creation`)
      // Update it instead
      await tablesGoClient.updateRow(doubleCheck.id, { data: rowData })
      continue
    }
    
    const newRow = await tablesSupabase.createRow({
      table_id: recordsTable.id,
      data: rowData,
      created_by: userId
    })
    
    linkCreates.push({ recordId: newRow.id, participantId })
  }
  
  // Create links in parallel (batch)
  const linkPromises: Promise<any>[] = []
  for (const { recordId, participantId } of linkCreates) {
    const participantRow = participantMap.get(participantId)
    if (!participantRow) continue
    
    if (sessionLink) {
      linkPromises.push(
        rowLinksGoClient.createRowLink(recordId, sessionRow.id, sessionLink.id, {})
      )
    }
    if (participantLink) {
      linkPromises.push(
        rowLinksGoClient.createRowLink(recordId, participantRow.id, participantLink.id, {})
      )
    }
  }
  
  await Promise.all(linkPromises)
}

/**
 * Load attendance sessions for an activity
 */
export async function loadAttendanceSessions(
  workspaceId: string,
  userId: string,
  activityId: string
): Promise<AttendanceSession[]> {
  const sessionsTable = await getOrCreateAttendanceSessionsTable(workspaceId, userId)
  const activitiesTable = await getOrCreateActivitiesTable(workspaceId, userId)
  
  // Find activity row
  const activityRows = await tablesGoClient.getRowsByTable(activitiesTable.id)
  let activityRow = activityRows.find((row: any) => row.id === activityId)
  if (!activityRow) {
    activityRow = activityRows.find((row: any) =>
      row.data?.legacy_activity_id === activityId ||
      row.data?.name === activityId
    )
  }
  
  if (!activityRow) {
    return []
  }
  
  // Get all sessions linked to this activity
  const links = await tableLinksGoClient.getTableLinks(sessionsTable.id)
  const link = links.find((l: any) =>
    l.source_table_id === sessionsTable.id &&
    l.target_table_id === activitiesTable.id
  )
  
  if (!link) {
    return []
  }
  
  const linkedRows = await rowLinksGoClient.getLinkedRows(activityRow.id, link.id)
  const sessionRows = linkedRows
    .filter((lr: any) => lr.row && lr.row.id !== activityRow.id)
    .map((lr: any) => lr.row)
  
  // Get columns
  const columns = await tablesSupabase.getTableColumns(sessionsTable.id)
  const dateColumn = columns?.find(c => c.name === 'session_date')
  const beginTimeColumn = columns?.find(c => c.name === 'begin_time')
  const endTimeColumn = columns?.find(c => c.name === 'end_time')
  const totalEnrolledColumn = columns?.find(c => c.name === 'total_enrolled')
  const totalPresentColumn = columns?.find(c => c.name === 'total_present')
  const attendanceRateColumn = columns?.find(c => c.name === 'attendance_rate')
  
  return sessionRows.map((row: any) => ({
    id: row.id,
    activity_id: activityId,
    session_date: row.data?.[dateColumn?.name || 'session_date'] || '',
    begin_time: row.data?.[beginTimeColumn?.name || 'begin_time'] || '',
    end_time: row.data?.[endTimeColumn?.name || 'end_time'] || '',
    total_enrolled: row.data?.[totalEnrolledColumn?.name || 'total_enrolled'] || 0,
    total_present: row.data?.[totalPresentColumn?.name || 'total_present'] || 0,
    attendance_rate: (row.data?.[attendanceRateColumn?.name || 'attendance_rate'] || 0) * 100
  }))
}

/**
 * Load attendance records for a session (optimized for speed)
 * Uses direct data lookup instead of multiple link queries
 */
export async function loadAttendanceRecords(
  workspaceId: string,
  userId: string,
  sessionId: string
): Promise<AttendanceRecord[]> {
  const recordsTable = await getOrCreateAttendanceRecordsTable(workspaceId, userId)
  const sessionsTable = await getOrCreateAttendanceSessionsTable(workspaceId, userId)
  
  // Get session row
  const sessionRows = await tablesGoClient.getRowsByTable(sessionsTable.id)
  const sessionRow = sessionRows.find((row: any) => row.id === sessionId)
  if (!sessionRow) {
    return []
  }
  
  // Get all records linked to this session
  const links = await tableLinksGoClient.getTableLinks(recordsTable.id)
  const link = links.find((l: any) =>
    l.source_table_id === recordsTable.id &&
    l.target_table_id === sessionsTable.id
  )
  
  if (!link) {
    return []
  }
  
  // Get all linked rows in one query
  const linkedRows = await rowLinksGoClient.getLinkedRows(sessionRow.id, link.id)
  const recordRows = linkedRows
    .filter((lr: any) => lr.row && lr.row.id !== sessionRow.id)
    .map((lr: any) => lr.row)
  
  // Get columns
  const columns = await tablesSupabase.getTableColumns(recordsTable.id)
  const statusColumn = columns?.find(c => c.name === 'status')
  const recordedAtColumn = columns?.find(c => c.name === 'recorded_at')
  
  // Extract records directly from row data (fast - no additional queries)
  const records: AttendanceRecord[] = recordRows.map((row: any) => {
    // participant_id is stored directly in row.data for fast lookup
    const participantId = row.data?.participant_id || 
      // Fallback: try to get from participant link column
      (row.data?.participant && Array.isArray(row.data.participant) ? row.data.participant[0] : '')
    
    return {
      id: row.id,
      session_id: sessionId,
      participant_id: participantId,
      status: row.data?.[statusColumn?.name || 'status'] || 'absent',
      recorded_at: row.data?.[recordedAtColumn?.name || 'recorded_at'] || new Date().toISOString(),
      notes: row.data?.notes
    }
  })
  
  return records
}

/**
 * Load attendance records for a session by participant IDs (fast lookup)
 * Returns a map of participant_id -> status for O(1) lookups
 */
export async function loadAttendanceRecordsMap(
  workspaceId: string,
  userId: string,
  sessionId: string
): Promise<Map<string, AttendanceRecord>> {
  const records = await loadAttendanceRecords(workspaceId, userId, sessionId)
  return new Map(records.map(r => [r.participant_id, r]))
}

