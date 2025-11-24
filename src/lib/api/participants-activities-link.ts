/**
 * Participants-Activities Relationship Manager
 * Handles linking participants to activities using table_links
 */

import { supabase } from '@/lib/supabase'
import { tablesSupabase } from './tables-supabase'

/**
 * Create table link between participants and activities
 */
export async function createParticipantsActivitiesLink(
  participantsTableId: string,
  activitiesTableId: string
) {
  try {
    // Get the enrolled_programs column from participants table
    const participantsColumns = await tablesSupabase.getTableColumns(participantsTableId)
    const enrolledProgramsColumn = participantsColumns?.find(
      col => col.name === 'enrolled_programs'
    )
    
    if (!enrolledProgramsColumn) {
      console.error('enrolled_programs column not found. Available columns:', participantsColumns?.map(c => c.name))
      throw new Error('enrolled_programs column not found')
    }

    if (!enrolledProgramsColumn.id) {
      console.error('enrolled_programs column has no id:', enrolledProgramsColumn)
      throw new Error('enrolled_programs column has no id')
    }

    console.log('Creating link with:', {
      participantsTableId,
      sourceColumnId: enrolledProgramsColumn.id,
      activitiesTableId,
      linkType: 'many_to_many'
    })

    // Check if link already exists via Go API
    const { tableLinksGoClient } = await import('./participants-go-client')
    const existingLinks = await tableLinksGoClient.getTableLinks(participantsTableId)
    const existingLink = existingLinks.find(l => 
      l.target_table_id === activitiesTableId && 
      l.link_type === 'many_to_many'
    )

    if (existingLink) {
      // Link already exists, return it silently
      return existingLink
    }

    // Create the link via Go API (passing source_column_id)
    const link = await tableLinksGoClient.createTableLink(
      participantsTableId,
      enrolledProgramsColumn.id,
      activitiesTableId,
      'many_to_many',
      {
        label: 'Participants',
        reverseLabel: 'Enrolled Programs'
      }
    )

    console.log('Link created successfully:', link)
    return link
  } catch (error) {
    console.error('Error creating participants-activities link:', error)
    throw error
  }
}

/**
 * Ensure link exists between participants and activities tables
 * This function will create the link if both tables exist and the link doesn't exist yet
 */
export async function ensureParticipantsActivitiesLink(
  workspaceId: string,
  userId: string
): Promise<string | null> {
  try {
    // Check if both tables exist
    const { participantsTableExists } = await import('./participants-setup')
    const { activitiesTableExists } = await import('./activities-table-setup')
    
    const participantsTableId = await participantsTableExists(workspaceId)
    const activitiesTableId = await activitiesTableExists(workspaceId)
    
    if (!participantsTableId || !activitiesTableId) {
      // One or both tables don't exist yet - can't create link
      return null
    }

    // Check if link already exists
    const { tableLinksGoClient } = await import('./participants-go-client')
    const existingLinks = await tableLinksGoClient.getTableLinks(participantsTableId)
    const existingLink = existingLinks.find(l => 
      l.target_table_id === activitiesTableId && 
      l.link_type === 'many_to_many'
    )

    if (existingLink) {
      return existingLink.id
    }

    // Create the link
    const link = await createParticipantsActivitiesLink(participantsTableId, activitiesTableId)
    return link?.id || null
  } catch (error) {
    console.warn('Could not ensure participants-activities link:', error)
    return null
  }
}

/**
 * Enroll participant in an activity (create row link)
 */
