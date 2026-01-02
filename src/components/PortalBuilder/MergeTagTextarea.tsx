'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui-components/popover'
import { Plus, X, Search, FileText, Mail, Type, Hash, List, Calendar, User, Link2 } from 'lucide-react'
import { ScrollArea } from '@/ui-components/scroll-area'

interface Field {
  id: string
  label: string
  type: string
}

interface MergeTagTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  fields: Field[]
  className?: string
  disabled?: boolean
  rows?: number
}

// Map field types to icons
function getFieldIcon(type: string) {
  switch (type) {
    case 'email':
      return <Mail className="h-4 w-4 text-teal-500" />
    case 'text':
    case 'textarea':
      return <Type className="h-4 w-4 text-blue-500" />
    case 'number':
      return <Hash className="h-4 w-4 text-purple-500" />
    case 'select':
    case 'multiselect':
    case 'checkbox':
    case 'radio':
      return <List className="h-4 w-4 text-orange-500" />
    case 'date':
      return <Calendar className="h-4 w-4 text-green-500" />
    case 'file':
    case 'upload':
      return <FileText className="h-4 w-4 text-red-500" />
    case 'recommendation':
      return <User className="h-4 w-4 text-indigo-500" />
    case 'link':
      return <Link2 className="h-4 w-4 text-cyan-500" />
    default:
      return <Type className="h-4 w-4 text-gray-500" />
  }
}

// Badge component for displaying field tags
function FieldBadge({ 
  field, 
  onRemove 
}: { 
  field: Field
  onRemove: () => void 
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm border border-blue-200">
      {field.label}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove()
        }}
        className="hover:bg-blue-200 rounded-full p-0.5 -mr-1"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// Parse value into segments (text and field references)
interface Segment {
  type: 'text' | 'field'
  value: string
  fieldId?: string
}

function parseValue(value: string, fields: Field[]): Segment[] {
  const segments: Segment[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(value)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: value.slice(lastIndex, match.index)
      })
    }

    // Add the field reference
    const fieldId = match[1]
    const field = fields.find(f => f.id === fieldId)
    segments.push({
      type: 'field',
      value: field?.label || fieldId,
      fieldId
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < value.length) {
    segments.push({
      type: 'text',
      value: value.slice(lastIndex)
    })
  }

  return segments
}

// Convert segments back to string value
function segmentsToValue(segments: Segment[]): string {
  return segments.map(seg => 
    seg.type === 'field' ? `{{${seg.fieldId}}}` : seg.value
  ).join('')
}

