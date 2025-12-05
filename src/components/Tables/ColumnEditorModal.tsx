'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, GripVertical, Type, Hash, Mail, Phone, Calendar, CheckSquare, Link as LinkIcon, List, Image, Link2, Search, ChevronRight, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface Column {
  id?: string
  name: string
  label: string
  column_type: string
  description?: string
  width?: number
  is_visible?: boolean
  position?: number
  settings?: Record<string, any>
  linked_table_id?: string
}

interface ColumnEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (column: Column) => void
  column?: Column | null
  mode: 'create' | 'edit'
  workspaceId: string
  currentTableId: string
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Single line text', icon: Type, description: 'Plain text up to 100 characters' },
  { value: 'textarea', label: 'Long text', icon: Type, description: 'Multi-line text' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Integer or decimal numbers' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Email address with validation' },
  { value: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
  { value: 'url', label: 'URL', icon: LinkIcon, description: 'Website link' },
  { value: 'address', label: 'Address', icon: MapPin, description: 'Address with autocomplete' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { value: 'datetime', label: 'Date & Time', icon: Calendar, description: 'Date and time picker' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'True/false value' },
  { value: 'select', label: 'Single select', icon: List, description: 'Pick one option from a list' },
  { value: 'multiselect', label: 'Multiple select', icon: List, description: 'Pick multiple options' },
  { value: 'link', label: 'Link to another table', icon: Link2, description: 'Reference records from another table' },
  { value: 'attachment', label: 'Attachment', icon: Image, description: 'File uploads' },
  { value: 'rating', label: 'Rating', icon: Type, description: 'Star rating (1-5)' },
  { value: 'currency', label: 'Currency', icon: Hash, description: 'Monetary values' },
  { value: 'percent', label: 'Percent', icon: Hash, description: 'Percentage values' },
]

export function ColumnEditorModal({ isOpen, onClose, onSubmit, column, mode, workspaceId, currentTableId }: ColumnEditorModalProps) {
  const [label, setLabel] = useState(column?.label || '')
  const [description, setDescription] = useState(column?.description || '')
  const [columnType, setColumnType] = useState(column?.column_type || 'text')
  const [selectedType, setSelectedType] = useState<typeof COLUMN_TYPES[0] | null>(
    COLUMN_TYPES.find(t => t.value === (column?.column_type || 'text')) || COLUMN_TYPES[0]
  )
  
  // Field-specific settings
  const [selectOptions, setSelectOptions] = useState<string[]>(
    column?.settings?.options || (column?.column_type === 'select' || column?.column_type === 'multiselect' ? ['Option 1'] : [])
  )
  const [linkedTableId, setLinkedTableId] = useState<string>(column?.linked_table_id || '')
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [linkedTableColumns, setLinkedTableColumns] = useState<Array<{ id: string; name: string; label: string }>>([])
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [displayFields, setDisplayFields] = useState<string[]>(() => {
    // Get display fields from column settings if editing
    if (column?.settings?.displayFields) {
      return Array.isArray(column.settings.displayFields) ? column.settings.displayFields : []
    }
    return []
  })
  const [typeSearch, setTypeSearch] = useState('')
  const [enableRichText, setEnableRichText] = useState(column?.settings?.richText || false)

  // Update state when column prop changes (for edit mode)
  useEffect(() => {
    if (column) {
      setLabel(column.label || '')
      setDescription(column.description || '')
      setColumnType(column.column_type || 'text')
      setSelectedType(COLUMN_TYPES.find(t => t.value === column.column_type) || COLUMN_TYPES[0])
      setSelectOptions(column.settings?.options || [])
      setLinkedTableId(column.linked_table_id || '')
      setEnableRichText(column.settings?.richText || false)
    } else {
      // Reset for create mode
      setLabel('')
      setDescription('')
      setColumnType('text')
      setSelectedType(COLUMN_TYPES[0])
      setSelectOptions(['Option 1'])
      setLinkedTableId('')
      setEnableRichText(false)
    }
  }, [column])

  // Load available tables when link type is selected
  useEffect(() => {
    if (columnType === 'link' && workspaceId) {
      loadAvailableTables()
    }
  }, [columnType, workspaceId])

  // Load columns from linked table when linkedTableId changes
  useEffect(() => {
    if (columnType === 'link' && linkedTableId) {
      loadLinkedTableColumns()
    } else {
      setLinkedTableColumns([])
      if (!column?.settings?.displayFields) {
        setDisplayFields([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnType, linkedTableId])

  const loadAvailableTables = async () => {
    try {
      setLoadingTables(true)
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      const tables = await tablesGoClient.getTablesByWorkspace(workspaceId)
      // Filter out the current table
      setAvailableTables(tables.filter((t: any) => t.id !== currentTableId))
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoadingTables(false)
    }
  }

  const loadLinkedTableColumns = async () => {
    if (!linkedTableId) return
    
    setLoadingColumns(true)
    try {
      const { tablesGoClient } = await import('@/lib/api/tables-go-client')
      const table = await tablesGoClient.getTableById(linkedTableId)
      console.log('📊 Loaded table for columns:', table)
      const columns = table.columns || []
      console.log('📋 Found columns:', columns.length, columns)
      
      if (columns.length === 0) {
        console.warn('⚠️ No columns found in table:', linkedTableId)
        setLinkedTableColumns([])
        return
      }
      
      setLinkedTableColumns(columns.map((col: any) => ({
        id: col.id || col.name,
        name: col.name,
        label: col.label || col.name
      })))
      
      // If no display fields set yet, default to the first text-like column or name
      if (displayFields.length === 0) {
        const nameColumn = columns.find((col: any) => 
          col.name === 'name' || col.name === 'title' || col.name === 'full_name'
        )
        if (nameColumn) {
          setDisplayFields([nameColumn.name])
        } else if (columns.length > 0) {
          // Use first visible column
          const firstVisible = columns.find((col: any) => col.is_visible !== false) || columns[0]
          setDisplayFields([firstVisible.name])
        }
      }
    } catch (error) {
      console.error('Error loading linked table columns:', error)
      toast.error('Failed to load table columns')
      setLinkedTableColumns([])
    } finally {
      setLoadingColumns(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const name = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    
    const columnData: any = {
      ...column,
      name,
      label: label || name, // Ensure label is set
      description,
      column_type: columnType,
      settings: {},
      is_visible: true, // Default to visible
      is_primary: false // Default to not primary
    }

    // Add type-specific settings
    if (columnType === 'select' || columnType === 'multiselect') {
      columnData.settings = {
        options: selectOptions.filter(o => o.trim())
      }
    }

    if (columnType === 'textarea') {
      columnData.settings = {
        richText: enableRichText
      }
    }

    // Add linked table for link type
    if (columnType === 'link') {
      if (!linkedTableId) {
        alert('Please select a table to link to')
        return
      }
      columnData.linked_table_id = linkedTableId
      // Add display fields to settings
      if (!columnData.settings) {
        columnData.settings = {}
      }
      columnData.settings.displayFields = displayFields.length > 0 ? displayFields : ['name']
    }

    onSubmit(columnData)
    onClose()
  }

  const handleAddOption = () => {
    setSelectOptions([...selectOptions, `Option ${selectOptions.length + 1}`])
  }

  const handleRemoveOption = (index: number) => {
    setSelectOptions(selectOptions.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...selectOptions]
    newOptions[index] = value
    setSelectOptions(newOptions)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Mobile Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Field' : 'Edit Field'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Field Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Name *
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Full Name, Email Address"
                required
                className="w-full px-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Help text for this field"
                className="w-full px-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Field Type *
              </label>
              
              {/* Type Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Find a field type"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto bg-white shadow-sm">
                {COLUMN_TYPES.filter(t => 
                  t.label.toLowerCase().includes(typeSearch.toLowerCase()) || 
                  t.description.toLowerCase().includes(typeSearch.toLowerCase())
                ).map((type) => {
                  const Icon = type.icon
                  const isSelected = columnType === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setColumnType(type.value)
                        setSelectedType(type)
                      }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-b border-gray-100 last:border-0 ${
                        isSelected 
                          ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                          {type.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                          {type.description}
                        </p>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Rich Text Toggle for Long Text */}
            {columnType === 'textarea' && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-900">Formatting</div>
                  <div className="text-xs text-gray-500">Enable rich text formatting</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableRichText(!enableRichText)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    enableRichText ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enableRichText ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Type-specific settings */}
            {(columnType === 'select' || columnType === 'multiselect') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Options
                </label>
                <div className="border border-gray-300 rounded-lg p-3 min-h-[100px]">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectOptions.map((option, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder="Option"
                          className="bg-transparent border-none outline-none text-sm font-medium w-auto min-w-[60px] focus:ring-0 p-0"
                          style={{ width: `${Math.max(60, option.length * 8)}px` }}
                        />
                        {selectOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Link to table settings */}
            {columnType === 'link' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select table to link
                  </label>
                  {loadingTables ? (
                    <div className="text-sm text-gray-500 py-2">Loading tables...</div>
                  ) : (
                    <select
                      value={linkedTableId}
                      onChange={(e) => setLinkedTableId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Choose a table...</option>
                      {availableTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {linkedTableId && (
                    <p className="mt-2 text-xs text-gray-500">
                      This field will allow you to link records from the selected table
                    </p>
                  )}
                </div>

                {/* Display Fields Configuration */}
                {linkedTableId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fields to display
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Select which fields from the linked table should be shown when displaying linked records
                    </p>
                    {loadingColumns ? (
                      <div className="text-sm text-gray-500 py-2">Loading columns...</div>
                    ) : linkedTableColumns.length === 0 ? (
                      <div className="text-sm text-gray-500 py-2">No columns available</div>
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                        {linkedTableColumns.map((col) => (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={displayFields.includes(col.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDisplayFields([...displayFields, col.name])
                                } else {
                                  setDisplayFields(displayFields.filter(f => f !== col.name))
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{col.label}</span>
                            <span className="text-xs text-gray-400">({col.name})</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {displayFields.length === 0 && linkedTableColumns.length > 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        Please select at least one field to display
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {columnType === 'number' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Value
                  </label>
                  <input
                    type="number"
                    placeholder="No minimum"
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Value
                  </label>
                  <input
                    type="number"
                    placeholder="No maximum"
                    className="w-full px-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {columnType === 'currency' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select className="w-full px-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 sm:py-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 sm:py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-base sm:text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!label}
              className="px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-base sm:text-sm font-medium"
            >
              {mode === 'create' ? 'Add Field' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
