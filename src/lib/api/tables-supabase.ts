/**
 * Tables Supabase API Client
 * Temporary compatibility layer during migration to FastAPI
 * TODO: Migrate all usages to tables-client.ts
 */

import { supabase } from '@/lib/supabase'

export const tablesSupabase = {
  /**
   * Get all tables for a workspace
   */
  async getTablesByWorkspace(workspaceId: string) {
    const { data, error } = await supabase
      .from('data_tables')
      .select(`
        *,
        columns:table_fields!table_columns_table_id_fkey(*),
        views:table_views(*)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  /**
   * Get a single table by ID
   */
  async getTableById(tableId: string) {
    const { data, error } = await supabase
      .from('data_tables')
      .select(`
        *,
        columns:table_fields!table_columns_table_id_fkey(*),
        views:table_views(*),
        links:table_links!table_links_source_table_id_fkey(*)
      `)
      .eq('id', tableId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new table
   */
  async createTable(tableData: any) {
    const { data, error } = await supabase
      .from('data_tables')
      .insert(tableData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a table
   */
  async updateTable(tableId: string, updates: any) {
    const { data, error } = await supabase
      .from('data_tables')
      .update(updates)
      .eq('id', tableId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a table
   */
  async deleteTable(tableId: string) {
    const { error } = await supabase
      .from('data_tables')
      .delete()
      .eq('id', tableId)

    if (error) throw error
  },

  /**
   * Get table columns
   */
  async getTableColumns(tableId: string) {
    const { data, error } = await supabase
      .from('table_fields')
      .select('*')
      .eq('table_id', tableId)
      .order('position', { ascending: true })

    if (error) throw error
    return data
  },

  /**
   * Create a column
   */
  async createColumn(columnData: any) {
    const { data, error } = await supabase
      .from('table_fields')
      .insert(columnData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a column
   */
  async updateColumn(columnId: string, updates: any) {
    const { data, error } = await supabase
      .from('table_fields')
      .update(updates)
      .eq('id', columnId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a column
   */
  async deleteColumn(columnId: string) {
    const { error } = await supabase
      .from('table_fields')
      .delete()
      .eq('id', columnId)

    if (error) throw error
  },

  /**
   * Get table rows
   */
  async getTableRows(tableId: string) {
    const { data, error } = await supabase
      .from('table_rows')
      .select('*')
      .eq('table_id', tableId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  /**
   * Create a row
   */
  async createRow(rowData: any) {
    const { data, error } = await supabase
      .from('table_rows')
      .insert(rowData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a row
   */
  async updateRow(rowId: string, updates: any) {
    const { data, error } = await supabase
      .from('table_rows')
      .update(updates)
      .eq('id', rowId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a row
   */
  async deleteRow(rowId: string) {
    const { error } = await supabase
      .from('table_rows')
      .delete()
      .eq('id', rowId)

    if (error) throw error
  }
}
