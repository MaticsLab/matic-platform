'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Save, Upload, Star, Calendar as CalendarIcon, Plus, Trash2, Lightbulb, Info, AlertCircle, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Checkbox } from '@/ui-components/checkbox'
import { RadioGroup, RadioGroupItem } from '@/ui-components/radio-group'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Progress } from '@/ui-components/progress'
import { Separator } from '@/ui-components/separator'
import { PortalConfig, Section, Field } from '@/types/portal'
import { AddressField, AddressValue } from '@/components/Tables/AddressField'
import { FileUploadField } from '@/components/ui/FileUploadField'

interface DynamicApplicationFormProps {
  config: PortalConfig
  onBack?: () => void
  isExternal?: boolean
  formId?: string
}

export function DynamicApplicationForm({ config, onBack, isExternal = false, formId }: DynamicApplicationFormProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>(config.sections[0]?.id || '')
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)

  const activeSectionIndex = config.sections.findIndex(s => s.id === activeSectionId)
  const activeSection = config.sections[activeSectionIndex]

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleNext = () => {
    if (activeSectionIndex < config.sections.length - 1) {
      setActiveSectionId(config.sections[activeSectionIndex + 1].id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrevious = () => {
    if (activeSectionIndex > 0) {
      setActiveSectionId(config.sections[activeSectionIndex - 1].id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const calculateProgress = () => {
    if (config.sections.length === 0) return 0
    return ((activeSectionIndex + 1) / config.sections.length) * 100
  }

  return (
    <div className={cn("min-h-screen flex flex-col", isExternal ? "bg-white" : "bg-gray-50")}>
      {/* Top Bar */}
      <div className={cn(
        "sticky top-0 z-30 transition-all",
        isExternal ? "bg-white/80 backdrop-blur-md border-b border-gray-100" : "bg-white border-b border-gray-200"
      )}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isExternal && onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            <div className="flex items-center gap-3">
              {config.settings.logoUrl ? (
                <img src={config.settings.logoUrl} alt="Logo" className="h-8 w-auto" />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: config.settings.themeColor || '#000' }}
                >
                  {config.settings.name.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-gray-900">{config.settings.name}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500 mb-1">
                Step {activeSectionIndex + 1} of {config.sections.length}
              </div>
              <Progress value={calculateProgress()} className="w-32 h-2" />
            </div>
            <Button 
              className={cn(isExternal && "hover:opacity-90")}
              style={{ backgroundColor: config.settings.themeColor || '#000' }}
            >
              Save & Exit
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full p-4 lg:p-8 pb-20">
        <AnimatePresence mode="wait">
          {activeSection && (
            <motion.div
              key={activeSection.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={cn(isExternal ? "border-none shadow-none" : "")}>
                <CardHeader className={cn(isExternal ? "px-0" : "")}>
                  <CardTitle className="text-2xl">{activeSection.title}</CardTitle>
                  {activeSection.description && (
                    <CardDescription>{activeSection.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className={cn("space-y-6", isExternal ? "px-0" : "")}>
                  <div className="grid grid-cols-12 gap-6">
                    {activeSection.fields.map((field) => (
                      <div key={field.id} className={cn(
                        field.width === 'half' ? 'col-span-12 sm:col-span-6' : 
                        field.width === 'third' ? 'col-span-12 sm:col-span-4' :
                        field.width === 'quarter' ? 'col-span-12 sm:col-span-3' :
                        'col-span-12'
                      )}>
                        <FieldRenderer 
                          field={field} 
                          value={formData[field.id]} 
                          onChange={(val) => handleFieldChange(field.id, val)}
                          themeColor={config.settings.themeColor}
                          formId={formId}
                          allFields={config.sections.flatMap(s => s.fields)}
                          formData={formData}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between pt-8 mt-8 border-t border-gray-100">
          <Button 
            variant="ghost" 
            onClick={handlePrevious}
            disabled={activeSectionIndex === 0}
            className="text-gray-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous Step
          </Button>
          <Button 
            onClick={handleNext}
            disabled={activeSectionIndex === config.sections.length - 1}
            style={{ backgroundColor: config.settings.themeColor || '#000' }}
            className="text-white"
          >
            Next Step
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Callout color configurations
const CALLOUT_COLORS: Record<string, { bg: string; border: string; icon: string; title: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-900', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', title: 'text-green-900', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-900', text: 'text-yellow-700' },
  red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', title: 'text-red-900', text: 'text-red-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', title: 'text-purple-900', text: 'text-purple-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', title: 'text-gray-900', text: 'text-gray-700' },
}

const CALLOUT_ICONS: Record<string, any> = {
  lightbulb: Lightbulb,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  help: HelpCircle,
}

function FieldRenderer({ field, value, onChange, themeColor, formId, allFields = [], formData = {} }: { field: Field, value: any, onChange: (val: any) => void, themeColor: string, formId?: string, allFields?: Field[], formData?: Record<string, any> }) {
  // Layout Fields
  if (field.type === 'divider') return <Separator className="my-4" />
  if (field.type === 'heading') return <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{field.label}</h3>
  if (field.type === 'paragraph') {
    const content = field.config?.content || field.label
    const isRichText = /<[a-z][\s\S]*>/i.test(content)
    return isRichText ? (
      <div 
        className="prose prose-sm max-w-none text-gray-600 mb-4 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    ) : (
      <p className="text-gray-600 text-sm leading-relaxed mb-4">{content}</p>
    )
  }
  if (field.type === 'callout') {
    const colorKey = (field.config?.color as string) || 'blue'
    const colors = CALLOUT_COLORS[colorKey] || CALLOUT_COLORS.blue
    const iconKey = (field.config?.icon as string) || 'lightbulb'
    const CalloutIcon = CALLOUT_ICONS[iconKey] || Lightbulb
    
    return (
      <div className={cn("flex items-start gap-3 p-4 border rounded-lg my-4", colors.bg, colors.border)}>
        <CalloutIcon className={cn("w-5 h-5 mt-0.5 shrink-0", colors.icon)} />
        <div>
          <p className={cn("text-sm font-medium", colors.title)}>{field.label}</p>
          {field.placeholder && (
            <p className={cn("text-sm mt-1", colors.text)}>{field.placeholder}</p>
          )}
        </div>
      </div>
    )
  }

  // Container Fields
  if (field.type === 'group') {
    return (
      <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/30">
        <h4 className="font-medium text-gray-900">{field.label}</h4>
        <div className="grid grid-cols-12 gap-4">
          {field.children?.map(child => (
             <div key={child.id} className={cn(
                child.width === 'half' ? 'col-span-12 sm:col-span-6' : 
                child.width === 'third' ? 'col-span-12 sm:col-span-4' :
                child.width === 'quarter' ? 'col-span-12 sm:col-span-3' :
                'col-span-12'
              )}>
               <FieldRenderer 
                 field={child} 
                 value={value?.[child.id]} 
                 onChange={(val) => onChange({ ...value, [child.id]: val })}
                 themeColor={themeColor}
                 allFields={allFields}
                 formData={formData}
               />
             </div>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'repeater') {
    const items = Array.isArray(value) ? value : []
    return (
      <div className="space-y-4">
        <Label className="text-base font-medium text-gray-700">{field.label}</Label>
        {items.map((item: any, idx: number) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-4 relative group bg-white">
             <Button 
               variant="ghost" 
               size="sm" 
               className="absolute right-2 top-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50"
               onClick={() => {
                 const newItems = [...items]
                 newItems.splice(idx, 1)
                 onChange(newItems)
               }}
             >
               <Trash2 className="w-4 h-4" />
             </Button>
             <div className="grid grid-cols-12 gap-4">
               {field.children?.map(child => (
                 <div key={child.id} className={cn(
                    child.width === 'half' ? 'col-span-12 sm:col-span-6' : 
                    child.width === 'third' ? 'col-span-12 sm:col-span-4' :
                    child.width === 'quarter' ? 'col-span-12 sm:col-span-3' :
                    'col-span-12'
                 )}>
                   <FieldRenderer 
                     field={child} 
                     value={item[child.id]} 
                     onChange={(val) => {
                       const newItems = [...items]
                       newItems[idx] = { ...newItems[idx], [child.id]: val }
                       onChange(newItems)
                     }}
                     themeColor={themeColor}
                     allFields={allFields}
                     formData={formData}
                   />
                 </div>
               ))}
             </div>
          </div>
        ))}
        <Button 
          variant="outline" 
          onClick={() => onChange([...items, {}])}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      {/* Text Inputs */}
      {(field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'phone') && (
        <Input 
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
          value={value || ''} 
          onChange={e => onChange(e.target.value)} 
          placeholder={field.placeholder}
          className="h-11"
        />
      )}

      {/* Address Field with Mapbox Autocomplete */}
      {field.type === 'address' && (
        <AddressField
          value={value as AddressValue | null}
          onChange={(addressValue) => onChange(addressValue)}
          placeholder={field.placeholder || 'Start typing an address...'}
          isTableCell={false}
        />
      )}

      {field.type === 'number' && (
        <Input 
          type="number"
          value={value || ''} 
          onChange={e => onChange(e.target.value)} 
          placeholder={field.placeholder}
          className="h-11"
        />
      )}

      {field.type === 'textarea' && (
        <Textarea 
          value={value || ''} 
          onChange={e => onChange(e.target.value)} 
          placeholder={field.placeholder}
          className="min-h-[120px] resize-y"
        />
      )}

      {/* Date & Time */}
      {(field.type === 'date' || field.type === 'datetime' || field.type === 'time') && (
        <div className="relative">
          <Input 
            type={field.type === 'datetime' ? 'datetime-local' : field.type}
            value={value || ''} 
            onChange={e => onChange(e.target.value)} 
            className="h-11"
          />
          <CalendarIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* Selection */}
      {field.type === 'select' && (() => {
        const options = field.options || field.config?.items || []
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
              {options.length === 0 && <SelectItem value="default" disabled>No options defined</SelectItem>}
            </SelectContent>
          </Select>
        )
      })()}

      {/* Rank Field - Multiple ranked choices with dynamic options support */}
      {field.type === 'rank' && (() => {
        let options = (field.options || field.config?.items || []) as string[]
        
        // Handle dynamic options from source field
        if (field.config?.sourceField) {
          let sourceData = formData[field.config.sourceField]
          
          // If not found by ID, try to find field by ID and use its value
          if (!sourceData && allFields) {
            const sourceFieldDef = allFields.find((f: Field) => f.id === field.config?.sourceField)
            if (sourceFieldDef) {
              sourceData = formData[sourceFieldDef.id]
            }
          }

          if (sourceData && Array.isArray(sourceData)) {
            const key = field.config?.sourceKey || 'name'
            const dynamicOptions = sourceData
              .map((item: any) => {
                if (typeof item === 'object' && item !== null) {
                  if (item[key]) return item[key]
                  const firstString = Object.values(item).find(v => typeof v === 'string')
                  return firstString || JSON.stringify(item)
                }
                return String(item)
              })
              .filter((val: string) => val && val.trim() !== '')
            
            if (dynamicOptions.length > 0) {
              options = dynamicOptions
            }
          }
        }

        const maxSelections = field.config?.maxSelections || 3
        const currentValues = (Array.isArray(value) ? value : []) as string[]

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: maxSelections }).map((_, index) => (
                <div key={index} className="space-y-2 relative group">
                  <div 
                    className="absolute -left-2 -top-2 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs z-10 shadow-sm border-2 border-white"
                    style={{ backgroundColor: themeColor || '#000' }}
                  >
                    {index + 1}
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 pt-5 group-hover:border-gray-300 transition-colors">
                    <Label className="text-xs text-gray-500 uppercase font-semibold mb-2 block">
                      Choice #{index + 1}
                    </Label>
                    <Select 
                      value={currentValues[index] || ''} 
                      onValueChange={v => {
                        const newValues = [...currentValues]
                        while (newValues.length < maxSelections) newValues.push('')
                        newValues[index] = v
                        onChange(newValues)
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-200 h-10">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt: string) => (
                          <SelectItem 
                            key={opt} 
                            value={opt} 
                            disabled={currentValues.includes(opt) && currentValues[index] !== opt}
                          >
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            {options.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed">
                No options available. {field.config?.sourceField ? 'Add items to the source field first.' : 'Configure options in field settings.'}
              </div>
            )}
          </div>
        )
      })()}

      {field.type === 'multiselect' && (() => {
        const options = field.options || field.config?.items || []
        return (
          <div className="border rounded-md p-3 space-y-2 bg-white">
            {options.map((opt: string) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox 
                  id={`${field.id}-${opt}`}
                  checked={(value || []).includes(opt)}
                  onCheckedChange={(checked) => {
                    const current = value || []
                    if (checked) onChange([...current, opt])
                    else onChange(current.filter((v: string) => v !== opt))
                  }}
                />
                <label htmlFor={`${field.id}-${opt}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {opt}
                </label>
              </div>
            ))}
            {options.length === 0 && <div className="text-sm text-gray-400">No options defined</div>}
          </div>
        )
      })()}

      {field.type === 'radio' && (() => {
        const options = field.options || field.config?.items || []
        return (
          <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
            {options.map((opt: string) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
              </div>
            ))}
            {options.length === 0 && <div className="text-sm text-gray-400">No options defined</div>}
          </RadioGroup>
        )
      })()}

      {field.type === 'checkbox' && (
        <div className="flex items-center space-x-2 p-2 border rounded-lg bg-gray-50/50">
          <Checkbox 
            id={field.id} 
            checked={!!value} 
            onCheckedChange={onChange}
          />
          <label 
            htmlFor={field.id} 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {field.placeholder || 'Yes, I agree'}
          </label>
        </div>
      )}

      {/* Media & Advanced */}
      {(field.type === 'file' || field.type === 'image') && (
        <FileUploadField
          value={value}
          onChange={onChange}
          imageOnly={field.type === 'image'}
          multiple={field.config?.multiple}
          maxFiles={field.config?.maxFiles || 5}
          storagePath={formId ? `submissions/${formId}/` : undefined}
        />
      )}

      {field.type === 'rating' && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={cn(
                "p-1 rounded-full hover:bg-gray-100 transition-colors",
                (value || 0) >= star ? "text-yellow-400" : "text-gray-300"
              )}
            >
              <Star className="w-8 h-8 fill-current" />
            </button>
          ))}
        </div>
      )}

      {field.type === 'signature' && (
        <div className="border border-gray-200 rounded-xl bg-gray-50 h-32 flex items-center justify-center text-gray-400 text-sm">
          Signature Pad Placeholder
        </div>
      )}
    </div>
  )
}
