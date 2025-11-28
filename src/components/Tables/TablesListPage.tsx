'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Table2, MoreVertical, Edit, Trash2, Copy, Upload } from 'lucide-react'
import { useTabContext } from '../WorkspaceTabProvider'
import { CreateTableModal, TableFormData } from './CreateTableModal'
import { CSVImportModal } from './CSVImportModal'
import { getSessionToken } from '@/lib/supabase'
import { toast } from 'sonner'
import type { DataTable } from '@/types/data-tables'

const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'https://backend.maticslab.com/api/v1'

interface TablesListPageProps {
  workspaceId: string
}

// Direct API functions following activities hubs pattern
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getSessionToken()
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.message || error.detail || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function listTables(workspaceId: string): Promise<DataTable[]> {
  const params = new URLSearchParams({ workspace_id: workspaceId })
  return fetchWithAuth(`${API_BASE}/tables?${params}`)
}

async function createTable(data: { workspace_id: string; name: string; description?: string; icon?: string }): Promise<DataTable> {
  return fetchWithAuth(`${API_BASE}/tables`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

async function deleteTable(tableId: string): Promise<void> {
  return fetchWithAuth(`${API_BASE}/tables/${tableId}`, {
    method: 'DELETE',
  })
}

export function TablesListPage({ workspaceId }: TablesListPageProps) {
  const [tables, setTables] = useState<DataTable[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const { tabManager, setTabActions, setTabHeaderContent } = useTabContext()

  useEffect(() => {
    if (workspaceId) {
      loadTables()
    }
  }, [workspaceId])

  // Register tab header content
  useEffect(() => {
    setTabHeaderContent({
      title: 'Data Hub',
    })
    return () => setTabHeaderContent(null)
  }, [setTabHeaderContent])

  // Register tab actions
  useEffect(() => {
    setTabActions([
      {
        label: 'Import CSV',
        icon: Upload,
        onClick: () => setIsImportModalOpen(true),
        variant: 'outline' as const
      },
      {
        label: 'New Table',
        icon: Plus,
        onClick: () => setIsCreateModalOpen(true),
        variant: 'default' as const
      }
    ])
    return () => setTabActions([])
  }, [setTabActions])

  const loadTables = async () => {
    try {
      setLoading(true)
      const data = await listTables(workspaceId)
      setTables(data || [])
    } catch (error: any) {
      console.error('Error loading tables:', error)
      toast.error(`Failed to load tables: ${error.message || 'Unknown error'}`)
      setTables([])
    } finally {
      setLoading(false)
    }
  }

  const handleNewTable = () => {
    setIsCreateModalOpen(true)
  }

  const handleImportCSV = () => {
    setIsImportModalOpen(true)
  }

  const handleCSVImport = async (data: { 
    headers: string[]
    rows: string[][]
    mappings: { name: string; type: string; included: boolean }[] 
  }) => {
    try {
      const token = await getSessionToken()
      if (!token) {
        toast.error('You must be logged in to import data')
        return
      }

      const tableName = `Imported Table ${new Date().toLocaleDateString()}`
      
      // Create table
      toast.loading('Creating table...')
      const newTable = await createTable({
        workspace_id: workspaceId,
        name: tableName,
        description: '',
        icon: 'table',
      })

          toast.dismiss()
      toast.success(`Table "${tableName}" created`)

      // Reload tables
      await loadTables()
      setIsImportModalOpen(false)

      // Open the new table
      if (newTable?.id) {
        tabManager?.addTab({
          title: newTable.name,
          type: 'table',
          url: `/w/${workspaceId}/tables/${newTable.id}`,
          workspaceId,
          metadata: { tableId: newTable.id }
        })
      }
    } catch (error: any) {
      console.error('Error importing CSV:', error)
      toast.dismiss()
      toast.error(`Failed to import CSV: ${error.message || 'Unknown error'}`)
    }
  }

  const handleCreateTable = async (data: TableFormData) => {
    try {
      console.log('Creating table with data:', data)
      
      const newTable = await createTable({
        workspace_id: data.workspace_id,
        name: data.name,
        description: data.description || '',
        icon: data.icon || 'table',
      })
      
      console.log('Table created:', newTable)
      toast.success(`Table "${newTable.name}" created successfully`)
      
      // Reload tables list
      await loadTables()
      
      // Close modal
      setIsCreateModalOpen(false)
      
      // Open the new table in a tab
      if (newTable?.id) {
      tabManager?.addTab({
        title: newTable.name,
        type: 'table',
        url: `/w/${workspaceId}/tables/${newTable.id}`,
        workspaceId,
        metadata: { tableId: newTable.id }
      })
      }
    } catch (error: any) {
      console.error('Error creating table:', error)
      toast.error(`Failed to create table: ${error.message || 'Unknown error'}`)
    }
  }

  const handleOpenTable = (table: DataTable) => {
    if (table?.id) {
    tabManager?.addTab({
      title: table.name,
      type: 'table',
      url: `/w/${workspaceId}/tables/${table.id}`,
      workspaceId,
      metadata: { tableId: table.id }
    })
    }
  }

  const handleDuplicateTable = async (table: DataTable) => {
    try {
      toast.info('Duplicate functionality coming soon!')
    } catch (error) {
      console.error('Error duplicating table:', error)
    }
    setActiveMenu(null)
  }

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table? This action cannot be undone.')) {
      return
    }
    
    try {
      await deleteTable(tableId)
      toast.success('Table deleted successfully')
      await loadTables()
    } catch (error: any) {
      console.error('Error deleting table:', error)
      toast.error(`Failed to delete table: ${error.message || 'Unknown error'}`)
    }
    setActiveMenu(null)
  }

  const filteredTables = tables.filter(table =>
    table?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tables...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">Overview</div>
          <div className="space-y-1">
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-blue-50 text-blue-700 font-medium">
              <span>All Tables</span>
              <span className="text-xs text-blue-600">{tables.length}</span>
            </div>
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600">
              <span>Total Rows</span>
              <span className="text-xs text-gray-400">{tables.reduce((sum, t) => sum + (t.row_count || 0), 0)}</span>
            </div>
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600">
              <span>Total Columns</span>
              <span className="text-xs text-gray-400">{tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-white rounded-tl-xl rounded-bl-xl border-l border-gray-200">
        {filteredTables.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Table2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No tables found' : 'No tables yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Get started by creating your first table to organize and manage your data'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleNewTable}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Table
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTables.map((table) => (
              <div
                key={table.id}
                className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div
                  className="p-4"
                  onClick={() => handleOpenTable(table)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Table2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenu(activeMenu === table.id ? null : table.id)
                        }}
                        className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                      
                      {activeMenu === table.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenTable(table)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Open
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicateTable(table)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <div className="border-t border-gray-200 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTable(table.id)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">
                    {table.name || 'Unnamed Table'}
                  </h3>
                  
                  {table.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {table.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{table.row_count || 0} rows</span>
                    <span>{table.columns?.length || 0} columns</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTable}
        workspaceId={workspaceId}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onComplete={handleCSVImport}
      />
    </div>
  )
}