export async function enrollParticipantInActivity(
  participantRowId: string,
  activityRowId: string,
  linkId: string,
  enrollmentData?: {
    enrolled_date?: string
    status?: 'active' | 'inactive' | 'completed' | 'withdrawn'
    notes?: string
  }
) {
  try {
    // Check if already enrolled
    const { data: existingLink } = await supabase
      .from('table_row_links')
      .select('*')
      .eq('link_id', linkId)
      .eq('source_row_id', participantRowId)
      .eq('target_row_id', activityRowId)
      .single()

    if (existingLink) {
      // Update metadata if provided
      if (enrollmentData) {
        const { data, error } = await supabase
          .from('table_row_links')
          .update({
            metadata: {
              ...existingLink.metadata,
              ...enrollmentData,
              updated_at: new Date().toISOString()
            }
          })
          .eq('id', existingLink.id)
          .select()
          .single()

        if (error) throw error
        return data
      }
      return existingLink
    }

    // Create new enrollment
    const { data, error } = await supabase
      .from('table_row_links')
      .insert({
        link_id: linkId,
        source_row_id: participantRowId,
        target_row_id: activityRowId,
        metadata: {
          enrolled_date: enrollmentData?.enrolled_date || new Date().toISOString(),
          status: enrollmentData?.status || 'active',
          notes: enrollmentData?.notes || '',
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error enrolling participant:', error)
    throw error
  }
}

/**
 * Unenroll participant from activity (delete row link)
 */
export async function unenrollParticipantFromActivity(
  participantRowId: string,
  activityRowId: string,
  linkId: string
) {
  try {
    const { error } = await supabase
      .from('table_row_links')
      .delete()
      .eq('link_id', linkId)
      .eq('source_row_id', participantRowId)
      .eq('target_row_id', activityRowId)

    if (error) throw error
  } catch (error) {
    console.error('Error unenrolling participant:', error)
    throw error
  }
}

/**
 * Get all participants enrolled in an activity
 */
export async function getParticipantsForActivity(
  activityRowId: string,
  linkId: string
) {
  try {
    // Use Go API to get linked rows
    const { rowLinksGoClient } = await import('./participants-go-client')
    const linkedRows = await rowLinksGoClient.getLinkedRows(activityRowId, linkId)

    return linkedRows.map(linkedRow => ({
      ...linkedRow.row,
      enrollment: linkedRow.link_data
    }))
  } catch (error) {
    console.error('Error getting participants for activity:', error)
    throw error
  }
}

/**
 * Get all activities a participant is enrolled in
 */
export async function getActivitiesForParticipant(
  participantRowId: string,
  linkId: string
) {
  try {
    const { data: rowLinks, error } = await supabase
      .from('table_row_links')
      .select(`
        *,
        activity:table_rows!table_row_links_target_row_id_fkey(*)
      `)
      .eq('link_id', linkId)
      .eq('source_row_id', participantRowId)

    if (error) throw error

    return rowLinks?.map(link => ({
      ...link.activity,
      enrollment: link.metadata
    })) || []
  } catch (error) {
    console.error('Error getting activities for participant:', error)
    throw error
  }
}

/**
 * Update enrollment status
 */
export async function updateEnrollmentStatus(
  participantRowId: string,
  activityRowId: string,
  linkId: string,
  status: 'active' | 'inactive' | 'completed' | 'withdrawn',
  notes?: string
) {
  try {
    const { data: rowLink } = await supabase
      .from('table_row_links')
      .select('*')
      .eq('link_id', linkId)
      .eq('source_row_id', participantRowId)
      .eq('target_row_id', activityRowId)
      .single()

    if (!rowLink) {
      throw new Error('Enrollment not found')
    }

    const { data, error } = await supabase
      .from('table_row_links')
      .update({
        metadata: {
          ...rowLink.metadata,
          status,
          notes: notes || rowLink.metadata?.notes || '',
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', rowLink.id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating enrollment status:', error)
    throw error
  }
}

/**
 * Get enrollment details
 */
export async function getEnrollmentDetails(
  participantRowId: string,
  activityRowId: string,
  linkId: string
) {
  try {
    const { data, error } = await supabase
      .from('table_row_links')
      .select('*')
      .eq('link_id', linkId)
      .eq('source_row_id', participantRowId)
      .eq('target_row_id', activityRowId)
      .single()

    if (error) throw error
    return data?.metadata || null
  } catch (error) {
    console.error('Error getting enrollment details:', error)
    return null
  }
}
