/**
 * Participants Table Setup Helper
 * Creates and initializes the Participants table in a workspace
 */

import { tablesSupabase } from './tables-supabase'
import { 
  PARTICIPANTS_TABLE_NAME, 
  PARTICIPANTS_TABLE_SLUG, 
  PARTICIPANTS_TABLE_DESCRIPTION,
  getParticipantsColumns,
  PARTICIPANTS_DEFAULT_VIEW
} from '../activities/participants-schema'

/**
 * Check if participants table exists in workspace
 */
export async function participantsTableExists(workspaceId: string): Promise<string | null> {
  try {
    const tables = await tablesSupabase.getTablesByWorkspace(workspaceId)
    const participantsTable = tables?.find(t => t.slug === PARTICIPANTS_TABLE_SLUG)
    return participantsTable?.id || null
  } catch (error) {
    console.error('Error checking participants table:', error)
    return null
  }
}

/**
 * Create the participants table with all columns and default view
 */
export async function createParticipantsTable(workspaceId: string, userId: string) {
  try {
    // Create the table (following same pattern as activities table)
    const table = await tablesSupabase.createTable({
      workspace_id: workspaceId,
      name: PARTICIPANTS_TABLE_NAME,
      slug: PARTICIPANTS_TABLE_SLUG,
      description: PARTICIPANTS_TABLE_DESCRIPTION,
      icon: 'users',
      color: '#3B82F6',
      settings: {
        defaultView: 'grid',
        allowComments: true,
        allowAttachments: true
      },
      is_archived: false,
      created_by: userId
    })

    // Get or create activities table first (needed for link column)
    const { getOrCreateActivitiesTable } = await import('./activities-table-setup')
    const activitiesTable = await getOrCreateActivitiesTable(workspaceId, userId)

    // Create all columns (following same pattern as activities table)
    const columns = getParticipantsColumns()
    for (const column of columns) {
      const columnData: any = {
        table_id: table.id,
        ...column
      }
      
      // If this is the enrolled_programs link column, set the linked_table_id
      // This ensures the column shows which table it's connected to (Activities)
      if (column.name === 'enrolled_programs' && column.column_type === 'link' && activitiesTable?.id) {
        columnData.linked_table_id = activitiesTable.id
        // Add linked table name to settings for display purposes
        if (!columnData.settings) {
          columnData.settings = {}
        }
        columnData.settings.linkedTableName = activitiesTable.name || 'Activities'
        columnData.settings.linkedTableSlug = activitiesTable.slug || 'activities'
      }
      
      await tablesSupabase.createColumn(columnData)
    }

    // Create default view
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('table_views').insert({
      table_id: table.id,
      name: PARTICIPANTS_DEFAULT_VIEW.name,
      view_type: PARTICIPANTS_DEFAULT_VIEW.view_type,
      settings: PARTICIPANTS_DEFAULT_VIEW.settings,
      filters: PARTICIPANTS_DEFAULT_VIEW.filters,
      sorts: PARTICIPANTS_DEFAULT_VIEW.sorts,
      created_by: userId
    })

    // Set up table link relationship (for table_row_links)
    const { createParticipantsActivitiesLink } = await import('./participants-activities-link')
    await createParticipantsActivitiesLink(table.id, activitiesTable.id)

    return table
  } catch (error) {
    console.error('Error creating participants table:', error)
    throw error
  }
}

/**
 * Ensure enrolled_programs column has linked_table_id set
 * Also updates settings to show which table is connected
 */
export async function ensureEnrolledProgramsLinkColumn(
  participantsTableId: string,
  activitiesTableId: string
) {
  try {
    const columns = await tablesSupabase.getTableColumns(participantsTableId)
    const enrolledProgramsColumn = columns?.find(col => col.name === 'enrolled_programs')
    
    if (enrolledProgramsColumn && enrolledProgramsColumn.column_type === 'link') {
      // Get activities table info for display
      const { getOrCreateActivitiesTable } = await import('./activities-table-setup')
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      
      let activitiesTable = null
      if (user) {
        const workspaceId = (await tablesSupabase.getTableById(participantsTableId))?.workspace_id
        if (workspaceId) {
          activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id)
        }
      }
      
      // Check if linked_table_id is already set correctly
      const needsUpdate = enrolledProgramsColumn.linked_table_id !== activitiesTableId
      const currentSettings = enrolledProgramsColumn.settings || {}
      const needsSettingsUpdate = !currentSettings.linkedTableName || !currentSettings.linkedTableSlug
      
      if (needsUpdate || needsSettingsUpdate) {
        const updateData: any = {}
        
        if (needsUpdate) {
          updateData.linked_table_id = activitiesTableId
        }
        
        if (needsSettingsUpdate && activitiesTable) {
          const updatedSettings = {
            ...currentSettings,
            linkedTableName: activitiesTable.name || 'Activities',
            linkedTableSlug: activitiesTable.slug || 'activities'
          }
          updateData.settings = updatedSettings
        }
        
        const { error } = await supabase
          .from('table_fields')
          .update(updateData)
          .eq('id', enrolledProgramsColumn.id)
        
        if (error) {
          console.error('Error updating enrolled_programs column:', error)
          throw error
        }
        
        console.log('✅ Updated enrolled_programs column with linked_table_id and settings')
      }
    }
  } catch (error) {
    console.error('Error ensuring enrolled_programs link column:', error)
    // Don't throw - this is a best-effort update
  }
}

/**
 * Get or create participants table for a workspace
 */
export async function getOrCreateParticipantsTable(workspaceId: string, userId: string) {
  const existingTableId = await participantsTableExists(workspaceId)
  
  if (existingTableId) {
    const table = await tablesSupabase.getTableById(existingTableId)
    
    // Ensure enrolled_programs column has linked_table_id set
    const { getOrCreateActivitiesTable } = await import('./activities-table-setup')
    const activitiesTable = await getOrCreateActivitiesTable(workspaceId, userId)
    if (activitiesTable?.id) {
      await ensureEnrolledProgramsLinkColumn(existingTableId, activitiesTable.id)
    }
    
    return table
  }
  
  return await createParticipantsTable(workspaceId, userId)
}
