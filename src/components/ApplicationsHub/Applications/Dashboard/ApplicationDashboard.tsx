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

  return (
    <div className="h-full overflow-auto p-6">
      {/* ... existing code ... */}
      <div className="flex gap-3">

          {/* ... existing buttons ... */}
      </div>

      {/* ... existing grid ... */}


    </div>
  )
}
