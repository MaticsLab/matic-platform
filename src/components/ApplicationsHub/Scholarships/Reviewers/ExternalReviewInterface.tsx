'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle, ChevronRight, AlertCircle, FileText, DollarSign, 
  GraduationCap, Info, X, Edit2, MessageSquare, Loader2,
  ChevronLeft, Star, Award, BookOpen, Users, Clock, Send,
  Eye, EyeOff, Sparkles
} from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { cn } from '@/lib/utils'

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
  financials: { gap: number | string; agi: string; pell: boolean }
  essays: { personal: string; challenge: string }
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
  { id: 'academic', category: 'Academic Excellence', max: 25, description: 'GPA, course rigor, academic achievements', criteria: [{ range: '21-25', desc: 'Exceptional academic record' }, { range: '15-20', desc: 'Strong academic performance' }, { range: '8-14', desc: 'Average academic record' }, { range: '0-7', desc: 'Below expectations' }] },
  { id: 'financial', category: 'Financial Need', max: 25, description: 'Demonstrated financial need and circumstances', criteria: [{ range: '21-25', desc: 'Significant financial need' }, { range: '15-20', desc: 'Moderate financial need' }, { range: '0-14', desc: 'Lower financial need' }] },
  { id: 'essays', category: 'Essay Quality', max: 25, description: 'Writing clarity, authenticity, and impact', criteria: [{ range: '21-25', desc: 'Compelling and authentic' }, { range: '15-20', desc: 'Clear and engaging' }, { range: '0-14', desc: 'Needs improvement' }] },
  { id: 'leadership', category: 'Leadership & Impact', max: 25, description: 'Community involvement and leadership', criteria: [{ range: '21-25', desc: 'Exceptional leadership' }, { range: '15-20', desc: 'Solid involvement' }, { range: '0-14', desc: 'Limited engagement' }] },
]

