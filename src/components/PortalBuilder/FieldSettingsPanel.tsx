import { Settings, X, HelpCircle, ArrowUpDown, Sliders, GitBranch, Code2, ShieldCheck, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui-components/accordion'
import { Field, FieldType } from '@/types/portal'
import { Textarea } from '@/ui-components/textarea'
import { cn } from '@/lib/utils'

const FIELD_TYPES: { value: string; label: string }[] = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'address', label: 'Address' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'radio', label: 'Single Choice' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'time', label: 'Time' },
  { value: 'file', label: 'File Upload' },
  { value: 'image', label: 'Image Upload' },
  { value: 'signature', label: 'Signature' },
  { value: 'rating', label: 'Rating' },
  { value: 'rank', label: 'Rank' },
  { value: 'divider', label: 'Divider' },
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'callout', label: 'Callout Box' },
  { value: 'group', label: 'Group' },
  { value: 'repeater', label: 'Repeater' },
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

  const isOptionField = ['select', 'multiselect', 'radio', 'checkbox', 'rank'].includes(selectedField.type)

  const sourceFields = allFields.filter(f => 
    f.id !== selectedField.id && 
    ['repeater', 'select', 'multiselect', 'radio'].includes(f.type)
  )

  const selectedSourceField = allFields.find(f => f.id === selectedField.config?.sourceField)

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={['basic', 'advanced']} className="w-full">
          
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
            <AccordionContent className="px-4 pb-4 space-y-5 pt-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Field Type</Label>
                <Select 
                  value={selectedField.type} 
                  onValueChange={(v) => handleUpdate({ type: v as FieldType })}
                >
                  <SelectTrigger className="bg-gray-50/50 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Label</Label>
                <Input 
                  value={selectedField.label} 
                  onChange={(e) => handleUpdate({ label: e.target.value })} 
                  className="font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</Label>
                <Textarea 
                  className="h-20 resize-none bg-gray-50/50 border-gray-200"
                  value={selectedField.config?.description || ''} 
                  onChange={(e) => handleConfigUpdate('description', e.target.value)}
                  placeholder="Helper text for the user"
                />
              </div>

              {!['divider', 'heading', 'paragraph', 'group', 'repeater'].includes(selectedField.type) && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Placeholder</Label>
                  <Input 
                    value={selectedField.placeholder || ''} 
                    onChange={(e) => handleUpdate({ placeholder: e.target.value })} 
                    className="bg-gray-50/50 border-gray-200"
                  />
                </div>
              )}

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
              
              {/* Static Options if Dynamic is OFF */}
              {isOptionField && !selectedField.config?.dynamicOptions && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Options</Label>
                  <Textarea 
                    value={selectedField.options?.join('\n') || ''}
                    onChange={(e) => handleUpdate({ options: e.target.value.split('\n').filter(Boolean) })}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    className="min-h-[100px] font-mono text-sm bg-gray-50/50 border-gray-200"
                  />
                  <p className="text-[10px] text-gray-400">Enter each option on a new line.</p>
                </div>
              )}

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
            </AccordionContent>
          </AccordionItem>

          {/* Logic Settings */}
          <AccordionItem value="logic" className="border-b border-gray-100">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 data-[state=open]:bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-purple-50 text-purple-600 rounded-md">
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-gray-900">Logic</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2">
              <div className="space-y-4">
                {(selectedField.config?.logic || []).map((rule: LogicRule) => (
                  <div key={rule.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <Select 
                        value={rule.action} 
                        onValueChange={(v) => handleUpdateLogicRule(rule.id, { action: v as any })}
                      >
                        <SelectTrigger className="w-24 bg-white h-8 text-xs">
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
                        className="ml-auto h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => handleDeleteLogicRule(rule.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    <Select 
                      value={rule.fieldId} 
                      onValueChange={(v) => handleUpdateLogicRule(rule.id, { fieldId: v })}
                    >
                      <SelectTrigger className="bg-white h-8 text-xs">
                        <SelectValue placeholder="Select Field" />
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
                        <SelectTrigger className="flex-1 bg-white h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="not_equals">Not Equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="greater_than">Greater Than</SelectItem>
                          <SelectItem value="less_than">Less Than</SelectItem>
                          <SelectItem value="is_empty">Is Empty</SelectItem>
                          <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                        <Input 
                          value={rule.value}
                          onChange={(e) => handleUpdateLogicRule(rule.id, { value: e.target.value })}
                          className="flex-1 bg-white h-8 text-xs"
                          placeholder="Value"
                        />
                      )}
                    </div>
                  </div>
                ))}

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-dashed text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                  onClick={handleAddLogicRule}
                >
                  <Plus className="w-3 h-3 mr-2" />
                  Add Logic Rule
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
            <AccordionContent className="px-4 pb-4 space-y-5 pt-3">
              {isOptionField && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="cursor-pointer text-sm font-medium" htmlFor="randomize">Randomize order</Label>
                    </div>
                    <Switch 
                      id="randomize"
                      checked={selectedField.config?.randomizeOrder || false}
                      onCheckedChange={(c) => handleConfigUpdate('randomizeOrder', c)}
                    />
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                        <Label className="cursor-pointer text-sm font-medium" htmlFor="dynamic">Dynamic Options</Label>
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                        </div>
                        <Switch 
                        id="dynamic"
                        checked={selectedField.config?.dynamicOptions || false}
                        onCheckedChange={(c) => handleConfigUpdate('dynamicOptions', c)}
                        />
                    </div>

                    {selectedField.config?.dynamicOptions && (
                        <div className="pt-2 animate-in fade-in slide-in-from-top-1 space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500">Source Field</Label>
                            <Select 
                                value={selectedField.config?.sourceField || ''}
                                onValueChange={(v) => handleConfigUpdate('sourceField', v)}
                            >
                                <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select data source..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="users">Users (Database)</SelectItem>
                                  {sourceFields.length > 0 && <div className="h-px bg-gray-100 my-1" />}
                                  {sourceFields.map(field => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.label} ({field.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                            </Select>
                          </div>

                          {selectedSourceField?.type === 'repeater' && (
                             <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-gray-500">Display Field</Label>
                                <Select 
                                    value={selectedField.config?.sourceKey || ''}
                                    onValueChange={(v) => handleConfigUpdate('sourceKey', v)}
                                >
                                    <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select field to display..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {selectedSourceField.children?.map(child => (
                                        <SelectItem key={child.id} value={child.id}>
                                          {child.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-gray-500">
                                    Which field from the repeater should be used as the option label?
                                </p>
                             </div>
                          )}
                        </div>
                    )}
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                 <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Custom CSS Class</Label>
                 <Input 
                    value={selectedField.config?.className || ''}
                    onChange={(e) => handleConfigUpdate('className', e.target.value)}
                    placeholder="my-custom-field"
                    className="font-mono text-xs bg-gray-50/50"
                 />
              </div>
            </AccordionContent>
          </AccordionItem>

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
            <AccordionContent className="px-4 pb-4 space-y-5 pt-3">
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Length</Label>
                            <Input 
                                type="number"
                                value={selectedField.validation?.minLength || ''}
                                onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, minLength: e.target.value } })}
                                className="bg-gray-50/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Length</Label>
                            <Input 
                                type="number"
                                value={selectedField.validation?.maxLength || ''}
                                onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, maxLength: e.target.value } })}
                                className="bg-gray-50/50"
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
                    </div>
                 </>
              )}

              {['number'].includes(selectedField.type) && (
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Min Value</Label>
                        <Input 
                            type="number"
                            value={selectedField.validation?.min || ''}
                            onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, min: e.target.value } })}
                            className="bg-gray-50/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Value</Label>
                        <Input 
                            type="number"
                            value={selectedField.validation?.max || ''}
                            onChange={(e) => handleUpdate({ validation: { ...selectedField.validation, max: e.target.value } })}
                            className="bg-gray-50/50"
                        />
                    </div>
                 </div>
              )}

              {['file', 'image'].includes(selectedField.type) && (
                 <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Files</Label>
                    <Input 
                        type="number"
                        value={selectedField.config?.maxFiles || 1}
                        onChange={(e) => handleConfigUpdate('maxFiles', parseInt(e.target.value))}
                        className="bg-gray-50/50"
                        min={1}
                    />
                    <p className="text-[10px] text-gray-400">Maximum number of files allowed (default: 1)</p>
                 </div>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  )
}
