'use client'

import { useState } from 'react'
import { 
  Home, Activity, Inbox, BarChart3, Users, Settings, 
  GraduationCap, ChevronRight, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { useTabContext } from './WorkspaceTabProvider'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui-components/tooltip'

interface SidebarProps {
  workspaceId: string
}

export function Sidebar({ workspaceId }: SidebarProps) {
  const { tabManager, activeTab } = useTabContext()
  const [isCollapsed, setIsCollapsed] = useState(true)
  
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      url: `/workspace/${workspaceId}`,
      type: 'custom'
    },
    {
      id: 'activities',
      label: 'Activities',
      icon: Activity,
      url: `/workspace/${workspaceId}/activities-hubs`,
      type: 'custom'
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: GraduationCap,
      url: `/workspace/${workspaceId}/applications`,
      type: 'custom'
    },
    {
      id: 'requests',
      label: 'Requests',
      icon: Inbox,
      url: `/workspace/${workspaceId}/request-hubs`,
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
      id: 'people',
      label: 'People',
      icon: Users,
      url: `/workspace/${workspaceId}/people`,
      type: 'custom'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      url: `/workspace/${workspaceId}/settings`,
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

