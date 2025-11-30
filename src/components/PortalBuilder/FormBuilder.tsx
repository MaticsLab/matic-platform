'use client'

import { useState, useRef, useEffect } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { 
  GripVertical, Trash2, Plus, Type, AlignLeft, Hash, Mail, Calendar, 
  CheckSquare, List, Image as ImageIcon, Phone, Link, Clock, PenTool, 
  Star, Minus, Heading, Pilcrow, CheckCircle2, Layout, X, Settings, Info, ArrowUpDown, MapPin,
  Upload, MessageSquare, Lightbulb, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Textarea } from '@/ui-components/textarea'
import { Section, Field, FieldType } from '@/types/portal'

interface FormBuilderProps {
  section: Section
  onUpdate: (updates: Partial<Section>) => void
  selectedFieldId: string | null
  onSelectField: (id: string | null) => void
}

const FIELD_ICONS: Record<string, any> = {
  text: Type, textarea: AlignLeft, number: Hash, email: Mail, phone: Phone, url: Link, address: MapPin,
  select: List, multiselect: List, radio: CheckCircle2, checkbox: CheckSquare,
  date: Calendar, datetime: Calendar, time: Clock,
  file: Upload, image: ImageIcon, signature: PenTool, rating: Star, rank: ArrowUpDown,
  divider: Minus, heading: Heading, paragraph: Pilcrow, callout: Lightbulb,
  group: Layout, repeater: List
}

