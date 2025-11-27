'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Filter, ChevronRight, Star, MessageSquare, CheckCircle, XCircle, MoreHorizontal, Download, ChevronDown, Calculator, FileText, Users, Award, ArrowUpDown, Flag, ThumbsUp, ThumbsDown, AlertCircle, School, DollarSign, Loader2, Settings, Plus, Trash2, Edit2, Save, Layout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { FormSubmission, Form } from '@/types/forms'
import { workflowsClient, ApplicationStage } from '@/lib/api/workflows-client'

interface ReviewWorkspaceProps {
  workspaceId: string
  formId: string | null
}

interface ReviewView {
  id: string;
  label: string;
  type: 'application' | 'financials' | 'scoring';
}

// Workflow Types
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
}

type SortOrder = 'newest' | 'score_high' | 'score_low';

interface Financials {
  coa: number;
  pell: number;
  stateGrants: number;
  institutionalScholarships: number;
  loans: number;
  workStudy: number;
  familyContribution: number;
}

interface Scores {
  [key: string]: number;
}

interface Application {
  id: string;
  name: string;
  gpa: number;
  phaseId: string; // ID of the current phase
  phaseName: string; // Display name
  status: 'pending' | 'approved' | 'rejected';
  submissionDate: string;
  tags: string[];
  financials: Financials;
  scores: Scores;
  chosenSchool: string;
  raw_data: any; // Store original submission data
}

