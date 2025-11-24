import { useState, useEffect, useCallback } from 'react'
import { Search, X, Plus, Link2, Loader2 } from 'lucide-react'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { tableLinksGoClient, rowLinksGoClient } from '@/lib/api/participants-go-client'
import { toast } from 'sonner'

interface LinkedRecord {
  id: string
  display_name: string
  data: Record<string, any>
}

interface LinkFieldProps {
  tableId: string
  rowId: string
  columnId: string
  columnName: string
  linkedTableId: string
  value: string[] // Array of linked record IDs
  onChange: (newValue: string[]) => void
  onSave: (newValue: string[]) => Promise<void>
  displayFields?: string[] // Fields to display from the linked table
}

/**
 * LinkField - A clean, rebuilt component for managing linked records
 * 
 * Architecture:
 * - Links are stored in table_row_links, NOT in row data JSON
 * - Supports bidirectional links (current table as source or target)
 * - Automatically finds or creates table_link
 * - Handles loading and saving links correctly
 */
export function LinkField({
  tableId,
  rowId,
  columnId,
  columnName,
  linkedTableId,
  value = [],
  onChange,
  onSave,
  displayFields = []
}: LinkFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [search, setSearch] = useState('')
  const [availableRecords, setAvailableRecords] = useState<LinkedRecord[]>([])
  const [allRecordsCache, setAllRecordsCache] = useState<LinkedRecord[]>([])
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tableLink, setTableLink] = useState<any>(null)
  const [linkDirection, setLinkDirection] = useState<'source' | 'target' | null>(null)

  // Load table link and determine direction
  useEffect(() => {
    if (linkedTableId && tableId) {
      loadTableLink()
    }
  }, [linkedTableId, tableId])

  // Load linked records when value changes
  useEffect(() => {
    if (value.length > 0 && linkedTableId && tableLink) {
      loadLinkedRecords()
    } else {
      setLinkedRecords([])
    }
  }, [value, linkedTableId, tableLink])

  // Load all available records when editing
  useEffect(() => {
    if (isEditing && linkedTableId && allRecordsCache.length === 0) {
      loadAvailableRecords()
    }
  }, [isEditing, linkedTableId])

  // Filter available records based on search
  useEffect(() => {
    if (allRecordsCache.length > 0) {
      if (search) {
        const searchLower = search.toLowerCase()
        const filtered = allRecordsCache.filter(record =>
          record.display_name.toLowerCase().includes(searchLower) ||
          record.id.toLowerCase().includes(searchLower)
        )
        setAvailableRecords(filtered)
      } else {
        setAvailableRecords(allRecordsCache)
      }
    }
  }, [search, allRecordsCache])

  const loadTableLink = async () => {
    try {
      // Try current table as source
      let links = await tableLinksGoClient.getTableLinks(tableId)
      let link = links.find((l: any) =>
        l.source_table_id === tableId &&
        l.target_table_id === linkedTableId
      )

      if (link) {
        setTableLink(link)
        setLinkDirection('source')
        return
      }

      // Try current table as target (reverse direction)
      links = await tableLinksGoClient.getTableLinks(linkedTableId)
      link = links.find((l: any) =>
        l.source_table_id === linkedTableId &&
        l.target_table_id === tableId
      )

      if (link) {
        setTableLink(link)
        setLinkDirection('target')
        return
      }

      // Create link if it doesn't exist
      if (columnId) {
        try {
          link = await tableLinksGoClient.createTableLink(
            tableId,
            columnId,
            linkedTableId,
            'many_to_many',
            {
              label: columnName,
              reverseLabel: 'Linked Records'
            }
          )
          setTableLink(link)
          setLinkDirection('source')
        } catch (err) {
          console.error('Error creating table link:', err)
          toast.error('Failed to create link')
        }
      }
    } catch (error) {
      console.error('Error loading table link:', error)
    }
  }

  const loadLinkedRecords = async () => {
    if (!tableLink || !rowId) return

    try {
      setLoading(true)
      const linkedRows = await rowLinksGoClient.getLinkedRows(rowId, tableLink.id)

      // Filter to get only the linked records (not the current row)
      const linkedIds = linkedRows
        .filter((lr: any) => lr.row && lr.row.id !== rowId)
        .map((lr: any) => lr.row.id)

      // Verify the linked IDs match the value
      if (JSON.stringify(linkedIds.sort()) !== JSON.stringify(value.sort())) {
        console.warn('Linked IDs mismatch, updating value:', { linkedIds, value })
        onChange(linkedIds)
      }

      // Get full record data for display
      if (linkedIds.length > 0) {
        const allRecords = await tablesGoClient.getRowsByTable(linkedTableId)
        const records = allRecords.filter((r: any) => linkedIds.includes(r.id))
        const formatted = records.map((record: any) => ({
          id: record.id,
          display_name: getDisplayName(record),
          data: record.data
        }))
        setLinkedRecords(formatted)
      } else {
        setLinkedRecords([])
      }
    } catch (error) {
      console.error('Error loading linked records:', error)
      setLinkedRecords([])
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableRecords = async () => {
    if (!linkedTableId) return

    try {
      setLoading(true)
      const allRecords = await tablesGoClient.getRowsByTable(linkedTableId)
      const formatted = allRecords.map((record: any) => ({
        id: record.id,
        display_name: getDisplayName(record),
        data: record.data
      }))
      setAllRecordsCache(formatted)
      setAvailableRecords(formatted)
    } catch (error) {
      console.error('Error loading available records:', error)
      toast.error('Failed to load records')
    } finally {
      setLoading(false)
    }
  }

  const getDisplayName = (record: any): string => {
    const data = record.data || {}
    
    // If displayFields are configured, use them
    if (displayFields.length > 0) {
      const displayParts = displayFields
        .map(field => {
          const value = data[field]
          if (value !== null && value !== undefined) {
            return String(value)
          }
          return null
        })
        .filter(part => part !== null)
      
      if (displayParts.length > 0) {
        return displayParts.join(' • ')
      }
    }
    
    // Fallback to default behavior
    const possibleNames = ['name', 'title', 'label', 'full_name', 'display_name', 'text']
    
    for (const field of possibleNames) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field]
      }
    }
    
    const firstString = Object.values(data).find(val =>
      typeof val === 'string' && val.trim().length > 0
    ) as string
    
    return firstString || `Record ${record.id?.substring(0, 8) || 'Unknown'}`
  }

  const handleLink = async (targetRecordId: string) => {
    if (value.includes(targetRecordId)) return

    const newValue = [...value, targetRecordId]
    onChange(newValue)
    
    try {
      setSaving(true)
      await onSave(newValue)
      toast.success('Record linked')
    } catch (error) {
      // Revert on error
      onChange(value)
      toast.error('Failed to link record')
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async (targetRecordId: string) => {
    const newValue = value.filter(id => id !== targetRecordId)
    onChange(newValue)
    
    try {
      setSaving(true)
      await onSave(newValue)
      toast.success('Record unlinked')
    } catch (error) {
      // Revert on error
      onChange(value)
      toast.error('Failed to unlink record')
      throw error
    } finally {
      setSaving(false)
    }
  }

  const filteredAvailable = availableRecords.filter(record =>
    !search || record.display_name.toLowerCase().includes(search.toLowerCase())
  )

  const isLinked = (recordId: string) => value.includes(recordId)

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setIsEditing(false)} />
        <div className="relative z-10 w-full max-w-2xl max-h-[80vh] bg-white rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Link Records</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Current Links */}
          {linkedRecords.length > 0 && (
            <div className="p-4 border-b bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-2">Linked ({linkedRecords.length}):</div>
              <div className="flex flex-wrap gap-2">
                {linkedRecords.map((record) => (
                  <span
                    key={record.id}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-purple-100 text-purple-700 rounded"
                  >
                    <Link2 className="h-3 w-3" />
                    {record.display_name}
                    <button
                      onClick={() => handleUnlink(record.id)}
                      className="hover:text-purple-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>
          </div>

          {/* Available Records */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredAvailable.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {search ? 'No matching records' : 'No records available'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredAvailable.map((record) => (
                  <label
                    key={record.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${
                      isLinked(record.id) ? 'bg-purple-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isLinked(record.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleLink(record.id)
                        } else {
                          handleUnlink(record.id)
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {record.display_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {record.id.substring(0, 8)}...
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={() => setIsEditing(false)}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Display mode
  return (
    <div
      className="px-3 py-2 cursor-pointer hover:bg-purple-50 min-h-[40px] flex items-center rounded"
      onClick={() => setIsEditing(true)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : linkedRecords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {linkedRecords.map((record) => (
            <span
              key={record.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-purple-100 text-purple-700 rounded"
            >
              <Link2 className="h-3 w-3" />
              {record.display_name}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-400">
          <Plus className="h-4 w-4" />
          <span className="text-sm">Link records...</span>
        </div>
      )}
    </div>
  )
}

