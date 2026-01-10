'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, BarChart3, Workflow, Table2, FileText, ArrowRight, Loader2, Search, CheckCircle, Clock, ContactRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSessionToken } from '@/lib/supabase'
import { goClient } from '@/lib/api/go-client'
import { formsClient } from '@/lib/api/forms-client'
import { automationWorkflowsClient } from '@/lib/api/automation-workflows-client'
import { Input } from '@/ui-components/input'
import type { DataTable } from '@/types/data-tables'
import type { Form } from '@/types/forms'
import type { AutomationWorkflow } from '@/lib/api/automation-workflows-client'

const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'https://backend.maticslab.com/api/v1'

interface SidebarHoverPanelProps {
  hubType: 'data' | 'applications' | 'workflows' | 'crm'
  workspaceId: string
  isVisible: boolean
  onClose: () => void
}

export function SidebarHoverPanel({ hubType, workspaceId, isVisible, onClose }: SidebarHoverPanelProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all')

  useEffect(() => {
    if (!isVisible || !workspaceId) return

    const loadData = async () => {
      try {
        setLoading(true)
        
        switch (hubType) {
          case 'data': {
            const token = await getSessionToken()
            const response = await fetch(`${API_BASE}/tables?workspace_id=${workspaceId}`, {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            })
            if (response.ok) {
              const tables: DataTable[] = await response.json()
              const tablesArray = Array.isArray(tables) ? tables : []
              setData(tablesArray)
              setStats({
                total: tablesArray.length,
                totalRows: tablesArray.reduce((sum, t) => sum + (t.row_count || 0), 0),
                totalColumns: tablesArray.reduce((sum, t) => sum + (t.columns?.length || 0), 0),
              })
            }
            break
          }
          case 'applications': {
            const forms = await formsClient.list(workspaceId)
            const formsArray = Array.isArray(forms) ? forms : []
            setData(formsArray)
            setStats({
              total: formsArray.length,
              active: formsArray.filter((f: Form) => f.is_public || f.status === 'published').length,
              draft: formsArray.filter((f: Form) => !f.is_public || f.status === 'draft').length,
            })
            break
          }
          case 'workflows': {
            const workflows = await automationWorkflowsClient.list(workspaceId)
            const workflowsArray = Array.isArray(workflows) ? workflows : []
            setData(workflowsArray)
            setStats({
              total: workflowsArray.length,
            })
            break
          }
          case 'crm': {
            // TODO: Replace with actual CRM clients API call
            setData([])
            setStats({
              total: 0,
            })
            break
          }
        }
      } catch (error) {
        console.error(`Error loading ${hubType} data:`, error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [hubType, workspaceId, isVisible])

  if (!isVisible) return null

  const config = {
    data: {
      title: 'Database',
      icon: BarChart3,
      description: 'Manage your data tables',
      emptyMessage: 'No tables yet',
      emptyDescription: 'Create your first table to organize your data',
    },
    applications: {
      title: 'Programs',
      icon: GraduationCap,
      description: 'Manage your application programs',
      emptyMessage: 'No programs yet',
      emptyDescription: 'Create your first program to start collecting applications',
    },
    workflows: {
      title: 'Workflows',
      icon: Workflow,
      description: 'Automate your processes',
      emptyMessage: 'No workflows yet',
      emptyDescription: 'Create your first workflow to automate tasks',
    },
    crm: {
      title: 'CRM',
      icon: ContactRound,
      description: 'Manage your clients and contacts',
      emptyMessage: 'No clients yet',
      emptyDescription: 'Create your first client to start managing relationships',
    },
  }[hubType]

  const Icon = config?.icon || ContactRound

  // Filter data based on search and status
  const filteredData = (Array.isArray(data) ? data : []).filter((item) => {
    const matchesSearch = !searchQuery || 
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    if (hubType === 'applications') {
      const matchesFilter = filterStatus === 'all' || 
        (filterStatus === 'active' && (item.is_public || item.status === 'published')) ||
        (filterStatus === 'draft' && (!item.is_public || item.status === 'draft'))
      return matchesSearch && matchesFilter
    }
    
    return matchesSearch
  })

  return (
    <div
      className={cn(
        "w-56 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col max-h-[calc(100vh-2rem)] sidebar-hover-panel",
        "animate-in slide-in-from-left-2 fade-in-0 duration-200"
      )}
      onMouseLeave={onClose}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Search */}
      {hubType === 'applications' && (
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input 
              placeholder="Filter applications..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-gray-50/50 border-gray-200"
            />
          </div>
        </div>
      )}

      {hubType === 'data' && (
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input 
              placeholder="Search tables..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-gray-50/50 border-gray-200"
            />
          </div>
        </div>
      )}

      {hubType === 'crm' && (
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input 
              placeholder="Search clients..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-gray-50/50 border-gray-200"
            />
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="p-3 border-b border-gray-200">
          {hubType === 'applications' ? (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold text-gray-900">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  Active
                </span>
                <span className="font-semibold text-green-600">{stats.active}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Draft
                </span>
                <span className="font-semibold text-gray-600">{stats.draft}</span>
              </div>
            </div>
          ) : hubType === 'data' ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">Overview</div>
              <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-blue-50 text-blue-700 font-medium">
                <span>All Tables</span>
                <span className="text-xs text-blue-600">{stats.total}</span>
              </div>
              <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600">
                <span>Total Rows</span>
                <span className="text-xs text-gray-400">{stats.totalRows || 0}</span>
              </div>
              <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600">
                <span>Total Columns</span>
                <span className="text-xs text-gray-400">{stats.totalColumns || 0}</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold text-gray-900">{stats.total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Filter - Only for Applications */}
      {hubType === 'applications' && (
        <div className="p-3 space-y-1.5 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Status</span>
          <div className="space-y-0.5">
            {[
              { value: 'all' as const, label: 'All Applications' },
              { value: 'active' as const, label: 'Active' },
              { value: 'draft' as const, label: 'Draft' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors",
                  filterStatus === option.value
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content - List of items */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">{config?.emptyMessage || 'No items'}</p>
            <p className="text-xs text-gray-500">{config?.emptyDescription || ''}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredData.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {hubType === 'data' && <Table2 className="w-4 h-4 text-gray-600" />}
                  {hubType === 'applications' && <FileText className="w-4 h-4 text-gray-600" />}
                  {hubType === 'workflows' && <Workflow className="w-4 h-4 text-gray-600" />}
                  {hubType === 'crm' && <ContactRound className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.name || 'Unnamed'}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
            {filteredData.length > 10 && (
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  +{filteredData.length - 10} more
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

