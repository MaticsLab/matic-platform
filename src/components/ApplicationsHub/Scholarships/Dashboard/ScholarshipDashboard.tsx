'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Users, FileText, AlertCircle, Download, Filter, Clock, ArrowUpRight, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { FormSubmission, Form } from '@/types/forms'

interface ScholarshipDashboardProps {
  workspaceId: string
  formId: string | null
}

export function ScholarshipDashboard({ workspaceId, formId }: ScholarshipDashboardProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formSettings, setFormSettings] = useState<any>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        setIsLoading(true)
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFormSettings(form.settings || {})
        
        const data = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
        setSubmissions(data || [])
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [formId])

  // Calculate stats
  const totalApps = submissions.length
  const inScreening = submissions.filter(s => s.status === 'submitted' || s.status === 'reviewed').length
  const approved = submissions.filter(s => s.status === 'approved').length
  const rejected = submissions.filter(s => s.status === 'rejected').length

  const stats = [
    { label: 'Total Applications', value: totalApps.toString(), subtext: 'Phase 1: Open', icon: FileText, color: 'blue' },
    { label: 'In Screening', value: inScreening.toString(), subtext: 'Phase 2: Review', icon: Users, color: 'yellow' },
    { label: 'Finalists', value: approved.toString(), subtext: 'Phase 3: Interview', icon: CheckCircle2, color: 'purple' },
    { label: 'Awarded', value: '0', subtext: 'Phase 4: Selection', icon: BarChart3, color: 'green' },
  ]

  const mappings = formSettings.mappings || {}

  const smartFolders = [
    { name: 'Ready for Committee', count: submissions.filter(s => s.status === 'reviewed').length, color: 'bg-green-100 text-green-700' },
    { 
      name: 'High Need Gap (>$10k)', 
      count: submissions.filter(s => {
        const efcField = mappings.efc
        const efcVal = efcField ? s.data[efcField] : (s.data?.efc || s.data?.EFC || 0)
        return (parseFloat(efcVal) || 0) < 5000
      }).length, 
      color: 'bg-blue-100 text-blue-700' 
    },
    { name: 'Missing Documents', count: 0, color: 'bg-orange-100 text-orange-700' },
    { 
      name: 'Ineligible (GPA < 2.7)', 
      count: submissions.filter(s => {
        const gpaField = mappings.gpa
        const gpaVal = gpaField ? s.data[gpaField] : (s.data?.gpa || s.data?.GPA || 0)
        return (parseFloat(gpaVal) || 0) < 2.7
      }).length, 
      color: 'bg-red-100 text-red-700' 
    },
  ]

  const upcomingDeadlines = [
    { event: 'Application Deadline', date: 'Jan 30', daysLeft: 5, type: 'critical' },
    { event: 'Staff Pre-screening', date: 'Feb 7', daysLeft: 13, type: 'normal' },
    { event: 'Committee Scoring', date: 'Feb 14', daysLeft: 20, type: 'normal' },
    { event: 'Finalist Interviews', date: 'Feb 23', daysLeft: 29, type: 'normal' },
  ]

  const recentActivity = submissions.slice(0, 5).map(sub => {
    const nameField = mappings.name
    const name = nameField ? sub.data[nameField] : (sub.data?.studentName || sub.data?.['Full Name'] || 'Unknown Applicant')
    
    return {
      user: name,
      action: 'submitted application',
      time: new Date(sub.submitted_at).toLocaleDateString(),
      status: sub.status
    }
  })

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Top Actions */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scholarship Program Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Current Phase: <span className="font-medium text-blue-600">Phase 1 - Application Period</span> (Ends Jan 30)</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filter View
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg bg-${stat.color}-50`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {stat.subtext}
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Smart Folders */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Queues</h3>
            <div className="grid grid-cols-2 gap-4">
              {smartFolders.map((folder, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer group">
                  <span className="font-medium text-gray-700 group-hover:text-blue-700">{folder.name}</span>
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${folder.color}`}>
                    {folder.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Phase Timeline</h3>
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {upcomingDeadlines.map((item, i) => (
                  <div key={i} className="relative flex items-start gap-6 group">
                    <div className={`absolute left-8 w-3 h-3 rounded-full border-2 border-white transform -translate-x-1.5 mt-1.5 ${
                      item.type === 'critical' ? 'bg-red-500 ring-4 ring-red-100' : 'bg-blue-500 ring-4 ring-blue-100'
                    }`}></div>
                    <div className="w-16 text-sm font-medium text-gray-500 pt-1">{item.date}</div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 group-hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{item.event}</span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          item.type === 'critical' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.daysLeft} days left
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700">View All</button>
            </div>
            <div className="space-y-6">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex gap-3">
                  <div className="mt-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 bg-white rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Review Pending Apps</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </button>
              <button className="w-full text-left px-4 py-3 bg-white rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Send Reminders</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </button>
              <button className="w-full text-left px-4 py-3 bg-white rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Edit Rubric</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
