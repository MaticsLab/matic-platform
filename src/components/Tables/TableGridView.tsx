'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, ChevronDown, Trash2, Copy, Settings, EyeOff, Eye, Grid3x3, Kanban, Calendar as CalendarIcon, Image as ImageIcon, List, Search, BarChart3, Filter, MoreHorizontal, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, AlignJustify, Rows, Maximize2, MapPin } from 'lucide-react'
import { ColumnEditorModal } from './ColumnEditorModal'
import { LinkField } from './LinkField'
import { AddressField, AddressValue } from './AddressField'
import { pulseSupabase } from '@/lib/api/pulse-supabase'
import type { PulseEnabledTable } from '@/lib/api/pulse-client'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/better-auth-client'
import type { TableRow } from '@/types/data-tables'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as TableRowComponent } from '@/ui-components/table'
import { Badge } from '@/ui-components/badge'
import { Input } from '@/ui-components/input'
import { Button } from '@/ui-components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/ui-components/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui-components/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/ui-components/sheet'
import { Textarea } from '@/ui-components/textarea'
import { toast } from 'sonner'

interface Column {
  id: string
  name: string
  label: string
  column_type: string
  width: number
  is_visible: boolean
  position: number
  linked_table_id?: string
  settings?: {
    options?: string[] | { value: string; color?: string }[]
    [key: string]: any
  }
}

interface Row {
  id: string
  data: Record<string, any>
  position: number
}

interface TableGridViewProps {
  tableId: string
  workspaceId: string
  onTableNameChange?: (newName: string) => void
}

type RowHeight = 'short' | 'medium' | 'tall' | 'extra-tall'

const ROW_HEIGHTS: Record<RowHeight, string> = {
  short: 'h-10',
  medium: 'h-16',
  tall: 'h-24',
  'extra-tall': 'h-32'
}

const VIEW_OPTIONS = [
  { value: 'grid', label: 'Grid', icon: Grid3x3, description: 'Spreadsheet-like table view' },
  { value: 'kanban', label: 'Kanban', icon: Kanban, description: 'Card-based workflow' },
  { value: 'calendar', label: 'Calendar', icon: CalendarIcon, description: 'Date-based timeline' },
  { value: 'gallery', label: 'Gallery', icon: ImageIcon, description: 'Visual card layout' },
  { value: 'list', label: 'List', icon: List, description: 'Compact list view' },
]

/**
 * Get cell value from row data
 * Looks up by column.id first (form submissions use field.id as key)
 * Falls back to column.name (legacy data) and then column.label
 */
const getCellValue = (rowData: Record<string, any>, column: Column): any => {
  // First try column.id (form submissions store data with field.id as key)
  if (column.id && rowData[column.id] !== undefined) {
    return rowData[column.id]
  }
  // Then try column.name
  if (column.name && rowData[column.name] !== undefined) {
    return rowData[column.name]
  }
  // Finally try column.label
  if (column.label && rowData[column.label] !== undefined) {
    return rowData[column.label]
  }
  return undefined
}

/**
 * Get the key to use when updating cell data
 * Uses the key that already exists in the data, or falls back to column.id
 */
const getCellKey = (rowData: Record<string, any>, column: Column): string => {
  // First check if column.id exists in data (form submissions)
  if (column.id && rowData[column.id] !== undefined) {
    return column.id
  }
  // Then check if column.name exists in data
  if (column.name && rowData[column.name] !== undefined) {
    return column.name
  }
  // For new data, prefer column.id (consistent with form submissions)
  return column.id || column.name
}

