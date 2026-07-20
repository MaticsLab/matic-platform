'use client'

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from '@/ui-components/sidebar'
import { Skeleton } from '@/ui-components/skeleton'

/**
 * Placeholder shown while useWorkspaceDiscovery/useOrganizationDiscovery are
 * still resolving. Reuses the real Sidebar/SidebarHeader/SidebarContent
 * primitives so the width and collapse behavior exactly match AppSidebar —
 * swapping to the real sidebar causes no layout shift.
 */
export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" variant="inset" className="font-hanken-grotesk">
      <SidebarHeader>
        <div className="flex w-full items-center gap-2.5 p-2">
          <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-[10px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-[38px] w-full rounded-[11px]" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 shrink-0 rounded" />
                    <Skeleton className="h-3.5 w-20 group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
