'use client'

import { ClipboardList, Activity, FileText, BarChart3, Settings, Download, Share2, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TabData } from '@/lib/tab-manager'
import { useRouter } from 'next/navigation'
import { useTabContext, TabAction } from './WorkspaceTabProvider'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { toast } from 'sonner'
interface TabActionBarProps {
  activeTab: TabData | null
  workspaceId: string
  tabs: TabData[]
  onAddTab?: (tab: Omit<TabData, 'id' | 'lastAccessed'>) => void
  onNavigate?: (direction: 'back' | 'forward') => void
}

export function TabActionBar({ activeTab, workspaceId, tabs, onAddTab, onNavigate }: TabActionBarProps) {
  const router = useRouter()
  const { tabActions, tabHeaderContent } = useTabContext()

  // Find current tab index for navigation
  const currentTabIndex = activeTab ? tabs.findIndex(tab => tab.id === activeTab.id) : -1
  const canGoBack = currentTabIndex > 0
  const canGoForward = currentTabIndex >= 0 && currentTabIndex < tabs.length - 1

  // Extract tableId if active tab is a table
  const tableId = activeTab?.type === 'table' 
    ? (activeTab.metadata?.tableId || activeTab.url?.split('/tables/')[1])
    : null

  const handleBack = () => {
    if (canGoBack) {
      onNavigate?.('back')
    }
  }

  const handleForward = () => {
    if (canGoForward) {
      onNavigate?.('forward')
    }
  }

  const handleExportTable = async () => {
    if (!tableId) return

    try {
      toast.info('Preparing export...')
      
      // Fetch table data
      const [table, rows] = await Promise.all([
        tablesGoClient.getTableById(tableId),
        tablesGoClient.getRowsByTable(tableId)
      ])

      if (!table || !rows) {
        toast.error('Failed to fetch table data')
        return
      }

      // Prepare CSV content
      const columns = table.columns || []
      const visibleColumns = columns.filter(col => col.is_visible !== false)
      
      // Header row
      const headers = visibleColumns.map(col => `"${col.label || col.name}"`).join(',')
      
      // Data rows
      const csvRows = rows.map(row => {
        return visibleColumns.map(col => {
          const value = row.data[col.name]
          
          if (value === null || value === undefined) {
            return '""'
          }
          
          if (typeof value === 'object') {
            // Handle arrays and objects
            const strValue = JSON.stringify(value).replace(/"/g, '""')
            return `"${strValue}"`
          }
          
          // Handle strings and numbers
          const strValue = String(value).replace(/"/g, '""')
          return `"${strValue}"`
        }).join(',')
      })
      
      const csvContent = [headers, ...csvRows].join('\n')
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${table.name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Table exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export table')
    }
  }

  // Determine which actions to show based on the active tab
  const getActionsForTab = (): TabAction[] => {
    // Activities Hub tab - show Attendance and Enrolled actions
    if (activeTab?.title?.includes('Activities') || activeTab?.url?.includes('activities-hub')) {
      return [
        {
          icon: ClipboardList,
          label: 'Attendance',
          onClick: () => {
            onAddTab?.({
              title: 'Attendance',
              url: `/workspace/${workspaceId}/attendance`,
              type: 'custom',
              workspaceId,
            })
          }
        },
        {
          icon: Users,
          label: 'Enrolled',
          onClick: () => {
            onAddTab?.({
              title: 'Enrolled',
              url: `/workspace/${workspaceId}/enrolled`,
              type: 'custom',
              workspaceId,
            })
          }
        }
      ]
    }

    // Overview tab - show main modules
    if (activeTab?.id === 'overview' || activeTab?.title === 'Overview') {
      return [
        {
          icon: ClipboardList,
          label: 'Attendance',
          onClick: () => {
            onAddTab?.({
              title: 'Attendance',
              url: `/w/${workspaceId}/attendance`,
              type: 'custom',
              workspaceId,
            })
          }
        },
        {
          icon: Activity,
          label: 'Pulse',
          onClick: () => {
            onAddTab?.({
              title: 'Pulse',
              url: `/w/${workspaceId}/pulse`,
              type: 'custom',
              workspaceId,
            })
          }
        },
        {
          icon: FileText,
          label: 'Documents',
          onClick: () => {
            onAddTab?.({
              title: 'Documents',
              url: `/w/${workspaceId}/documents`,
              type: 'custom',
              workspaceId,
            })
          }
        },
        {
          icon: BarChart3,
          label: 'Reports',
          onClick: () => {
            onAddTab?.({
              title: 'Reports',
              url: `/w/${workspaceId}/reports`,
              type: 'custom',
              workspaceId,
            })
          }
        }
      ]
    }

    // Table tab - show table-specific actions
    if (activeTab?.type === 'table') {
      return [
        {
          icon: Download,
          label: 'Export',
          onClick: handleExportTable
        },
        {
          icon: Share2,
          label: 'Share',
          onClick: () => console.log('Share table')
        },
        {
          icon: Settings,
          label: 'Settings',
          onClick: () => console.log('Table settings')
        }
      ]
    }

    // Form tab - show form-specific actions
    if (activeTab?.type === 'form') {
      return [
        {
          icon: Share2,
          label: 'Share Form',
          onClick: () => console.log('Share form')
        },
        {
          icon: BarChart3,
          label: 'View Responses',
          onClick: () => console.log('View responses')
        },
        {
          icon: Settings,
          label: 'Settings',
          onClick: () => console.log('Form settings')
        }
      ]
    }

    // Default: no actions
    return []
  }

  const defaultActions = getActionsForTab()
  const actions = tabActions.length > 0 ? tabActions : defaultActions


  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      {/* Left side - Navigation arrows + Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            disabled={!canGoBack}
            className={cn(
              "p-1.5 rounded transition-colors",
              canGoBack 
                ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100" 
                : "text-gray-300 cursor-not-allowed"
            )}
            title="Go back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            disabled={!canGoForward}
            className={cn(
              "p-1.5 rounded transition-colors",
              canGoForward 
                ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100" 
                : "text-gray-300 cursor-not-allowed"
            )}
            title="Go forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Title info after arrows */}
        {tabHeaderContent && (
          <div className="pl-2 border-l border-gray-200 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{tabHeaderContent.title}</span>
            {tabHeaderContent.subModule && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">{tabHeaderContent.subModule}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Center - Tab Header Navigation (if available) */}
      {tabHeaderContent && tabHeaderContent.navItems && tabHeaderContent.navItems.length > 0 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-100 rounded-full">
            {tabHeaderContent.navItems.map((item) => {
              const Icon = item.icon
              const isActive = tabHeaderContent.activeNavId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => tabHeaderContent.onNavChange?.(item.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all",
                    isActive 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={cn(
                      "ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-medium",
                      item.badgeColor === 'blue' 
                        ? "bg-blue-100 text-blue-700"
                        : item.badgeColor === 'green'
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-700"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2">


        {actions.map((action, index) => {
          const Icon = action.icon
          const isOutline = action.variant === 'outline'
          return (
            <button
              key={index}
              onClick={action.onClick}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all",
                isOutline 
                  ? "border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300" 
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <Icon size={16} />
              <span className="font-medium">{action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
