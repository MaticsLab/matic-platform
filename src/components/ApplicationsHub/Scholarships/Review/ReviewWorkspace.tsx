'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Filter, ChevronRight, Star, MessageSquare, CheckCircle, XCircle, MoreHorizontal, Download, ChevronDown, Calculator, FileText, Users, Award, ArrowUpDown, Flag, ThumbsUp, ThumbsDown, AlertCircle, School, DollarSign, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { FormSubmission, Form } from '@/types/forms'

interface ReviewWorkspaceProps {
  workspaceId: string
  formId: string | null
}

type Phase = 'Phase 1: Application' | 'Phase 2: Screening' | 'Phase 2: Committee' | 'Phase 3: Interview' | 'Phase 4: Selection' | 'Awarded' | 'Rejected';
type SortOrder = 'newest' | 'score_high' | 'score_low';

const PHASES: Phase[] = ['Phase 1: Application', 'Phase 2: Screening', 'Phase 2: Committee', 'Phase 3: Interview', 'Phase 4: Selection', 'Awarded', 'Rejected'];

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
  phase: Phase;
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
  const [activeTab, setActiveTab] = useState<'application' | 'financials' | 'scoring'>('scoring')
  const [filterPhase, setFilterPhase] = useState<Phase | 'All'>('All')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [formSettings, setFormSettings] = useState<any>({})
  
  // State to track the "active" phase for scoring context
  const [scoringPhase, setScoringPhase] = useState<Phase>('Phase 2: Committee')
  
  // State for interactive scoring
  const [currentScores, setCurrentScores] = useState<Scores | null>(null)

  const [showGuidelines, setShowGuidelines] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!formId) return
      
      setIsLoading(true)
      try {
        // Fetch form settings first
        const form = await goClient.get<Form>(`/forms/${formId}`)
        const settings = form.settings || {}
        setFormSettings(settings)
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
            coa: 45000,
            pell: 0,
            stateGrants: 0,
            institutionalScholarships: 0,
            loans: 0,
            workStudy: 0,
            familyContribution: efc
          }
          
          // Initialize scores based on rubric
          const scores: Scores = {}
          if (settings.rubric) {
            settings.rubric.forEach((cat: any) => {
              scores[cat.id] = 0 // Initialize with 0 or fetch from saved scores if available
            })
          } else {
             // Default mock scores
             scores['academic'] = 0
             scores['financial'] = 0
             scores['essays'] = 0
             scores['extracurriculars'] = 0
             scores['recommendation'] = 0
          }

          const schoolField = mappings.school
          const school = schoolField ? data[schoolField] : (data['School'] || data['University'] || 'Undecided')

          return {
            id: sub.id,
            name: name || 'Unknown',
            gpa,
            phase: 'Phase 1: Application', // Default phase
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

  // Update scoring phase when app changes
  useMemo(() => {
    if (selectedApp) {
      setScoringPhase(selectedApp.phase)
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
      const matchesPhase = filterPhase === 'All' || app.phase === filterPhase
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
  }, [searchQuery, filterPhase, sortOrder])

  const calculateGap = (fin: Financials) => {
    const giftAid = fin.pell + fin.stateGrants + fin.institutionalScholarships
    return fin.coa - giftAid
  }

  const getNextPhase = (current: Phase) => {
    const idx = PHASES.indexOf(current);
    if (idx !== -1 && idx < PHASES.length - 1) return PHASES[idx + 1];
    return 'Completed';
  }

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white relative">
      {/* Guidelines Modal */}
      {showGuidelines && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Scoring Rubric Guidelines</h3>
              <button onClick={() => setShowGuidelines(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(formSettings.rubric || []).map((section: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-900">{section.category}</span>
                    <span className="text-sm text-gray-500">Max: {section.max} pts</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600">{section.description || 'No guidelines provided.'}</p>
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
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value as Phase | 'All')}
            >
              <option value="All">All Phases</option>
              <option value="Phase 1: Application">Phase 1: Application</option>
              <option value="Phase 2: Screening">Phase 2: Screening</option>
              <option value="Phase 2: Committee">Phase 2: Committee</option>
              <option value="Phase 3: Interview">Phase 3: Interview</option>
              <option value="Phase 4: Selection">Phase 4: Selection</option>
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
                <span className="text-xs font-medium text-gray-500">{app.phase}</span>
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
                      <button className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2">
                        Move to Next Phase
                        <ChevronRight className="w-4 h-4" />
                      </button>
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
                <div className="flex gap-3">
                  <button 
                    onClick={() => setActiveTab('application')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-2", 
                      activeTab === 'application' 
                        ? "bg-gray-900 text-white border-gray-900" 
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    Application
                  </button>
                  <button 
                    onClick={() => setActiveTab('financials')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-2", 
                      activeTab === 'financials' 
                        ? "bg-gray-900 text-white border-gray-900" 
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <Calculator className="w-4 h-4" />
                    Financial Analysis
                  </button>
                  <button 
                    onClick={() => setActiveTab('scoring')}
                    className={cn("px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-2", 
                      activeTab === 'scoring' 
                        ? "bg-gray-900 text-white border-gray-900" 
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <Award className="w-4 h-4" />
                    Scoring & Rubric
                  </button>
                </div>
                
                {activeTab === 'application' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Personal Statement</h3>
                      <p className="text-gray-700 leading-relaxed">
                        Growing up as a first-generation student, I always knew that education would be my path to making a difference. 
                        My passion for environmental science started when I volunteered at the local community garden...
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Academic Record</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-sm text-gray-500">High School</p><p className="font-medium">Lincoln High</p></div>
                        <div><p className="text-sm text-gray-500">Class Rank</p><p className="font-medium">12 / 450</p></div>
                        <div><p className="text-sm text-gray-500">SAT Score</p><p className="font-medium">1450</p></div>
                        <div><p className="text-sm text-gray-500">AP Courses</p><p className="font-medium">5 (All 4+)</p></div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'financials' && (
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

                {activeTab === 'scoring' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {scoringPhase === 'Phase 2: Committee' && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* Blue Header Banner */}
                      <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-medium">Phase 2: Committee Scoring</h3>
                          <div className="flex items-center gap-4 mt-1">
                            <p className="text-blue-100 text-sm">Evaluate the candidate based on the following criteria.</p>
                            <button 
                              onClick={() => setShowGuidelines(true)}
                              className="text-xs bg-blue-500/50 hover:bg-blue-500 text-white px-3 py-1 rounded-full font-medium flex items-center gap-1.5 transition-colors border border-blue-400/30"
                            >
                              <FileText className="w-3 h-3" />
                              View Guidelines
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-5xl font-bold">
                            {calculateTotalScore(currentScores)}
                            <span className="text-2xl text-blue-200 font-normal">/100</span>
                          </span>
                          <p className="text-xs text-blue-200 font-medium uppercase tracking-wide mt-1">Total Score</p>
                        </div>
                      </div>
                      
                      <div className="p-8 space-y-8">
                        {(formSettings.rubric || [
                          { id: 'academic', category: 'Academic Performance', max: 20, description: 'GPA, Test Scores, Course Rigor' },
                          { id: 'financial', category: 'Financial Need', max: 30, description: 'Gap amount, AGI, Extenuating circumstances' },
                          { id: 'essays', category: 'Essays', max: 25, description: 'Goals, Challenge overcome, Mission alignment' },
                          { id: 'extracurriculars', category: 'Extracurriculars', max: 15, description: 'Leadership, Community service, Impact' },
                          { id: 'recommendation', category: 'Letter of Recommendation', max: 10, description: 'Endorsement strength, Specific examples' },
                        ]).map((item: any) => (
                          <div key={item.id} className="group">
                            <div className="flex justify-between mb-3">
                              <div>
                                <span className="font-medium text-gray-900 block text-base">{item.category}</span>
                                <span className="text-xs text-gray-500">{item.description}</span>
                              </div>
                              <span className="font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                                {currentScores[item.id] || 0}/{item.max}
                              </span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max={item.max} 
                              value={currentScores[item.id] || 0} 
                              onChange={(e) => handleScoreChange(item.id, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-all"
                            />
                            <div className="flex justify-between mt-1 text-xs text-gray-400">
                              <span>0</span>
                              <span>{item.max}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="px-8 pb-8">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reviewer Comments</label>
                        <textarea 
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          rows={3}
                          placeholder="Add any additional context or feedback for the committee..."
                        />
                      </div>
                    </div>
                    )}

                    {scoringPhase === 'Phase 3: Interview' && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-purple-600 p-6 text-white flex justify-between items-center">
                          <div>
                            <h3 className="text-xl font-medium">Phase 3: Interview Scoring</h3>
                            <p className="text-purple-100 text-sm mt-1">Rate the candidate's interview performance.</p>
                          </div>
                          <span className="text-5xl font-bold">
                            {currentScores.interview || 0}
                            <span className="text-2xl text-purple-200 font-normal">/20</span>
                          </span>
                        </div>
                        <div className="p-8">
                          <div className="flex justify-between mb-3">
                            <div>
                              <span className="font-medium text-gray-900 block text-base">Interview Performance</span>
                              <span className="text-xs text-gray-500">Poise, Clarity of goals, Genuine need</span>
                            </div>
                            <span className="font-bold text-gray-900 bg-purple-50 text-purple-700 px-3 py-1 rounded-lg">
                              {currentScores.interview || 0}/20
                            </span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="20" 
                            value={currentScores.interview || 0} 
                            onChange={(e) => handleScoreChange('interview', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:accent-purple-700 transition-all"
                          />
                          <div className="flex justify-between mt-1 text-xs text-gray-400">
                            <span>0</span>
                            <span>20</span>
                          </div>
                        </div>
                        <div className="px-8 pb-8">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Interview Notes</label>
                          <textarea 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            rows={4}
                            placeholder="Record key takeaways from the interview..."
                          />
                        </div>
                      </div>
                    )}

                    {scoringPhase !== 'Phase 2: Committee' && scoringPhase !== 'Phase 3: Interview' && (
                      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                        <div className="p-3 bg-gray-50 rounded-full mb-3">
                          <Award className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 font-medium">No Rubric Configured</h3>
                        <p className="text-sm text-gray-500 mt-1">There is no active scoring rubric for {scoringPhase}.</p>
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
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2 shadow-sm">
                    <ThumbsUp className="w-4 h-4" />
                    Move to {getNextPhase(selectedApp.phase)}
                  </button>
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
