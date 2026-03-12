'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
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

interface StandardTag {
  id: string
  label: string
}

interface MergeTagTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  fields: Field[]
  standardTags?: StandardTag[]
  className?: string
  disabled?: boolean
  rows?: number
}

// Map field types to icons
function getFieldIcon(type: string) {
  switch (type) {
    case 'email':
      return <Mail className="h-3.5 w-3.5 text-teal-500" />
    case 'text':
    case 'textarea':
      return <Type className="h-3.5 w-3.5 text-blue-500" />
    case 'number':
      return <Hash className="h-3.5 w-3.5 text-purple-500" />
    case 'select':
    case 'multiselect':
    case 'checkbox':
    case 'radio':
      return <List className="h-3.5 w-3.5 text-orange-500" />
    case 'date':
      return <Calendar className="h-3.5 w-3.5 text-green-500" />
    case 'file':
    case 'upload':
      return <FileText className="h-3.5 w-3.5 text-red-500" />
    case 'recommendation':
      return <User className="h-3.5 w-3.5 text-indigo-500" />
    case 'link':
      return <Link2 className="h-3.5 w-3.5 text-cyan-500" />
    default:
      return <Type className="h-3.5 w-3.5 text-gray-400" />
  }
}

// Inline styles for chips injected via innerHTML — can't use Tailwind here
const CHIP_STYLE =
  'display:inline-flex;align-items:center;gap:2px;padding:1px 4px;border-radius:4px;' +
  'background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;font-size:11px;font-weight:500;' +
  'vertical-align:middle;cursor:default;user-select:none;white-space:nowrap;line-height:1.6;margin:0 1px'

const CHIP_BTN_STYLE =
  'display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;' +
  'border-radius:50%;background:transparent;border:none;cursor:pointer;color:#a5b4fc;' +
  'font-size:10px;padding:0;line-height:1;flex-shrink:0'

export function MergeTagTextarea({
  value,
  onChange,
  placeholder = 'Enter text...',
  fields,
  standardTags,
  className,
  disabled,
  rows = 3,
}: MergeTagTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)
  const [isEmpty, setIsEmpty] = useState(!value)
  const [isFieldOpen, setIsFieldOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const allTags = useMemo(
    () => [...(standardTags || []), ...fields.map(f => ({ id: f.id, label: f.label }))],
    [standardTags, fields]
  )

  const buildChip = (fieldId: string): string => {
    const tag = allTags.find(t => t.id === fieldId)
    const label = tag?.label || fieldId
    return (
      `<span style="${CHIP_STYLE}" data-field-id="${fieldId}" contenteditable="false">` +
      `${label}<button style="${CHIP_BTN_STYLE}" data-remove="${fieldId}" type="button">&#215;</button></span>`
    )
  }

  const valueToHTML = (text: string): string =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/\{\{([^}]+)\}\}/g, (_, id) => buildChip(id))

  const htmlToValue = (el: HTMLElement): string => {
    let out = ''
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) {
        out += (n.textContent || '').replace(/\u200B/g, '')
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as HTMLElement
        const fid = e.getAttribute('data-field-id')
        if (fid) {
          out += `{{${fid}}}`
        } else if (e.tagName === 'BR') {
          out += '\n'
        } else {
          e.childNodes.forEach(walk)
          if (e.tagName === 'DIV' || e.tagName === 'P') out += '\n'
        }
      }
    }
    el.childNodes.forEach(walk)
    return out.replace(/\n+$/, '')
  }

  // Set initial HTML on mount only
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = valueToHTML(value)
    setIsEmpty(!value)
    lastValueRef.current = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when value changes externally (skip when it came from our own typing)
  useEffect(() => {
    if (!editorRef.current || value === lastValueRef.current) return
    editorRef.current.innerHTML = valueToHTML(value)
    setIsEmpty(!value)
    lastValueRef.current = value
  }, [value, allTags]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = () => {
    if (!editorRef.current) return
    const v = htmlToValue(editorRef.current)
    lastValueRef.current = v
    setIsEmpty(!v)
    onChange(v)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('[data-remove]') as HTMLElement | null
    if (!btn) return
    e.preventDefault()
    const chip = btn.closest('[data-field-id]') as HTMLElement | null
    if (chip && editorRef.current?.contains(chip)) {
      chip.remove()
      handleInput()
    }
  }

  const insertTag = (fieldId: string) => {
    const editor = editorRef.current
    if (!editor || disabled) return
    editor.focus()

    const tag = allTags.find(t => t.id === fieldId)
    const label = tag?.label || fieldId
    const chip = document.createElement('span')
    chip.setAttribute('style', CHIP_STYLE)
    chip.setAttribute('data-field-id', fieldId)
    chip.setAttribute('contenteditable', 'false')
    chip.innerHTML = `${label}<button style="${CHIP_BTN_STYLE}" data-remove="${fieldId}" type="button">&#215;</button>`

    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const frag = document.createDocumentFragment()
      frag.appendChild(chip)
      const space = document.createTextNode('\u200B')
      frag.appendChild(space)
      range.insertNode(frag)
      range.setStartAfter(space)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editor.appendChild(chip)
      editor.appendChild(document.createTextNode('\u200B'))
    }

    handleInput()
  }

  const filteredFields = searchQuery
    ? fields.filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : fields

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Editable area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleClick}
          className={cn(
            'px-3 py-2.5 rounded-md border border-gray-200 bg-white text-sm leading-relaxed',
            'focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-colors',
            'break-words overflow-wrap-anywhere',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
          )}
          style={{ minHeight: `${rows * 1.5 + 1.25}rem` }}
        />
        {isEmpty && (
          <div className="pointer-events-none absolute top-2.5 left-3 text-sm text-gray-400 select-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Quick-insert strip */}
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-[10px] text-gray-400 shrink-0">Insert:</span>
        {(standardTags || []).map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => insertTag(tag.id)}
            disabled={disabled}
            className="px-1.5 py-0.5 text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded transition-colors leading-tight whitespace-nowrap"
          >
            {tag.label}
          </button>
        ))}
        {fields.length > 0 && (
          <Popover open={isFieldOpen} onOpenChange={setIsFieldOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-500 border border-gray-200 rounded transition-colors leading-tight"
              >
                <Plus className="h-2.5 w-2.5" />
                field
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start" side="top" sideOffset={4}>
              <div className="p-1.5 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-6 h-7 text-xs"
                    autoFocus
                  />
                </div>
              </div>
              <ScrollArea className="h-40">
                <div className="p-1">
                  {filteredFields.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { insertTag(f.id); setIsFieldOpen(false); setSearchQuery('') }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-gray-100 text-left"
                    >
                      {getFieldIcon(f.type)}
                      <span className="truncate">{f.label}</span>
                    </button>
                  ))}
                  {filteredFields.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">No fields found</p>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
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
