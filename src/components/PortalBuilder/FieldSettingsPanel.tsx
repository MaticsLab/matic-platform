'use client'

import { useState } from 'react'
import { Settings, ArrowUpDown, Sliders, GitBranch, Code2, ShieldCheck, Plus, Trash2, GripVertical, Type, Hash, Mail, Phone, Link as LinkIcon, List, CheckSquare, Calendar, Clock, Upload, Image, PenTool, Star, Heading2, FileText, AlertCircle, Grid3x3, Repeat2 } from 'lucide-react'
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
        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Options</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddOption}
          className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Option
        </Button>
      </div>
      
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
        {options.map((option, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-2 group",
              draggedIndex === index && "opacity-50"
            )}
          >
            <div className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing">
              <GripVertical className="w-4 h-4" />
            </div>
            <Input
              value={option}
              onChange={(e) => handleUpdateOption(index, e.target.value)}
              className="flex-1 h-9 text-sm bg-gray-50/50"
              placeholder={`Option ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveOption(index)}
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {options.length === 0 && (
        <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No options yet</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddOption}
            className="mt-2 text-xs text-blue-600"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add first option
          </Button>
        </div>
      )}
    </div>
  )
}

export function FieldSettingsPanel({ selectedField, onUpdate, onClose, allFields }: FieldSettingsPanelProps) {
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
      id: Date.now().toString(),
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

  const isOptionField = ['select', 'multiselect', 'radio', 'rank'].includes(selectedField.type)
  const isLayoutField = ['divider', 'heading', 'paragraph', 'callout'].includes(selectedField.type)
  const isContainerField = ['group', 'repeater'].includes(selectedField.type)

  const sourceFields = allFields.filter(f => 
    f.id !== selectedField.id && 
    ['repeater', 'select', 'multiselect', 'radio'].includes(f.type)
  )

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-sm text-gray-900">Field Settings</span>
        </div>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">
          {FIELD_TYPES.find(t => t.value === selectedField.type)?.label || selectedField.type}
        </span>
      </div>

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

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description / Help Text</Label>
                <Textarea 
                  className="h-20 resize-none bg-gray-50/50 border-gray-200"
                  value={selectedField.config?.description || ''} 
                  onChange={(e) => handleConfigUpdate('description', e.target.value)}
                  placeholder="Helper text shown below the field. Type @ to reference other fields."
                />
                {selectedField.config?.description?.includes('{') && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    💡 Mentions will be replaced with field values when the form is submitted
                  </div>
                )}
              </div>

              {/* Placeholder - not for layout fields */}
              {!isLayoutField && !isContainerField && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Placeholder</Label>
                  <Input 
                    value={selectedField.placeholder || ''} 
                    onChange={(e) => handleUpdate({ placeholder: e.target.value })} 
                    className="bg-gray-50/50 border-gray-200"
                    placeholder="Placeholder text..."
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
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Dynamic Options</Label>
                    <p className="text-xs text-gray-500">Load options from another field</p>
                  </div>
                  <Switch 
                    checked={selectedField.config?.dynamicOptions || false} 
                    onCheckedChange={(c) => handleConfigUpdate('dynamicOptions', c)} 
                  />
                </div>

                {selectedField.config?.dynamicOptions ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Source Field</Label>
                      <Select 
                        value={selectedField.config?.sourceField || ''} 
                        onValueChange={(v) => handleConfigUpdate('sourceField', v)}
                      >
                        <SelectTrigger className="bg-gray-50/50">
                          <SelectValue placeholder="Select source field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceFields.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                {(selectedField.config?.logic || []).map((rule: LogicRule) => (
                  <div key={rule.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select 
                        value={rule.action} 
                        onValueChange={(v) => handleUpdateLogicRule(rule.id, { action: v as any })}
                      >
                        <SelectTrigger className="w-20 bg-white h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="show">Show</SelectItem>
                          <SelectItem value="hide">Hide</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-gray-500">this field if</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 ml-auto text-gray-400 hover:text-red-500"
                        onClick={() => handleDeleteLogicRule(rule.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      <Select 
                        value={rule.fieldId} 
                        onValueChange={(v) => handleUpdateLogicRule(rule.id, { fieldId: v })}
                      >
                        <SelectTrigger className="bg-white h-8 text-xs">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allFields.filter(f => f.id !== selectedField.id).map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Select 
                          value={rule.operator} 
                          onValueChange={(v) => handleUpdateLogicRule(rule.id, { operator: v as any })}
                        >
                          <SelectTrigger className="w-32 bg-white h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">equals</SelectItem>
                            <SelectItem value="not_equals">not equals</SelectItem>
                            <SelectItem value="contains">contains</SelectItem>
                            <SelectItem value="is_empty">is empty</SelectItem>
                            <SelectItem value="is_not_empty">is not empty</SelectItem>
                          </SelectContent>
                        </Select>
                        {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                          <Input 
                            value={rule.value}
                            onChange={(e) => handleUpdateLogicRule(rule.id, { value: e.target.value })}
                            className="flex-1 h-8 text-xs bg-white"
                            placeholder="Value..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
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
