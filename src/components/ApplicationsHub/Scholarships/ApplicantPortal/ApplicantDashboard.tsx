'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Clock, FileText, Upload, Calendar, Mail, ChevronRight, AlertCircle, Download, Send, ArrowLeft, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock Applicant Data
const MOCK_APPLICANT = {
  id: 'APP-2025-101',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  program: 'Future Leaders Scholarship 2025'
}

import { ApplicationForm, MOCK_APPLICATION_STATE } from './ApplicationForm'

type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'phase_2_screening' | 'interview' | 'decision'
type ViewState = 'dashboard' | 'application_form'

export function ApplicantDashboard() {
  const [status, setStatus] = useState<ApplicationStatus>('draft')
  const [view, setView] = useState<ViewState>('dashboard')
  const [showConfetti, setShowConfetti] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  
  // Form Data
  const [tasks, setTasks] = useState({
    application: 'pending',
    terms: 'pending'
  })
  
  // Mock Phase 2 Data
  const [documents, setDocuments] = useState([
    { id: 1, name: 'Official Transcript', status: 'pending' },
    { id: 2, name: 'Financial Aid Report', status: 'pending' }
  ])

  const handleSubmit = () => {
    setStatus('submitted')
    setShowConfetti(true)
    
    // Simulate Email Sending
    setTimeout(() => {
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    }, 1000)

    // Simulate moving to review after a delay
    setTimeout(() => {
      setStatus('under_review')
    }, 2000)
  }

  const handleFileUpload = (id: number) => {
    setDocuments(docs => docs.map(d => d.id === id ? { ...d, status: 'uploaded' } : d))
  }

  // Demo Control: Simulate Admin moving applicant to Phase 2
  const simulatePhase2 = () => {
    setStatus('phase_2_screening')
    // Trigger email notification logic here in real app
    setEmailSent(true)
    setTimeout(() => setEmailSent(false), 3000)
  }

  if (view === 'application_form') {
    return <ApplicationForm onBack={() => setView('dashboard')} initialData={MOCK_APPLICATION_STATE} />
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
            <span className="font-semibold text-gray-900">Matic Scholarship Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{MOCK_APPLICANT.name}</div>
              <div className="text-xs text-gray-500">{MOCK_APPLICANT.id}</div>
            </div>
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
              {MOCK_APPLICANT.name.charAt(0)}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        
        {/* Status Banner */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'draft' && `Welcome back, ${MOCK_APPLICANT.name.split(' ')[0]}!`}
              {status === 'submitted' && 'Application Submitted!'}
              {status === 'under_review' && 'Application Under Review'}
              {status === 'phase_2_screening' && 'Action Required: Phase 2 Unlocked'}
              {status === 'interview' && 'Interview Invitation'}
            </h1>
            <p className="text-gray-600 max-w-2xl">
              {status === 'draft' && 'Complete your application for the Future Leaders Scholarship before the deadline on Nov 30.'}
              {status === 'submitted' && 'We have received your application. You will receive a confirmation email shortly.'}
              {status === 'under_review' && 'Our committee is currently reviewing your submission. No action is needed at this time.'}
              {status === 'phase_2_screening' && 'Congratulations! You have advanced to the next round. Please upload the additional documents below.'}
            </p>
          </div>
          
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-16 -mt-16 z-0" />
          <div className="absolute bottom-0 right-20 w-32 h-32 bg-yellow-50 rounded-full -mb-10 z-0" />
        </div>

        {/* Email Notification Toast */}
        {emailSent && (
          <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
            <Mail className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium text-sm">Email Notification Sent</p>
              <p className="text-xs text-gray-400">To: {MOCK_APPLICANT.email}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Workflow & Tasks */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Timeline */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-6">Application Progress</h3>
              <div className="relative">
                {/* Connecting Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-100" />
                
                <div className="space-y-8 relative">
                  <TimelineItem 
                    status={status === 'draft' ? 'current' : 'completed'}
                    title="Application Submission"
                    date="Due Nov 30"
                    icon={FileText}
                  />
                  <TimelineItem 
                    status={status === 'under_review' ? 'current' : (['phase_2_screening', 'interview', 'decision'].includes(status) ? 'completed' : 'upcoming')}
                    title="Committee Review"
                    date="Dec 1 - Dec 15"
                    icon={Users}
                  />
                  <TimelineItem 
                    status={status === 'phase_2_screening' ? 'current' : (['interview', 'decision'].includes(status) ? 'completed' : 'upcoming')}
                    title="Phase 2: Documents"
                    date="Due Dec 20"
                    icon={Upload}
                  />
                  <TimelineItem 
                    status={status === 'interview' ? 'current' : (status === 'decision' ? 'completed' : 'upcoming')}
                    title="Final Interview"
                    date="Jan 5 - Jan 10"
                    icon={Calendar}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Task Area */}
            {status === 'draft' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Pending Tasks</h3>
                  <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    {Object.values(tasks).filter(t => t === 'pending').length} Remaining
                  </span>
                </div>
                <div className="space-y-3">
                  <TaskItem 
                    title="Complete Application Form" 
                    status={tasks.application as 'pending' | 'completed'} 
                    onClick={() => setView('application_form')}
                  />
                  <TaskItem 
                    title="Sign Terms & Conditions" 
                    status={tasks.terms as 'pending' | 'completed'} 
                    onClick={() => setTasks(prev => ({ ...prev, terms: 'completed' }))} // Mock completion
                  />
                </div>
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <button 
                    onClick={handleSubmit}
                    disabled={Object.values(tasks).some(t => t === 'pending')}
                    className={cn(
                      "w-full py-3 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2",
                      Object.values(tasks).some(t => t === 'pending') 
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                    )}
                  >
                    Submit Application
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {status === 'phase_2_screening' && (
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-6 shadow-sm animate-in fade-in zoom-in duration-300">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg">Phase 2 Requirements Unlocked</h3>
                    <p className="text-blue-700 text-sm mt-1">Please upload the following documents to proceed to the interview stage.</p>
                  </div>
                </div>

                <div className="space-y-3 bg-white rounded-xl p-4 border border-blue-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${doc.status === 'uploaded' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {doc.status === 'uploaded' ? <CheckCircle className="w-5 h-5" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <span className="font-medium text-gray-700">{doc.name}</span>
                      </div>
                      {doc.status === 'pending' ? (
                        <button 
                          onClick={() => handleFileUpload(doc.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Upload
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Uploaded</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Info & Support */}
          <div className="space-y-6">
            {/* Application Summary Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Application Summary</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Program</span>
                  <span className="font-medium text-gray-900 text-right">Future Leaders 2025</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Submitted</span>
                  <span className="font-medium text-gray-900">{status === 'draft' ? '-' : 'Nov 25, 2025'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium capitalize px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              {status !== 'draft' && (
                <button className="w-full mt-4 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              )}
            </div>

            {/* Support Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-sm text-gray-500 mb-4">Contact the scholarship committee if you have questions about your application status.</p>
              <button className="w-full py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                Contact Support
              </button>
            </div>

            {/* Demo Controls (For Reviewer/Dev) */}
            <div className="mt-8 p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
              <div className="flex items-center gap-2 mb-2 text-gray-500">
                <Settings className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Demo Controls</span>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setStatus('draft')
                    setTasks({ application: 'pending', terms: 'pending' })
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-200 rounded"
                >
                  Reset to Draft
                </button>
                <button 
                  onClick={simulatePhase2}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-200 rounded flex justify-between items-center"
                >
                  Simulate Admin: Move to Phase 2
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setStatus('interview')}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-200 rounded"
                >
                  Simulate Admin: Invite to Interview
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

// Helper Components
function TimelineItem({ status, title, date, icon: Icon }: { status: 'completed' | 'current' | 'upcoming', title: string, date: string, icon: any }) {
  return (
    <div className="flex gap-4 relative z-10">
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors",
        status === 'completed' ? "bg-green-100 border-green-50 text-green-600" :
        status === 'current' ? "bg-blue-600 border-blue-100 text-white shadow-lg shadow-blue-200" :
        "bg-white border-gray-100 text-gray-300"
      )}>
        {status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
      </div>
      <div className="pt-1">
        <h4 className={cn("font-medium", status === 'upcoming' ? "text-gray-400" : "text-gray-900")}>{title}</h4>
        <p className="text-sm text-gray-500">{date}</p>
      </div>
    </div>
  )
}

function TaskItem({ title, status, onClick }: { title: string, status: 'pending' | 'completed', onClick?: () => void }) {
  return (
    <div 
      onClick={status === 'pending' ? onClick : undefined}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        status === 'pending' ? "bg-white border-gray-200 hover:border-blue-300 cursor-pointer hover:shadow-sm" : "bg-gray-50 border-gray-100"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-full border flex items-center justify-center",
        status === 'completed' ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
      )}>
        {status === 'completed' && <CheckCircle className="w-3 h-3" />}
      </div>
      <span className={cn("text-sm flex-1", status === 'completed' ? "text-gray-500 line-through" : "text-gray-700")}>
        {title}
      </span>
      {status === 'pending' && <ChevronRight className="w-4 h-4 text-gray-400" />}
    </div>
  )
}
