'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Users, FileText, AlertCircle, Download, Filter, Clock, ArrowUpRight, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { FormSubmission, Form, DashboardConfig, DashboardTile, LogicRule } from '@/types/forms'

interface ApplicationDashboardProps {
  workspaceId: string
  formId: string | null
}

export function ApplicationDashboard({ workspaceId, formId }: ApplicationDashboardProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formSettings, setFormSettings] = useState<any>({})
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        setIsLoading(true)
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFormSettings(form.settings || {})
        setDashboardConfig(form.settings?.dashboardConfig || null)
        
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

  const evaluateRule = (rule: LogicRule, data: any): boolean => {
    const value = data?.[rule.fieldId]
    const numValue = parseFloat(value)
    const ruleValue = rule.value
    const numRuleValue = parseFloat(ruleValue)

    switch (rule.operator) {
      case 'equals': return value == ruleValue
      case 'not_equals': return value != ruleValue
      case 'contains': return String(value).toLowerCase().includes(String(ruleValue).toLowerCase())
      case 'greater_than': return !isNaN(numValue) && !isNaN(numRuleValue) && numValue > numRuleValue
      case 'less_than': return !isNaN(numValue) && !isNaN(numRuleValue) && numValue < numRuleValue
      case 'is_empty': return !value || value === ''
      case 'is_not_empty': return !!value && value !== ''
      default: return false
    }
  }

  const calculateTileValue = (tile: DashboardTile, submissions: FormSubmission[]) => {
    const filtered = submissions.filter(sub => {
      if (!tile.filter || tile.filter.length === 0) return true
      // Check if it's a status check (special case for now until we have full field mapping)
      const statusRule = tile.filter.find(r => r.fieldId === 'status')
      if (statusRule) {
        if (statusRule.operator === 'equals' && sub.status !== statusRule.value) return false
      }

      // Check data fields
      const dataRules = tile.filter.filter(r => r.fieldId !== 'status')
      return dataRules.every(rule => evaluateRule(rule, sub.data))
    })
    
    if (tile.aggregation === 'sum' && tile.fieldId) {
      const fieldId = tile.fieldId
      return filtered.reduce((acc, sub) => acc + (parseFloat(sub.data[fieldId]) || 0), 0).toString()
    }
    
    return filtered.length.toString()
  }

  // Default configuration if none exists
  const defaultConfig: DashboardConfig = {
    tiles: [
      { id: '1', title: 'Total Applications', type: 'stat', icon: 'FileText', color: 'blue', filter: [] },
      { id: '2', title: 'In Screening', type: 'stat', icon: 'Users', color: 'yellow', filter: [{ id: 'f1', fieldId: 'status', operator: 'equals', value: 'submitted', action: 'show' }] }, // Simplified status check
      { id: '3', title: 'Finalists', type: 'stat', icon: 'CheckCircle2', color: 'purple', filter: [{ id: 'f2', fieldId: 'status', operator: 'equals', value: 'approved', action: 'show' }] },
      { id: '4', title: 'Awarded', type: 'stat', icon: 'BarChart3', color: 'green', filter: [{ id: 'f3', fieldId: 'status', operator: 'equals', value: 'awarded', action: 'show' }] },
      
      // Smart Folders
      { id: '5', title: 'Ready for Committee', type: 'folder', color: 'green', filter: [{ id: 'f4', fieldId: 'status', operator: 'equals', value: 'reviewed', action: 'show' }] },
      { id: '6', title: 'High Need Gap (<$5k EFC)', type: 'folder', color: 'blue', filter: [{ id: 'f5', fieldId: 'efc', operator: 'less_than', value: '5000', action: 'show' }] },
      { id: '7', title: 'Ineligible (GPA < 2.7)', type: 'folder', color: 'red', filter: [{ id: 'f6', fieldId: 'gpa', operator: 'less_than', value: '2.7', action: 'show' }] },
    ]
  }

  const activeConfig = dashboardConfig || defaultConfig

  const statsTiles = activeConfig.tiles.filter(t => t.type === 'stat')
  const folderTiles = activeConfig.tiles.filter(t => t.type === 'folder')

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'FileText': return FileText
      case 'Users': return Users
      case 'CheckCircle2': return CheckCircle2
      case 'BarChart3': return BarChart3
      default: return FileText
    }
  }

  const upcomingDeadlines = [
    { event: 'Application Deadline', date: 'Jan 30', daysLeft: 5, type: 'critical' },
    { event: 'Staff Pre-screening', date: 'Feb 7', daysLeft: 13, type: 'normal' },
    { event: 'Committee Scoring', date: 'Feb 14', daysLeft: 20, type: 'normal' },
    { event: 'Finalist Interviews', date: 'Feb 23', daysLeft: 29, type: 'normal' },
  ]

  const recentActivity = submissions.slice(0, 5).map(sub => {
    const nameField = formSettings.mappings?.name
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

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {statsTiles.map(tile => {
          const IconComponent = getIcon(tile.icon)
          const value = calculateTileValue(tile, submissions)
          return (
            <div key={tile.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[tile.color || 'blue']}`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500">{tile.title}</div>
            </div>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Smart Folders */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Smart Folders</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Configure
            </button>
          </div>
          <div className="space-y-3">
            {folderTiles.map(folder => {
              const count = calculateTileValue(folder, submissions)
              return (
                <div 
                  key={folder.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      folder.color === 'green' ? 'bg-green-500' :
                      folder.color === 'blue' ? 'bg-blue-500' :
                      folder.color === 'red' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`} />
                    <span className="font-medium text-gray-900">{folder.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">{count}</span>
                    <ArrowUpRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-4">
            {upcomingDeadlines.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  item.type === 'critical' ? 'bg-red-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">{item.event}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{item.date}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      item.daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.daysLeft}d left
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <Clock className="w-4 h-4 text-gray-400" />
        </div>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {activity.user.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{activity.user}</span>
                    <span className="text-gray-500 ml-1">{activity.action}</span>
                  </div>
                </div>
                <span className="text-sm text-gray-400">{activity.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  )
}