export function ExternalReviewInterface({ reviewerName, token }: ExternalReviewInterfaceProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [rubric, setRubric] = useState<RubricCategory[]>(DEFAULT_RUBRIC)
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  const [submitted, setSubmitted] = useState<string[]>([])
  const [showRubric, setShowRubric] = useState(false)
  const [rubricNotes, setRubricNotes] = useState<Record<string, Record<string, string>>>({})
  const [activeSection, setActiveSection] = useState<'overview' | 'essays' | 'activities'>('overview')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await goClient.get<{ form: Form; submissions: any[] }>(`/external-review/${token}`)
        const { form, submissions } = response
        const settings = form.settings || {}
        
        if (settings.rubric && Array.isArray(settings.rubric) && settings.rubric.length > 0) {
          setRubric(settings.rubric as RubricCategory[])
        }

        const mappedApps = submissions.map(sub => {
          const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data
          const metadata = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : sub.metadata || {}
          
          if (metadata.review || sub.status === 'reviewed') {
            setSubmitted(prev => prev.includes(sub.id) ? prev : [...prev, sub.id])
            if (metadata.review?.scores) setScores(prev => ({ ...prev, [sub.id]: metadata.review.scores }))
            if (metadata.review?.notes) setRubricNotes(prev => ({ ...prev, [sub.id]: metadata.review.notes }))
          }

          return {
            id: sub.id,
            redactedName: `Applicant ${sub.id.substring(0, 6).toUpperCase()}`,
            gpa: data.gpa || data.GPA || 'N/A',
            school: data.school || data.university || 'N/A',
            major: data.major || data.intended_major || 'N/A',
            financials: { gap: data.efc || data.financial_need || 0, agi: 'Redacted', pell: data.pell_eligible === 'yes' || data.pell === true },
            essays: { personal: data.personal_statement || data.essay || 'No essay provided.', challenge: data.challenge_essay || data.resilience || '' },
            activities: Array.isArray(data.activities) ? data.activities : [],
            data
          }
        })

        setApplications(mappedApps)
        
        const initialScores: Record<string, Record<string, number>> = {}
        mappedApps.forEach(app => {
          if (!scores[app.id]) {
            initialScores[app.id] = {}
            rubric.forEach(cat => { initialScores[app.id][cat.id] = 0 })
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
    if (token) fetchData()
  }, [token])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading your review session...</p>
        </div>
      </div>
    )
  }

  if (error || applications.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">{error || 'No applications available for review.'}</p>
        </div>
      </div>
    )
  }

  const currentApp = applications[currentIndex]
  const isSubmittedApp = submitted.includes(currentApp.id)
  const currentScore = scores[currentApp.id] || {}
  const totalScore = Object.values(currentScore).reduce((a, b) => a + b, 0)
  const maxScore = rubric.reduce((a, b) => a + b.max, 0)
  const scorePercent = Math.round((totalScore / maxScore) * 100)

  const handleScoreChange = (categoryId: string, value: number) => {
    if (isSubmittedApp) return
    setScores({ ...scores, [currentApp.id]: { ...currentScore, [categoryId]: value } })
  }

  const handleNoteChange = (categoryId: string, value: string) => {
    if (isSubmittedApp) return
    setRubricNotes({ ...rubricNotes, [currentApp.id]: { ...(rubricNotes[currentApp.id] || {}), [categoryId]: value } })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
        scores: currentScore,
        notes: rubricNotes[currentApp.id],
        status: 'reviewed'
      })
      setSubmitted([...submitted, currentApp.id])
      if (currentIndex < applications.length - 1) {
        setTimeout(() => setCurrentIndex(currentIndex + 1), 1000)
      }
    } catch (err) {
      console.error('Failed to submit:', err)
      alert('Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = () => setSubmitted(submitted.filter(id => id !== currentApp.id))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Scholarship Review Portal</h1>
                <p className="text-sm text-gray-500">Welcome, {reviewerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                <EyeOff className="w-4 h-4" />
                PII Protected
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                <span className="text-gray-500">Progress:</span>
                <span className="font-semibold text-gray-900">{submitted.length}/{applications.length}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Application Queue */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900 text-sm">Review Queue</h3>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{ width: `${(submitted.length / applications.length) * 100}%` }} />
                </div>
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
                {applications.map((app, idx) => {
                  const isDone = submitted.includes(app.id)
                  const isActive = idx === currentIndex
                  return (
                    <button key={app.id} onClick={() => setCurrentIndex(idx)} className={cn("w-full text-left p-3 rounded-xl mb-1 transition-all flex items-center justify-between", isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent")}>
                      <div>
                        <p className={cn("font-medium text-sm", isActive ? "text-blue-900" : "text-gray-900")}>{app.redactedName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.major}</p>
                      </div>
                      {isDone ? <CheckCircle className="w-5 h-5 text-green-500" /> : isActive ? <ChevronRight className="w-4 h-4 text-blue-500" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Middle Column - Application Content */}
          <div className="col-span-5 space-y-6">
            {/* Applicant Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">Application #{currentIndex + 1} of {applications.length}</p>
                    <h2 className="text-2xl font-bold">{currentApp.redactedName}</h2>
                    <p className="text-blue-100 mt-1">{currentApp.major} • {currentApp.school}</p>
                  </div>
                  {isSubmittedApp && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Reviewed</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50">
                <div className="p-4 text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{currentApp.gpa}</p>
                  <p className="text-xs text-gray-500">GPA</p>
                </div>
                <div className="p-4 text-center">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">${Number(currentApp.financials.gap).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Need Gap</p>
                </div>
                <div className="p-4 text-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{currentApp.financials.pell ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-gray-500">Pell Eligible</p>
                </div>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                {[
                  { id: 'overview', label: 'Overview', icon: Eye },
                  { id: 'essays', label: 'Essays', icon: FileText },
                  { id: 'activities', label: 'Activities', icon: Users }
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveSection(tab.id as any)} className={cn("flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors border-b-2", activeSection === tab.id ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700")}>
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="p-6">
                {activeSection === 'overview' && (
                  <div className="prose prose-sm max-w-none">
                    <h4 className="text-gray-900 font-semibold mb-3">Application Summary</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Intended Major</p>
                        <p className="font-medium text-gray-900">{currentApp.major}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">School</p>
                        <p className="font-medium text-gray-900">{currentApp.school}</p>
                      </div>
                    </div>
                    <p className="text-gray-600 mt-4 leading-relaxed">{currentApp.essays.personal.substring(0, 300)}...</p>
                  </div>
                )}
                
                {activeSection === 'essays' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        Personal Statement
                      </h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{currentApp.essays.personal}</p>
                    </div>
                    {currentApp.essays.challenge && (
                      <div className="pt-6 border-t border-gray-100">
                        <h4 className="text-gray-900 font-semibold mb-3">Challenge & Resilience</h4>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{currentApp.essays.challenge}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {activeSection === 'activities' && (
                  <div className="space-y-3">
                    <h4 className="text-gray-900 font-semibold mb-3">Extracurricular Activities</h4>
                    {currentApp.activities.length === 0 ? (
                      <p className="text-gray-500 text-sm">No activities listed.</p>
                    ) : (
                      currentApp.activities.map((act, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-900">{act.role}</p>
                            <p className="text-sm text-gray-500">{act.org}</p>
                          </div>
                          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">{act.duration}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Scoring */}
          <div className="col-span-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Evaluation</h3>
                  <p className="text-sm text-gray-500">Rate each category</p>
                </div>
                <button onClick={() => setShowRubric(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  Rubric
                </button>
              </div>

              {isSubmittedApp ? (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Review Complete</h3>
                  <p className="text-gray-500 mb-2">Score: {totalScore}/{maxScore}</p>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-6">
                    <div className={cn("h-full rounded-full", scorePercent >= 80 ? "bg-green-500" : scorePercent >= 60 ? "bg-blue-500" : "bg-amber-500")} style={{ width: `${scorePercent}%` }} />
                  </div>
                  <button onClick={handleEdit} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mx-auto">
                    <Edit2 className="w-4 h-4" />
                    Edit Review
                  </button>
                </div>
              ) : (
                <div className="p-5">
                  {/* Score Summary */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Total Score</span>
                      <span className="text-2xl font-bold text-blue-600">{totalScore}<span className="text-sm text-blue-400 font-normal">/{maxScore}</span></span>
                    </div>
                    <div className="w-full h-2 bg-blue-200/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${scorePercent}%` }} />
                    </div>
                  </div>

                  {/* Category Scores */}
                  <div className="space-y-5">
                    {rubric.map((cat) => (
                      <div key={cat.id} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{cat.category}</p>
                            <p className="text-xs text-gray-500">{cat.description}</p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{currentScore[cat.id] || 0}/{cat.max}</span>
                        </div>
                        <input type="range" min="0" max={cat.max} value={currentScore[cat.id] || 0} onChange={(e) => handleScoreChange(cat.id, parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                        <input type="text" value={rubricNotes[currentApp.id]?.[cat.id] || ''} onChange={(e) => handleNoteChange(cat.id, e.target.value)} placeholder="Add note..." className="w-full mt-2 text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                      </div>
                    ))}
                  </div>

                  {/* Submit Button */}
                  <button onClick={handleSubmit} disabled={isSubmitting} className="w-full mt-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                    ) : (
                      <><Send className="w-5 h-5" />Submit Review</>
                    )}
                  </button>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                      <ChevronLeft className="w-4 h-4" />Previous
                    </button>
                    <button onClick={() => setCurrentIndex(Math.min(applications.length - 1, currentIndex + 1))} disabled={currentIndex === applications.length - 1} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                      Next<ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rubric Modal */}
      {showRubric && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Scoring Guidelines</h3>
              <button onClick={() => setShowRubric(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {rubric.map((section) => (
                <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{section.category}</h4>
                    <span className="text-sm text-gray-500">Max: {section.max} pts</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {section.criteria?.map((crit, j) => (
                      <div key={j} className="px-4 py-3 flex gap-4">
                        <span className="text-sm font-semibold text-blue-600 w-20">{crit.range}</span>
                        <span className="text-sm text-gray-600">{crit.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowRubric(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
