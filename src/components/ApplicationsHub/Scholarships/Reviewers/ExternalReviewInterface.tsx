'use client'

import { useState } from 'react'
import { CheckCircle, ChevronRight, AlertCircle, FileText, DollarSign, GraduationCap, Info, X, Edit2, MessageSquare } from 'lucide-react'

interface ExternalReviewInterfaceProps {
  reviewerName: string
  token: string
}

// Mock Data for External Review
const mockApplications = [
  {
    id: 'APP-2025-892',
    redactedName: 'Applicant #892',
    gpa: 3.8,
    school: 'University of Illinois',
    major: 'Environmental Science',
    financials: {
      gap: 12500,
      agi: 'Redacted (< $45k)',
      pell: true
    },
    essays: {
      personal: "Growing up in a community where green spaces were scarce, I realized early on the impact of environment on mental health. My goal is to design urban landscapes that...",
      challenge: "During my sophomore year, I had to take on a part-time job to support my family while maintaining my grades. This taught me time management..."
    },
    activities: [
      { role: 'President', org: 'Eco Club', duration: '2 years' },
      { role: 'Volunteer', org: 'City Food Pantry', duration: '4 years' }
    ]
  },
  {
    id: 'APP-2025-904',
    redactedName: 'Applicant #904',
    gpa: 3.5,
    school: 'Michigan State',
    major: 'Nursing',
    financials: {
      gap: 8200,
      agi: 'Redacted (< $60k)',
      pell: true
    },
    essays: {
      personal: "Healthcare has always been my calling. After witnessing the shortage of nurses in my community...",
      challenge: "Balancing varsity sports and AP Chemistry was my biggest academic hurdle..."
    },
    activities: [
      { role: 'Captain', org: 'Varsity Soccer', duration: '3 years' },
      { role: 'Member', org: 'HOSA', duration: '2 years' }
    ]
  },
  {
    id: 'APP-2025-915',
    redactedName: 'Applicant #915',
    gpa: 3.2,
    school: 'DePaul University',
    major: 'Computer Science',
    financials: {
      gap: 15000,
      agi: 'Redacted (< $35k)',
      pell: true
    },
    essays: {
      personal: "Technology is the great equalizer. I want to build tools that help underserved communities access resources...",
      challenge: "My family immigrated when I was 10, and learning a new language while keeping up with school was incredibly difficult..."
    },
    activities: [
      { role: 'Member', org: 'Robotics Team', duration: '3 years' },
      { role: 'Tutor', org: 'Math Lab', duration: '1 year' }
    ]
  }
]

const rubricGuidelines = [
  {
    category: 'Academic Performance',
    points: 20,
    criteria: [
      { range: '18-20 pts', desc: 'GPA 3.5+, rigorous AP/IB workload, strong test scores' },
      { range: '14-17 pts', desc: 'GPA 3.0-3.4, solid college prep curriculum' },
      { range: '10-13 pts', desc: 'GPA 2.7-2.9, meets basic requirements' }
    ]
  },
  {
    category: 'Financial Need',
    points: 30,
    criteria: [
      { range: '25-30 pts', desc: 'High gap (>$10k), Pell eligible, significant hardship' },
      { range: '15-24 pts', desc: 'Moderate gap ($5k-$10k), some family contribution' },
      { range: '0-14 pts', desc: 'Low gap (<$5k) or high family contribution' }
    ]
  },
  {
    category: 'Essay Quality',
    points: 25,
    criteria: [
      { range: '21-25 pts', desc: 'Compelling narrative, clear goals, authentic voice' },
      { range: '15-20 pts', desc: 'Good structure, addresses prompt, some generic elements' },
      { range: '0-14 pts', desc: 'Lacks focus, grammatical errors, short' }
    ]
  },
  {
    category: 'Leadership',
    points: 15,
    criteria: [
      { range: '13-15 pts', desc: 'Significant impact, sustained commitment, initiative' },
      { range: '8-12 pts', desc: 'Active participation, some leadership roles' },
      { range: '0-7 pts', desc: 'Minimal involvement' }
    ]
  },
  {
    category: 'Recommendation',
    points: 10,
    criteria: [
      { range: '9-10 pts', desc: 'Strong endorsement, specific examples of character' },
      { range: '6-8 pts', desc: 'Positive but generic' },
      { range: '0-5 pts', desc: 'Neutral or reserved' }
    ]
  }
]

export function ExternalReviewInterface({ reviewerName, token }: ExternalReviewInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scores, setScores] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState<string[]>([])
  const [showRubric, setShowRubric] = useState(false)
  
  // New State
  const [rubricNotes, setRubricNotes] = useState<Record<string, Record<string, string>>>({})
  const [appComments, setAppComments] = useState<Record<string, Record<string, string>>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})

  const currentApp = mockApplications[currentIndex]
  const isSubmitted = submitted.includes(currentApp.id)
  const currentScore = scores[currentApp.id] || { academic: 0, financial: 0, essays: 0, activities: 0, rec: 0 }

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

  const handleRubricNoteChange = (category: string, note: string) => {
    if (isSubmitted) return
    setRubricNotes({
      ...rubricNotes,
      [currentApp.id]: {
        ...(rubricNotes[currentApp.id] || {}),
        [category]: note
      }
    })
  }

  const handleAppCommentChange = (section: string, comment: string) => {
    if (isSubmitted) return
    setAppComments({
      ...appComments,
      [currentApp.id]: {
        ...(appComments[currentApp.id] || {}),
        [section]: comment
      }
    })
  }

  const handleSubmit = () => {
    setSubmitted([...submitted, currentApp.id])
    if (currentIndex < mockApplications.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 1500)
    }
  }

  const handleEdit = () => {
    setSubmitted(submitted.filter(id => id !== currentApp.id))
  }

  const totalScore = Object.values(currentScore).reduce((a: any, b: any) => a + b, 0) as number

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
              <span className="font-medium text-gray-900">{submitted.length} / {mockApplications.length}</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${(submitted.length / mockApplications.length) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {mockApplications.map((app, idx) => {
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
                        {[
                          { id: 'academic', label: 'Academic Performance', max: 20, desc: 'GPA, Course Rigor' },
                          { id: 'financial', label: 'Financial Need', max: 30, desc: 'Gap amount, Circumstances' },
                          { id: 'essays', label: 'Essay Quality', max: 25, desc: 'Clarity, Goals, Voice' },
                          { id: 'activities', label: 'Leadership', max: 15, desc: 'Impact, Commitment' },
                          { id: 'rec', label: 'Recommendation', max: 10, desc: 'Teacher endorsement' },
                        ].map((field) => (
                          <div key={field.id} className="p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                            <div className="flex justify-between mb-2">
                              <div>
                                <span className="font-medium text-gray-900 block text-sm">{field.label}</span>
                                <span className="text-xs text-gray-500">{field.desc}</span>
                              </div>
                              <span className="font-medium text-gray-700 text-sm">
                                {currentScore[field.id]}/{field.max}
                              </span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max={field.max} 
                              value={currentScore[field.id]}
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
                {rubricGuidelines.map((section, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="font-bold text-gray-900">{section.category}</h4>
                      <span className="text-sm font-medium text-gray-500">Max: {section.points} pts</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {section.criteria.map((crit, j) => (
                        <div key={j} className="px-4 py-3 flex gap-4">
                          <span className="text-sm font-bold text-blue-600 w-24 flex-shrink-0">{crit.range}</span>
                          <span className="text-sm text-gray-600">{crit.desc}</span>
                        </div>
                      ))}
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
