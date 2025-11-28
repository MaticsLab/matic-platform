/**
 * Tables Go API Client
 * Complete replacement for tables-supabase.ts using Go backend
 */

import { goClient } from './go-client'
import type { DataTable, TableColumn, TableRow, TableView } from '@/types/data-tables'
import { semanticSearchClient } from './semantic-search-client'

export interface CreateTableInput {
  workspace_id: string
  name: string
  description?: string
  icon?: string
  columns?: Omit<TableColumn, 'id' | 'table_id' | 'created_at' | 'updated_at'>[]
  settings?: Record<string, any>
}

export interface UpdateTableInput {
  name?: string
  description?: string
  icon?: string
  settings?: Record<string, any>
}

export interface CreateRowInput {
  data: Record<string, any>
  position: number
}

export interface UpdateRowInput {
  data?: Record<string, any>
  position?: number
}

export interface BulkCreateRowsInput {
  rows: Record<string, any>[]
  created_by: string
}

/**
 * Tables Go API Client
 */
export const tablesGoClient = {
  // ============ Tables ============

  /**
   * Get all tables in a workspace
   */
  async getTablesByWorkspace(workspaceId: string): Promise<DataTable[]> {
    return goClient.get<DataTable[]>('/tables', { workspace_id: workspaceId })
  },

  /**
   * Get a single table by ID with columns and views
   */
  async getTableById(tableId: string): Promise<DataTable> {
    return goClient.get<DataTable>(`/tables/${tableId}`)
  },

  /**
   * Create a new table
   */
  async createTable(input: CreateTableInput, userId: string): Promise<DataTable> {
    return goClient.post<DataTable>(
      '/tables',
      {
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description || '',
        icon: input.icon || 'table',
        settings: input.settings || {},
      },
      { user_id: userId }
    )
  },

  /**
   * Update a table
   */
  async updateTable(tableId: string, input: UpdateTableInput): Promise<DataTable> {
    return goClient.patch<DataTable>(`/tables/${tableId}`, input)
  },

  /**
   * Delete a table
   */
  async deleteTable(tableId: string): Promise<void> {
    return goClient.delete<void>(`/tables/${tableId}`)
  },

  // ============ Table Columns ============

  /**
   * Get columns for a table
   */
  async getTableColumns(tableId: string): Promise<TableColumn[]> {
    const table = await this.getTableById(tableId)
    return table.columns || []
  },

  /**
   * Create a new column
   */
  async createColumn(
    tableId: string,
    input: Omit<TableColumn, 'id' | 'created_at' | 'updated_at'>
  ): Promise<TableColumn> {
    const payload: any = {
      name: input.name,
      label: input.label || input.name, // Use label if provided, otherwise use name
      type: input.column_type,
      position: input.position || 0,
      width: input.width || 200,
      is_primary: input.is_primary || false,
      options: input.settings || {},
      validation: input.validation || {},
    }
    
    // Add linked_table_id if it's a link column
    if (input.column_type === 'link' && input.linked_table_id) {
      payload.linked_table_id = input.linked_table_id
    }
    
    console.log('Creating column with payload:', payload)
    return goClient.post<TableColumn>(`/tables/${tableId}/columns`, payload)
  },

  /**
   * Update a column
   */
  async updateColumn(
    tableId: string,
    columnId: string,
    input: Partial<Omit<TableColumn, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<TableColumn> {
    const updateData: Record<string, any> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.label !== undefined) updateData.label = input.label
    if (input.column_type !== undefined) updateData.type = input.column_type
    if (input.position !== undefined) updateData.position = input.position
    if (input.width !== undefined) updateData.width = input.width
    if (input.is_visible !== undefined) updateData.is_visible = input.is_visible
    if (input.is_primary !== undefined) updateData.is_primary = input.is_primary
    if (input.linked_table_id !== undefined) updateData.linked_table_id = input.linked_table_id
    if (input.settings !== undefined) updateData.options = input.settings
    if (input.validation !== undefined) updateData.validation = input.validation
    
    return goClient.patch<TableColumn>(`/tables/${tableId}/columns/${columnId}`, updateData)
  },

  /**
   * Delete a column
   */
  async deleteColumn(tableId: string, columnId: string): Promise<void> {
    return goClient.delete<void>(`/tables/${tableId}/columns/${columnId}`)
  },

  // ============ Table Rows ============

  /**
   * Get all rows for a table
   */
  async getRowsByTable(tableId: string): Promise<TableRow[]> {
    return goClient.get<TableRow[]>(`/tables/${tableId}/rows`)
  },

  /**
   * Create a new row
   */
  async createRow(tableId: string, input: CreateRowInput, userId: string): Promise<TableRow> {
    const row = await goClient.post<TableRow>(
      `/tables/${tableId}/rows`,
      input,
      { user_id: userId }
    )
    
    // Queue row for embedding (fire and forget)
    if (row?.id) {
      semanticSearchClient.queueForEmbedding(row.id, 'row', 5).catch(() => {})
    }
    
    return row
  },

  /**
   * Update a row
   */
  async updateRow(tableId: string, rowId: string, input: UpdateRowInput): Promise<TableRow> {
    const row = await goClient.patch<TableRow>(`/tables/${tableId}/rows/${rowId}`, input)
    
    // Queue row for re-embedding (fire and forget)
    if (row?.id) {
      semanticSearchClient.queueForEmbedding(row.id, 'row', 3).catch(() => {})
    }
    
    return row
  },

  /**
   * Delete a row
   */
  async deleteRow(tableId: string, rowId: string): Promise<void> {
    return goClient.delete<void>(`/tables/${tableId}/rows/${rowId}`)
  },

  /**
   * Bulk create rows
   */
  async bulkCreateRows(tableId: string, input: BulkCreateRowsInput): Promise<TableRow[]> {
    // Note: This endpoint doesn't exist in Go backend yet
    // You'll need to add it to go-backend/handlers/data_tables.go
    // For now, we'll create rows one at a time
    const createdRows: TableRow[] = []
    
    for (let i = 0; i < input.rows.length; i++) {
      try {
        const row = await this.createRow(
          tableId,
          { data: input.rows[i], position: i },
          input.created_by
        )
        createdRows.push(row)
      } catch (error) {
        console.error(`Failed to create row ${i}:`, error)
        // Continue with other rows even if one fails
      }
    }
    
    return createdRows
  },

  // ============ Search ============

  /**
   * Search table rows
   */
  async searchTableRows(tableId: string, query: string): Promise<TableRow[]> {
    return goClient.get<TableRow[]>(`/tables/${tableId}/search`, { q: query })
  },
}

/**
 * Backward compatibility - use tablesGoClient instead
 * @deprecated Use tablesGoClient
 */
export const tablesSupabaseCompat = tablesGoClient