export function MergeTagTextarea({
  value,
  onChange,
  placeholder = 'Enter text...',
  fields,
  className,
  disabled,
  rows = 3
}: MergeTagTextareaProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const segments = parseValue(value, fields)

  // Group fields by type for better organization
  const groupedFields = fields.reduce((acc, field) => {
    const category = field.type === 'email' ? 'Email' : 
                    ['text', 'textarea'].includes(field.type) ? 'Text' :
                    ['select', 'multiselect', 'checkbox', 'radio'].includes(field.type) ? 'Selection' :
                    'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(field)
    return acc
  }, {} as Record<string, Field[]>)

  const filteredFields = searchQuery
    ? fields.filter(f => 
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : fields

  const handleRemoveField = (index: number) => {
    const newSegments = [...segments]
    newSegments.splice(index, 1)
    onChange(segmentsToValue(newSegments))
  }

  const handleInsertField = (field: Field) => {
    // Insert at end for now
    const newValue = value + `{{${field.id}}}`
    onChange(newValue)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleTextChange = (index: number, newText: string) => {
    const newSegments = [...segments]
    if (newSegments[index]) {
      newSegments[index] = { type: 'text', value: newText }
    }
    onChange(segmentsToValue(newSegments))
  }

  // Handle direct input for adding text
  const handleContentInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (disabled) return
    
    const target = e.target as HTMLElement
    // Only handle direct text input, not badge changes
    if (target.getAttribute('data-badge')) return
    
    // Get plain text content, but preserve our badge placeholders
    const content = contentRef.current
    if (!content) return

    // Build new value from DOM
    let newValue = ''
    content.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        newValue += node.textContent || ''
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const fieldId = el.getAttribute('data-field-id')
        if (fieldId) {
          newValue += `{{${fieldId}}}`
        } else {
          newValue += el.textContent || ''
        }
      }
    })

    onChange(newValue)
  }

  // Render content with badges
  const renderContent = () => {
    if (segments.length === 0 && !isFocused) {
      return <span className="text-gray-400">{placeholder}</span>
    }

    return segments.map((seg, i) => {
      if (seg.type === 'field') {
        const field = fields.find(f => f.id === seg.fieldId)
        return (
          <span
            key={`field-${i}`}
            data-field-id={seg.fieldId}
            data-badge="true"
            contentEditable={false}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm border border-blue-200 mx-0.5 cursor-default select-none"
          >
            {seg.value}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleRemoveField(i)
              }}
              className="hover:bg-blue-200 rounded-full p-0.5 -mr-1"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      }
      return <span key={`text-${i}`}>{seg.value}</span>
    })
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-start gap-2">
        <div
          ref={contentRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleContentInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "flex-1 min-h-[80px] p-3 rounded-md border bg-gray-50/50 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "whitespace-pre-wrap break-words",
            disabled && "opacity-50 cursor-not-allowed",
            isFocused ? "border-blue-500" : "border-gray-200"
          )}
          style={{ minHeight: `${rows * 24 + 24}px` }}
        >
          {renderContent()}
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={disabled}
              className="h-8 w-8 p-0 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 p-0" 
            align="end"
            side="left"
          >
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-8 h-8 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2">
                {searchQuery ? (
                  // Show flat filtered list when searching
                  <div className="space-y-1">
                    {filteredFields.map(field => (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => handleInsertField(field)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left"
                      >
                        {getFieldIcon(field.type)}
                        <span className="truncate">{field.label}</span>
                      </button>
                    ))}
                    {filteredFields.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No fields found</p>
                    )}
                  </div>
                ) : (
                  // Show grouped list when not searching
                  <div className="space-y-3">
                    {Object.entries(groupedFields).map(([category, categoryFields]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-gray-500 px-2 mb-1">{category}</p>
                        <div className="space-y-0.5">
                          {categoryFields.map(field => (
                            <button
                              key={field.id}
                              type="button"
                              onClick={() => handleInsertField(field)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left"
                            >
                              {getFieldIcon(field.type)}
                              <span className="truncate">{field.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

// Single field picker component - like MergeTagTextarea but for selecting just one field
interface MergeTagFieldPickerProps {
  value: string // field ID or empty
  onChange: (fieldId: string) => void
  placeholder?: string
  fields: Field[]
  className?: string
  disabled?: boolean
}

export function MergeTagFieldPicker({
  value,
  onChange,
  placeholder = 'Auto-detect',
  fields,
  className,
  disabled
}: MergeTagFieldPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedField = fields.find(f => f.id === value)

  // Group fields by type for better organization
  const groupedFields = fields.reduce((acc, field) => {
    const category = field.type === 'email' ? 'Email' : 
                    ['text', 'textarea'].includes(field.type) ? 'Text' :
                    ['select', 'multiselect', 'checkbox', 'radio'].includes(field.type) ? 'Selection' :
                    'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(field)
    return acc
  }, {} as Record<string, Field[]>)

  const filteredFields = searchQuery
    ? fields.filter(f => 
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : fields

  const handleSelectField = (field: Field) => {
    onChange(field.id)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "min-h-[42px] px-3 py-2 rounded-lg border bg-white transition-colors flex items-center gap-2",
          disabled ? "bg-gray-100 cursor-not-allowed" : "border-gray-200 hover:border-gray-300",
          isOpen && "ring-2 ring-blue-500 border-blue-500"
        )}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {selectedField ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm border border-blue-200">
              {getFieldIcon(selectedField.type)}
              <span className="truncate">{selectedField.label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleClear()
                }}
                className="hover:bg-blue-200 rounded-full p-0.5 -mr-0.5"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="text-gray-400 text-sm">{placeholder}</span>
          )}
        </div>

        {/* Field picker button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 w-7 p-0 shrink-0"
              disabled={disabled}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2">
                {/* Auto-detect option */}
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left mb-2",
                    !value && "bg-blue-50 text-blue-700"
                  )}
                >
                  <Type className="h-4 w-4 text-gray-400" />
                  <span>Auto-detect</span>
                </button>
                
                <div className="border-t pt-2">
                  {searchQuery ? (
                    <div className="space-y-0.5">
                      {filteredFields.map(field => (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() => handleSelectField(field)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left",
                            value === field.id && "bg-blue-50 text-blue-700"
                          )}
                        >
                          {getFieldIcon(field.type)}
                          <span className="truncate">{field.label}</span>
                        </button>
                      ))}
                      {filteredFields.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No fields found</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(groupedFields).map(([category, categoryFields]) => (
                        <div key={category}>
                          <p className="text-xs font-medium text-gray-500 px-2 mb-1">{category}</p>
                          <div className="space-y-0.5">
                            {categoryFields.map(field => (
                              <button
                                key={field.id}
                                type="button"
                                onClick={() => handleSelectField(field)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left",
                                  value === field.id && "bg-blue-50 text-blue-700"
                                )}
                              >
                                {getFieldIcon(field.type)}
                                <span className="truncate">{field.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
