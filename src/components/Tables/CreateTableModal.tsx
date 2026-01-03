'use client'

import { useState } from 'react'
import { useSession } from '@/lib/better-auth-client'
import { X, Plus, Trash2, Table2, Hash, Type, Mail, Phone, Calendar, CheckSquare, Link as LinkIcon } from 'lucide-react'

interface Column {
  name: string
  label: string
  column_type: string
}

interface CreateTableModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TableFormData) => void
  workspaceId: string
}

export interface TableFormData {
  name: string
  slug: string
  description: string
  icon: string
  color: string
  workspace_id: string
  created_by: string
  columns: Column[]
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'url', label: 'URL', icon: LinkIcon },
]

const ICON_OPTIONS = ['table', 'users', 'briefcase', 'folder', 'file-text', 'database']
const COLOR_OPTIONS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899']

export function CreateTableModal({ isOpen, onClose, onSubmit, workspaceId }: CreateTableModalProps) {
  const { data: sessionData } = useSession()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('table')
  const [selectedColor, setSelectedColor] = useState('#10B981')
  const [columns, setColumns] = useState<Column[]>([
    { name: 'name', label: 'Name', column_type: 'text' }
  ])

  const handleAddColumn = () => {
    setColumns([...columns, { name: '', label: '', column_type: 'text' }])
  }

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index))
  }

  const handleColumnChange = (index: number, field: keyof Column, value: string) => {
    const newColumns = [...columns]
    newColumns[index] = { ...newColumns[index], [field]: value }
    // Auto-generate name from label
    if (field === 'label') {
      newColumns[index].name = value.toLowerCase().replace(/\s+/g, '_')
    }
    setColumns(newColumns)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Get user from session hook
    const user = sessionData?.user
    
    if (!user) {
      alert('You must be logged in to create a table')
      return
    }
    
    const slug = name.toLowerCase().replace(/\s+/g, '-')
    
    onSubmit({
      name,
      slug,
      description,
      icon: selectedIcon,
      color: selectedColor,
      workspace_id: workspaceId,
      created_by: user.id,
      columns: columns.map((col, i) => ({ ...col, position: i }))
    })
    
    // Reset form
    setName('')
    setDescription('')
    setSelectedIcon('table')
    setSelectedColor('#10B981')
    setColumns([{ name: 'name', label: 'Name', column_type: 'text' }])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Table2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Table</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Table Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Contacts, Projects, Tasks"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will you use this table for?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Icon and Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`p-3 border rounded-lg transition-all ${
                        selectedIcon === icon
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Table2 className="w-5 h-5 mx-auto text-gray-700" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`p-3 border rounded-lg transition-all ${
                        selectedColor === color
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color + '20' }}
                    >
                      <div
                        className="w-5 h-5 rounded mx-auto"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Columns */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Columns *
                </label>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Column
                </button>
              </div>

              <div className="space-y-3">
                {columns.map((column, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={column.label}
                        onChange={(e) => handleColumnChange(index, 'label', e.target.value)}
                        placeholder="Column name"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value={column.column_type}
                      onChange={(e) => handleColumnChange(index, 'column_type', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {COLUMN_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || columns.some(c => !c.label)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Create Table
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