export function FormBuilder({ section, onUpdate, selectedFieldId, onSelectField }: FormBuilderProps) {
  const handleUpdateField = (fieldId: string, updates: Partial<Field>) => {
    onUpdate({
      fields: updateFieldRecursive(section.fields, fieldId, updates)
    })
  }

  const handleDeleteField = (fieldId: string) => {
    if (selectedFieldId === fieldId) onSelectField(null)
    onUpdate({
      fields: deleteFieldRecursive(section.fields, fieldId)
    })
  }

  const handleAddChildField = (parentId: string) => {
    const newField: Field = {
      id: Date.now().toString(),
      type: 'text',
      label: 'New Field',
      required: false,
      width: 'full'
    }
    onUpdate({
      fields: addChildFieldRecursive(section.fields, parentId, newField)
    })
  }

  return (
    <div className="flex h-full">
      {/* Main Builder Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Section Header */}
        <div className="p-6 border-b border-gray-100 shrink-0">
          <Input 
            value={section.title} 
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="text-2xl font-bold border-none px-0 h-auto focus-visible:ring-0 placeholder:text-gray-300"
            placeholder="Section Title"
          />
          <Input 
            value={section.description || ''} 
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="text-gray-500 border-none px-0 h-auto focus-visible:ring-0 mt-2"
            placeholder="Add a description for this section..."
          />
        </div>

        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {section.fields.length === 0 ? (
            <div className="h-32 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400">
              Add fields from the sidebar
            </div>
          ) : (
            section.fields.map((field) => (
              <FieldEditor 
                key={field.id} 
                field={field} 
                selectedFieldId={selectedFieldId}
                onSelectField={onSelectField}
                onUpdate={(updates) => handleUpdateField(field.id, updates)}
                onDelete={() => handleDeleteField(field.id)}
                onAddChild={() => handleAddChildField(field.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions for recursive updates
function updateFieldRecursive(fields: Field[], targetId: string, updates: Partial<Field>): Field[] {
  return fields.map(field => {
    if (field.id === targetId) {
      return { ...field, ...updates }
    }
    if (field.children) {
      return { ...field, children: updateFieldRecursive(field.children, targetId, updates) }
    }
    return field
  })
}

function deleteFieldRecursive(fields: Field[], targetId: string): Field[] {
  return fields.filter(field => field.id !== targetId).map(field => {
    if (field.children) {
      return { ...field, children: deleteFieldRecursive(field.children, targetId) }
    }
    return field
  })
}

function addChildFieldRecursive(fields: Field[], parentId: string, newField: Field): Field[] {
  return fields.map(field => {
    if (field.id === parentId) {
      return { ...field, children: [...(field.children || []), newField] }
    }
    if (field.children) {
      return { ...field, children: addChildFieldRecursive(field.children, parentId, newField) }
    }
    return field
  })
}

function findFieldRecursive(fields: Field[], targetId: string | null): Field | undefined {
  if (!targetId) return undefined
  for (const field of fields) {
    if (field.id === targetId) return field
    if (field.children) {
      const found = findFieldRecursive(field.children, targetId)
      if (found) return found
    }
  }
  return undefined
}

function FieldEditor({ 
  field, 
  selectedFieldId, 
  onSelectField, 
  onUpdate, 
  onDelete, 
  onAddChild 
}: { 
  field: Field, 
  selectedFieldId: string | null,
  onSelectField: (id: string) => void,
  onUpdate: (u: Partial<Field>) => void, 
  onDelete: () => void, 
  onAddChild: () => void 
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(field.label)
  const labelInputRef = useRef<HTMLInputElement>(null)
  
  const isLayoutField = ['divider', 'heading', 'paragraph', 'callout'].includes(field.type)
  const isContainerField = ['group', 'repeater'].includes(field.type)
  const Icon = FIELD_ICONS[field.type] || Type
  const isSelected = field.id === selectedFieldId

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])

  const handleLabelSave = () => {
    if (editedLabel.trim()) {
      onUpdate({ label: editedLabel.trim() })
    } else {
      setEditedLabel(field.label)
    }
    setIsEditingLabel(false)
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelSave()
    } else if (e.key === 'Escape') {
      setEditedLabel(field.label)
      setIsEditingLabel(false)
    }
  }

  // Render field preview based on type
  const renderFieldPreview = () => {
    const options = field.options || field.config?.items || []
    
    switch (field.type) {
      case 'divider':
        return <div className="border-t border-gray-300 w-full my-2" />
        
      case 'heading':
        return (
          <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
        )
        
      case 'paragraph':
        return (
          <p className="text-gray-600 text-sm leading-relaxed">{field.label}</p>
        )
        
      case 'callout':
        return (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">{field.label}</p>
              {field.placeholder && (
                <p className="text-sm text-blue-700 mt-1">{field.placeholder}</p>
              )}
            </div>
          </div>
        )
        
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
      case 'number':
      case 'address':
        return (
          <Input 
            disabled
            placeholder={field.placeholder || `Enter ${field.type}...`}
            className="h-11 bg-gray-50 cursor-not-allowed"
          />
        )
        
      case 'textarea':
        return (
          <Textarea 
            disabled
            placeholder={field.placeholder || 'Enter text...'}
            className="min-h-[80px] bg-gray-50 cursor-not-allowed resize-none"
          />
        )
        
      case 'date':
      case 'datetime':
      case 'time':
        return (
          <div className="relative">
            <Input 
              disabled
              placeholder={field.type === 'time' ? 'HH:MM' : 'MM/DD/YYYY'}
              className="h-11 bg-gray-50 cursor-not-allowed"
            />
            <Calendar className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
          </div>
        )
        
      case 'select':
      case 'rank':
        return (
          <Select disabled>
            <SelectTrigger className="h-11 bg-gray-50">
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
          </Select>
        )
        
      case 'multiselect':
        return (
          <div className="border rounded-md p-3 space-y-2 bg-gray-50">
            {options.length > 0 ? options.slice(0, 3).map((opt: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 border border-gray-300 rounded bg-white" />
                <span className="text-sm">{opt}</span>
              </div>
            )) : (
              <span className="text-sm text-gray-400">No options defined</span>
            )}
            {options.length > 3 && (
              <span className="text-xs text-gray-400">+{options.length - 3} more</span>
            )}
          </div>
        )
        
      case 'radio':
        return (
          <div className="space-y-2">
            {options.length > 0 ? options.slice(0, 3).map((opt: string, i: number) => (
              <div key={i} className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 border border-gray-300 rounded-full bg-white" />
                <span className="text-sm">{opt}</span>
              </div>
            )) : (
              <span className="text-sm text-gray-400">No options defined</span>
            )}
            {options.length > 3 && (
              <span className="text-xs text-gray-400">+{options.length - 3} more</span>
            )}
          </div>
        )
        
      case 'checkbox':
        return (
          <div className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50">
            <div className="w-4 h-4 border border-gray-300 rounded bg-white" />
            <span className="text-sm text-gray-500">{field.placeholder || 'Yes, I agree'}</span>
          </div>
        )
        
      case 'file':
      case 'image':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 cursor-not-allowed">
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">
              {field.type === 'image' ? 'Click to upload image' : 'Drag and drop files here'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {field.type === 'image' ? 'PNG, JPG or GIF (max. 10MB)' : 'PDF, DOC, XLS up to 10MB'}
            </p>
          </div>
        )
        
      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="w-6 h-6 text-gray-300" />
            ))}
          </div>
        )
        
      case 'signature':
        return (
          <div className="border border-gray-200 rounded-xl bg-gray-50 h-24 flex items-center justify-center text-gray-400 text-sm">
            <PenTool className="w-5 h-5 mr-2" />
            Signature Area
          </div>
        )
        
      default:
        return null
    }
  }

  // For layout fields, show a simpler representation
  if (field.type === 'divider') {
    return (
      <div 
        className={cn(
          "group relative bg-white border rounded-xl p-4 transition-all cursor-pointer",
          isSelected ? "border-blue-500 ring-1 ring-blue-500 shadow-md" : "border-gray-200 hover:border-blue-300 hover:shadow-sm"
        )}
        onClick={(e) => {
          e.stopPropagation()
          onSelectField(field.id)
        }}
      >
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="cursor-grab text-gray-300 hover:text-gray-500">
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1 border-t-2 border-gray-300" />
        </div>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "group relative bg-white border rounded-xl p-4 transition-all cursor-pointer",
        isSelected ? "border-blue-500 ring-1 ring-blue-500 shadow-md" : "border-gray-200 hover:border-blue-300 hover:shadow-sm"
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelectField(field.id)
      }}
    >
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-10">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="mt-1 cursor-grab text-gray-300 hover:text-gray-500">
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-3">
            {/* Field Type Badge */}
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-md", isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{field.type}</span>
            </div>

            {/* Editable Label - Skip for layout types that use label as content */}
            {!['heading', 'paragraph', 'callout'].includes(field.type) && (
              <div className="flex items-center gap-2">
                {isEditingLabel ? (
                  <Input
                    ref={labelInputRef}
                    value={editedLabel}
                    onChange={(e) => setEditedLabel(e.target.value)}
                    onBlur={handleLabelSave}
                    onKeyDown={handleLabelKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="text-base font-medium border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <div 
                    className="group/label flex items-center gap-2 cursor-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsEditingLabel(true)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setIsEditingLabel(true)
                    }}
                  >
                    <span className="font-medium text-gray-900 hover:bg-gray-100 px-1 py-0.5 rounded transition-colors">
                      {field.label}
                    </span>
                    {field.required && <span className="text-red-500">*</span>}
                    <span className="text-xs text-gray-400 opacity-0 group-hover/label:opacity-100 transition-opacity">
                      (click to edit)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Field Preview */}
            <div className="pointer-events-none">
              {renderFieldPreview()}
            </div>

            {/* Dynamic Options Info Box */}
            {field.config?.dynamicOptions && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                <div className="mt-0.5 text-blue-500">
                  <Info className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Dynamic options enabled</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {field.config?.sourceField 
                      ? `Sourcing options from ${field.config.sourceField}` 
                      : 'Choose where to source options from'}
                  </p>
                </div>
              </div>
            )}

            {/* Container Field Children */}
            {isContainerField && (
              <div className="pt-4 border-t border-gray-100 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Child Fields</Label>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation()
                    onAddChild()
                  }} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Add Field
                  </Button>
                </div>
                <div className="space-y-4 pl-4 border-l-2 border-gray-100">
                  {field.children?.map((child) => (
                    <FieldEditor 
                      key={child.id} 
                      field={child} 
                      selectedFieldId={selectedFieldId}
                      onSelectField={onSelectField}
                      onUpdate={(u) => {
                        const newChildren = field.children?.map(c => c.id === child.id ? { ...c, ...u } : c)
                        onUpdate({ children: newChildren })
                      }}
                      onDelete={() => {
                        const newChildren = field.children?.filter(c => c.id !== child.id)
                        onUpdate({ children: newChildren })
                      }}
                      onAddChild={() => {
                        // Recursive add child logic needs to be passed down or handled via a global handler
                        // For now, we can just call the parent's onUpdate with the new child
                        const newChild: Field = {
                          id: Date.now().toString(),
                          type: 'text',
                          label: 'New Field',
                          required: false,
                          width: 'full'
                        }
                        const newChildren = [...(child.children || []), newChild]
                        const updatedChild = { ...child, children: newChildren }
                        const newParentChildren = field.children?.map(c => c.id === child.id ? updatedChild : c)
                        onUpdate({ children: newParentChildren })
                      }}
                    />
                  ))}
                  {(!field.children || field.children.length === 0) && (
                    <div className="text-sm text-gray-400 italic">No child fields yet</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
