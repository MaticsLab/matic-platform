'use client'

import { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { 
  GripVertical, Trash2, Plus, Type, AlignLeft, Hash, Mail, Calendar, 
  CheckSquare, List, Image as ImageIcon, Phone, Link, Clock, PenTool, 
  Star, Minus, Heading, Pilcrow, CheckCircle2, Layout
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Section, Field, FieldType } from '@/types/portal'

interface FormBuilderProps {
  section: Section
  onUpdate: (updates: Partial<Section>) => void
}

const FIELD_ICONS: Record<string, any> = {
  text: Type, textarea: AlignLeft, number: Hash, email: Mail, phone: Phone, url: Link,
  select: List, multiselect: List, radio: CheckCircle2, checkbox: CheckSquare,
  date: Calendar, datetime: Calendar, time: Clock,
  file: ImageIcon, image: ImageIcon, signature: PenTool, rating: Star,
  divider: Minus, heading: Heading, paragraph: Pilcrow,
  group: Layout, repeater: List
}

export function FormBuilder({ section, onUpdate }: FormBuilderProps) {
  const handleUpdateField = (fieldId: string, updates: Partial<Field>) => {
    onUpdate({
      fields: updateFieldRecursive(section.fields, fieldId, updates)
    })
  }

  const handleDeleteField = (fieldId: string) => {
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
    <div className="flex flex-col h-full">
      {/* Section Header */}
      <div className="p-6 border-b border-gray-100">
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

      <div className="flex-1 p-6 space-y-4">
        {section.fields.length === 0 ? (
          <div className="h-32 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400">
            Add fields from the sidebar
          </div>
        ) : (
          section.fields.map((field) => (
            <FieldEditor 
              key={field.id} 
              field={field} 
              onUpdate={(updates) => handleUpdateField(field.id, updates)}
              onDelete={() => handleDeleteField(field.id)}
              onAddChild={() => handleAddChildField(field.id)}
            />
          ))
        )}
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

function FieldEditor({ field, onUpdate, onDelete, onAddChild }: { field: Field, onUpdate: (u: Partial<Field>) => void, onDelete: () => void, onAddChild: () => void }) {
  const isLayoutField = ['divider', 'heading', 'paragraph'].includes(field.type)
  const isContainerField = ['group', 'repeater'].includes(field.type)
  const Icon = FIELD_ICONS[field.type] || Type

  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="mt-3 cursor-grab text-gray-300 hover:text-gray-500">
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gray-100 rounded-md text-gray-500">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{field.type}</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Label / Content</Label>
                <Input 
                  value={field.label} 
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  className="font-medium"
                  placeholder={isLayoutField ? "Enter content..." : "Field Label"}
                />
              </div>
              
              {!isLayoutField && !isContainerField && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Placeholder</Label>
                  <Input 
                    value={field.placeholder || ''} 
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    placeholder="Placeholder text..."
                  />
                </div>
              )}
            </div>

            {!isLayoutField && (
              <div className="flex items-center gap-6 pt-2 border-t border-gray-50 mt-2">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={field.required} 
                    onCheckedChange={(c) => onUpdate({ required: c })}
                  />
                  <Label className="text-sm text-gray-600">Required</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={field.width || 'full'} onValueChange={(v) => onUpdate({ width: v as any })}>
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue placeholder="Width" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Width</SelectItem>
                      <SelectItem value="half">1/2 Width</SelectItem>
                      <SelectItem value="third">1/3 Width</SelectItem>
                      <SelectItem value="quarter">1/4 Width</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {/* Options Editor for Select/Radio/Checkbox */}
            {['select', 'multiselect', 'radio'].includes(field.type) && (
              <div className="pt-2 border-t border-gray-50 mt-2">
                <Label className="text-xs text-gray-500 mb-2 block">Options (comma separated)</Label>
                <Input 
                  value={field.options?.join(', ') || ''}
                  onChange={(e) => onUpdate({ options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}

            {/* Container Field Children */}
            {isContainerField && (
              <div className="pt-4 border-t border-gray-100 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Child Fields</Label>
                  <Button variant="outline" size="sm" onClick={onAddChild} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Add Field
                  </Button>
                </div>
                <div className="space-y-4 pl-4 border-l-2 border-gray-100">
                  {field.children?.map((child) => (
                    <FieldEditor 
                      key={child.id} 
                      field={child} 
                      onUpdate={(u) => {
                        const newChildren = field.children?.map(c => c.id === child.id ? { ...c, ...u } : c)
                        onUpdate({ children: newChildren })
                      }}
                      onDelete={() => {
                        const newChildren = field.children?.filter(c => c.id !== child.id)
                        onUpdate({ children: newChildren })
                      }}
                      onAddChild={() => {
                        // Recursive add child not fully implemented for deep nesting in this simplified view
                        // But we can add it if needed
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
