'use client'

import { useState } from 'react'
import { 
  Home, Activity, Inbox, BarChart3, Users, Settings, 
  GraduationCap, ChevronRight, PanelLeftClose, PanelLeftOpen, Workflow,
  Building2, Building, ChevronDown
} from 'lucide-react'
import { useTabContext } from './WorkspaceTabProvider'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui-components/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'

interface SidebarProps {
  workspaceId: string
  currentWorkspace?: any
  workspaces?: any[]
  organizations?: any[]
  currentOrganization?: any
  switchToOrganization?: (id: string) => void
  handleWorkspaceSwitch?: (slug: string) => void
  getWorkspaceColorClass?: (workspace: any) => string
  getWorkspaceColorStyle?: (workspace: any) => React.CSSProperties
}

export function Sidebar({ 
  workspaceId,
  currentWorkspace,
  workspaces = [],
  organizations = [],
  currentOrganization,
  switchToOrganization,
  handleWorkspaceSwitch,
  getWorkspaceColorClass,
  getWorkspaceColorStyle
}: SidebarProps) {
  const { tabManager, activeTab } = useTabContext()
  const [isCollapsed, setIsCollapsed] = useState(true)
  
  const navItems = [
    {
      id: 'applications',
      label: 'Applications',
      icon: GraduationCap,
      url: `/workspace/${workspaceId}/applications`,
      type: 'custom'
    },
    {
      id: 'data',
      label: 'Data',
      icon: BarChart3,
      url: `/workspace/${workspaceId}/tables`,
      type: 'table'
    },
    {
      id: 'workflows',
      label: 'Workflows',
      icon: Workflow,
      url: `/workspace/${workspaceId}/workflows`,
      type: 'custom'
    }
  ]

  const handleNavigate = (item: any) => {
    if (!tabManager) return

    // If it's home, we might want to close other tabs or just focus the overview tab
    if (item.id === 'home') {
      // Find overview tab
      const tabs = tabManager.getTabs()
      const overviewTab = tabs.find(t => t.title === 'Overview')
      if (overviewTab) {
        tabManager.setActiveTab(overviewTab.id)
      } else {
        tabManager.addTab({
          title: 'Overview',
          type: 'custom',
          url: `/workspace/${workspaceId}`,
          workspaceId
        })
      }
    } else {
      // Add or focus tab for the hub
      tabManager.addTab({
        title: item.label,
        type: item.type,
        url: item.url,
        workspaceId,
        metadata: { hubType: item.id }
      })
    }
  }

  return (
    <div 
      className={cn(
        "bg-white border border-gray-200 flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out relative group/sidebar rounded-xl shadow-sm",
        isCollapsed ? "w-16" : "w-56"
      )}
    >
      {/* Workspace Dropdown at Top */}
      {!isCollapsed && currentWorkspace && (
        <div className="p-4 border-b border-gray-200">
          {/* Organization Selector - Only show if user has multiple organizations */}
          {organizations.length > 1 && currentOrganization && switchToOrganization && (
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors mb-2">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 flex items-center gap-1 min-w-0">
                  <span className="text-xs text-gray-700 font-medium truncate">{currentOrganization.name}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-white">
                <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => {
                  const isCurrent = org.id === currentOrganization?.id
                  return (
                    <DropdownMenuItem 
                      key={org.id}
                      onClick={() => !isCurrent && switchToOrganization(org.id)}
                      className={isCurrent ? 'bg-gray-50' : ''}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{org.name}</div>
                          <div className="text-xs text-gray-500">
                            {isCurrent ? 'Current organization' : 'Switch to this organization'}
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Workspace Selector */}
          {handleWorkspaceSwitch && getWorkspaceColorClass && getWorkspaceColorStyle && (
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                <div 
                  className={`w-8 h-8 ${getWorkspaceColorClass(currentWorkspace)} rounded-lg flex items-center justify-center flex-shrink-0`}
                  style={getWorkspaceColorStyle(currentWorkspace)}
                >
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-900 truncate">{currentWorkspace.name}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-white">
                <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((ws) => {
                  const isCurrent = ws.id === currentWorkspace?.id
                  const workspaceColor = (ws as any).color || '#7C3AED'
                  const colorClass = workspaceColor.startsWith('#') ? '' : `bg-${workspaceColor}`
                  const colorStyle = workspaceColor.startsWith('#') ? { backgroundColor: workspaceColor } : {}
                  return (
                    <DropdownMenuItem 
                      key={ws.id}
                      onClick={() => !isCurrent && handleWorkspaceSwitch(ws.slug)}
                      className={isCurrent ? 'bg-gray-50' : ''}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div 
                          className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}
                          style={colorStyle}
                        >
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{ws.name}</div>
                          <div className="text-xs text-gray-500">
                            {isCurrent ? 'Current workspace' : 'Switch to this workspace'}
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="p-4 flex-1">
        <div className={cn(
          "flex items-center justify-between mb-4 px-2",
          isCollapsed && "justify-center px-0"
        )}>
          {!isCollapsed && (
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hubs
            </div>
          )}
        </div>
        
        <nav className="space-y-1">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              // Determine if active based on activeTab
              const isActive = activeTab?.url === item.url || 
                               (item.id === 'home' && activeTab?.title === 'Overview') ||
                               (activeTab?.metadata?.hubType === item.id)

              const ButtonContent = (
                <button
                  onClick={() => handleNavigate(item)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <item.icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                  {!isCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                  {!isCollapsed && isActive && <ChevronRight size={14} className="text-blue-600" />}
                </button>
              )

              if (isCollapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      {ButtonContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return <div key={item.id}>{ButtonContent}</div>
            })}
          </TooltipProvider>
        </nav>
      </div>

      {/* Collapse Toggle Button */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "w-full flex items-center gap-2 text-gray-500 hover:text-gray-900",
            isCollapsed && "justify-center px-0"
          )}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!isCollapsed && <span>Collapse Sidebar</span>}
        </Button>
      </div>
    </div>
  )
}