export function TableGridView({ tableId, workspaceId, onTableNameChange }: TableGridViewProps) {
  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [expandedCell, setExpandedCell] = useState<{ rowId: string; columnId: string; value: string; columnName: string } | null>(null)
  const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null)
  const [tableName, setTableName] = useState('')
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<Column | null>(null)
  const [targetColumnPosition, setTargetColumnPosition] = useState<number | null>(null)
  const [currentView, setCurrentView] = useState<'grid' | 'kanban' | 'calendar' | 'gallery' | 'list'>('grid')
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [multiselectSearch, setMultiselectSearch] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isEditingTableName, setIsEditingTableName] = useState(false)
  const [tempTableName, setTempTableName] = useState('')
  const [linkedRecords, setLinkedRecords] = useState<{ [tableId: string]: Row[] }>({})
  const [loadingLinkedRecords, setLoadingLinkedRecords] = useState<{ [tableId: string]: boolean }>({})
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set())
  const [scanResultPopover, setScanResultPopover] = useState<{
    rowId: string
    barcode: string
    position: { x: number; y: number }
  } | null>(null)
  const [pulseConfig, setPulseConfig] = useState<PulseEnabledTable | null>(null)
  const [isPulseEnabled, setIsPulseEnabled] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [resizingColumn, setResizingColumn] = useState<{ id: string; startX: number; startWidth: number } | null>(null)
  const [rowHeight, setRowHeight] = useState<RowHeight>('short')
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null)
  const [filterConfig, setFilterConfig] = useState<{ columnId: string; operator: string; value: string } | null>(null)
  
  // Real-time collaboration state
  const [editingUsers, setEditingUsers] = useState<Record<string, { userId: string; userName: string; userColor: string }>>({}) // Key: rowId:columnId
  const [realtimeCellValues, setRealtimeCellValues] = useState<Record<string, any>>({}) // Key: rowId:columnId
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; color: string } | null>(null)
  
  const gridRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tableNameInputRef = useRef<HTMLInputElement>(null)
  const columnsRef = useRef<Column[]>([])
  const channelRef = useRef<any>(null)
  const broadcastDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Keep columns ref in sync
  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

  // Load current user for collaboration
  const { data: sessionData } = useSession()
  useEffect(() => {
    const user = sessionData?.user
    if (user) {
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
      const color = colors[Math.floor(Math.random() * colors.length)]
      setCurrentUser({
        id: user.id,
        name: user.name || user.email?.split('@')[0] || 'User',
        color
      })
    }
  }, [sessionData])

  // Column resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColumn) return
      
      const diff = e.clientX - resizingColumn.startX
      const newWidth = Math.max(100, resizingColumn.startWidth + diff) // Min width 100px
      
      setColumns(prev => prev.map(col => 
        col.id === resizingColumn.id ? { ...col, width: newWidth } : col
      ))
    }

    const handleMouseUp = async () => {
      if (resizingColumn) {
        // Find the column to save
        const column = columns.find(c => c.id === resizingColumn.id)
        if (column) {
          try {
            const { tablesGoClient } = await import('@/lib/api/tables-go-client')
            await tablesGoClient.updateColumn(tableId, column.id, { width: column.width })
          } catch (error) {
            console.error('Failed to save column width:', error)
          }
        }
        setResizingColumn(null)
      }
    }

    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
    }
  }, [resizingColumn, columns, tableId])

  // Real-time subscription for table rows and columns
  useEffect(() => {
    if (!tableId) return

    console.log('🔌 Setting up Supabase Realtime subscription for table:', tableId)
    setRealtimeStatus('connecting')

    const channel = supabase
      .channel(`table-realtime-${tableId}`)
    
    // Store channel ref for broadcasting
    channelRef.current = channel
    
    channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_rows',
          filter: `table_id=eq.${tableId}`
        },
        (payload) => {
          console.log('🔄 Realtime row update:', payload)
          
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as any
            // Ensure data is an object
            if (typeof newRow.data === 'string') {
              try {
                newRow.data = JSON.parse(newRow.data)
              } catch (e) {
                console.error('Failed to parse row data:', e)
                newRow.data = {}
              }
            }

            setRows(prev => {
              // Check if row already exists (to avoid duplicates from optimistic updates or double events)
              if (prev.some(r => r.id === newRow.id)) return prev
              
              // For new rows, we might need to fetch linked records if they exist
              // But usually new rows start empty or with basic data
              return [...prev, {
                id: newRow.id,
                data: newRow.data || {},
                position: newRow.position || 0
              }]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as any
            // Ensure data is an object
            if (typeof updatedRow.data === 'string') {
              try {
                updatedRow.data = JSON.parse(updatedRow.data)
              } catch (e) {
                console.error('Failed to parse row data:', e)
                updatedRow.data = {}
              }
            }
            
            setRows(prev => prev.map(row => {
              if (row.id === updatedRow.id) {
                // We need to preserve client-side only data (like linked records)
                // which are stored in row.data but not in the DB's data column
                const currentData = { ...row.data }
                const newData = { ...updatedRow.data }
                
                // Use the ref to get current columns since we're in a closure
                const currentColumns = columnsRef.current
                
                // Restore values for link columns from the current state
                currentColumns.forEach(col => {
                  if (col.column_type === 'link' && currentData[col.name]) {
                    // Only restore if the new data doesn't have it (it shouldn't)
                    if (newData[col.name] === undefined) {
                      newData[col.name] = currentData[col.name]
                    }
                  }
                })

                return { 
                  ...row, 
                  data: newData, 
                  position: updatedRow.position 
                }
              }
              return row
            }))
          } else if (payload.eventType === 'DELETE') {
            const deletedRowId = payload.old.id
            setRows(prev => prev.filter(row => row.id !== deletedRowId))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_fields',
          filter: `table_id=eq.${tableId}`
        },
        (payload) => {
          console.log('🔄 Realtime column update:', payload)
          // Reload table data to refresh columns
          loadTableData()
        }
      )
      .on(
        'broadcast',
        { event: 'table_update' },
        (payload) => {
          console.log('📡 Received broadcast update:', payload)
          const { type, row } = payload.payload
          
          if (type === 'UPDATE' && row) {
             setRows(prev => prev.map(r => {
              if (r.id === row.id) {
                // Merge data similar to DB update
                const currentData = { ...r.data }
                const newData = { ...row.data }
                
                const currentColumns = columnsRef.current
                currentColumns.forEach(col => {
                  if (col.column_type === 'link' && currentData[col.name]) {
                    if (newData[col.name] === undefined) {
                      newData[col.name] = currentData[col.name]
                    }
                  }
                })

                return { ...r, data: newData }
              }
              return r
            }))
          } else if (type === 'INSERT' && row) {
             setRows(prev => {
              if (prev.some(r => r.id === row.id)) return prev
              return [...prev, {
                id: row.id,
                data: row.data || {},
                position: row.position || 0
              }]
            })
          }
        }
      )
      .on(
        'broadcast',
        { event: 'field_editing' },
        (payload) => {
          console.log('📡 Received field editing:', payload)
          const { userId, userName, userColor, rowId, columnId, value, isEditing } = payload.payload
          
          // Ignore own edits
          if (currentUser && userId === currentUser.id) return
          
          const cellKey = `${rowId}:${columnId}`
          
          if (isEditing) {
            // Another user started editing this cell
            setEditingUsers(prev => ({
              ...prev,
              [cellKey]: { userId, userName, userColor }
            }))
            
            // Update the real-time value
            if (value !== undefined) {
              setRealtimeCellValues(prev => ({
                ...prev,
                [cellKey]: value
              }))
            }
          } else {
            // User stopped editing
            setEditingUsers(prev => {
              const updated = { ...prev }
              delete updated[cellKey]
              return updated
            })
            setRealtimeCellValues(prev => {
              const updated = { ...prev }
              delete updated[cellKey]
              return updated
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 Supabase Realtime status:', status)
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected')
        }
      })

    return () => {
      console.log('🔌 Cleaning up Supabase Realtime subscription')
      // Clear any pending broadcast timers
      Object.values(broadcastDebounceTimers.current).forEach(timer => clearTimeout(timer))
      broadcastDebounceTimers.current = {}
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [tableId])

  useEffect(() => {
    loadTableData()
    loadPulseConfig()
  }, [tableId])

  // Set up real-time subscription for table_row_links changes
  useEffect(() => {
    if (!tableId || columns.length === 0) return

    // Find all link columns
    const linkColumns = columns.filter(col => col.column_type === 'link' && col.linked_table_id)
    if (linkColumns.length === 0) return

    let channels: any[] = []
    
    const setupSubscriptions = async () => {
      const { supabase } = await import('@/lib/supabase')
      const { tableLinksGoClient } = await import('@/lib/api/participants-go-client')
      
      // For each link column, set up a subscription
      for (const column of linkColumns) {
        try {
          // Find the table_link for this column
          let tableLinks = await tableLinksGoClient.getTableLinks(tableId)
          let tableLink = tableLinks.find((l: any) => 
            l.source_table_id === tableId && 
            l.target_table_id === column.linked_table_id &&
            l.source_column_id === column.id
          )
          
          if (!tableLink && column.linked_table_id) {
            tableLinks = await tableLinksGoClient.getTableLinks(column.linked_table_id)
            tableLink = tableLinks.find((l: any) => 
              (l.source_table_id === tableId && l.target_table_id === column.linked_table_id) ||
              (l.source_table_id === column.linked_table_id && l.target_table_id === tableId)
            )
          }
          
          if (tableLink?.id) {
            const channel = supabase
              .channel(`table-row-links-${tableId}-${column.id}`)
              .on(
                'postgres_changes',
                {
                  event: '*', // INSERT, UPDATE, DELETE
                  schema: 'public',
                  table: 'table_row_links',
                  filter: `link_id=eq.${tableLink.id}`
                },
                (payload: any) => {
                  console.log('🔄 Table row link changed:', payload)
                  // Reload table data to refresh link columns
                  setTimeout(() => {
                    loadTableData()
                  }, 300)
                }
              )
              .subscribe()
            
            channels.push(channel)
            console.log(`📡 Subscribed to table_row_links changes for column ${column.name} (link ${tableLink.id})`)
          }
        } catch (error) {
          console.error(`Error setting up subscription for column ${column.name}:`, error)
        }
      }
    }

    setupSubscriptions()

    return () => {
      if (channels.length > 0) {
        const { supabase } = require('@/lib/supabase')
        channels.forEach(channel => {
          supabase.removeChannel(channel)
        })
      }
    }
  }, [tableId, columns])

  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeColumnMenu) {
        setActiveColumnMenu(null)
      }
    }
    if (activeColumnMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [activeColumnMenu])

  // Load Pulse configuration
  const loadPulseConfig = async () => {
    try {
      const config = await pulseSupabase.getPulseConfig(tableId)
      if (config && config.enabled) {
        setPulseConfig(config)
        setIsPulseEnabled(true)
        console.log('✅ Pulse enabled for this table:', config)
      } else {
        setPulseConfig(null)
        setIsPulseEnabled(false)
      }
    } catch (error) {
      // Pulse not enabled - that's ok
      setPulseConfig(null)
      setIsPulseEnabled(false)
    }
  }

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let result = rows

    // Filter
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(row => {
        // Search across all visible columns
        return columns.some(column => {
          if (!column.is_visible) return false
          
          const value = getCellValue(row.data, column)
          if (value == null) return false

          // Convert value to searchable string
          let searchableValue = ''
          if (Array.isArray(value)) {
            searchableValue = value.join(' ')
          } else if (typeof value === 'object') {
            searchableValue = JSON.stringify(value)
          } else {
            searchableValue = String(value)
          }

          return searchableValue.toLowerCase().includes(lowerSearch)
        })
      })
    }

    // Sort
    if (sortConfig) {
      const column = columns.find(c => c.id === sortConfig.columnId)
      if (column) {
        result = [...result].sort((a, b) => {
          const aValue = getCellValue(a.data, column)
          const bValue = getCellValue(b.data, column)

          if (aValue === bValue) return 0
          if (aValue === null || aValue === undefined) return 1
          if (bValue === null || bValue === undefined) return -1

          const comparison = aValue < bValue ? -1 : 1
          return sortConfig.direction === 'asc' ? comparison : -comparison
        })
      }
    }

    return result
  }, [rows, searchTerm, columns, sortConfig])

  // Preload linked records when columns change
  useEffect(() => {
    columns.forEach(column => {
      if (column.column_type === 'link' && column.linked_table_id) {
        loadLinkedRecords(column.linked_table_id)
      }
    })
  }, [columns])

  const loadTableData = async () => {
    try {
      setLoading(true)
      
      const tableData = await tablesGoClient.getTableById(tableId)
      setTableName(tableData.name)
      
      // Filter out layout fields (section, divider, heading, paragraph, callout, etc.)
      // Layout fields should not appear in database/table views
      const layoutFieldTypes = ['section', 'divider', 'heading', 'paragraph', 'callout'];
      const filteredColumns = (tableData.columns || []).filter((col: any) => {
        // Check if field type category is layout
        if (col.field_type?.category === 'layout') {
          return false;
        }
        // Also filter by type as fallback
        if (layoutFieldTypes.includes(col.type) || layoutFieldTypes.includes(col.column_type)) {
          return false;
        }
        return true;
      });

      // Map columns to frontend format - ensure label exists (use name if label missing)
      const columnsWithLinks = filteredColumns.map((col: any) => {
        const mappedCol = {
          ...col,
          label: col.label || col.name || '', // Use label if exists, otherwise use name
          is_visible: col.is_visible !== undefined ? col.is_visible : true,
          width: col.width || 200,
          position: col.position || 0,
          settings: col.settings || col.options || {}, // Map options to settings
        }
        
        // For link columns, use linked_table_id from column if available
        // Otherwise try to find it from table_links
        if (col.column_type === 'link') {
          if (col.linked_table_id) {
            // Column already has linked_table_id set
            mappedCol.linked_table_id = col.linked_table_id
          } else if (tableData.links) {
            // Try to find table_link by matching source_table_id and target_table_id
            // Find any link where this table is the source
            const link = tableData.links.find((l: any) => 
              l.source_table_id === tableId && 
              (l.source_column_id === col.id || !l.source_column_id)
            )
            if (link) {
              mappedCol.linked_table_id = link.target_table_id
            }
          }
        }
        
        return mappedCol
      })
      
      console.log('📊 Loaded columns:', columnsWithLinks.length, columnsWithLinks)
      setColumns(columnsWithLinks as any)
      
      const rowsData = await tablesGoClient.getRowsByTable(tableId)
      console.log('📊 Loaded rows:', rowsData.length, rowsData)
      
      // Populate link column values from table_row_links
      const rowsWithLinks = await Promise.all(
        rowsData.map(async (row: any) => {
          const rowData = { ...row.data }
          
          // Find link columns and populate their values from table_row_links
          for (const col of columnsWithLinks) {
            if (col.column_type === 'link' && col.linked_table_id) {
              try {
                // Find the table_link by matching source and target tables (check both directions)
                const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client')
                
                // First try: current table as source, linked table as target
                let tableLinks = await tableLinksGoClient.getTableLinks(tableId)
                let tableLink = tableLinks.find((l: any) => 
                  l.source_table_id === tableId && 
                  l.target_table_id === col.linked_table_id
                )
                
                // Second try: linked table as source, current table as target (reverse direction)
                if (!tableLink) {
                  tableLinks = await tableLinksGoClient.getTableLinks(col.linked_table_id)
                  tableLink = tableLinks.find((l: any) => 
                    l.source_table_id === col.linked_table_id && 
                    l.target_table_id === tableId
                  )
                }
                
                if (tableLink?.id && row.id) {
                  // Determine if we're the source or target
                  const isSource = tableLink.source_table_id === tableId
                  
                  console.log(`🔍 Loading links for column ${col.name} in row ${row.id}:`, {
                    tableId,
                    linkedTableId: col.linked_table_id,
                    linkId: tableLink.id,
                    isSource,
                    sourceTableId: tableLink.source_table_id,
                    targetTableId: tableLink.target_table_id
                  })
                  
                  if (isSource) {
                    // Current table is source - get linked rows where this row is the source
                    const linkedRows = await rowLinksGoClient.getLinkedRows(row.id, tableLink.id)
                    console.log(`📊 Got ${linkedRows.length} linked rows from API for row ${row.id} with link ${tableLink.id}`)
                    
                    // Extract the linked record IDs (target rows)
                    // The API returns rows where this row is either source or target
                    // We need to filter to only get target rows (where this row is the source)
                    const linkedIds = linkedRows
                      .filter((lr: any) => {
                        // Only include rows that are NOT the current row (they are the target)
                        return lr.row && lr.row.id !== row.id
                      })
                      .map((lr: any) => lr.row.id)
                    
                    rowData[col.name] = linkedIds
                    console.log(`✅ Loaded ${linkedIds.length} linked records for ${col.name} in row ${row.id} (source direction):`, linkedIds)
                  } else {
                    // Current table is target - need to find rows where this row is the target
                    // The GetLinkedRows API should return rows where this row is either source or target
                    // When we're the target, we need to find which source rows link to us
                    const linkedRows = await rowLinksGoClient.getLinkedRows(row.id, tableLink.id)
                    console.log(`📊 Got ${linkedRows.length} linked rows from API for row ${row.id} (target direction)`)
                    
                    // Filter to only get source rows (rows from the linked table that link to this row)
                    // When we're the target, the source rows are the ones we want to display
                    const linkedIds = linkedRows
                      .filter((lr: any) => {
                        // Only include rows that are NOT the current row
                        // These are the source rows (from linked table) that link to this target row
                        return lr.row && lr.row.id !== row.id
                      })
                      .map((lr: any) => lr.row.id)
                    
                    rowData[col.name] = linkedIds
                    console.log(`✅ Loaded ${linkedIds.length} linked records for ${col.name} in row ${row.id} (target direction):`, linkedIds)
                  }
                } else {
                  console.log(`⚠️ No table link found for column ${col.name} (linkId: ${tableLink?.id}, rowId: ${row.id})`)
                  // No table_link found, ensure field is an empty array
                  if (!rowData[col.name] || !Array.isArray(rowData[col.name])) {
                    rowData[col.name] = []
                  }
                }
              } catch (error) {
                console.error(`Error loading links for column ${col.name}:`, error)
                // Ensure field is an empty array on error
                if (!rowData[col.name] || !Array.isArray(rowData[col.name])) {
                  rowData[col.name] = []
                }
              }
            }
          }
          
          return {
            ...row,
            data: rowData
          }
        })
      )
      
      console.log('📊 Loaded rows with links:', rowsWithLinks.length)
      setRows(rowsWithLinks as any)
    } catch (error) {
      console.error('Error loading table data:', error)
      toast.error('Failed to load table data')
    } finally {
      setLoading(false)
    }
  }

  const handleStartEditingTableName = () => {
    setTempTableName(tableName)
    setIsEditingTableName(true)
    // Focus the input after state update
    setTimeout(() => {
      tableNameInputRef.current?.focus()
      tableNameInputRef.current?.select()
    }, 0)
  }

  const handleSaveTableName = async () => {
    if (!tempTableName.trim() || tempTableName === tableName) {
      setIsEditingTableName(false)
      return
    }

    try {
      await tablesGoClient.updateTable(tableId, { name: tempTableName })
      setTableName(tempTableName)
      setIsEditingTableName(false)
      if (onTableNameChange) {
        onTableNameChange(tempTableName)
      }
      toast.success('Table name updated')
    } catch (error: any) {
      console.error('Error updating table name:', error)
      toast.error('Failed to update table name')
      setIsEditingTableName(false)
    }
  }

  const handleResizeStart = (e: React.MouseEvent, columnId: string, currentWidth: number) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn({ id: columnId, startX: e.clientX, startWidth: currentWidth })
  }

  const loadLinkedRecords = async (linkedTableId: string) => {
    if (linkedRecords[linkedTableId] || loadingLinkedRecords[linkedTableId]) {
      return // Already loaded or loading
    }

    setLoadingLinkedRecords(prev => ({ ...prev, [linkedTableId]: true }))
    
    try {
      const records = await tablesGoClient.getRowsByTable(linkedTableId)
      // Convert TableRow[] to Row[] format
      const convertedRecords: Row[] = records.map((record: TableRow) => ({
        id: record.id || '',
        data: record.data || {},
        position: record.position || 0
      }))
      setLinkedRecords(prev => ({ ...prev, [linkedTableId]: convertedRecords }))
    } catch (error) {
      console.error('Error loading linked records:', error)
      toast.error('Failed to load linked records')
    } finally {
      setLoadingLinkedRecords(prev => ({ ...prev, [linkedTableId]: false }))
    }
  }

  const handleTableNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTableName()
    } else if (e.key === 'Escape') {
      setIsEditingTableName(false)
    }
  }

  const handleAddRow = async () => {
    try {
      // Get current user ID from Better Auth
      const { authClient } = await import('@/lib/better-auth-client')
      const session = await authClient.getSession()
      const user = session?.data?.user
      
      if (!user) {
        console.error('No user found')
        alert('You must be logged in to add rows')
        return
      }

      console.log('Adding row with user:', user.id)
      const { goClient } = await import('@/lib/api/go-client')
      
      const newRow = await goClient.post<Row>(
        `/tables/${tableId}/rows`,
        { 
          data: {}, 
          position: rows.length
        },
        { user_id: user.id }
      )
      
      console.log('Row added successfully:', newRow)
      setRows([...rows, newRow])
    } catch (error: any) {
      console.error('Error adding row:', error)
      alert(`Failed to add row: ${error.message || 'Unknown error'}`)
    }
  }

  const handleFilter = () => {
    toast.info('Filter feature coming soon! You will be able to filter by any field.')
  }

  // Save handler specifically for link columns
  const handleSaveLinks = async (rowId: string, columnName: string, newLinkedIds: string[]) => {
    const row = rows.find(r => r.id === rowId)
    if (!row) return

    const column = columns.find(c => c.name === columnName || c.id === columnName)
    if (!column || column.column_type !== 'link' || !column.linked_table_id) {
      throw new Error('Invalid link column')
    }

    // Get value using getCellValue helper for proper ID/name fallback
    const prevValue = getCellValue(row.data, column)
    const previousLinkedIds: string[] = Array.isArray(prevValue) ? prevValue : []
    const linkedRecordIds: string[] = Array.isArray(newLinkedIds) ? newLinkedIds : []

    // Find or create the table_link
    const { tableLinksGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client')
    
    // Try both directions
    let tableLinks = await tableLinksGoClient.getTableLinks(tableId)
    let tableLink = tableLinks.find((l: any) =>
      l.source_table_id === tableId &&
      l.target_table_id === column.linked_table_id
    )

    if (!tableLink) {
      tableLinks = await tableLinksGoClient.getTableLinks(column.linked_table_id)
      tableLink = tableLinks.find((l: any) =>
        l.source_table_id === column.linked_table_id &&
        l.target_table_id === tableId
      )
    }

    // Create link if it doesn't exist
    if (!tableLink && column.id) {
      tableLink = await tableLinksGoClient.createTableLink(
        tableId,
        column.id,
        column.linked_table_id,
        'many_to_many',
        {
          label: column.label || columnName,
          reverseLabel: 'Linked Records'
        }
      )
    }

    if (!tableLink?.id) {
      throw new Error('Failed to find or create table link')
    }

    const isSource = tableLink.source_table_id === tableId
    const addedIds = linkedRecordIds.filter(id => !previousLinkedIds.includes(id))
    const removedIds = previousLinkedIds.filter(id => !linkedRecordIds.includes(id))

    // Create new links
    for (const targetId of addedIds) {
      if (isSource) {
        await rowLinksGoClient.createRowLink(rowId, targetId, tableLink.id, {})
      } else {
        await rowLinksGoClient.createRowLink(targetId, rowId, tableLink.id, {})
      }
    }

    // Delete removed links
    for (const removedId of removedIds) {
      const linkedRows = await rowLinksGoClient.getLinkedRows(
        isSource ? rowId : removedId,
        tableLink.id
      )
      const rowLink = linkedRows.find((lr: any) =>
        isSource
          ? lr.row.id === removedId
          : lr.row.id === rowId
      )
      if (rowLink?.row_link_id) {
        await rowLinksGoClient.deleteRowLink(rowLink.row_link_id)
      }
    }

    // Reload table data to refresh links
    await loadTableData()
    
    // Also notify the linked table to refresh (if it's open)
    // This is a best-effort notification - the other table's subscription will catch it
    console.log(`✅ Links updated for row ${rowId}, column ${columnName}. Linked table ${column.linked_table_id} should refresh.`)
  }

  const handleCellEdit = async (rowId: string, columnName: string, value: any) => {
    try {
      const row = rows.find(r => r.id === rowId)
      if (!row) return

      // Check if this is a link column
      const column = columns.find(c => c.name === columnName)
      const isLinkColumn = column?.column_type === 'link' && column.linked_table_id
      
      if (isLinkColumn) {
        // Link columns are handled by LinkField's onSave
        // This should not be called for link columns
        return
      }

      // For non-link columns, update the row data
      const updatedData = { ...row.data, [columnName]: value }
      setRows(prevRows => 
        prevRows.map(r => 
          r.id === rowId ? { ...r, data: updatedData } : r
        )
      )

      // Update via Go API
      const { goClient } = await import('@/lib/api/go-client')
      await goClient.patch(`/tables/${tableId}/rows/${rowId}`, {
        data: updatedData
      })
    } catch (error) {
      console.error('Error updating cell:', error)
      toast.error(`Failed to update cell: ${error}`)
    }
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Are you sure you want to delete this row?')) return
    try {
      const { goClient } = await import('@/lib/api/go-client')
      await goClient.delete(`/tables/${tableId}/rows/${rowId}`)
      setRows(rows.filter(r => r.id !== rowId))
      setSelectedRows(prev => {
        const next = new Set(prev)
        next.delete(rowId)
        return next
      })
    } catch (error) {
      console.error('Error deleting row:', error)
      alert('Failed to delete row. Please try again.')
    }
  }

  const handleBulkDeleteRows = async () => {
    if (selectedRows.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} row(s)?`)) return
    
    try {
      const { goClient } = await import('@/lib/api/go-client')
      const deletePromises = Array.from(selectedRows).map(rowId =>
        goClient.delete(`/tables/${tableId}/rows/${rowId}`)
      )
      await Promise.all(deletePromises)
      setRows(rows.filter(r => !selectedRows.has(r.id)))
      setSelectedRows(new Set())
      toast.success(`Deleted ${selectedRows.size} row(s)`)
    } catch (error) {
      console.error('Error deleting rows:', error)
      toast.error('Failed to delete some rows')
    }
  }

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  const toggleAllRows = () => {
    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredRows.map(r => r.id)))
    }
  }

  const handleDuplicateRow = async (rowId: string) => {
    try {
      const row = rows.find(r => r.id === rowId)
      if (!row) return
      
      // Get current user ID from Better Auth
      const { authClient } = await import('@/lib/better-auth-client')
      const session = await authClient.getSession()
      const user = session?.data?.user
      
      if (!user) {
        toast.error('You must be logged in to duplicate rows')
        return
      }
      
      const newRow = await tablesGoClient.createRow(
        tableId,
        { data: row.data, position: rows.length },
        user.id
      )
      setRows([...rows, newRow as any])
      toast.success('Row duplicated')
    } catch (error: any) {
      console.error('Error duplicating row:', error)
      toast.error(`Failed to duplicate row: ${error.message}`)
    }
  }

  const handleAddColumn = (position?: number) => {
    setEditingColumn(null)
    setTargetColumnPosition(typeof position === 'number' ? position : null)
    setIsColumnEditorOpen(true)
    setActiveColumnMenu(null)
  }

  const handleEditColumn = (column: Column) => {
    setEditingColumn(column)
    setIsColumnEditorOpen(true)
    setActiveColumnMenu(null)
  }

  const handleDuplicateColumn = async (column: Column) => {
    try {
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      const newColumn = {
        ...column,
        name: `${column.name}_copy_${Date.now()}`, // Ensure unique name
        label: `${column.label} copy`,
        position: column.position + 1,
        is_primary: false
      }
      // Remove id to create new
      const { id, ...columnToCreate } = newColumn
      
      await tablesGoClient.createColumn(tableId, columnToCreate as any)
      await loadTableData()
      toast.success('Field duplicated')
    } catch (error: any) {
      console.error('Error duplicating column:', error)
      toast.error('Failed to duplicate field')
    }
    setActiveColumnMenu(null)
  }

  const handleHideColumn = async (column: Column) => {
    try {
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      await tablesGoClient.updateColumn(tableId, column.id, { is_visible: false })
      await loadTableData()
      toast.success('Field hidden')
    } catch (error: any) {
      console.error('Error hiding column:', error)
      toast.error('Failed to hide field')
    }
    setActiveColumnMenu(null)
  }

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Delete this field? All data will be lost.')) return
    
    try {
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      await tablesGoClient.deleteColumn(tableId, columnId)
      await loadTableData()
      toast.success('Column deleted')
    } catch (error) {
      console.error('Error deleting column:', error)
      toast.error('Failed to delete column')
    }
    setActiveColumnMenu(null)
  }

  const handleSaveColumn = async (columnData: any) => {
    try {
      console.log('Saving column data:', columnData)
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      
      if (editingColumn) {
        // Update existing column
        await tablesGoClient.updateColumn(
          tableId,
          editingColumn.id!,
          columnData
        )
        toast.success('Column updated')
      } else {
        // Create new column
        // If targetColumnPosition is set, use it. Otherwise append to end.
        // We might need to shift other columns if inserting in middle, but for now let's just set position
        // The backend or next load should handle order. 
        // Ideally we should shift positions of other columns here or in backend.
        // For simplicity, we'll just set the position.
        const position = targetColumnPosition !== null ? targetColumnPosition : columns.length
        const payload = { ...columnData, position }
        await tablesGoClient.createColumn(tableId, payload)
        toast.success('Column created')
      }
      
      // Reload table data to ensure everything is in sync
      await loadTableData()
      
      setIsColumnEditorOpen(false)
      setEditingColumn(null)
      setTargetColumnPosition(null)
    } catch (error: any) {
      console.error('Error saving column:', error)
      toast.error(`Failed to save column: ${error.message}`)
    }
  }

  const handleToggleColumnVisibility = async (columnId: string, isVisible: boolean) => {
    try {
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      
      // Optimistic update
      setColumns(prev => prev.map(col => 
        col.id === columnId ? { ...col, is_visible: isVisible } : col
      ))

      await tablesGoClient.updateColumn(tableId, columnId, { is_visible: isVisible })
    } catch (error) {
      console.error('Error updating column visibility:', error)
      toast.error('Failed to update field visibility')
      // Revert on error
      loadTableData()
    }
  }

  // Broadcast field editing with debounce
  const broadcastFieldEditing = useCallback((rowId: string, columnId: string, value: any, isEditing: boolean) => {
    if (!currentUser || !channelRef.current) return
    
    const cellKey = `${rowId}:${columnId}`
    
    // Clear existing debounce timer for this cell
    if (broadcastDebounceTimers.current[cellKey]) {
      clearTimeout(broadcastDebounceTimers.current[cellKey])
    }
    
    // Debounce to avoid too many broadcasts (150ms)
    broadcastDebounceTimers.current[cellKey] = setTimeout(() => {
      channelRef.current.send({
        type: 'broadcast',
        event: 'field_editing',
        payload: {
          userId: currentUser.id,
          userName: currentUser.name,
          userColor: currentUser.color,
          rowId,
          columnId,
          value,
          isEditing
        }
      })
      delete broadcastDebounceTimers.current[cellKey]
    }, 150)
  }, [currentUser])

  const renderCell = (row: Row, column: Column) => {
    const cellKey = `${row.id}:${column.id}`
    const otherUserEditing = editingUsers[cellKey]
    const realtimeValue = realtimeCellValues[cellKey]
    
    // Use realtime value if another user is editing, otherwise use stored value
    const baseValue = getCellValue(row.data, column)
    const value = otherUserEditing && realtimeValue !== undefined ? realtimeValue : baseValue
    
    const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id
    const isSelected = selectedCell?.rowId === row.id && selectedCell?.columnId === column.id

    // Link column type - use real-time link field component
    if (column.column_type === 'link') {
      const linkedRecordIds = Array.isArray(value) ? value : []
      
      return (
        <LinkField
          tableId={tableId}
          rowId={row.id}
          columnId={column.id || ''}
          columnName={column.name}
          linkedTableId={column.linked_table_id || ''}
          value={linkedRecordIds}
          displayFields={column.settings?.displayFields || []}
          onChange={(newValue) => {
            // Update the local state immediately
            const key = getCellKey(row.data, column)
            const updatedRows = rows.map(r => 
              r.id === row.id 
                ? { ...r, data: { ...r.data, [key]: newValue } }
                : r
            )
            setRows(updatedRows)
          }}
          onSave={async (newValue) => {
            // Save links using the dedicated handler
            await handleSaveLinks(row.id, column.name, newValue)
          }}
        />
      )
    }

    // Address column type - use address autocomplete field
    if (column.column_type === 'address') {
      return (
        <AddressField
          value={value as AddressValue | string | null}
          onChange={(newValue) => {
            // Update local state immediately
            const key = getCellKey(row.data, column)
            const updatedRows = rows.map(r => 
              r.id === row.id 
                ? { ...r, data: { ...r.data, [key]: newValue } }
                : r
            )
            setRows(updatedRows)
          }}
          onSave={async (newValue) => {
            await handleCellEdit(row.id, column.name, newValue)
          }}
          isTableCell={true}
          className={isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}
        />
      )
    }

    // Multi-select column type
    if (column.column_type === 'multiselect') {
      const selectedOptions = Array.isArray(value) ? value : []
      const options = column.settings?.options || []
      const filteredOptions = multiselectSearch 
        ? options.filter((opt: any) => {
            const optValue = typeof opt === 'string' ? opt : opt.value
            return optValue.toLowerCase().includes(multiselectSearch.toLowerCase())
          })
        : options
      
      if (isEditing) {
        return (
          <div className="relative" style={{ position: 'relative' }}>
            {/* Invisible overlay to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setEditingCell(null)
                setMultiselectSearch('')
              }}
            />
            
            {/* Dropdown */}
            <div
              ref={dropdownRef}
              className="absolute left-0 top-0 z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-xl"
            >
              {/* Selected chips */}
              <div className="p-3 border-b border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {selectedOptions.map((opt: string) => (
                    <span key={opt} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md">
                      {opt}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newValue = selectedOptions.filter((o: string) => o !== opt)
                          handleCellEdit(row.id, column.name, newValue)
                        }}
                        className="hover:text-blue-900 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Could add "create new option" functionality here
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              
              {/* Search input */}
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={multiselectSearch}
                    onChange={(e) => setMultiselectSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              
              {/* Options list */}
              <div className="max-h-64 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    {multiselectSearch ? 'No matching options' : 'No options available'}
                  </div>
                ) : (
                  <div className="py-2">
                    {filteredOptions.map((option: any) => {
                      const optionValue = typeof option === 'string' ? option : option.value
                      const isOptionSelected = selectedOptions.includes(optionValue)
                      return (
                        <label 
                          key={optionValue} 
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isOptionSelected}
                            onChange={(e) => {
                              const newValue = e.target.checked
                                ? [...selectedOptions, optionValue]
                                : selectedOptions.filter((o: string) => o !== optionValue)
                              handleCellEdit(row.id, column.name, newValue)
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{optionValue}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      return (
        <div
          className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
          onClick={() => {
            setSelectedCell({ rowId: row.id, columnId: column.id })
            setEditingCell({ rowId: row.id, columnId: column.id })
            setMultiselectSearch('')
          }}
        >
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedOptions.map((opt: string) => (
                <span key={opt} className="inline-flex items-center px-2.5 py-1 text-sm bg-blue-100 text-blue-700 rounded-md">
                  {opt}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">Empty</span>
          )}
        </div>
      )
    }

    // Single select column type
    if (column.column_type === 'select') {
      const options = column.settings?.options || []
      
      if (isEditing) {
        return (
          <select
            value={value || ''}
            autoFocus
            onChange={(e) => {
              handleCellEdit(row.id, column.name, e.target.value)
              setEditingCell(null)
            }}
            onBlur={() => setEditingCell(null)}
            className="w-full h-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
          >
            <option value="">Select...</option>
            {options.map((option: any) => {
              const optionValue = typeof option === 'string' ? option : option.value
              return (
                <option key={optionValue} value={optionValue}>
                  {optionValue}
                </option>
              )
            })}
          </select>
        )
      }

      return (
        <div
          className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => {
            setSelectedCell({ rowId: row.id, columnId: column.id })
            setEditingCell({ rowId: row.id, columnId: column.id })
          }}
        >
          {value ? (
            <span className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded">
              {value}
            </span>
          ) : (
            <span className="text-gray-400">Empty</span>
          )}
        </div>
      )
    }

    // Default text input for other types
    if (isEditing) {
      return (
        <input
          type="text"
          defaultValue={typeof value === 'object' ? JSON.stringify(value) : (value || '')}
          autoFocus
          onChange={(e) => {
            // Broadcast real-time changes to other users
            broadcastFieldEditing(row.id, column.id, e.target.value, true)
          }}
          onFocus={() => {
            // Notify others that we're editing this cell
            broadcastFieldEditing(row.id, column.id, value, true)
          }}
          onBlur={(e) => {
            handleCellEdit(row.id, column.name, e.target.value)
            setEditingCell(null)
            // Notify others that we stopped editing
            broadcastFieldEditing(row.id, column.id, e.target.value, false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(row.id, column.name, e.currentTarget.value)
              setEditingCell(null)
              broadcastFieldEditing(row.id, column.id, e.currentTarget.value, false)
            } else if (e.key === 'Escape') {
              setEditingCell(null)
              broadcastFieldEditing(row.id, column.id, value, false)
            }
          }}
          className="w-full h-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
        />
      )
    }

    // Helper to safely render values
    const renderValue = () => {
      if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400">Empty</span>
      }
      
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
      }
      
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          if (value.length === 0) return <span className="text-gray-400">Empty</span>
          // Render array items joined by comma
          return (
            <span className="truncate block" title={JSON.stringify(value)}>
              {value.map(v => {
                if (typeof v === 'object' && v !== null) {
                  // Try to find a meaningful string representation
                  return Object.values(v).filter(val => typeof val !== 'object').join(' ') || JSON.stringify(v)
                }
                return String(v)
              }).join(', ')}
            </span>
          )
        }
        // Render object as string
        return (
          <span className="truncate block" title={JSON.stringify(value)}>
            {Object.values(value).filter(val => typeof val !== 'object').join(' ') || JSON.stringify(value)}
          </span>
        )
      }
      
      return String(value)
    }

    return (
      <div
        className={`px-3 py-2 cursor-pointer hover:bg-blue-50 relative group/cell h-full ${
          isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : 
          otherUserEditing ? 'ring-2 ring-inset bg-opacity-10' : ''
        }`}
        style={otherUserEditing ? { 
          borderColor: otherUserEditing.userColor,
          backgroundColor: `${otherUserEditing.userColor}10`
        } : {}}
        onClick={() => setSelectedCell({ rowId: row.id, columnId: column.id })}
        onDoubleClick={() => {
          if (!otherUserEditing) {
            setEditingCell({ rowId: row.id, columnId: column.id })
          }
        }}
      >
        <div className={`${isSelected ? 'line-clamp-2 whitespace-normal' : 'truncate whitespace-nowrap'}`}>
          {renderValue()}
        </div>
        
        {otherUserEditing && (
          <div 
            className="absolute top-0 right-0 px-2 py-0.5 text-xs font-medium text-white rounded-bl shadow-sm z-10"
            style={{ backgroundColor: otherUserEditing.userColor }}
          >
            {otherUserEditing.userName}
          </div>
        )}
        
        {isSelected && !otherUserEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6 bg-white shadow-sm border border-gray-200 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10"
            onClick={(e) => {
              e.stopPropagation()
              setExpandedCell({
                rowId: row.id,
                columnId: column.id,
                value: String(value || ''),
                columnName: column.name
              })
            }}
          >
            <Maximize2 className="h-3 w-3 text-gray-500" />
          </Button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading table...</p>
        </div>
      </div>
    )
  }

  if (currentView !== 'grid') {
    const CurrentViewIcon = VIEW_OPTIONS.find(v => v.value === currentView)?.icon || Grid3x3
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {isEditingTableName ? (
              <input
                ref={tableNameInputRef}
                type="text"
                value={tempTableName}
                onChange={(e) => setTempTableName(e.target.value)}
                onBlur={handleSaveTableName}
                onKeyDown={handleTableNameKeyDown}
                className="text-lg font-semibold text-gray-900 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h2 
                className="text-lg font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={handleStartEditingTableName}
              >
                {tableName}
              </h2>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <CurrentViewIcon className="w-4 h-4" />
                {VIEW_OPTIONS.find(v => v.value === currentView)?.label}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showViewMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  {VIEW_OPTIONS.map((view) => {
                    const Icon = view.icon
                    return (
                      <button
                        key={view.value}
                        onClick={() => {
                          setCurrentView(view.value as any)
                          setShowViewMenu(false)
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-start gap-3 ${
                          currentView === view.value ? 'bg-blue-50' : ''
                        }`}
                      >
                        <Icon className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{view.label}</div>
                          <div className="text-xs text-gray-500">{view.description}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Placeholder */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <CurrentViewIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {VIEW_OPTIONS.find(v => v.value === currentView)?.label} View
            </h3>
            <p className="text-gray-600 mb-4">
              {VIEW_OPTIONS.find(v => v.value === currentView)?.description}
            </p>
            <p className="text-sm text-gray-500">Coming soon</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEditingTableName ? (
              <input
                ref={tableNameInputRef}
                type="text"
                value={tempTableName}
                onChange={(e) => setTempTableName(e.target.value)}
                onBlur={handleSaveTableName}
                onKeyDown={handleTableNameKeyDown}
                className="text-2xl font-semibold text-gray-900 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h1 
                className="text-2xl font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                onClick={handleStartEditingTableName}
              >
                {tableName}
              </h1>
            )}
            <Badge variant="outline" className="gap-1.5 bg-green-50 text-green-700 border-green-200">
              <div className={`h-1.5 w-1.5 rounded-full ${realtimeStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {realtimeStatus === 'connected' ? 'Live' : 'Connecting...'}
            </Badge>
            
            {/* Active collaborators indicator */}
            {Object.keys(editingUsers).length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-2">
                  {Array.from(new Set(Object.values(editingUsers).map(u => u.userId))).slice(0, 3).map((userId) => {
                    const user = Object.values(editingUsers).find(u => u.userId === userId)
                    if (!user) return null
                    return (
                      <div
                        key={userId}
                        className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white shadow-sm"
                        style={{ backgroundColor: user.userColor }}
                        title={`${user.userName} is editing`}
                      >
                        {user.userName[0].toUpperCase()}
                      </div>
                    )
                  })}
                </div>
                {Array.from(new Set(Object.values(editingUsers).map(u => u.userId))).length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{Array.from(new Set(Object.values(editingUsers).map(u => u.userId))).length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="h-6 w-px bg-gray-200 mx-2" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {(() => {
                    const currentViewOption = VIEW_OPTIONS.find(v => v.value === currentView)
                    const Icon = currentViewOption?.icon || Grid3x3
                    return (
                      <>
                        <Icon className="h-4 w-4 mr-2" />
                        {currentViewOption?.label || 'Grid view'}
                      </>
                    )
                  })()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {VIEW_OPTIONS.map((view) => {
                  const Icon = view.icon
                  return (
                    <DropdownMenuItem
                      key={view.value}
                      onClick={() => setCurrentView(view.value as any)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {view.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handleFilter}>
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={sortConfig ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}>
                  {sortConfig ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 mr-2" /> : <ArrowDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ArrowUp className="h-4 w-4 mr-2" />
                  )}
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 text-xs font-medium text-gray-500">Sort by</div>
                <div className="max-h-64 overflow-y-auto">
                  {columns.filter(c => c.is_visible).map(column => (
                    <DropdownMenuItem 
                      key={column.id}
                      onClick={() => setSortConfig({ columnId: column.id, direction: 'asc' })}
                      className="justify-between"
                    >
                      <span className="truncate">{column.label}</span>
                      {sortConfig?.columnId === column.id && (
                        <span className="text-xs text-blue-600 ml-2">
                          {sortConfig.direction === 'asc' ? 'A → Z' : 'Z → A'}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
                {sortConfig && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setSortConfig(null)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear sort
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide fields
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <div className="p-3 border-b border-gray-100">
                  <div className="text-sm font-medium">Fields</div>
                  <div className="text-xs text-gray-500">Toggle visibility</div>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {columns.map(column => (
                    <div 
                      key={column.id} 
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-md cursor-pointer"
                      onClick={() => handleToggleColumnVisibility(column.id, !column.is_visible)}
                    >
                      <input
                        type="checkbox"
                        checked={column.is_visible}
                        onChange={() => {}} // Handled by parent div
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm flex-1 truncate ${!column.is_visible ? 'text-gray-400' : 'text-gray-700'}`}>
                        {column.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-100 bg-gray-50">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      columns.forEach(c => {
                        if (!c.is_visible) handleToggleColumnVisibility(c.id, true)
                      })
                    }}
                  >
                    Show all
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <Rows className="h-4 w-4 mr-2" />
                  Row height
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRowHeight('short')}>
                  <AlignJustify className="h-4 w-4 mr-2 rotate-90" />
                  Short
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRowHeight('medium')}>
                  <AlignJustify className="h-4 w-4 mr-2 rotate-90" />
                  Medium
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRowHeight('tall')}>
                  <AlignJustify className="h-4 w-4 mr-2 rotate-90" />
                  Tall
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRowHeight('extra-tall')}>
                  <AlignJustify className="h-4 w-4 mr-2 rotate-90" />
                  Extra Tall
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>


        </div>

        {/* Toolbar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-700">
                {selectedRows.size} row{selectedRows.size > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteRows}
                className="h-7"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto relative">
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-gray-50 shadow-sm">
              <tr className="border-b border-gray-200">
                <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap border-r border-gray-200 w-14 text-center sticky left-0 z-40 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedRows.size > 0 && selectedRows.size === filteredRows.length}
                    onChange={toggleAllRows}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                {columns.filter(c => c.is_visible).map((column) => (
                  <th 
                    key={column.id} 
                    style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} 
                    className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap border-r border-gray-200 relative group/column"
                  >
                    <div className="flex items-center justify-between h-full">
                      <span className="flex-1 min-w-0 truncate pr-2 text-xs uppercase tracking-wider text-gray-600">{column.label}</span>
                      <div className="relative flex items-center">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover/column:opacity-100 transition-all flex-shrink-0 cursor-pointer hover:bg-gray-200 rounded-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveColumnMenu(activeColumnMenu === column.id ? null : column.id)
                          }}
                          type="button"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5 text-gray-500" />
                        </Button>
                        {activeColumnMenu === column.id && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditColumn(column)
                                setActiveColumnMenu(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Settings className="h-4 w-4" />
                              Edit field
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDuplicateColumn(column)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Copy className="h-4 w-4" />
                              Duplicate field
                            </button>
                            <div className="h-px bg-gray-200 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddColumn(column.position)
                                setActiveColumnMenu(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              Insert left
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddColumn(column.position + 1)
                                setActiveColumnMenu(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Insert right
                            </button>
                            <div className="h-px bg-gray-200 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSortConfig({ columnId: column.id, direction: 'asc' })
                                setActiveColumnMenu(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <ArrowUp className="h-4 w-4" />
                              Sort First → Last
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSortConfig({ columnId: column.id, direction: 'desc' })
                                setActiveColumnMenu(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <ArrowDown className="h-4 w-4" />
                              Sort Last → First
                            </button>
                            <div className="h-px bg-gray-200 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleHideColumn(column)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <EyeOff className="h-4 w-4" />
                              Hide field
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteColumn(column.id)
                                setActiveColumnMenu(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete field
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Resize Handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
                      onMouseDown={(e) => handleResizeStart(e, column.id, column.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                ))}
                <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-12 bg-gray-50">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleAddColumn()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rowIndex) => {
                const isHighlighted = highlightedRows.has(row.id)
                const isSelected = selectedRows.has(row.id)
                return (
                  <tr 
                    key={row.id}
                    className={`group/row border-b border-gray-200 transition-colors ${ROW_HEIGHTS[rowHeight]} ${isHighlighted ? 'bg-green-50' : ''} ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className={`p-2 align-middle whitespace-nowrap border-r border-gray-200 text-center sticky left-0 z-20 w-14 ${isSelected ? 'bg-blue-50' : 'bg-white group-hover/row:bg-gray-50'}`}>
                      <div className="relative flex items-center justify-center h-full w-full">
                        <span className={`text-gray-500 text-sm ${isSelected ? 'hidden' : 'group-hover/row:hidden'}`}>
                          {rowIndex + 1}
                        </span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(row.id)}
                          className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer absolute ${isSelected ? 'block' : 'hidden group-hover/row:block'}`}
                        />
                      </div>
                    </td>
                    {columns.filter(c => c.is_visible).map((column) => (
                      <td 
                        key={column.id}
                        style={{ width: column.width, minWidth: column.width, maxWidth: column.width }}
                        className="p-0 align-middle whitespace-nowrap border-r border-gray-200 relative"
                      >
                        {renderCell(row, column)}
                      </td>
                    ))}
                    <td className="p-0 align-middle whitespace-nowrap w-12">
                      <div className="flex items-center justify-center h-full">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDuplicateRow(row.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteRow(row.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Empty State for Add Row */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 sticky left-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
              onClick={handleAddRow}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add row
            </Button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-2 border-t border-gray-200 bg-white text-xs text-gray-500 flex justify-between items-center">
          <span>
            {filteredRows.length} {filteredRows.length === 1 ? 'row' : 'rows'}
            {searchTerm && ` (filtered from ${rows.length} total)`}
          </span>
        </div>
      </div>

      <ColumnEditorModal
        isOpen={isColumnEditorOpen}
        onClose={() => {
          setIsColumnEditorOpen(false)
          setEditingColumn(null)
        }}
        onSubmit={handleSaveColumn}
        column={editingColumn}
        mode={editingColumn ? 'edit' : 'create'}
        workspaceId={workspaceId}
        currentTableId={tableId}
      />

      <Sheet open={!!expandedCell} onOpenChange={(open) => {
        if (!open && expandedCell) {
          // Notify others that we stopped editing
          broadcastFieldEditing(expandedCell.rowId, columns.find(c => c.name === expandedCell.columnName)?.id || '', expandedCell.value, false)
        }
        setExpandedCell(open ? expandedCell : null)
      }}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Edit Cell</SheetTitle>
            <SheetDescription>
              Make changes to the cell content here. Click save when you're done.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 h-[calc(100vh-200px)]">
            <Textarea
              className="h-full resize-none font-mono text-sm"
              value={expandedCell?.value || ''}
              onChange={(e) => {
                const newValue = e.target.value
                setExpandedCell(prev => prev ? { ...prev, value: newValue } : null)
                // Broadcast real-time changes
                if (expandedCell) {
                  const column = columns.find(c => c.name === expandedCell.columnName)
                  if (column) {
                    broadcastFieldEditing(expandedCell.rowId, column.id, newValue, true)
                  }
                }
              }}
            />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => {
              if (expandedCell) {
                const column = columns.find(c => c.name === expandedCell.columnName)
                if (column) {
                  broadcastFieldEditing(expandedCell.rowId, column.id, expandedCell.value, false)
                }
              }
              setExpandedCell(null)
            }}>Cancel</Button>
            <Button onClick={() => {
              if (expandedCell) {
                handleCellEdit(expandedCell.rowId, expandedCell.columnName, expandedCell.value)
                const column = columns.find(c => c.name === expandedCell.columnName)
                if (column) {
                  broadcastFieldEditing(expandedCell.rowId, column.id, expandedCell.value, false)
                }
                setExpandedCell(null)
              }
            }}>Save changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
