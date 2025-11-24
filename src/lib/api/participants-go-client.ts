/**
 * Participants Go API Client
 * Wraps Go backend endpoints for participant management
 */

import { goClient } from './go-client'
import type { Participant, CreateParticipantInput, UpdateParticipantInput } from '@/types/participants'
import type { TableRow } from '@/types/data-tables'

export interface TableLink {
  id: string
  source_table_id: string
  target_table_id: string
  link_type: 'one_to_many' | 'many_to_many'
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TableRowLink {
  id: string
  link_id: string
  source_row_id: string
  target_row_id: string
  link_data: Record<string, any>
  created_at: string
  updated_at: string
}

export interface LinkedRowResponse {
  row: TableRow
  link_data: Record<string, any>
  row_link_id: string
}

/**
 * Participants (Table Rows) API
 */
export const participantsGoClient = {
  /**
   * Get all participants (table rows) for a table
   */
  async getParticipants(tableId: string): Promise<TableRow[]> {
    return goClient.get<TableRow[]>(`/tables/${tableId}/rows`)
  },

  /**
   * Create a new participant (table row)
   */
  async createParticipant(
    tableId: string,
    data: Record<string, any>,
    userId: string
  ): Promise<TableRow> {
    return goClient.post<TableRow>(
      `/tables/${tableId}/rows`,
      { data, position: 0 },
      { user_id: userId }
    )
  },

  /**
   * Update a participant (table row)
   */
  async updateParticipant(
    tableId: string,
    rowId: string,
    data: Record<string, any>
  ): Promise<TableRow> {
    return goClient.patch<TableRow>(
      `/tables/${tableId}/rows/${rowId}`,
      { data }
    )
  },

  /**
   * Delete a participant (table row)
   */
  async deleteParticipant(tableId: string, rowId: string): Promise<void> {
    return goClient.delete<void>(`/tables/${tableId}/rows/${rowId}`)
  },
}

/**
 * Table Links API - for managing relationships between tables
 */
export const tableLinksGoClient = {
  /**
   * Get all links for a table
   */
  async getTableLinks(tableId: string): Promise<TableLink[]> {
    return goClient.get<TableLink[]>('/table-links', { table_id: tableId })
  },

  /**
   * Create a link between two tables
   */
  async createTableLink(
    sourceTableId: string,
    sourceColumnId: string,
    targetTableId: string,
    linkType: 'one_to_many' | 'many_to_many',
    settings?: Record<string, any>,
    targetColumnId?: string
  ): Promise<TableLink> {
    return goClient.post<TableLink>('/table-links', {
      source_table_id: sourceTableId,
      source_column_id: sourceColumnId,
      target_table_id: targetTableId,
      target_column_id: targetColumnId || null,
      link_type: linkType,
      settings: settings || {},
    })
  },

  /**
   * Delete a table link
   */
  async deleteTableLink(linkId: string): Promise<void> {
    return goClient.delete<void>(`/table-links/${linkId}`)
  },
}

/**
 * Row Links API - for managing enrollments and connections between rows
 */
export const rowLinksGoClient = {
  /**
   * Get all rows linked to a specific row (e.g., activities enrolled by a participant)
   */
  async getLinkedRows(rowId: string, linkId: string): Promise<LinkedRowResponse[]> {
    return goClient.get<LinkedRowResponse[]>(
      `/row-links/rows/${rowId}/linked`,
      { link_id: linkId }
    )
  },

  /**
   * Create a link between two rows (e.g., enroll participant in activity)
   */
  async createRowLink(
    sourceRowId: string,
    targetRowId: string,
    linkId: string,
    linkData?: Record<string, any>
  ): Promise<TableRowLink> {
    return goClient.post<TableRowLink>('/row-links', {
      source_row_id: sourceRowId,
      target_row_id: targetRowId,
      link_id: linkId,
      link_data: linkData || {},
    })
  },

  /**
   * Update row link metadata (e.g., update enrollment status)
   */
  async updateRowLink(
    rowLinkId: string,
    linkData: Record<string, any>
  ): Promise<TableRowLink> {
    return goClient.patch<TableRowLink>(
      `/row-links/${rowLinkId}`,
      { link_data: linkData }
    )
  },

  /**
   * Delete a row link (e.g., unenroll participant from activity)
   */
  async deleteRowLink(rowLinkId: string): Promise<void> {
    return goClient.delete<void>(`/row-links/${rowLinkId}`)
  },
}
