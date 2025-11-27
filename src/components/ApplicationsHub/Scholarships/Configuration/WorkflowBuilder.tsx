'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, ChevronRight, Settings, Save, ChevronDown, ChevronUp, Info, CheckCircle2, Users, Bot, Gavel, Calendar, Clock, Loader2, Filter, Eye, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { Form, FormField } from '@/types/forms'

interface WorkflowBuilderProps {
  formId: string | null
}

interface EntryCriterion {
  id: string
  fieldId: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value: string
}

interface ExitAction {
  id: string
  type: 'advance' | 'reject' | 'waitlist' | 'tag' | 'email'
  config: Record<string, any>
}

interface RubricGuideline {
  id: string
  range: string
  description: string
}

interface RubricCategory {
  id: string
  name: string
  points: number
  description?: string
  guidelines?: RubricGuideline[]
}

interface Phase {
  id: string
  name: string
  type: 'review' | 'interview' | 'automated' | 'decision'
  description?: string
  rubric?: RubricCategory[]
  isCollapsed?: boolean // For UI state if we want inline expansion
  startDate?: string
  endDate?: string
  deadlineType?: 'hard' | 'soft'
  entryCriteria?: EntryCriterion[]
  exitActions?: ExitAction[]
  visibleFields?: string[] // IDs of fields visible to reviewers in this stage
}

const DEFAULT_PHASES: Phase[] = [
  { 
    id: 'p1', 
    name: 'Application Submission', 
    type: 'automated',
    description: 'Initial automated check for completeness and eligibility.',
    startDate: '2024-01-01',
    endDate: '2024-03-01',
    deadlineType: 'hard'
  },
  { 
    id: 'p2', 
    name: 'Screening Review', 
    type: 'review',
    description: 'First round of manual review to filter candidates.',
    rubric: [
      { id: 'r1', name: 'Eligibility Check', points: 5, description: 'Meets basic requirements' },
      { id: 'r2', name: 'Completeness', points: 5, description: 'All documents submitted' }
    ],
    startDate: '2024-03-02',
    endDate: '2024-03-15',
    deadlineType: 'soft'
  },
  { 
    id: 'p3', 
    name: 'Committee Review', 
    type: 'review',
    description: 'Detailed evaluation by the scholarship committee.',
    rubric: [
      { 
        id: 'c1', 
        name: 'Academic Performance', 
        points: 20, 
        description: 'GPA, Course Rigor',
        guidelines: [
          { id: 'g1', range: '18-20 pts', description: 'GPA 3.5+, rigorous AP/IB workload, strong test scores' },
          { id: 'g2', range: '14-17 pts', description: 'GPA 3.0-3.4, solid college prep curriculum' },
          { id: 'g3', range: '10-13 pts', description: 'GPA 2.7-2.9, meets basic requirements' }
        ]
      },
      { 
        id: 'c2', 
        name: 'Financial Need', 
        points: 30, 
        description: 'Gap analysis',
        guidelines: [
          { id: 'g4', range: '25-30 pts', description: 'High gap (>10k), Pell eligible, significant hardship' },
          { id: 'g5', range: '15-24 pts', description: 'Moderate gap ($5k-$10k), some family contribution' },
          { id: 'g6', range: '0-14 pts', description: 'Low gap (<$5k) or high family contribution' }
        ]
      },
      { 
        id: 'c3', 
        name: 'Essays', 
        points: 25, 
        description: 'Personal statement quality',
        guidelines: [
           { id: 'g7', range: '21-25 pts', description: 'Compelling narrative, clear goals, authentic voice' }
        ]
      }
    ],
    startDate: '2024-03-16',
    endDate: '2024-04-01',
    deadlineType: 'hard'
  },
  { 
    id: 'p4', 
    name: 'Interview', 
    type: 'interview',
    description: 'Finalist interviews with the board.',
    rubric: [
      { id: 'i1', name: 'Communication', points: 10, description: 'Clarity and poise' },
      { id: 'i2', name: 'Leadership Potential', points: 10, description: 'Future goals' }
    ],
    startDate: '2024-04-05',
    endDate: '2024-04-15',
    deadlineType: 'hard'
  }
]

