'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, ChevronRight, AlertCircle, FileText, DollarSign, GraduationCap, Info, X, Edit2, MessageSquare, Loader2 } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'

interface ExternalReviewInterfaceProps {
  reviewerName: string
  token: string
}

interface Application {
  id: string
  redactedName: string
  gpa: number | string
  school: string
  major: string
  financials: {
    gap: number | string
    agi: string
    pell: boolean
  }
  essays: {
    personal: string
    challenge: string
  }
  activities: Array<{ role: string; org: string; duration: string }>
  data: any
}

interface RubricCategory {
  id: string
  category: string
  max: number
  description: string
  criteria?: Array<{ range: string; desc: string }>
}

const DEFAULT_RUBRIC: RubricCategory[] = [
  { 
    id: 'academic', 
    category: 'Academic Performance', 
    max: 20, 
    description: 'GPA, Course Rigor',
    criteria: [
      { range: '18-20', desc: 'Exceptional academic record, rigorous coursework' },
      { range: '15-17', desc: 'Strong academic record, some rigorous coursework' },
      { range: '10-14', desc: 'Average academic record' },
      { range: '0-9', desc: 'Below average academic record' }
    ]
  },
  { 
    id: 'financial', 
    category: 'Financial Need', 
    max: 30, 
    description: 'Gap amount, Circumstances',
    criteria: [
      { range: '25-30', desc: 'High financial need, significant gap' },
      { range: '15-24', desc: 'Moderate financial need' },
      { range: '0-14', desc: 'Low financial need' }
    ]
  },
  { 
    id: 'essays', 
    category: 'Essay Quality', 
    max: 25, 
    description: 'Clarity, Goals, Voice',
    criteria: [
      { range: '21-25', desc: 'Compelling, clear, and authentic voice' },
      { range: '15-20', desc: 'Clear and well-written' },
      { range: '0-14', desc: 'Lacks clarity or depth' }
    ]
  },
  { 
    id: 'activities', 
    category: 'Leadership', 
    max: 15, 
    description: 'Impact, Commitment',
    criteria: [
      { range: '13-15', desc: 'Significant leadership and impact' },
      { range: '8-12', desc: 'Some leadership or consistent involvement' },
      { range: '0-7', desc: 'Little to no involvement' }
    ]
  },
  { 
    id: 'rec', 
    category: 'Recommendation', 
    max: 10, 
    description: 'Teacher endorsement',
    criteria: [
      { range: '9-10', desc: 'Strongly enthusiastic endorsement' },
      { range: '6-8', desc: 'Positive endorsement' },
      { range: '0-5', desc: 'Neutral or negative endorsement' }
    ]
  },
]