export function ReviewWorkspace({ workspaceId, formId }: ReviewWorkspaceProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const [views, setViews] = useState<ReviewView[]>([
    { id: 'v1', label: 'Application', type: 'application' },
    { id: 'v2', label: 'Financial Analysis', type: 'financials' },
    { id: 'v3', label: 'Scoring & Rubric', type: 'scoring' },
  ])
  const [activeViewId, setActiveViewId] = useState<string>('v1')
  const [isViewBuilderOpen, setIsViewBuilderOpen] = useState(false)
  const [isSavingViews, setIsSavingViews] = useState(false)

  const [phases, setPhases] = useState<Phase[]>([])
  const [filterPhaseId, setFilterPhaseId] = useState<string>('All')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [formSettings, setFormSettings] = useState<any>({})
  
  // State to track the "active" phase for scoring context
  const [scoringPhaseId, setScoringPhaseId] = useState<string | null>(null)
  
  // State for interactive scoring
  const [currentScores, setCurrentScores] = useState<Scores | null>(null)

  const [showGuidelines, setShowGuidelines] = useState(false)

  // View Builder State
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [tempViewLabel, setTempViewLabel] = useState('')

  useEffect(() => {
    async function fetchData() {
      if (!formId || !workspaceId) return
      
      setIsLoading(true)
      try {
        // Fetch form settings first
        const form = await goClient.get<Form>(`/forms/${formId}`)
        const settings = form.settings || {}
        setFormSettings(settings)
        
        // Load Phases from Workflow API (connected to WorkflowBuilder)
        let loadedPhases: Phase[] = []
        
        // Try to get workflow ID from form settings
        const workflowId = settings.workflow_id || settings.workflow?.id
        
        if (workflowId) {
          // Fetch stages from the workflow
          const stages = await workflowsClient.listStages(workspaceId, workflowId)
          
          // Transform ApplicationStage to Phase format
          loadedPhases = stages.map((stage: ApplicationStage, index: number) => ({
            id: stage.id,
            name: stage.name,
            type: stage.stage_type === 'review' ? 'review' : 'automated',
            description: stage.description || undefined,
            rubric: [] // Can be loaded from rubric if configured
          }))
        } else if (settings.workflow && settings.workflow.phases) {
          // Fallback to old format
          loadedPhases = settings.workflow.phases
        }
        
        setPhases(loadedPhases)

        if (settings.views && Array.isArray(settings.views) && settings.views.length > 0) {
          setViews(settings.views)
          setActiveViewId(settings.views[0].id)
        }
        
        const mappings = settings.mappings || {}

        const submissions = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
        
        // Transform submissions to Application format
        const transformedApps: Application[] = submissions.map((sub: FormSubmission) => {
          const data = sub.data || {}
          
          // Use mappings if available, otherwise fallbacks
          const name = mappings.name ? data[mappings.name] : (data['Full Name'] || data['name'] || data['Name'] || `Applicant ${sub.id.substring(0, 6)}`)
          
          // Try to find GPA
          const gpaField = mappings.gpa
          const gpaVal = gpaField ? data[gpaField] : (data['GPA'] || data['gpa'])
          const gpa = parseFloat(gpaVal || '0') || 0
          
          // Mock financials for now as they might not be in the form
          const efcField = mappings.efc
          const efcVal = efcField ? data[efcField] : (data['EFC'] || data['SAI'])
          const efc = parseFloat(efcVal || '0') || 0

          const financials: Financials = {
            coa: 45000, // TODO: Make dynamic based on school selection if possible
            pell: 0,
            stateGrants: 0,
            institutionalScholarships: 0,
            loans: 0,
            workStudy: 0,
            familyContribution: efc
          }
          
          // Determine Phase
          // In a real app, this would be stored in the submission metadata or a separate status table
          // For now, we default to the first phase if available
          const currentPhaseId = loadedPhases.length > 0 ? loadedPhases[0].id : 'p1'
          const currentPhaseName = loadedPhases.find(p => p.id === currentPhaseId)?.name || 'Application'

          // Initialize scores based on rubric of the current phase
          const scores: Scores = {}
          // We might want to load saved scores here
          
          const schoolField = mappings.school
          const school = schoolField ? data[schoolField] : (data['School'] || data['University'] || 'Undecided')

          return {
            id: sub.id,
            name: name || 'Unknown',
            gpa,
            phaseId: currentPhaseId,
            phaseName: currentPhaseName,
            status: 'pending',
            submissionDate: new Date(sub.submitted_at).toLocaleDateString(),
            tags: [],
            financials,
            scores,
            chosenSchool: school,
            raw_data: data
          }
        })
        
        setApplications(transformedApps)
        if (transformedApps.length > 0) {
          setSelectedAppId(transformedApps[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [formId])

  const selectedApp = applications.find(app => app.id === selectedAppId)
  const activeView = views.find(v => v.id === activeViewId) || views[0]

  // Update scoring phase when app changes
  useMemo(() => {
    if (selectedApp) {
      setScoringPhaseId(selectedApp.phaseId)
      setCurrentScores(selectedApp.scores)
    }
  }, [selectedApp])

  const calculateTotalScore = (scores: Scores) => {
    return Object.values(scores).reduce((sum, val) => sum + (val || 0), 0)
  }

  const handleScoreChange = (category: string, value: number) => {
    if (currentScores) {
      setCurrentScores({ ...currentScores, [category]: value })
    }
  }

  const filteredApps = useMemo(() => {
    let result = applications.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPhase = filterPhaseId === 'All' || app.phaseId === filterPhaseId
      return matchesSearch && matchesPhase
    })

    return result.sort((a, b) => {
      if (sortOrder === 'score_high') {
        return calculateTotalScore(b.scores) - calculateTotalScore(a.scores)
      } else if (sortOrder === 'score_low') {
        return calculateTotalScore(a.scores) - calculateTotalScore(b.scores)
      } else {
        // Default to newest (mock date parsing or just id for now)
        return b.id.localeCompare(a.id)
      }
    })
  }, [searchQuery, filterPhaseId, sortOrder, applications])

  const calculateGap = (fin: Financials) => {
    const giftAid = fin.pell + fin.stateGrants + fin.institutionalScholarships
    return fin.coa - giftAid
  }

  const getNextPhase = (currentId: string) => {
    const idx = phases.findIndex(p => p.id === currentId);
    if (idx !== -1 && idx < phases.length - 1) return phases[idx + 1];
    return null;
  }

  const handleAddView = () => {
    const newView: ReviewView = {
      id: `v${Date.now()}`,
      label: 'New View',
      type: 'application'
    }
    setViews([...views, newView])
    setEditingViewId(newView.id)
    setTempViewLabel(newView.label)
  }

  const handleDeleteView = (id: string) => {
    const newViews = views.filter(v => v.id !== id)
    setViews(newViews)
    if (activeViewId === id && newViews.length > 0) {
      setActiveViewId(newViews[0].id)
    }
  }

  const handleSaveViewLabel = (id: string) => {
    setViews(views.map(v => v.id === id ? { ...v, label: tempViewLabel } : v))
    setEditingViewId(null)
  }

  const handleChangeViewType = (id: string, type: ReviewView['type']) => {
    setViews(views.map(v => v.id === id ? { ...v, type } : v))
  }

  const saveViewsToBackend = async () => {
    if (!formId) return
    setIsSavingViews(true)
    try {
      const newSettings = { ...formSettings, views }
      await goClient.patch(`/forms/${formId}`, { settings: newSettings })
      setFormSettings(newSettings)
    } catch (error) {
      console.error('Failed to save views:', error)
    } finally {
      setIsSavingViews(false)
    }
  }

  // Get current phase configuration
  const currentPhaseConfig = phases.find(p => p.id === scoringPhaseId)
  const currentRubric = currentPhaseConfig?.rubric || []
  const maxScore = currentRubric.reduce((sum, cat) => sum + cat.points, 0)

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white relative">
      {/* View Builder Modal */}
      {isViewBuilderOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">View Builder</h3>
              </div>
              <button onClick={() => setIsViewBuilderOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-4">Customize the tabs and views available in the review workspace.</p>
              
              <div className="space-y-3">
                {views.map((view) => (
                  <div key={view.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white hover:border-blue-300 transition-colors">
                    <div className="p-2 bg-gray-100 rounded-md text-gray-500">
                      {view.type === 'application' && <FileText className="w-4 h-4" />}
                      {view.type === 'financials' && <Calculator className="w-4 h-4" />}
                      {view.type === 'scoring' && <Award className="w-4 h-4" />}
                    </div>
                    
                    <div className="flex-1">
                      {editingViewId === view.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={tempViewLabel}
                            onChange={(e) => setTempViewLabel(e.target.value)}
                            className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => handleSaveViewLabel(view.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{view.label}</span>
                          <button 
                            onClick={() => { setEditingViewId(view.id); setTempViewLabel(view.label); }}
                            className="text-gray-400 hover:text-blue-600"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Type:</span>
                        <select 
                          value={view.type}
                          onChange={(e) => handleChangeViewType(view.id, e.target.value as ReviewView['type'])}
                          className="text-xs border-none bg-transparent p-0 text-blue-600 font-medium focus:ring-0 cursor-pointer"
                        >
                          <option value="application">Application Data</option>
                          <option value="financials">Financial Analysis</option>
                          <option value="scoring">Scoring Rubric</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeleteView(view.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={views.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleAddView}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New View
              </button>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => {
                  saveViewsToBackend()
                  setIsViewBuilderOpen(false)
                }}
                disabled={isSavingViews}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingViews && <Loader2 className="w-4 h-4 animate-spin" />}
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guidelines Modal */}
      {showGuidelines && currentPhaseConfig && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Scoring Rubric Guidelines</h3>
              <button onClick={() => setShowGuidelines(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentRubric.map((section, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-900">{section.name}</span>
                    <span className="text-sm text-gray-500">Max: {section.points} pts</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-3">{section.description || 'No description provided.'}</p>
                    {section.guidelines && section.guidelines.length > 0 && (
                      <div className="space-y-2">
                        {section.guidelines.map(g => (
                          <div key={g.id} className="flex gap-3 text-sm">
                            <span className="font-medium text-blue-600 min-w-[80px]">{g.range}</span>
                            <span className="text-gray-700">{g.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowGuidelines(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar: Application List */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-gray-200 bg-white space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search applicants..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select 
              className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterPhaseId}
              onChange={(e) => setFilterPhaseId(e.target.value)}
            >
              <option value="All">All Phases</option>
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="relative">
              <select 
                className="appearance-none pl-8 pr-4 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <option value="newest">Newest</option>
                <option value="score_high">Highest Score</option>
                <option value="score_low">Lowest Score</option>
              </select>
              <ArrowUpDown className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              onClick={() => setSelectedAppId(app.id)}
              className={cn(
                "p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors group",
                selectedAppId === app.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'bg-white border-l-4 border-l-transparent'
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className={cn("font-semibold", selectedAppId === app.id ? 'text-blue-900' : 'text-gray-900')}>
                  {app.name}
                </h4>
                <span className="text-xs text-gray-500">{app.submissionDate}</span>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                <span className="text-xs font-medium text-gray-500">{app.phaseName}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                    app.status === 'approved' ? 'bg-green-100 text-green-700' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  )}>
                    {app.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {app.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {app.status === 'pending' && <AlertCircle className="w-3 h-3" />}
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-600 ml-auto">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {calculateTotalScore(app.scores)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {app.tags.map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {filteredApps.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              No applications found matching your filters.
            </div>
          )}
        </div>
      </div>

      {/* Right Content: Detail & Scoring */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        {selectedApp && currentScores ? (
          <>
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto space-y-6">
                
                {/* Header Card */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedApp.name}</h2>
                    <div className="flex gap-3">
                      <button className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm flex items-center gap-2">
                        <Flag className="w-4 h-4" />
                        Flag
                      </button>
                      {getNextPhase(selectedApp.phaseId) && (
                        <button className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2">
                          Move to {getNextPhase(selectedApp.phaseId)?.name}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-gray-400" /> 
                      GPA: <span className="font-medium text-gray-900">{selectedApp.gpa}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <School className="w-4 h-4 text-gray-400" /> 
                      School: <span className="font-medium text-gray-900">{selectedApp.chosenSchool}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      Gap: <span className="font-medium text-red-600">${calculateGap(selectedApp.financials).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-3 items-center">
                  <div className="flex gap-2">
                    {views.map(view => (
                      <button 
                        key={view.id}
                        onClick={() => setActiveViewId(view.id)}
                        className={cn("px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-2", 
                          activeViewId === view.id 
                            ? "bg-gray-900 text-white border-gray-900" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {view.type === 'application' && <FileText className="w-4 h-4" />}
                        {view.type === 'financials' && <Calculator className="w-4 h-4" />}
                        {view.type === 'scoring' && <Award className="w-4 h-4" />}
                        {view.label}
                      </button>
                    ))}
                  </div>
                  <div className="h-6 w-px bg-gray-300 mx-1"></div>
                  <button 
                    onClick={() => setIsViewBuilderOpen(true)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Configure Views"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                
                {activeView.type === 'application' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Application Data</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(selectedApp.raw_data || {}).map(([key, value]) => {
                          if (typeof value === 'object') return null; // Skip complex objects for now
                          return (
                            <div key={key} className="border-b border-gray-50 pb-2 last:border-0">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{key}</p>
                              <p className="text-gray-900 whitespace-pre-wrap">{String(value)}</p>
                            </div>
                          )
                        })}
                        {(!selectedApp.raw_data || Object.keys(selectedApp.raw_data).length === 0) && (
                           <p className="text-gray-500 italic">No application data available.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeView.type === 'financials' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6">Financial Need Calculation</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="font-medium text-gray-700">Costs & Contribution</h4>
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">Cost of Attendance (COA)</span>
                            <span className="font-semibold">${selectedApp.financials.coa.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">Family Contribution (EFC/SAI)</span>
                            <span className="font-semibold">${selectedApp.financials.familyContribution.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium text-gray-700">Gift Aid (Grants & Scholarships)</h4>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Pell Grant</span>
                            <span className="font-medium text-green-700">+ ${selectedApp.financials.pell.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">State Grants (MAP)</span>
                            <span className="font-medium text-green-700">+ ${selectedApp.financials.stateGrants.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Institutional Scholarships</span>
                            <span className="font-medium text-green-700">+ ${selectedApp.financials.institutionalScholarships.toLocaleString()}</span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 flex justify-between items-center font-medium">
                            <span>Total Gift Aid</span>
                            <span className="text-green-700">${(selectedApp.financials.pell + selectedApp.financials.stateGrants + selectedApp.financials.institutionalScholarships).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-bold text-blue-900">Remaining Need Gap</h4>
                            <p className="text-sm text-blue-700 mt-1">COA - Total Gift Aid (Loans/Work-Study excluded)</p>
                          </div>
                          <div className="text-3xl font-bold text-blue-700">
                            ${calculateGap(selectedApp.financials).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeView.type === 'scoring' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {currentPhaseConfig && currentRubric.length > 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Header Banner */}
                        <div className={cn("p-6 text-white flex justify-between items-center", 
                          currentPhaseConfig.type === 'interview' ? 'bg-purple-600' : 'bg-blue-600'
                        )}>
                          <div>
                            <h3 className="text-xl font-medium">{currentPhaseConfig.name} Scoring</h3>
                            <div className="flex items-center gap-4 mt-1">
                              <p className={cn("text-sm", currentPhaseConfig.type === 'interview' ? 'text-purple-100' : 'text-blue-100')}>
                                Evaluate the candidate based on the following criteria.
                              </p>
                              <button 
                                onClick={() => setShowGuidelines(true)}
                                className={cn("text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 transition-colors border",
                                  currentPhaseConfig.type === 'interview' 
                                    ? "bg-purple-500/50 hover:bg-purple-500 border-purple-400/30" 
                                    : "bg-blue-500/50 hover:bg-blue-500 border-blue-400/30"
                                )}
                              >
                                <FileText className="w-3 h-3" />
                                View Guidelines
                              </button>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-5xl font-bold">
                              {calculateTotalScore(currentScores)}
                              <span className={cn("text-2xl font-normal", currentPhaseConfig.type === 'interview' ? 'text-purple-200' : 'text-blue-200')}>/{maxScore}</span>
                            </span>
                            <p className={cn("text-xs font-medium uppercase tracking-wide mt-1", currentPhaseConfig.type === 'interview' ? 'text-purple-200' : 'text-blue-200')}>Total Score</p>
                          </div>
                        </div>
                        
                        <div className="p-8 space-y-8">
                          {currentRubric.map((item) => (
                            <div key={item.id} className="group">
                              <div className="flex justify-between mb-3">
                                <div>
                                  <span className="font-medium text-gray-900 block text-base">{item.name}</span>
                                  <span className="text-xs text-gray-500">{item.description}</span>
                                </div>
                                <span className="font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                                  {currentScores[item.id] || 0}/{item.points}
                                </span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max={item.points} 
                                value={currentScores[item.id] || 0} 
                                onChange={(e) => handleScoreChange(item.id, parseInt(e.target.value))}
                                className={cn("w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer transition-all",
                                  currentPhaseConfig.type === 'interview' ? "accent-purple-600 hover:accent-purple-700" : "accent-blue-600 hover:accent-blue-700"
                                )}
                              />
                              <div className="flex justify-between mt-1 text-xs text-gray-400">
                                <span>0</span>
                                <span>{item.points}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="px-8 pb-8">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Reviewer Comments</label>
                          <textarea 
                            className={cn("w-full p-3 border border-gray-300 rounded-lg focus:ring-2 outline-none text-sm",
                              currentPhaseConfig.type === 'interview' ? "focus:ring-purple-500" : "focus:ring-blue-500"
                            )}
                            rows={3}
                            placeholder="Add any additional context or feedback..."
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                        <div className="p-3 bg-gray-50 rounded-full mb-3">
                          <Award className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 font-medium">No Rubric Configured</h3>
                        <p className="text-sm text-gray-500 mt-1">There is no active scoring rubric for {currentPhaseConfig?.name || 'this phase'}.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
            
            {/* Sticky Footer for Actions */}
            <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
               <div className="flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>All required fields reviewed</span>
               </div>
               <div className="flex gap-3">
                  <button className="px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 flex items-center gap-2">
                    <ThumbsDown className="w-4 h-4" />
                    Reject
                  </button>
                  {getNextPhase(selectedApp.phaseId) ? (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2 shadow-sm">
                      <ThumbsUp className="w-4 h-4" />
                      Move to {getNextPhase(selectedApp.phaseId)?.name}
                    </button>
                  ) : (
                    <button className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 flex items-center gap-2 shadow-sm">
                      <CheckCircle className="w-4 h-4" />
                      Finalize Decision
                    </button>
                  )}
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select an application to review
          </div>
        )}
      </div>
    </div>
  )
}
