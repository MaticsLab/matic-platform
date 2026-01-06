'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Settings, ArrowUpDown, Sliders, GitBranch, Code2, ShieldCheck, Plus, Trash2, GripVertical, Type, Hash, Mail, Phone, Link as LinkIcon, List, CheckSquare, Calendar, Clock, Upload, Image, PenTool, Star, Heading2, FileText, AlertCircle, Grid3x3, Repeat2, UserPlus } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui-components/accordion'
import { Field, FieldType } from '@/types/portal'
import { Textarea } from '@/ui-components/textarea'
import { cn } from '@/lib/utils'
import { RichTextEditor } from './RichTextEditor'
import { MentionableInput } from './MentionableInput'
import { MergeTagTextarea, MergeTagFieldPicker } from './MergeTagTextarea'

const FIELD_TYPES: { value: string; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'text', label: 'Text Input', icon: <Type className="w-4 h-4" />, description: 'Single line text field' },
  { value: 'textarea', label: 'Text Area', icon: <FileText className="w-4 h-4" />, description: 'Multi-line text field' },
  { value: 'number', label: 'Number', icon: <Hash className="w-4 h-4" />, description: 'Numeric input' },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, description: 'Email with validation' },
  { value: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" />, description: 'Phone number field' },
  { value: 'url', label: 'URL', icon: <LinkIcon className="w-4 h-4" />, description: 'Website URL field' },
  { value: 'address', label: 'Address', icon: <Grid3x3 className="w-4 h-4" />, description: 'Address with autocomplete' },
  { value: 'select', label: 'Dropdown', icon: <List className="w-4 h-4" />, description: 'Single option selection' },
  { value: 'multiselect', label: 'Multi-Select', icon: <List className="w-4 h-4" />, description: 'Multiple option selection' },
  { value: 'radio', label: 'Single Choice', icon: <CheckSquare className="w-4 h-4" />, description: 'Radio button options' },
  { value: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="w-4 h-4" />, description: 'True/false toggle' },
  { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" />, description: 'Date picker' },
  { value: 'datetime', label: 'Date & Time', icon: <Calendar className="w-4 h-4" />, description: 'Date and time picker' },
  { value: 'time', label: 'Time', icon: <Clock className="w-4 h-4" />, description: 'Time picker' },
  { value: 'file', label: 'File Upload', icon: <Upload className="w-4 h-4" />, description: 'File upload field' },
  { value: 'image', label: 'Image Upload', icon: <Image className="w-4 h-4" />, description: 'Image upload field' },
  { value: 'signature', label: 'Signature', icon: <PenTool className="w-4 h-4" />, description: 'Digital signature' },
  { value: 'rating', label: 'Rating', icon: <Star className="w-4 h-4" />, description: 'Star rating (1-5)' },
  { value: 'rank', label: 'Rank', icon: <Repeat2 className="w-4 h-4" />, description: 'Ranking field' },
  { value: 'divider', label: 'Divider', icon: <Grid3x3 className="w-4 h-4" />, description: 'Visual divider' },
  { value: 'heading', label: 'Heading', icon: <Heading2 className="w-4 h-4" />, description: 'Section heading' },
  { value: 'paragraph', label: 'Paragraph', icon: <FileText className="w-4 h-4" />, description: 'Display text' },
  { value: 'callout', label: 'Callout Box', icon: <AlertCircle className="w-4 h-4" />, description: 'Highlighted message' },
  { value: 'group', label: 'Group', icon: <Grid3x3 className="w-4 h-4" />, description: 'Field group' },
  { value: 'repeater', label: 'Repeater', icon: <Repeat2 className="w-4 h-4" />, description: 'Repeatable section' },
  { value: 'recommendation', label: 'Recommendation', icon: <UserPlus className="w-4 h-4" />, description: 'Request letters of recommendation' },
]

const CALLOUT_COLORS = [
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500' },
  { value: 'green', label: 'Green', bg: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-500' },
  { value: 'red', label: 'Red', bg: 'bg-red-500' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { value: 'gray', label: 'Gray', bg: 'bg-gray-500' },
]

const CALLOUT_ICONS = [
  { value: 'lightbulb', label: 'Lightbulb' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'success', label: 'Success' },
  { value: 'help', label: 'Help' },
]

interface FieldSettingsPanelProps {
  selectedField: Field | null | undefined
  onUpdate: (fieldId: string, updates: Partial<Field>) => void
  onClose: () => void
  allFields: Field[]
}

interface LogicRule {
  id: string
  action: 'show' | 'hide'
  fieldId: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value: string
}

// Component for managing individual options with drag support
function OptionEditor({ 
  options, 
  onChange 
}: { 
  options: string[]
  onChange: (options: string[]) => void 
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleAddOption = () => {
    onChange([...options, `Option ${options.length + 1}`])
  }

  const handleRemoveOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
  }

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    onChange(newOptions)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    const newOptions = [...options]
    const [draggedItem] = newOptions.splice(draggedIndex, 1)
    newOptions.splice(index, 0, draggedItem)
    onChange(newOptions)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
          Custom Options
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddOption}
          className="h-8 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Option
        </Button>
      </div>
      
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
        {options.map((option, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-2 group p-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all duration-200",
              draggedIndex === index && "opacity-50 scale-95"
            )}
          >
            <div className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing transition-colors">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-gray-700">
              {index + 1}
            </div>
            <Input
              value={option}
              onChange={(e) => handleUpdateOption(index, e.target.value)}
              className="flex-1 h-9 text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
              placeholder={`Option ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveOption(index)}
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {options.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/30">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">No options yet</p>
          <p className="text-xs text-gray-400 mb-3">Add options for users to choose from</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddOption}
            className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add first option
          </Button>
        </div>
      )}
    </div>
  )
}

export function FieldSettingsPanel({ selectedField, onUpdate, onClose, allFields }: FieldSettingsPanelProps) {
    // Helper to update validation settings for minWords/maxWords
    const handleValidationUpdate = (key: 'minWords' | 'maxWords', value?: number) => {
      if (!selectedField) return;
      onUpdate(selectedField.id, {
        validation: {
          ...selectedField.validation,
          [key]: value,
        },
      });
    }
  if (!selectedField) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/30">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Settings className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="font-medium text-gray-900 mb-1">No Field Selected</h3>
        <p className="text-sm text-gray-500 max-w-[200px]">Click on a field in the canvas to configure its properties.</p>
      </div>
    )
  }

  const handleUpdate = (updates: Partial<Field>) => {
    onUpdate(selectedField.id, updates)
  }

  const handleConfigUpdate = (key: string, value: any) => {
    handleUpdate({
      config: {
        ...selectedField.config,
        [key]: value
      }
    })
  }

  const handleAddLogicRule = () => {
    const currentLogic = selectedField.config?.logic || []
    const newRule: LogicRule = {
      id: uuidv4(),
      action: 'show',
      fieldId: '',
      operator: 'equals',
      value: ''
    }
    handleConfigUpdate('logic', [...currentLogic, newRule])
  }

  const handleUpdateLogicRule = (ruleId: string, updates: Partial<LogicRule>) => {
    const currentLogic = selectedField.config?.logic || []
    const newLogic = currentLogic.map((rule: LogicRule) => rule.id === ruleId ? { ...rule, ...updates } : rule)
    handleConfigUpdate('logic', newLogic)
  }

  const handleDeleteLogicRule = (ruleId: string) => {
    const currentLogic = selectedField.config?.logic || []
    const newLogic = currentLogic.filter((rule: LogicRule) => rule.id !== ruleId)
    handleConfigUpdate('logic', newLogic)
  }

  const findFieldById = (fieldId?: string) => allFields.find((f) => f.id === fieldId)

  const getFieldOptionsForLogic = (field?: Field) => {
    if (!field) return []
    if (Array.isArray(field.options) && field.options.length > 0) {
      return field.options.map((option) => ({
        label: typeof option === 'string' ? option : String(option),
        value: typeof option === 'string' ? option : String(option)
      }))
    }

    if (field.type === 'checkbox') {
      return [
        { label: 'Checked', value: 'true' },
        { label: 'Unchecked', value: 'false' }
      ]
    }

    if (field.type === 'rating') {
      return Array.from({ length: 5 }).map((_, i) => {
        const value = String(i + 1)
        return { label: `${value} star${i === 0 ? '' : 's'}`, value }
      })
    }

    return []
  }

  const getValueInputType = (field?: Field) => {
    if (!field) return 'text'
    if (field.type === 'number') return 'number'
    if (field.type === 'date') return 'date'
    if (field.type === 'datetime') return 'datetime-local'
    if (field.type === 'time') return 'time'
    return 'text'
  }

  const isOptionField = ['select', 'multiselect', 'radio', 'rank'].includes(selectedField.type)
  const isLayoutField = ['divider', 'heading', 'paragraph', 'callout'].includes(selectedField.type)
  const isContainerField = ['group', 'repeater'].includes(selectedField.type)

  const sourceFields = allFields.filter(f => 
    f.id !== selectedField.id && 
    ['repeater', 'select', 'multiselect', 'radio'].includes(f.type)
  )

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={['basic', 'options', 'validation']} className="w-full">
          
          {/* Basic Settings */}
          <AccordionItem value="basic" className="border-b border-gray-100">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 data-[state=open]:bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-50 text-blue-600 rounded-md">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-gray-900">Basic Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4 pt-3">
              {/* Field Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Field Type</Label>
                <div className="relative">
                  <Select 
                    value={selectedField.type} 
                    onValueChange={(v) => handleUpdate({ type: v as FieldType })}
                  >
                    <SelectTrigger className="bg-white border-gray-200 hover:bg-gray-50 h-auto py-2.5">
                      <div className="flex items-center gap-2 text-left">
                        {FIELD_TYPES.find(t => t.value === selectedField.type)?.icon}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {FIELD_TYPES.find(t => t.value === selectedField.type)?.label || selectedField.type}
                          </p>
                          <p className="text-xs text-gray-500">
                            {FIELD_TYPES.find(t => t.value === selectedField.type)?.description}
                          </p>
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {FIELD_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="py-2">
                          <div className="flex items-start gap-2">
                            {t.icon}
                            <div>
                              <p className="text-sm font-medium">{t.label}</p>
                              <p className="text-xs text-gray-500">{t.description}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Label */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Label</Label>
                <MentionableInput 
                  value={selectedField.label} 
                  onChange={(v) => handleUpdate({ label: v })}
                  className="font-medium"
                  previousFields={allFields}
                  fieldId={selectedField.id}
                />
              </div>

              {/* Description / Help Text */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description / Help Text</Label>
                <Textarea 
                  className="h-20 resize-none bg-gray-50/50 border-gray-200"
                  value={selectedField.description || ''} 
                  onChange={(e) => handleUpdate({ description: e.target.value })}
                  placeholder="Helper text shown below the field"
                />
              </div>

              {/* Placeholder - not for layout fields */}
              {!isLayoutField && !isContainerField && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Placeholder</Label>
                  <Input 
                    value={selectedField.placeholder || ''} 
                    onChange={(e) => handleUpdate({ placeholder: e.target.value })} 
                    className="bg-gray-50/50 border-gray-200"
                    placeholder="Text shown inside the empty field..."
                  />
                </div>
              )}

              {/* Width */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Width</Label>
                <Select 
                  value={selectedField.width || 'full'} 
                  onValueChange={(v) => handleUpdate({ width: v as any })}
                >
                  <SelectTrigger className="bg-gray-50/50 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Width</SelectItem>
                    <SelectItem value="half">1/2 Width</SelectItem>
                    <SelectItem value="third">1/3 Width</SelectItem>
                    <SelectItem value="quarter">1/4 Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Callout Settings */}
              {selectedField.type === 'callout' && (
                <>
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Color</Label>
                    <div className="flex gap-2">
                      {CALLOUT_COLORS.map(color => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => handleConfigUpdate('color', color.value)}
                          className={cn(
                            "w-8 h-8 rounded-full transition-all",
                            color.bg,
                            selectedField.config?.color === color.value 
                              ? "ring-2 ring-offset-2 ring-blue-500" 
                              : "hover:scale-110"
                          )}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</Label>
                    <Select 
                      value={selectedField.config?.icon || 'lightbulb'} 
                      onValueChange={(v) => handleConfigUpdate('icon', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALLOUT_ICONS.map(icon => (
                          <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Rating Settings */}
              {selectedField.type === 'rating' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Rating</Label>
                  <Select 
                    value={String(selectedField.config?.maxRating || 5)} 
                    onValueChange={(v) => handleConfigUpdate('maxRating', parseInt(v))}
                  >
                    <SelectTrigger className="bg-gray-50/50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7, 10].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Group Field Settings */}
              {selectedField.type === 'group' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Columns</Label>
                  <Select 
                    value={String(selectedField.config?.columns || 2)} 
                    onValueChange={(v) => handleConfigUpdate('columns', parseInt(v))}
                  >
                    <SelectTrigger className="bg-gray-50/50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Column</SelectItem>
                      <SelectItem value="2">2 Columns</SelectItem>
                      <SelectItem value="3">3 Columns</SelectItem>
                      <SelectItem value="4">4 Columns</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Number of columns for child fields</p>
                </div>
              )}

              {/* Repeater Field Settings */}
              {selectedField.type === 'repeater' && (
                <>
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Item Label</Label>
                    <Input 
                      value={selectedField.config?.itemLabel || 'Item'} 
                      onChange={(e) => handleConfigUpdate('itemLabel', e.target.value)} 
                      className="bg-gray-50/50 border-gray-200"
                      placeholder="Item"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Items</Label>
                      <Input 
                        type="number"
                        min={0}
                        value={selectedField.config?.minItems ?? 0} 
                        onChange={(e) => handleConfigUpdate('minItems', parseInt(e.target.value) || 0)} 
                        className="bg-gray-50/50 border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Items</Label>
                      <Input 
                        type="number"
                        min={1}
                        value={selectedField.config?.maxItems ?? 10} 
                        onChange={(e) => handleConfigUpdate('maxItems', parseInt(e.target.value) || 10)} 
                        className="bg-gray-50/50 border-gray-200"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 pt-1">Control how many items users can add</p>
                </>
              )}


              {/* Textarea Field Settings: Min/Max Words */}
              {selectedField.type === 'textarea' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Word Limit</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="number"
                        min={0}
                        value={selectedField.validation?.minWords ?? ''}
                        onChange={e => handleValidationUpdate('minWords', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Min words"
                        className="bg-gray-50/50 border-gray-200"
                      />
                      <p className="text-xs text-gray-400 mt-1">Minimum required words</p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min={1}
                        value={selectedField.validation?.maxWords ?? ''}
                        onChange={e => handleValidationUpdate('maxWords', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Max words"
                        className="bg-gray-50/50 border-gray-200"
                      />
                      <p className="text-xs text-gray-400 mt-1">Maximum allowed words</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Paragraph Rich Text Settings */}
              {selectedField.type === 'paragraph' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Content</Label>
                  <RichTextEditor
                    value={selectedField.config?.content || selectedField.label || ''}
                    onChange={(content) => handleConfigUpdate('content', content)}
                    placeholder="Enter your paragraph text with formatting..."
                    minHeight="120px"
                  />
                  <p className="text-xs text-gray-500">Use the toolbar to add bold, italic, lists, links and more.</p>
                </div>
              )}

              {/* Address Field Settings */}
              {selectedField.type === 'address' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address Format</Label>
                    <Select 
                      value={selectedField.config?.addressFormat || 'full'} 
                      onValueChange={(v) => handleConfigUpdate('addressFormat', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Address (Street, City, State, Zip, Country)</SelectItem>
                        <SelectItem value="street_city">Street & City Only</SelectItem>
                        <SelectItem value="city_state">City & State Only</SelectItem>
                        <SelectItem value="single_line">Single Line</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Enable Autocomplete</Label>
                      <p className="text-xs text-gray-500">Use Google Places API for suggestions</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.enableAutocomplete !== false} 
                      onCheckedChange={(c) => handleConfigUpdate('enableAutocomplete', c)} 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Allow Manual Entry</Label>
                      <p className="text-xs text-gray-500">Let users type address manually</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.allowManualEntry !== false} 
                      onCheckedChange={(c) => handleConfigUpdate('allowManualEntry', c)} 
                    />
                  </div>
                </div>
              )}

              {/* Signature Field Settings */}
              {selectedField.type === 'signature' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Signature Type</Label>
                    <Select 
                      value={selectedField.config?.signatureType || 'draw'} 
                      onValueChange={(v) => handleConfigUpdate('signatureType', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draw">Draw Signature</SelectItem>
                        <SelectItem value="type">Type Name</SelectItem>
                        <SelectItem value="both">Draw or Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pen Color</Label>
                    <div className="flex gap-2">
                      {['#000000', '#1e40af', '#166534'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleConfigUpdate('penColor', color)}
                          className={cn(
                            "w-8 h-8 rounded-full transition-all border-2",
                            selectedField.config?.penColor === color 
                              ? "ring-2 ring-offset-2 ring-blue-500" 
                              : "border-gray-200 hover:scale-110"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Show Date</Label>
                      <p className="text-xs text-gray-500">Display signature date below</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.showDate !== false} 
                      onCheckedChange={(c) => handleConfigUpdate('showDate', c)} 
                    />
                  </div>
                </div>
              )}

              {/* Phone Field Settings */}
              {selectedField.type === 'phone' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Format</Label>
                    <Select 
                      value={selectedField.config?.phoneFormat || 'us'} 
                      onValueChange={(v) => handleConfigUpdate('phoneFormat', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">US Format (XXX) XXX-XXXX</SelectItem>
                        <SelectItem value="international">International (+X XXX XXX XXXX)</SelectItem>
                        <SelectItem value="free">Free Format (any)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Show Country Code</Label>
                      <p className="text-xs text-gray-500">Display country selector</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.showCountryCode || false} 
                      onCheckedChange={(c) => handleConfigUpdate('showCountryCode', c)} 
                    />
                  </div>
                </div>
              )}

              {/* URL Field Settings */}
              {selectedField.type === 'url' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">URL Type</Label>
                    <Select 
                      value={selectedField.config?.urlType || 'any'} 
                      onValueChange={(v) => handleConfigUpdate('urlType', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Website URL</SelectItem>
                        <SelectItem value="linkedin">LinkedIn Profile</SelectItem>
                        <SelectItem value="twitter">Twitter/X Profile</SelectItem>
                        <SelectItem value="github">GitHub Profile</SelectItem>
                        <SelectItem value="portfolio">Portfolio Website</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Validate URL</Label>
                      <p className="text-xs text-gray-500">Check if URL is accessible</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.validateUrl || false} 
                      onCheckedChange={(c) => handleConfigUpdate('validateUrl', c)} 
                    />
                  </div>
                </div>
              )}

              {/* Time Field Settings */}
              {selectedField.type === 'time' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time Format</Label>
                    <Select 
                      value={selectedField.config?.timeFormat || '12h'} 
                      onValueChange={(v) => handleConfigUpdate('timeFormat', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                        <SelectItem value="24h">24-Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Time</Label>
                      <Input 
                        type="time"
                        value={selectedField.config?.minTime || ''}
                        onChange={(e) => handleConfigUpdate('minTime', e.target.value)}
                        className="bg-gray-50/50 border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Time</Label>
                      <Input 
                        type="time"
                        value={selectedField.config?.maxTime || ''}
                        onChange={(e) => handleConfigUpdate('maxTime', e.target.value)}
                        className="bg-gray-50/50 border-gray-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time Interval</Label>
                    <Select 
                      value={String(selectedField.config?.timeInterval || 15)} 
                      onValueChange={(v) => handleConfigUpdate('timeInterval', parseInt(v))}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Rank Field Settings */}
              {selectedField.type === 'rank' && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Allow Ties</Label>
                      <p className="text-xs text-gray-500">Let users rank items at same position</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.allowTies || false} 
                      onCheckedChange={(c) => handleConfigUpdate('allowTies', c)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Display Style</Label>
                    <Select 
                      value={selectedField.config?.displayStyle || 'drag'} 
                      onValueChange={(v) => handleConfigUpdate('displayStyle', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drag">Drag & Drop</SelectItem>
                        <SelectItem value="number">Number Input</SelectItem>
                        <SelectItem value="arrows">Up/Down Arrows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Heading Field Settings */}
              {selectedField.type === 'heading' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Heading Level</Label>
                    <Select 
                      value={String(selectedField.config?.level || 2)} 
                      onValueChange={(v) => handleConfigUpdate('level', parseInt(v))}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">H1 - Extra Large</SelectItem>
                        <SelectItem value="2">H2 - Large</SelectItem>
                        <SelectItem value="3">H3 - Medium</SelectItem>
                        <SelectItem value="4">H4 - Small</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Alignment</Label>
                    <Select 
                      value={selectedField.config?.align || 'left'} 
                      onValueChange={(v) => handleConfigUpdate('align', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Divider Field Settings */}
              {selectedField.type === 'divider' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Divider Style</Label>
                    <Select 
                      value={selectedField.config?.dividerStyle || 'solid'} 
                      onValueChange={(v) => handleConfigUpdate('dividerStyle', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid Line</SelectItem>
                        <SelectItem value="dashed">Dashed Line</SelectItem>
                        <SelectItem value="dotted">Dotted Line</SelectItem>
                        <SelectItem value="space">Blank Space</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Spacing</Label>
                    <Select 
                      value={selectedField.config?.spacing || 'medium'} 
                      onValueChange={(v) => handleConfigUpdate('spacing', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (8px)</SelectItem>
                        <SelectItem value="medium">Medium (16px)</SelectItem>
                        <SelectItem value="large">Large (32px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Recommendation Field Settings */}
              {selectedField.type === 'recommendation' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Number of Recommenders</Label>
                    <Select 
                      value={String(selectedField.config?.numRecommenders || 2)} 
                      onValueChange={(v) => handleConfigUpdate('numRecommenders', parseInt(v))}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Recommender</SelectItem>
                        <SelectItem value="2">2 Recommenders</SelectItem>
                        <SelectItem value="3">3 Recommenders</SelectItem>
                        <SelectItem value="4">4 Recommenders</SelectItem>
                        <SelectItem value="5">5 Recommenders</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">How many letters of recommendation are required</p>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline Type</Label>
                    <Select
                      value={selectedField.config?.deadlineType || 'relative'}
                      onValueChange={(v) => handleConfigUpdate('deadlineType', v)}
                    >
                      <SelectTrigger className="bg-gray-50/50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relative">Days after request sent</SelectItem>
                        <SelectItem value="fixed">Fixed date and time</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {selectedField.config?.deadlineType === 'fixed' ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">Deadline Date & Time</Label>
                        <Input 
                          type="datetime-local"
                          value={selectedField.config?.fixedDeadline || ''} 
                          onChange={(e) => handleConfigUpdate('fixedDeadline', e.target.value)} 
                          className="bg-gray-50/50 border-gray-200"
                        />
                        <p className="text-xs text-gray-500">All recommenders must submit by this date and time</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600">Days to Submit</Label>
                        <Input 
                          type="number"
                          min={1}
                          max={90}
                          value={selectedField.config?.deadlineDays || 14} 
                          onChange={(e) => handleConfigUpdate('deadlineDays', parseInt(e.target.value) || 14)} 
                          className="bg-gray-50/50 border-gray-200"
                        />
                        <p className="text-xs text-gray-500">Days from when request is sent</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email Subject</Label>
                    <Input 
                      value={selectedField.config?.emailSubject || 'Letter of Recommendation Request'} 
                      onChange={(e) => handleConfigUpdate('emailSubject', e.target.value)} 
                      className="bg-gray-50/50 border-gray-200"
                      placeholder="Letter of Recommendation Request"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email Message</Label>
                    <MergeTagTextarea 
                      value={selectedField.config?.emailMessage || 'You have been requested to provide a letter of recommendation. Please click the link below to submit your recommendation.'} 
                      onChange={(v) => handleConfigUpdate('emailMessage', v)} 
                      placeholder="Enter the email message for recommenders..."
                      fields={allFields.filter(f => f.id !== selectedField.id).map(f => ({
                        id: f.id,
                        label: f.label || f.id,
                        type: f.type
                      }))}
                      rows={3}
                    />
                    <p className="text-xs text-gray-500">Message sent to recommenders via email. Click + to insert field values.</p>
                  </div>

                  {/* Merge Tag Field Mappings */}
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Merge Tag Field Mappings</Label>
                    <p className="text-xs text-gray-500">
                      Select which form fields to use for email merge tags
                    </p>
                    
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600 flex items-center gap-2">
                          <code className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">{'{{applicant_name}}'}</code>
                          Applicant Name
                        </Label>
                        <MergeTagFieldPicker
                          value={selectedField.config?.mergeTagFields?.applicant_name || ''}
                          onChange={(v) => handleConfigUpdate('mergeTagFields', {
                            ...(selectedField.config?.mergeTagFields || {}),
                            applicant_name: v
                          })}
                          placeholder="Auto-detect (name fields)"
                          fields={allFields
                            .filter(f => ['text', 'email', 'select'].includes(f.type) && f.id !== selectedField.id)
                            .map(f => ({
                              id: f.id,
                              label: f.label || f.id,
                              type: f.type
                            }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600 flex items-center gap-2">
                          <code className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">{'{{applicant_email}}'}</code>
                          Applicant Email
                        </Label>
                        <MergeTagFieldPicker
                          value={selectedField.config?.mergeTagFields?.applicant_email || ''}
                          onChange={(v) => handleConfigUpdate('mergeTagFields', {
                            ...(selectedField.config?.mergeTagFields || {}),
                            applicant_email: v
                          })}
                          placeholder="Auto-detect (email fields)"
                          fields={allFields
                            .filter(f => ['text', 'email'].includes(f.type) && f.id !== selectedField.id)
                            .map(f => ({
                              id: f.id,
                              label: f.label || f.id,
                              type: f.type
                            }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Allow Applicant to See Status</Label>
                      <p className="text-xs text-gray-500">Show pending/completed status</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.showStatus !== false} 
                      onCheckedChange={(c) => handleConfigUpdate('showStatus', c)} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Send Reminder Emails</Label>
                      <p className="text-xs text-gray-500">Auto-remind before deadline</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.sendReminders !== false} 
                      onCheckedChange={(c) => handleConfigUpdate('sendReminders', c)} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Require Relationship</Label>
                      <p className="text-xs text-gray-500">Ask how recommender knows applicant</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.requireRelationship || false} 
                      onCheckedChange={(c) => handleConfigUpdate('requireRelationship', c)} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Allow File Upload</Label>
                      <p className="text-xs text-gray-500">Let recommender upload PDF/Word document</p>
                    </div>
                    <Switch 
                      checked={selectedField.config?.showFileUpload !== false} 
                      onCheckedChange={(c) => handleConfigUpdate('showFileUpload', c)} 
                    />
                  </div>

                  {/* Recommendation Questions Editor */}
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Questions for Recommender</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const questions = selectedField.config?.questions || []
                          const newQuestion = {
                            id: uuidv4(),
                            type: 'textarea',
                            label: 'New Question',
                            description: '',
                            required: false,
                            options: []
                          }
                          handleConfigUpdate('questions', [...questions, newQuestion])
                        }}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Question
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Customize the questions recommenders will answer. Leave empty to use default questions.
                    </p>
                    
                    {(selectedField.config?.questions || []).length === 0 ? (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-sm text-gray-500">No custom questions</p>
                        <p className="text-xs text-gray-400 mt-1">Default questions will be used</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(selectedField.config?.questions || []).map((question: any, index: number) => (
                          <div key={question.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={question.label}
                                  onChange={(e) => {
                                    const questions = [...(selectedField.config?.questions || [])]
                                    questions[index] = { ...question, label: e.target.value }
                                    handleConfigUpdate('questions', questions)
                                  }}
                                  placeholder="Question text"
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Select
                                    value={question.type}
                                    onValueChange={(v) => {
                                      const questions = [...(selectedField.config?.questions || [])]
                                      questions[index] = { ...question, type: v }
                                      handleConfigUpdate('questions', questions)
                                    }}
                                  >
                                    <SelectTrigger className="w-32 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Short Text</SelectItem>
                                      <SelectItem value="textarea">Long Text</SelectItem>
                                      <SelectItem value="rating">Rating (1-5)</SelectItem>
                                      <SelectItem value="select">Dropdown</SelectItem>
                                      <SelectItem value="checkbox">Checkbox</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="flex items-center gap-1">
                                    <Switch
                                      checked={question.required}
                                      onCheckedChange={(c) => {
                                        const questions = [...(selectedField.config?.questions || [])]
                                        questions[index] = { ...question, required: c }
                                        handleConfigUpdate('questions', questions)
                                      }}
                                    />
                                    <span className="text-xs text-gray-500">Required</span>
                                  </div>
                                </div>
                                {question.type === 'select' && (
                                  <Input
                                    value={(question.options || []).join(', ')}
                                    onChange={(e) => {
                                      const questions = [...(selectedField.config?.questions || [])]
                                      questions[index] = { 
                                        ...question, 
                                        options: e.target.value.split(',').map((o: string) => o.trim()).filter(Boolean)
                                      }
                                      handleConfigUpdate('questions', questions)
                                    }}
                                    placeholder="Options (comma separated)"
                                    className="text-xs"
                                  />
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const questions = (selectedField.config?.questions || []).filter((_: any, i: number) => i !== index)
                                  handleConfigUpdate('questions', questions)
                                }}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Options Section - Only for option fields */}
          {isOptionField && (
            <AccordionItem value="options" className="border-b border-gray-100">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 data-[state=open]:bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-amber-50 text-amber-600 rounded-md">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-sm text-gray-900">Options</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {selectedField.options?.length || 0}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-3">
                {/* Dynamic Options Toggle */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200/50 mb-4 shadow-sm">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Dynamic Options
                    </Label>
                    <p className="text-xs text-gray-600">Automatically populate options from another field</p>
                  </div>
                  <Switch 
                    checked={selectedField.config?.dynamicOptions || false} 
                    onCheckedChange={(c) => handleConfigUpdate('dynamicOptions', c)} 
                  />
                </div>

                {selectedField.config?.dynamicOptions ? (
                  <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50/30 to-purple-50/30 border border-blue-100/50 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Source Field
                      </Label>
                      <Select 
                        value={selectedField.config?.sourceField || ''} 
                        onValueChange={(v) => handleConfigUpdate('sourceField', v)}
                      >
                        <SelectTrigger className="bg-white border-gray-200 hover:border-blue-300 transition-colors shadow-sm">
                          <SelectValue placeholder="Choose a field with options..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sourceFields.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-gray-500">
                              <p className="font-medium">No source fields available</p>
                              <p className="text-xs mt-1">Add a Repeater, Select, Radio, or Multi-Select field first</p>
                            </div>
                          ) : (
                            sourceFields.map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                                    {f.type}
                                  </span>
                                  <span>{f.label}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Option Template for Repeater Fields */}
                    {selectedField.config?.sourceField && (() => {
                      const sourceField = sourceFields.find(f => f.id === selectedField.config?.sourceField)
                      const isRepeater = sourceField?.type === 'repeater'
                      
                      return isRepeater && sourceField?.children ? (
                        <div className="space-y-3 p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                              Option Template
                            </Label>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              Create custom option labels by combining subfield values. Click a chip below to insert it.
                            </p>
                          </div>
                          <Textarea
                            value={selectedField.config?.optionTemplate || ''}
                            onChange={(e) => handleConfigUpdate('optionTemplate', e.target.value)}
                            placeholder={`Example: ${sourceField.children[0]?.label || 'Name'} - ${sourceField.children[1]?.label || 'Type'}`}
                            className="bg-gray-50 border-gray-200 focus:border-purple-300 focus:ring-purple-200 font-mono text-sm min-h-[80px] resize-none"
                          />
                          {selectedField.config?.optionTemplate && (
                            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded p-2">
                              <span className="font-medium text-blue-700">Preview:</span> {selectedField.config.optionTemplate}
                            </div>
                          )}
                          <div className="space-y-2 pt-2 border-t border-gray-100">
                            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Click to Insert</Label>
                            <div className="flex flex-wrap gap-2">
                              {sourceField.children.map(child => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => {
                                    const currentTemplate = selectedField.config?.optionTemplate || ''
                                    const insertion = `{${child.id}}`
                                    handleConfigUpdate('optionTemplate', `${currentTemplate}${insertion}`)
                                  }}
                                  className="group inline-flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-lg hover:from-purple-50 hover:to-blue-50 hover:border-purple-300 hover:shadow-md active:scale-95 transition-all duration-200"
                                  title={`Insert {${child.id}}`}
                                >
                                  <span className="font-semibold text-gray-900">{child.label}</span>
                                  <span className="px-1.5 py-0.5 text-xs font-mono bg-purple-100 text-purple-700 rounded group-hover:bg-purple-200 transition-colors">
                                    {'{'}...{'}'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                ) : (
                  <OptionEditor
                    options={selectedField.options || []}
                    onChange={(options) => handleUpdate({ options })}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Validation Settings */}
          <AccordionItem value="validation" className="border-b border-gray-100">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 data-[state=open]:bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-green-50 text-green-600 rounded-md">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-gray-900">Validation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4 pt-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Required field</Label>
                    <p className="text-xs text-gray-500">User must fill this field</p>
                </div>
                <Switch 
                  checked={selectedField.required} 
                  onCheckedChange={(c) => handleUpdate({ required: c })} 
                />
              </div>

              {['text', 'textarea', 'email'].includes(selectedField.type) && (
                 <>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Length</Label>
                            <Input 
                                type="number"
                                value={selectedField.validation?.minLength || ''}
                                onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, minLength: parseInt(e.target.value) || undefined } })}
                                className="bg-gray-50/50"
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Length</Label>
                            <Input 
                                type="number"
                                value={selectedField.validation?.maxLength || ''}
                                onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, maxLength: parseInt(e.target.value) || undefined } })}
                                className="bg-gray-50/50"
                                placeholder="1000"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Regex Pattern</Label>
                        <Input 
                            value={selectedField.validation?.pattern || ''}
                            onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, pattern: e.target.value } })}
                            placeholder="e.g. ^[A-Z]+$"
                            className="font-mono text-xs bg-gray-50/50"
                        />
                        <p className="text-[10px] text-gray-400">Regular expression for custom validation</p>
                    </div>
                 </>
              )}

              {['number'].includes(selectedField.type) && (
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Value</Label>
                        <Input 
                            type="number"
                            value={selectedField.validation?.min ?? ''}
                            onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, min: parseFloat(e.target.value) || undefined } })}
                            className="bg-gray-50/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Value</Label>
                        <Input 
                            type="number"
                            value={selectedField.validation?.max ?? ''}
                            onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, max: parseFloat(e.target.value) || undefined } })}
                            className="bg-gray-50/50"
                        />
                    </div>
                 </div>
              )}

              {['select', 'multiselect'].includes(selectedField.type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Selections</Label>
                    <Input 
                      type="number"
                      value={selectedField.validation?.minSelect ?? ''}
                      onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, minSelect: parseInt(e.target.value) || undefined } })}
                      className="bg-gray-50/50"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Selections</Label>
                    <Input 
                      type="number"
                      value={selectedField.validation?.maxSelect ?? ''}
                      onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, maxSelect: parseInt(e.target.value) || undefined } })}
                      className="bg-gray-50/50"
                      min={1}
                    />
                  </div>
                </div>
              )}

              {['file', 'image'].includes(selectedField.type) && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Files</Label>
                      <Input 
                        type="number"
                        value={selectedField.config?.maxFiles || 1}
                        onChange={(e) => handleConfigUpdate('maxFiles', parseInt(e.target.value))}
                        className="bg-gray-50/50"
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Size (MB)</Label>
                      <Input 
                        type="number"
                        value={selectedField.config?.maxSizeMB || 10}
                        onChange={(e) => handleConfigUpdate('maxSizeMB', parseInt(e.target.value))}
                        className="bg-gray-50/50"
                        min={1}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accepted File Types</Label>
                    <Input 
                      value={selectedField.config?.acceptedTypes || ''}
                      onChange={(e) => handleConfigUpdate('acceptedTypes', e.target.value)}
                      className="bg-gray-50/50 font-mono text-xs"
                      placeholder=".pdf,.doc,.docx"
                    />
                    <p className="text-[10px] text-gray-400">Comma-separated list of file extensions</p>
                  </div>
                </>
              )}

              {['date', 'datetime'].includes(selectedField.type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Date</Label>
                    <Input 
                      type="date"
                      value={selectedField.validation?.minDate || ''}
                      onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, minDate: e.target.value } })}
                      className="bg-gray-50/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Date</Label>
                    <Input 
                      type="date"
                      value={selectedField.validation?.maxDate || ''}
                      onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, maxDate: e.target.value } })}
                      className="bg-gray-50/50"
                    />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Logic Settings */}
          <AccordionItem value="logic" className="border-b border-gray-100">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 data-[state=open]:bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-purple-50 text-purple-600 rounded-md">
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-gray-900">Conditional Logic</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2">
              <div className="space-y-4">
                {(selectedField.config?.logic || []).map((rule: LogicRule) => {
                  const logicField = findFieldById(rule.fieldId)
                  const logicFieldOptions = getFieldOptionsForLogic(logicField)
                  const showValueControl = !['is_empty', 'is_not_empty'].includes(rule.operator)
                  const valueInputType = getValueInputType(logicField)

                  return (
                    <div key={rule.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm space-y-3">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={rule.action} 
                          onValueChange={(v) => handleUpdateLogicRule(rule.id, { action: v as any })}
                        >
                          <SelectTrigger className="w-24 bg-white h-9 text-xs border-gray-300 shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)]">
                            <SelectItem value="show">Show</SelectItem>
                            <SelectItem value="hide">Hide</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-gray-500">this field when</span>
                        {logicField && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                            <span className="h-2 w-2 rounded-full bg-purple-500" />
                            {logicField.label}
                          </span>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 ml-auto text-gray-400 hover:text-red-500"
                          onClick={() => handleDeleteLogicRule(rule.id)}
                          aria-label="Remove condition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid gap-2">
                        <div className="grid gap-1">
                          <span className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">Field to evaluate</span>
                          <Select 
                            value={rule.fieldId} 
                            onValueChange={(v) => handleUpdateLogicRule(rule.id, { fieldId: v, value: '' })}
                          >
                            <SelectTrigger className="bg-white h-10 text-sm w-full border-gray-300 shadow-sm">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)] max-h-64 overflow-auto">
                              {allFields
                                .filter(f => f.id !== selectedField.id && !['divider', 'heading', 'paragraph', 'callout', 'group', 'repeater'].includes(f.type))
                                .map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-[1fr,1.2fr]">
                          <div className="grid gap-1">
                            <span className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">Operator</span>
                            <Select 
                              value={rule.operator} 
                              onValueChange={(v) => handleUpdateLogicRule(rule.id, { operator: v as any, value: ['is_empty', 'is_not_empty'].includes(v as any) ? '' : rule.value })}
                            >
                              <SelectTrigger className="bg-white h-10 text-sm border-gray-300 shadow-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)]">
                                <SelectItem value="equals">equals</SelectItem>
                                <SelectItem value="not_equals">not equals</SelectItem>
                                <SelectItem value="contains">contains</SelectItem>
                                <SelectItem value="is_empty">is empty</SelectItem>
                                <SelectItem value="is_not_empty">is not empty</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {showValueControl && (
                            <div className="grid gap-1">
                              <span className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">Value</span>
                              {logicFieldOptions.length > 0 ? (
                                <Select
                                  value={rule.value}
                                  onValueChange={(v) => handleUpdateLogicRule(rule.id, { value: v })}
                                >
                                  <SelectTrigger className="bg-white h-10 text-sm border-gray-300 shadow-sm">
                                    <SelectValue placeholder="Choose a value from this field" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)] max-h-60 overflow-auto">
                                    {logicFieldOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input 
                                  type={valueInputType}
                                  value={rule.value}
                                  onChange={(e) => handleUpdateLogicRule(rule.id, { value: e.target.value })}
                                  className="h-10 text-sm bg-white border-gray-300 shadow-sm"
                                  placeholder={logicField ? 'Enter a value for this field' : 'Value...'}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddLogicRule}
                  className="w-full"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Condition
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Advanced Settings */}
          <AccordionItem value="advanced" className="border-b border-gray-100">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 data-[state=open]:bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-orange-50 text-orange-600 rounded-md">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-gray-900">Advanced</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4 pt-3">
              <div className="space-y-2">
                 <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Field ID</Label>
                 <Input 
                    value={selectedField.id}
                    disabled
                    className="font-mono text-xs bg-gray-100 text-gray-500"
                 />
              </div>
              
              <div className="space-y-2">
                 <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Custom CSS Class</Label>
                 <Input 
                    value={selectedField.config?.className || ''}
                    onChange={(e) => handleConfigUpdate('className', e.target.value)}
                    placeholder="my-custom-field"
                    className="font-mono text-xs bg-gray-50/50"
                 />
              </div>

              <div className="space-y-2">
                 <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Default Value</Label>
                 <Input 
                    value={selectedField.config?.defaultValue || ''}
                    onChange={(e) => handleConfigUpdate('defaultValue', e.target.value)}
                    placeholder="Pre-filled value"
                    className="bg-gray-50/50"
                 />
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  )
}