export function ExternalReviewInterface({ reviewerName, token }: ExternalReviewInterfaceProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [rubric, setRubric] = useState<RubricCategory[]>(DEFAULT_RUBRIC)
  const [reviewConfig, setReviewConfig] = useState<Record<string, { visible: boolean; redact: boolean }>>({})
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  const [submitted, setSubmitted] = useState<string[]>([])
  const [showRubric, setShowRubric] = useState(false)
  
  const [rubricNotes, setRubricNotes] = useState<Record<string, Record<string, string>>>({})
  const [appComments, setAppComments] = useState<Record<string, Record<string, string>>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // Fetch data from public endpoint
        const response = await goClient.get<{ form: Form; submissions: any[] }>(`/external-review/${token}`)
        
        const { form, submissions } = response
        
        // Parse settings
        const settings = form.settings || {}
        if (settings.rubric && Array.isArray(settings.rubric) && settings.rubric.length > 0) {
          setRubric(settings.rubric as RubricCategory[])
        }
        if (settings.reviewConfig) {
          setReviewConfig(settings.reviewConfig as any)
        }

        // Map submissions to applications
        const mappedApps = submissions.map(sub => {
          const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data
          const metadata = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : sub.metadata || {}
          
          // Check if already reviewed
          if (metadata.review || sub.status === 'reviewed') {
            setSubmitted(prev => {
              if (!prev.includes(sub.id)) return [...prev, sub.id]
              return prev
            })
            if (metadata.review?.scores) {
              setScores(prev => ({ ...prev, [sub.id]: metadata.review.scores }))
            }
            if (metadata.review?.notes) {
              setRubricNotes(prev => ({ ...prev, [sub.id]: metadata.review.notes }))
            }
            if (metadata.review?.comments) {
              setAppComments(prev => ({ ...prev, [sub.id]: metadata.review.comments }))
            }
          }

          // Map fields based on mappings or default logic
          const mappings = settings.mappings || {}
          
          const getValue = (key: string, fallbackKeys: string[]) => {
            if (mappings[key] && data[mappings[key]]) return data[mappings[key]]
            for (const k of fallbackKeys) {
              if (data[k]) return data[k]
            }
            return 'N/A'
          }

          return {
            id: sub.id,
            redactedName: `Applicant #${sub.id.substring(0, 8)}`,
            gpa: getValue('gpa', ['gpa', 'GPA', 'grade_point_average']),
            school: getValue('school', ['school', 'university', 'college', 'high_school']),
            major: getValue('major', ['major', 'intended_major', 'program']),
            financials: {
              gap: getValue('efc', ['efc', 'sai', 'financial_need']),
              agi: 'Redacted',
              pell: data.pell_eligible === 'yes' || data.pell === true
            },
            essays: {
              personal: getValue('personal_statement', ['personal_statement', 'essay', 'statement']),
              challenge: getValue('challenge', ['challenge_essay', 'resilience'])
            },
            activities: Array.isArray(data.activities) ? data.activities : [],
            data: data
          }
        })

        setApplications(mappedApps)
        
        // Initialize scores for all apps
        const initialScores: Record<string, Record<string, number>> = {}
        mappedApps.forEach(app => {
          if (!initialScores[app.id]) {
            initialScores[app.id] = {}
            // Initialize with 0 for each rubric category if not already set
            rubric.forEach(cat => {
              initialScores[app.id][cat.id] = 0
            })
          }
        })
        setScores(prev => ({ ...initialScores, ...prev }))

      } catch (err) {
        console.error('Failed to fetch review data:', err)
        setError('Invalid review token or session expired.')
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      fetchData()
    }
  }, [token])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading review session...</p>
        </div>
      </div>
    )
  }

  if (error || applications.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">{error || 'No applications found for review.'}</p>
        </div>
      </div>
    )
  }

  const currentApp = applications[currentIndex]
  const isSubmitted = submitted.includes(currentApp.id)
  const currentScore = scores[currentApp.id] || {}

  const handleScoreChange = (category: string, value: number) => {
    if (isSubmitted) return
    setScores({
      ...scores,
      [currentApp.id]: {
        ...currentScore,
        [category]: value
      }
    })
  }

  const handleAppCommentChange = (sectionId: string, value: string) => {
    if (isSubmitted) return
    setAppComments({
      ...appComments,
      [currentApp.id]: {
        ...(appComments[currentApp.id] || {}),
        [sectionId]: value
      }
    })
  }

  const handleRubricNoteChange = (categoryId: string, value: string) => {
    if (isSubmitted) return
    setRubricNotes({
      ...rubricNotes,
      [currentApp.id]: {
        ...(rubricNotes[currentApp.id] || {}),
        [categoryId]: value
      }
    })
  }

  const handleSubmit = async () => {
    try {
      await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
        scores: currentScore,
        notes: rubricNotes[currentApp.id],
        comments: appComments[currentApp.id],
        status: 'reviewed'
      })

      setSubmitted([...submitted, currentApp.id])
      if (currentIndex < applications.length - 1) {
        setTimeout(() => setCurrentIndex(currentIndex + 1), 1500)
      }
    } catch (err) {
      console.error('Failed to submit review:', err)
      alert('Failed to submit review. Please try again.')
    }
  }

  const handleEdit = () => {
    setSubmitted(submitted.filter(id => id !== currentApp.id))
  }

  const totalScore = Object.values(currentScore).reduce((a: number, b: number) => a + b, 0)

  const renderSectionHeader = (title: string, sectionId: string) => {
    const hasComment = !!(appComments[currentApp.id]?.[sectionId])
    const isExpanded = expandedComments[sectionId]
    
    return (
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button 
            onClick={() => setExpandedComments(prev => ({...prev, [sectionId]: !prev[sectionId]}))}
            className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm ${hasComment ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            title="Add Comment"
          >
            <MessageSquare className="w-4 h-4" />
            {hasComment && <span className="text-xs font-medium">Note added</span>}
          </button>
        </div>
        {(isExpanded || hasComment) && (
          <textarea
            value={appComments[currentApp.id]?.[sectionId] || ''}
            onChange={(e) => handleAppCommentChange(sectionId, e.target.value)}
            placeholder={`Add notes about ${title.toLowerCase()}...`}
            className="w-full text-sm p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-yellow-50/50"
            rows={2}
            disabled={isSubmitted}
          />
        )}
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0 z-20 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Scholarship Review Portal</h1>
            <p className="text-xs text-gray-500">Welcome, {reviewerName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              <AlertCircle className="w-3 h-3" />
              PII Redacted
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Application List */}
        <aside className="w-72 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col z-10">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Your Queue</h3>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span className="font-medium text-gray-900">{submitted.length} / {applications.length}</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${(submitted.length / applications.length) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {applications.map((app, idx) => {
               const isAppSubmitted = submitted.includes(app.id)
               const isActive = idx === currentIndex
               return (
                 <button
                   key={app.id}
                   onClick={() => setCurrentIndex(idx)}
                   className={`w-full text-left p-3 rounded-lg text-sm transition-all flex justify-between items-center group ${
                     isActive 
                       ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm' 
                       : 'hover:bg-gray-50 text-gray-700'
                   }`}
                 >
                   <div>
                     <div className={`font-medium ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>{app.redactedName}</div>
                     <div className="text-xs opacity-70 mt-0.5">{app.id}</div>
                   </div>
                   {isAppSubmitted ? (
                     <CheckCircle className="w-4 h-4 text-green-500" />
                   ) : (
                     <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-400' : 'bg-gray-300 group-hover:bg-gray-400'}`}></div>
                   )}
                 </button>
               )
            })}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
           <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
              {/* Application Details (Left 2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Applicant Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{currentApp.redactedName}</h2>
                      <p className="text-gray-500">{currentApp.id}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Intended Major</div>
                      <div className="font-medium text-gray-900">{currentApp.major}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">GPA</p>
                        <p className="font-bold text-gray-900">{currentApp.gpa}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-lg text-green-600">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Need Gap</p>
                        <p className="font-bold text-gray-900">${currentApp.financials.gap.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pell Eligible</p>
                        <p className="font-bold text-gray-900">{currentApp.financials.pell ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Essays */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  {renderSectionHeader('Personal Statement', 'personal_statement')}
                  <p className="text-gray-700 leading-relaxed mb-6">{currentApp.essays.personal}</p>
                  
                  <div className="pt-4 border-t border-gray-100">
                    {renderSectionHeader('Challenge & Resilience', 'challenge')}
                    <p className="text-gray-700 leading-relaxed">{currentApp.essays.challenge}</p>
                  </div>
                </div>

                {/* Activities */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  {renderSectionHeader('Activities & Leadership', 'activities')}
                  <div className="space-y-3">
                    {currentApp.activities.map((act, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{act.role}, {act.org}</span>
                        <span className="text-sm text-gray-500">{act.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scoring Sidebar (Right 1 col) */}
              <div className="space-y-6">
                 {/* Scorecard */}
                 <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm sticky top-6">
                    {/* Header with Rubric Info Button */}
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900">Scorecard</h3>
                      <button 
                        onClick={() => setShowRubric(true)} 
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <Info className="w-4 h-4" />
                        Rubric Guide
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-end mb-6 pb-4 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Total Score</span>
                      <div className="text-3xl font-bold text-blue-600 leading-none">
                        {totalScore}<span className="text-sm text-gray-400 font-normal">/100</span>
                      </div>
                    </div>

                    {isSubmitted ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                          <CheckCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Review Submitted</h3>
                        <p className="text-gray-500 mt-2 mb-6 text-sm">Score: {totalScore}/100</p>
                        
                        <button 
                          onClick={handleEdit}
                          className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Review
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {rubric.map((field) => (
                          <div key={field.id} className="p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                            <div className="flex justify-between mb-2">
                              <div>
                                <span className="font-medium text-gray-900 block text-sm">{field.category}</span>
                                <span className="text-xs text-gray-500">{field.description}</span>
                              </div>
                              <span className="font-medium text-gray-700 text-sm">
                                {currentScore[field.id] || 0}/{field.max}
                              </span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max={field.max} 
                              value={currentScore[field.id] || 0}
                              onChange={(e) => handleScoreChange(field.id, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-2" 
                            />
                            <input
                              type="text"
                              value={rubricNotes[currentApp.id]?.[field.id] || ''}
                              onChange={(e) => handleRubricNoteChange(field.id, e.target.value)}
                              placeholder="Add note..."
                              className="w-full text-xs p-2 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                              disabled={isSubmitted}
                            />
                          </div>
                        ))}

                        <div className="pt-6 border-t border-gray-100">
                          <button 
                            onClick={handleSubmit}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                          >
                            Submit Review
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </main>
      </div>

      {/* Rubric Modal */}
      {showRubric && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Scoring Rubric Guidelines</h3>
              <button onClick={() => setShowRubric(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {rubric.map((section, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="font-bold text-gray-900">{section.category}</h4>
                      <span className="text-sm font-medium text-gray-500">Max: {section.max} pts</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {section.criteria && section.criteria.length > 0 ? (
                        section.criteria.map((crit, j) => (
                          <div key={j} className="px-4 py-3 flex gap-4">
                            <span className="text-sm font-bold text-blue-600 w-24 flex-shrink-0">{crit.range}</span>
                            <span className="text-sm text-gray-600">{crit.desc}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 italic">No specific criteria defined.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
              <button 
                onClick={() => setShowRubric(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
