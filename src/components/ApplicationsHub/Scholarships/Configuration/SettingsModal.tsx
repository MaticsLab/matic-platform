'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { Plus, Trash2, Save } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { Form, FormField } from '@/types/forms'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  onSave: () => void
}

interface RubricCategory {
  id: string
  category: string
  max: number
  description: string
}

interface FieldMapping {
  gpa: string
  efc: string
  personal_statement: string
  school: string
  name: string
  email: string
}

export function SettingsModal({ open, onOpenChange, formId, onSave }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('rubric')
  const [rubric, setRubric] = useState<RubricCategory[]>([])
  const [mappings, setMappings] = useState<FieldMapping>({
    gpa: '',
    efc: '',
    personal_statement: '',
    school: '',
    name: '',
    email: ''
  })
  const [fields, setFields] = useState<FormField[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && formId) {
      fetchSettings()
    }
  }, [open, formId])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      setFields(form.fields || [])
      
      const settings = form.settings || {}
      if (settings.rubric) {
        setRubric(settings.rubric as RubricCategory[])
      } else {
        // Default rubric if none exists
        setRubric([
          { id: '1', category: 'Academic Performance', max: 20, description: 'GPA, Test Scores' },
          { id: '2', category: 'Financial Need', max: 30, description: 'EFC, Gap' },
          { id: '3', category: 'Essays', max: 25, description: 'Quality of writing' },
          { id: '4', category: 'Extracurriculars', max: 15, description: 'Leadership, Service' },
          { id: '5', category: 'Recommendation', max: 10, description: 'Teacher feedback' }
        ])
      }

      if (settings.mappings) {
        setMappings(settings.mappings as FieldMapping)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const currentForm = await goClient.get<Form>(`/forms/${formId}`)
      const updatedSettings = {
        ...currentForm.settings,
        rubric,
        mappings
      }
      
      await goClient.patch(`/forms/${formId}`, {
        settings: updatedSettings
      })
      
      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const addRubricCategory = () => {
    setRubric([...rubric, { id: Date.now().toString(), category: 'New Category', max: 10, description: '' }])
  }

  const removeRubricCategory = (index: number) => {
    const newRubric = [...rubric]
    newRubric.splice(index, 1)
    setRubric(newRubric)
  }

  const updateRubricCategory = (index: number, field: keyof RubricCategory, value: any) => {
    const newRubric = [...rubric]
    newRubric[index] = { ...newRubric[index], [field]: value }
    setRubric(newRubric)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
          <DialogDescription>Configure scoring rubric and data mappings.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="rubric">Scoring Rubric</TabsTrigger>
            <TabsTrigger value="mappings">Field Mappings</TabsTrigger>
          </TabsList>

          <TabsContent value="rubric" className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Scoring Categories</h3>
              <Button size="sm" variant="outline" onClick={addRubricCategory}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>
            
            <div className="space-y-3">
              {rubric.map((item, index) => (
                <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 space-y-2">
                    <Input 
                      value={item.category} 
                      onChange={(e) => updateRubricCategory(index, 'category', e.target.value)}
                      placeholder="Category Name"
                      className="bg-white"
                    />
                    <Input 
                      value={item.description} 
                      onChange={(e) => updateRubricCategory(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="bg-white text-xs"
                    />
                  </div>
                  <div className="w-24">
                    <Input 
                      type="number" 
                      value={item.max} 
                      onChange={(e) => updateRubricCategory(index, 'max', parseInt(e.target.value))}
                      placeholder="Max Pts"
                      className="bg-white"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeRubricCategory(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end p-2 bg-blue-50 rounded text-blue-700 text-sm font-medium">
              Total Points: {rubric.reduce((sum, item) => sum + (item.max || 0), 0)}
            </div>
          </TabsContent>

          <TabsContent value="mappings" className="space-y-4 py-4">
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Map your form fields to system data points for analysis.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Applicant Name</Label>
                  <select 
                    className="w-full p-2 border rounded-md text-sm"
                    value={mappings.name}
                    onChange={(e) => setMappings({...mappings, name: e.target.value})}
                  >
                    <option value="">Select Field...</option>
                    {fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <select 
                    className="w-full p-2 border rounded-md text-sm"
                    value={mappings.email}
                    onChange={(e) => setMappings({...mappings, email: e.target.value})}
                  >
                    <option value="">Select Field...</option>
                    {fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>GPA</Label>
                  <select 
                    className="w-full p-2 border rounded-md text-sm"
                    value={mappings.gpa}
                    onChange={(e) => setMappings({...mappings, gpa: e.target.value})}
                  >
                    <option value="">Select Field...</option>
                    {fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>EFC / SAI (Financial)</Label>
                  <select 
                    className="w-full p-2 border rounded-md text-sm"
                    value={mappings.efc}
                    onChange={(e) => setMappings({...mappings, efc: e.target.value})}
                  >
                    <option value="">Select Field...</option>
                    {fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>School / University</Label>
                  <select 
                    className="w-full p-2 border rounded-md text-sm"
                    value={mappings.school}
                    onChange={(e) => setMappings({...mappings, school: e.target.value})}
                  >
                    <option value="">Select Field...</option>
                    {fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Personal Statement</Label>
                  <select 
                    className="w-full p-2 border rounded-md text-sm"
                    value={mappings.personal_statement}
                    onChange={(e) => setMappings({...mappings, personal_statement: e.target.value})}
                  >
                    <option value="">Select Field...</option>
                    {fields.map(f => <option key={f.id} value={f.label}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
