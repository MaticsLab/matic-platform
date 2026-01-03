'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, BarChart3, Workflow, Table2, FileText, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSessionToken } from '@/lib/supabase'
import { goClient } from '@/lib/api/go-client'
import { formsClient } from '@/lib/api/forms-client'
import { automationWorkflowsClient } from '@/lib/api/automation-workflows-client'
import type { DataTable } from '@/types/data-tables'
import type { Form } from '@/types/forms'
import type { AutomationWorkflow } from '@/lib/api/automation-workflows-client'

const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'https://backend.maticslab.com/api/v1'

interface SidebarHoverPanelProps {
  hubType: 'data' | 'applications' | 'workflows'
  workspaceId: string
  isVisible: boolean
  onClose: () => void
}

export function SidebarHoverPanel({ hubType, workspaceId, isVisible, onClose }: SidebarHoverPanelProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

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
              setData(tables || [])
              setStats({
                total: tables.length,
                totalRows: tables.reduce((sum, t) => sum + (t.row_count || 0), 0),
                totalColumns: tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0),
              })
            }
            break
          }
          case 'applications': {
            const forms = await formsClient.list(workspaceId)
            setData(forms || [])
            setStats({
              total: forms.length,
              published: forms.filter((f: Form) => f.status === 'published').length,
              draft: forms.filter((f: Form) => f.status === 'draft').length,
            })
            break
          }
          case 'workflows': {
            const workflows = await automationWorkflowsClient.list(workspaceId)
            setData(workflows || [])
            setStats({
              total: workflows.length,
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
  }[hubType]

  const Icon = config.icon

  return (
    <div
      className={cn(
        "w-80 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col max-h-[calc(100vh-2rem)] sidebar-hover-panel",
        "animate-in slide-in-from-left-2 fade-in-0 duration-200"
      )}
      onMouseLeave={onClose}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{config.title}</h3>
            <p className="text-xs text-gray-500">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total: </span>
              <span className="font-semibold text-gray-900">{stats.total}</span>
            </div>
            {stats.totalRows !== undefined && (
              <div>
                <span className="text-gray-600">Rows: </span>
                <span className="font-semibold text-gray-900">{stats.totalRows}</span>
              </div>
            )}
            {stats.totalColumns !== undefined && (
              <div>
                <span className="text-gray-600">Columns: </span>
                <span className="font-semibold text-gray-900">{stats.totalColumns}</span>
              </div>
            )}
            {stats.published !== undefined && (
              <div>
                <span className="text-gray-600">Published: </span>
                <span className="font-semibold text-green-600">{stats.published}</span>
              </div>
            )}
            {stats.draft !== undefined && (
              <div>
                <span className="text-gray-600">Draft: </span>
                <span className="font-semibold text-gray-600">{stats.draft}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">{config.emptyMessage}</p>
            <p className="text-xs text-gray-500">{config.emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {hubType === 'data' && <Table2 className="w-4 h-4 text-gray-600" />}
                  {hubType === 'applications' && <FileText className="w-4 h-4 text-gray-600" />}
                  {hubType === 'workflows' && <Workflow className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.name || 'Unnamed'}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                  )}
                  {hubType === 'data' && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(item.row_count || 0)} rows • {(item.columns?.length || 0)} columns
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
            {data.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  +{data.length - 5} more {hubType === 'data' ? 'tables' : hubType === 'applications' ? 'programs' : 'workflows'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

