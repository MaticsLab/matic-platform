'use client'

import { TabData } from '@/lib/tab-manager'
import { useTabContext } from './WorkspaceTabProvider'
import { FileText, Calendar, Users, Search, Plus, BarChart3, Folder, Clock, Layout, Inbox, Activity as ActivityIcon, LayoutGrid, GraduationCap, FileInput, Database, Settings, Filter, MoreHorizontal, ArrowRight, Pin, Eye, EyeOff } from 'lucide-react'
import { TablesListPage } from './Tables/TablesListPage'
import { TableGridView } from './Tables/TableGridView'
import { FormsListPage as FormsListComponent } from './Forms/FormsListPage'
import { ApplicationsHub } from './ApplicationsHub/ApplicationsHub'
import { ApplicantCRMPage } from './CRM/ApplicantCRMPage'
import { useState, useEffect } from 'react'
import { getWorkspaceStats } from '@/lib/api/reports-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'

interface TabContentRouterProps {
  tab?: TabData | null
  workspaceId: string
}

export function TabContentRouter({ tab: propTab, workspaceId }: TabContentRouterProps) {
  const { activeTab, tabManager } = useTabContext()
  
  // Use prop tab or context active tab
  const tab = propTab !== undefined ? propTab : activeTab

  if (!tab) {
    // No tab active - redirect to applications hub
    return <ApplicationsHub workspaceId={workspaceId} />
  }

  // Route tab content based on type and URL
  switch (tab.type) {
    case 'form':
      // Always show forms list
      return <FormsListComponent workspaceId={workspaceId} />
      
    case 'table':
      // Check if it's the tables list page or a specific table
      if (tab.url?.includes('/tables') && !tab.url?.includes('/tables/')) {
        return <TablesListPage workspaceId={workspaceId} />
      }
      // Individual table view - extract tableId from URL or metadata
      const tableId = tab.metadata?.tableId || tab.url?.split('/tables/')[1]
      if (tableId) {
        return (
          <TableGridView 
            tableId={tableId} 
            workspaceId={workspaceId} 
            onTableNameChange={(newName) => {
              if (tabManager && tab.id) {
                tabManager.updateTab(tab.id, { title: newName })
              }
            }}
          />
        )
      }
      // Fallback
      return (
        <div className="h-full p-6 bg-gray-50">
          <div className="h-full bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="font-medium mb-2">Table Not Found</p>
              <p className="text-sm">Unable to load table data</p>
            </div>
          </div>
        </div>
      )
      
    case 'custom':
      // Handle Applications Hub
      if (tab.url?.includes('/applications')) {
        return <ApplicationsHub workspaceId={workspaceId} />
      }

      // Handle Database/Tables hub
      if (tab.url?.includes('/tables') && !tab.url?.includes('/tables/')) {
        return <TablesListPage workspaceId={workspaceId} />
      }

      // Handle CRM - Applicant management
      if (tab.url?.includes('/crm')) {
        return <ApplicantCRMPage workspaceId={workspaceId} />
      }
      
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {tab.title}
            </h3>
            <p className="text-gray-600">
              Content type: {tab.type}
            </p>
          </div>
        </div>
      )
      
    default:
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {tab.title}
            </h3>
            <p className="text-gray-600">
              Content type: {tab.type}
            </p>
          </div>
        </div>
      )
  }
}
// Empty state when no tab is active
function EmptyTabState({ workspaceId }: { workspaceId: string }) {
  const quickActions = [
    {
      title: 'Create Table',
      description: 'Start organizing your data',
      icon: Database,
      action: 'new-table'
    },
    {
      title: 'Create Form',
      description: 'Build a new form',
      icon: FileText,
      action: 'new-form'
    },
    {
      title: 'Search Content',
      description: 'Find documents and data',
      icon: Search,
      action: 'search'
    }
  ]

  const handleQuickAction = (action: string) => {
    // These would trigger tab creation via the parent component
    console.log('Quick action:', action)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome to your workspace
          </h1>
          <p className="text-gray-600">
            Open a tab or create new content to get started
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.action}
              onClick={() => handleQuickAction(action.action)}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <action.icon size={20} className="text-purple-600" />
                <span className="font-medium text-gray-900 group-hover:text-blue-600">
                  {action.title}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {action.description}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">
            Keyboard shortcuts:
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span><kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs">⌘K</kbd> Search</span>
            <span><kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs">⌘T</kbd> New tab</span>
            <span><kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs">⌘W</kbd> Close tab</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Search results view
function SearchResultsView({ 
  query, 
  results, 
  workspaceId 
}: { 
  query: string
  results: any[]
  workspaceId: string 
}) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Search Results
          </h1>
          <p className="text-gray-600">
            Results for &quot;{query}&quot; ({results.length} found)
          </p>
        </div>

        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={result.id || index}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-gray-500 mt-1">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">
                      {result.title}
                    </h3>
                    {result.snippet && (
                      <p className="text-sm text-gray-600 mb-2">
                        {result.snippet}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="uppercase">{result.type}</span>
                      {result.score && (
                        <>
                          <span>•</span>
                          <span>{Math.round((1 - result.score) * 100)}% match</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Search size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No results found
            </h3>
            <p className="text-gray-600">
              Try adjusting your search query or explore other content.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Workspace Dashboard Component
function WorkspaceDashboard({ workspaceId }: { workspaceId: string }) {
  const { tabManager } = useTabContext()
  const [stats, setStats] = useState<any>(null)
  const [activityFeed, setActivityFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showHiddenHubs, setShowHiddenHubs] = useState(false)
  const [hubVisibility, setHubVisibility] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        
        // Check if current user is admin
        const { supabase } = await import('@/lib/supabase')
        const { authClient } = await import('@/lib/better-auth-client')
        const session = await authClient.getSession()
        const user = session?.data?.user
        if (user) {
          const { listWorkspaceMembers } = await import('@/lib/api/invitations-client')
          const members = await listWorkspaceMembers(workspaceId).catch(() => [])
          const currentMember = members.find(m => m.user_id === user.id)
          setIsAdmin(currentMember?.role === 'admin')
        }
        
        const [statsData, activityData] = await Promise.all([
          getWorkspaceStats(workspaceId).catch(() => null),
          workspacesClient.getActivity(workspaceId).catch(() => [])
        ])
        
        if (statsData) {
          setStats(statsData.stats)
        }
        if (activityData) {
          // Handle both array and object response formats
          const activities = Array.isArray(activityData) ? activityData : (activityData as any).activities || []
          
          // Map backend activity format to frontend display format
          const mappedActivities = activities.map((a: any) => ({
            user_name: 'User', // We only have UUID (a.changed_by) for now
            action: a.summary || a.type.replace('_', ' '),
            entity_name: 'Item', // We only have UUID (a.entity_id) for now
            entity_type: a.entity_type || 'row',
            created_at: a.timestamp,
            hub: 'Data Hub' // Default to Data Hub as these are row changes
          }))
          
          setActivityFeed(mappedActivities)
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [workspaceId])

  const handleNavigate = (hub: string) => {
    if (!tabManager) return
    
    switch (hub) {
      case 'applications':
        tabManager.addTab({
          title: 'Programs',
          type: 'custom',
          url: `/workspace/${workspaceId}/applications`,
          workspaceId,
          metadata: { hub: 'applications' }
        })
        break
      case 'data':
        tabManager.addTab({
          title: 'Database',
          type: 'table',
          url: `/workspace/${workspaceId}/tables`,
          workspaceId,
          metadata: { hub: 'data' }
        })
        break
      case 'people':
        tabManager.addTab({
          title: 'People',
          type: 'custom',
          url: `/workspace/${workspaceId}/people`,
          workspaceId,
          metadata: { hub: 'people' }
        })
        break
    }
  }

  // Map stats to display format
  const displayStats = [
    { 
      label: 'Total Rows', 
      value: stats?.rows || '0', 
      subtext: 'Across all tables', 
      icon: Database, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'Active Tables', 
      value: stats?.tables || '0', 
      subtext: 'Data collections', 
      icon: LayoutGrid, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50' 
    },
    { 
      label: 'Pending Reviews', 
      value: stats?.pending_reviews || '0', 
      subtext: 'Awaiting action', 
      icon: Inbox, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      label: 'Active Forms', 
      value: stats?.forms || '0', 
      subtext: 'Data collection points', 
      icon: FileText, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
  ]

  // Hubs configuration
  const hubs = [
    { 
      id: 'applications', 
      name: 'Programs', 
      icon: GraduationCap, 
      description: 'Manage scholarships, grants, and admissions.', 
      color: 'green',
      action: 'Review Apps'
    },
    { 
      id: 'data', 
      name: 'Database', 
      icon: Database, 
      description: 'System tables, data management, and reporting.', 
      color: 'slate',
      action: 'Manage Data'
    },
  ]

  // Filter hubs based on visibility - non-admins never see hidden hubs
  const visibleHubs = hubs.filter(hub => {
    const isHidden = hubVisibility[hub.id] === true
    if (!isAdmin) return !isHidden
    if (showHiddenHubs) return true
    return !isHidden
  })

  // Toggle hub visibility (admin only)
  const handleToggleHubVisibility = async (hubId: string, hide: boolean) => {
    try {
      // For now, we'll store this in local state
      // In production, this would call the API endpoint
      setHubVisibility(prev => ({ ...prev, [hubId]: hide }))
      const { toast } = await import('sonner')
      toast.success(hide ? 'Hub hidden from workspace' : 'Hub is now visible')
    } catch (error) {
      console.error('Failed to toggle hub visibility:', error)
    }
  }

  // Helper for time ago
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Workspace Overview
          </h1>
          <p className="text-gray-600">
            Welcome back! Here's what's happening in your workspace.
          </p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {displayStats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {loading ? '...' : stat.value}
              </h3>
              <p className="text-xs text-gray-500">{stat.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hub Access Cards (Main Content - 2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Your Hubs</h2>
            {isAdmin && (
              <button
                onClick={() => setShowHiddenHubs(!showHiddenHubs)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {showHiddenHubs ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showHiddenHubs ? 'Showing all' : 'Show hidden'}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleHubs.map((hub) => {
              const isHidden = hubVisibility[hub.id] === true
              return (
                <div 
                  key={hub.id}
                  className={`bg-white rounded-xl border p-6 hover:shadow-lg transition-all group flex flex-col h-full relative ${isHidden ? 'border-dashed border-gray-300 opacity-60' : 'border-gray-200'}`}
                >
                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="absolute top-4 right-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={() => handleToggleHubVisibility(hub.id, !isHidden)}
                            className="flex items-center gap-2"
                          >
                            {isHidden ? (
                              <>
                                <Eye className="w-4 h-4" />
                                Show hub
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-4 h-4" />
                                Hide hub
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-${hub.color}-50 group-hover:bg-${hub.color}-100 transition-colors`}>
                      <hub.icon className={`w-6 h-6 text-${hub.color}-600`} />
                    </div>
                    {isHidden && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Hidden</span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{hub.name}</h3>
                  <p className="text-gray-600 text-sm mb-6 flex-1">{hub.description}</p>
                  
                  <div className="pt-4 border-t border-gray-100">
                    <button 
                      onClick={() => handleNavigate(hub.id)}
                      className={`w-full py-2 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 group-hover:border-${hub.color}-200 group-hover:text-${hub.color}-700 group-hover:bg-${hub.color}-50`}
                    >
                      {hub.action}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Activity Feed (Sidebar - 1 col) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Activity Feed</h2>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading activity...</div>
              ) : activityFeed.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No recent activity</div>
              ) : (
                activityFeed.map((activity, i) => (
                  <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                        {(activity.user_name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-semibold">{activity.user_name || 'User'}</span> {activity.action} <span className="font-medium text-blue-600">{activity.entity_name}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{timeAgo(activity.created_at)}</span>
                          <span className="text-xs text-gray-300">•</span>
                          <span className="text-xs font-medium text-gray-500">{activity.entity_type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Quick Action Card Component
function QuickActionCard({ 
  title, 
  description, 
  icon: Icon, 
  color 
}: { 
  title: string
  description: string
  icon: any
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-4`}>
        <Icon size={24} />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}