const PHASE_TYPE_CONFIG = {
  review: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Review' },
  interview: { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', label: 'Interview' },
  automated: { icon: Bot, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', label: 'Automated' },
  decision: { icon: Gavel, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Decision' }
}

export function WorkflowBuilder({ formId }: WorkflowBuilderProps) {
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES)
  const [availableFields, setAvailableFields] = useState<FormField[]>([])
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(DEFAULT_PHASES[0].id)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Collapsible sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    settings: true,
    rubric: true,
    timeline: true,
    automation: false,
    views: false,
    criteria: false
  })

  useEffect(() => {
    async function fetchWorkflow() {
      if (!formId) return
      
      setIsLoading(true)
      try {
        const form = await goClient.get<Form>(`/forms/${formId}`)
        if (form.fields) {
          setAvailableFields(form.fields)
        }
        if (form.settings && (form.settings as any).workflow) {
          const workflow = (form.settings as any).workflow
          if (workflow.phases && Array.isArray(workflow.phases) && workflow.phases.length > 0) {
            setPhases(workflow.phases)
            setSelectedPhaseId(workflow.phases[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch workflow settings:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWorkflow()
  }, [formId])

  const handleSave = async () => {
    if (!formId) return
    
    setIsSaving(true)
    try {
      // First get current settings to merge
      const form = await goClient.get<Form>(`/forms/${formId}`)
      const currentSettings = form.settings || {}
      
      const updatedSettings = {
        ...currentSettings,
        workflow: {
          phases
        }
      }
      
      await goClient.patch(`/forms/${formId}`, {
        settings: updatedSettings
      })
      
      // Optional: Show success toast
    } catch (error) {
      console.error('Failed to save workflow:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedPhase = phases.find(p => p.id === selectedPhaseId)

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleAddPhase = () => {
    const newPhase: Phase = {
      id: `p${Date.now()}`,
      name: 'New Phase',
      type: 'review',
      rubric: []
    }
    setPhases([...phases, newPhase])
    setSelectedPhaseId(newPhase.id)
  }

  const handleDeletePhase = (id: string) => {
    setPhases(phases.filter(p => p.id !== id))
    if (selectedPhaseId === id) setSelectedPhaseId(null)
  }

  const updatePhase = (id: string, updates: Partial<Phase>) => {
    setPhases(phases.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const addEntryCriterion = (phaseId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return
    
    const newCriterion: EntryCriterion = {
      id: `ec${Date.now()}`,
      fieldId: availableFields[0]?.id || '',
      operator: 'equals',
      value: ''
    }
    
    updatePhase(phaseId, {
      entryCriteria: [...(phase.entryCriteria || []), newCriterion]
    })
  }

  const updateEntryCriterion = (phaseId: string, criterionId: string, updates: Partial<EntryCriterion>) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return
    
    const newCriteria = (phase.entryCriteria || []).map(c => c.id === criterionId ? { ...c, ...updates } : c)
    updatePhase(phaseId, { entryCriteria: newCriteria })
  }

  const removeEntryCriterion = (phaseId: string, criterionId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return
    
    const newCriteria = (phase.entryCriteria || []).filter(c => c.id !== criterionId)
    updatePhase(phaseId, { entryCriteria: newCriteria })
  }

  const toggleVisibleField = (phaseId: string, fieldId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return
    
    const currentFields = phase.visibleFields || []
    const newFields = currentFields.includes(fieldId)
      ? currentFields.filter(id => id !== fieldId)
      : [...currentFields, fieldId]
      
    updatePhase(phaseId, { visibleFields: newFields })
  }

  const addRubricCategory = (phaseId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return

    const newCategory: RubricCategory = {
      id: `rc${Date.now()}`,
      name: 'New Category',
      points: 10
    }

    updatePhase(phaseId, {
      rubric: [...(phase.rubric || []), newCategory]
    })
  }

  const updateRubricCategory = (phaseId: string, catId: string, updates: Partial<RubricCategory>) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase || !phase.rubric) return

    const newRubric = phase.rubric.map(c => c.id === catId ? { ...c, ...updates } : c)
    updatePhase(phaseId, { rubric: newRubric })
  }

  const deleteRubricCategory = (phaseId: string, catId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase || !phase.rubric) return

    const newRubric = phase.rubric.filter(c => c.id !== catId)
    updatePhase(phaseId, { rubric: newRubric })
  }

  const addGuideline = (phaseId: string, catId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase || !phase.rubric) return

    const newGuideline: RubricGuideline = {
      id: `g${Date.now()}`,
      range: '0-5 pts',
      description: 'Criteria description'
    }

    const newRubric = phase.rubric.map(c => {
      if (c.id === catId) {
        return { ...c, guidelines: [...(c.guidelines || []), newGuideline] }
      }
      return c
    })
    updatePhase(phaseId, { rubric: newRubric })
  }

  const updateGuideline = (phaseId: string, catId: string, guidelineId: string, updates: Partial<RubricGuideline>) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase || !phase.rubric) return

    const newRubric = phase.rubric.map(c => {
      if (c.id === catId) {
        const newGuidelines = (c.guidelines || []).map(g => g.id === guidelineId ? { ...g, ...updates } : g)
        return { ...c, guidelines: newGuidelines }
      }
      return c
    })
    updatePhase(phaseId, { rubric: newRubric })
  }

  const deleteGuideline = (phaseId: string, catId: string, guidelineId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase || !phase.rubric) return

    const newRubric = phase.rubric.map(c => {
      if (c.id === catId) {
        const newGuidelines = (c.guidelines || []).filter(g => g.id !== guidelineId)
        return { ...c, guidelines: newGuidelines }
      }
      return c
    })
    updatePhase(phaseId, { rubric: newRubric })
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar: Phases List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Review Workflow</h2>
          <p className="text-sm text-gray-500">Define stages and scoring criteria</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-0 relative">
            {/* Connecting Line */}
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-100 z-0" />

            {phases.map((phase, index) => {
              const Config = PHASE_TYPE_CONFIG[phase.type]
              const Icon = Config.icon
              const isSelected = selectedPhaseId === phase.id

              return (
                <div 
                  key={phase.id}
                  onClick={() => setSelectedPhaseId(phase.id)}
                  className={cn(
                    "relative z-10 mb-4 pl-14 pr-4 py-3 rounded-xl border cursor-pointer transition-all group",
                    isSelected 
                      ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500" 
                      : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                  )}
                >
                  {/* Step Number / Icon */}
                  <div className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                    isSelected 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "bg-white border-gray-200 text-gray-400 group-hover:border-blue-300 group-hover:text-blue-500"
                  )}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <div className={cn("font-semibold text-sm", isSelected ? "text-gray-900" : "text-gray-700")}>
                        {phase.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide flex items-center gap-1", Config.bg, Config.color)}>
                          <Icon className="w-3 h-3" />
                          {Config.label}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase.id) }}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}

            <button 
              onClick={handleAddPhase}
              className="w-full py-3 ml-0 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 bg-gray-50/50 relative z-10"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Phase Configuration */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
        {selectedPhase ? (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPhase.name}</h2>
                  <p className="text-gray-500">Configure settings for this workflow stage</p>
                </div>
                <div className="flex gap-2">
                  <span className={cn("px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-2", PHASE_TYPE_CONFIG[selectedPhase.type].bg, PHASE_TYPE_CONFIG[selectedPhase.type].color, PHASE_TYPE_CONFIG[selectedPhase.type].border)}>
                    {PHASE_TYPE_CONFIG[selectedPhase.type].label} Stage
                  </span>
                </div>
              </div>

              {/* Collapsible: Phase Settings */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('settings')}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Stage Settings
                  </h3>
                  {openSections.settings ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                
                {openSections.settings && (
                  <div className="p-6 grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
                      <input 
                        type="text" 
                        value={selectedPhase.name}
                        onChange={(e) => updatePhase(selectedPhase.id, { name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea 
                        value={selectedPhase.description || ''}
                        onChange={(e) => updatePhase(selectedPhase.id, { description: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        rows={2}
                        placeholder="Describe the purpose of this stage..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stage Type</label>
                      <select 
                        value={selectedPhase.type}
                        onChange={(e) => updatePhase(selectedPhase.id, { type: e.target.value as any })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="review">Review (Scored)</option>
                        <option value="interview">Interview</option>
                        <option value="automated">Automated / Screening</option>
                        <option value="decision">Final Decision</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible: Timeline & Deadlines */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('timeline')}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    Timeline & Deadlines
                  </h3>
                  {openSections.timeline ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                
                {openSections.timeline && (
                  <div className="p-6 grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="date" 
                          value={selectedPhase.startDate || ''}
                          onChange={(e) => updatePhase(selectedPhase.id, { startDate: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date / Deadline</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="date" 
                          value={selectedPhase.endDate || ''}
                          onChange={(e) => updatePhase(selectedPhase.id, { endDate: e.target.value })}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Deadline Enforcement</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="deadlineType"
                            checked={selectedPhase.deadlineType === 'soft'}
                            onChange={() => updatePhase(selectedPhase.id, { deadlineType: 'soft' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="block text-sm font-medium text-gray-900">Soft Deadline</span>
                            <span className="block text-xs text-gray-500">Allow late submissions/reviews with a warning</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="deadlineType"
                            checked={selectedPhase.deadlineType === 'hard'}
                            onChange={() => updatePhase(selectedPhase.id, { deadlineType: 'hard' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="block text-sm font-medium text-gray-900">Hard Deadline</span>
                            <span className="block text-xs text-gray-500">Strictly lock actions after the deadline</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible: Entry Criteria */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('criteria')}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    Entry Criteria
                  </h3>
                  {openSections.criteria ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                
                {openSections.criteria && (
                  <div className="p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-sm text-gray-500">Define conditions that applications must meet to enter this stage.</p>
                    
                    {selectedPhase.entryCriteria?.map((criterion) => (
                      <div key={criterion.id} className="flex gap-2 items-center">
                        <select 
                          value={criterion.fieldId}
                          onChange={(e) => updateEntryCriterion(selectedPhase.id, criterion.id, { fieldId: e.target.value })}
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Select Field</option>
                          {availableFields.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                        <select 
                          value={criterion.operator}
                          onChange={(e) => updateEntryCriterion(selectedPhase.id, criterion.id, { operator: e.target.value as any })}
                          className="w-32 p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="equals">Equals</option>
                          <option value="not_equals">Not Equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater Than</option>
                          <option value="less_than">Less Than</option>
                          <option value="is_empty">Is Empty</option>
                          <option value="is_not_empty">Is Not Empty</option>
                        </select>
                        <input 
                          type="text" 
                          value={criterion.value}
                          onChange={(e) => updateEntryCriterion(selectedPhase.id, criterion.id, { value: e.target.value })}
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Value"
                        />
                        <button 
                          onClick={() => removeEntryCriterion(selectedPhase.id, criterion.id)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => addEntryCriterion(selectedPhase.id)}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Condition
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsible: Stage Views */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('views')}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-gray-400" />
                    Reviewer View
                  </h3>
                  {openSections.views ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                
                {openSections.views && (
                  <div className="p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-sm text-gray-500">Select which fields are visible to reviewers during this stage.</p>
                    
                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {availableFields.map((field) => (
                        <label key={field.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={(selectedPhase.visibleFields || []).includes(field.id)}
                            onChange={() => toggleVisibleField(selectedPhase.id, field.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 truncate">{field.label}</span>
                        </label>
                      ))}
                      {availableFields.length === 0 && (
                        <div className="col-span-2 text-center text-gray-400 text-sm py-4">
                          No fields found in this form.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible: Rubric Builder */}
              {(selectedPhase.type === 'review' || selectedPhase.type === 'interview') && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button 
                    onClick={() => toggleSection('rubric')}
                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-gray-400" />
                        Scoring Rubric
                      </h3>
                      <span className="text-sm text-gray-500 font-normal">
                        {selectedPhase.rubric?.length || 0} criteria • {selectedPhase.rubric?.reduce((a, b) => a + b.points, 0) || 0} pts total
                      </span>
                    </div>
                    {openSections.rubric ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>

                  {openSections.rubric && (
                    <div className="p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      {selectedPhase.rubric?.map((cat) => (
                        <div key={cat.id} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200 group hover:border-blue-300 transition-colors">
                          <div className="mt-3 text-gray-400 cursor-move">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-xs font-medium text-gray-500 uppercase">Category</label>
                                <input 
                                  type="text" 
                                  value={cat.name}
                                  onChange={(e) => updateRubricCategory(selectedPhase.id, cat.id, { name: e.target.value })}
                                  className="w-full mt-1 p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div className="w-24">
                                <label className="text-xs font-medium text-gray-500 uppercase">Points</label>
                                <input 
                                  type="number" 
                                  value={cat.points}
                                  onChange={(e) => updateRubricCategory(selectedPhase.id, cat.id, { points: parseInt(e.target.value) })}
                                  className="w-full mt-1 p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>
                            
                            {cat.description !== undefined ? (
                              <div className="mt-3">
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
                                  <button 
                                    onClick={() => updateRubricCategory(selectedPhase.id, cat.id, { description: undefined })}
                                    className="text-xs text-red-500 hover:text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <textarea 
                                  value={cat.description}
                                  onChange={(e) => updateRubricCategory(selectedPhase.id, cat.id, { description: e.target.value })}
                                  className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                  rows={2}
                                  placeholder="Enter scoring guidelines..."
                                />
                              </div>
                            ) : (
                              <button 
                                onClick={() => updateRubricCategory(selectedPhase.id, cat.id, { description: '' })}
                                className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                              >
                                <Plus className="w-3 h-3" />
                                Add Description
                              </button>
                            )}

                            {/* Guidelines Section */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-medium text-gray-500 uppercase">Scoring Guidelines</label>
                                <button 
                                  onClick={() => addGuideline(selectedPhase.id, cat.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Level
                                </button>
                              </div>
                              <div className="space-y-2">
                                {cat.guidelines?.map((guide) => (
                                  <div key={guide.id} className="flex gap-2 items-start">
                                    <input 
                                      type="text" 
                                      value={guide.range}
                                      onChange={(e) => updateGuideline(selectedPhase.id, cat.id, guide.id, { range: e.target.value })}
                                      className="w-24 p-1.5 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-medium text-blue-600"
                                      placeholder="Range"
                                    />
                                    <input 
                                      type="text" 
                                      value={guide.description}
                                      onChange={(e) => updateGuideline(selectedPhase.id, cat.id, guide.id, { description: e.target.value })}
                                      className="flex-1 p-1.5 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                      placeholder="Description"
                                    />
                                    <button 
                                      onClick={() => deleteGuideline(selectedPhase.id, cat.id, guide.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                {(!cat.guidelines || cat.guidelines.length === 0) && (
                                  <div className="text-xs text-gray-400 italic">No specific guidelines defined.</div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteRubricCategory(selectedPhase.id, cat.id)}
                            className="mt-7 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <button 
                        onClick={() => addRubricCategory(selectedPhase.id)}
                        className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Criterion
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Select a workflow stage to configure</p>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>
    </div>
  )
}
