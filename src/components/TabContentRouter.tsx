'use client'

import { TabData } from '@/lib/tab-manager'
import { useTabContext } from './WorkspaceTabProvider'
import { FileText, Calendar, Users, Search, Plus, BarChart3, Folder, Clock, Layout, Inbox, Activity as ActivityIcon, LayoutGrid, GraduationCap, FileInput, Database, Settings, Filter, MoreHorizontal, ArrowRight, Pin } from 'lucide-react'
import { TablesListPage } from './Tables/TablesListPage'
import { TableGridView } from './Tables/TableGridView'
import { FormsListPage as FormsListComponent } from './Forms/FormsListPage'
import { ActivitiesHubListPage } from './ActivitiesHub/ActivitiesHubListPage'
import { AttendanceView } from './ActivitiesHub/AttendanceView'
import { EnrolledView } from './ActivitiesHub/EnrolledView'
import { AddParticipantDialog } from './ActivitiesHub/AddParticipantDialog'
import { ParticipantDetailPanel } from './ActivitiesHub/ParticipantDetailPanel'
import { RequestHubViewer } from './RequestHub/RequestHubViewer'
import { RequestHubListPage } from './RequestHub/RequestHubListPage'
import { ApplicationsHub } from './ApplicationsHub/ApplicationsHub'
import { useState, useEffect } from 'react'
import { activitiesSupabase } from '@/lib/api/activities-supabase'
import type { Activity } from '@/types/activities-hubs'
import type { Participant, CreateParticipantInput, UpdateParticipantInput } from '@/types/participants'

interface TabContentRouterProps {
  tab?: TabData | null
  workspaceId: string
}

// Attendance View Wrapper with data fetching
function AttendanceViewWrapper({ workspaceId }: { workspaceId: string }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true)
        const data = await activitiesSupabase.listActivities(workspaceId)
        setActivities(data)
      } catch (error) {
        console.error('Error loading activities:', error)
      } finally {
        setLoading(false)
      }
    }
    loadActivities()
  }, [workspaceId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading attendance...</div>
      </div>
    )
  }

  return <AttendanceView activities={activities} workspaceId={workspaceId} onSelectActivity={() => {}} />
}

// Enrolled View Wrapper with data fetching
function EnrolledViewWrapper({ workspaceId }: { workspaceId: string }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [participantsTableId, setParticipantsTableId] = useState<string | null>(null)
  const [linkId, setLinkId] = useState<string | null>(null)

  useEffect(() => {
    let rowsChannel: any = null
    let linksChannel: any = null
    
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load activities
        const activitiesData = await activitiesSupabase.listActivities(workspaceId)
        setActivities(activitiesData)
        
        // Get or create participants table and activities table
        const { getOrCreateParticipantsTable } = await import('@/lib/api/participants-setup')
        const { supabase } = await import('@/lib/supabase')
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const table = await getOrCreateParticipantsTable(workspaceId, user.id)
          setParticipantsTableId(table.id)
          
          // Ensure link exists between participants and activities tables
          const { ensureParticipantsActivitiesLink } = await import('@/lib/api/participants-activities-link')
          const linkIdFromEnsure = await ensureParticipantsActivitiesLink(workspaceId, user.id)
          
          // Get link ID between participants and activities tables via Go API
          const { tableLinksGoClient } = await import('@/lib/api/participants-go-client')
          const links = await tableLinksGoClient.getTableLinks(table.id)
          const link = links.find(l => l.link_type === 'many_to_many')
          
          if (link) {
            setLinkId(link.id)
          } else if (linkIdFromEnsure) {
            setLinkId(linkIdFromEnsure)
          }
          
          // Load participants via Go API
          const { participantsGoClient } = await import('@/lib/api/participants-go-client')
          const rows = await participantsGoClient.getParticipants(table.id)
          
          // Convert table rows to participants (with enrollments from row_links)
          const { tableRowToParticipant } = await import('@/lib/api/participants-helpers')
          const participantsData = await Promise.all(
            (rows || []).map((row: any) => 
              tableRowToParticipant(row, table.id, link?.id)
            )
          )
          
          setParticipants(participantsData)
          
          // Subscribe to realtime changes for participants table_rows
          rowsChannel = supabase
            .channel(`table_rows:${table.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'table_rows',
                filter: `table_id=eq.${table.id}`
              },
              async (payload) => {
                console.log('Participants row change:', payload)
                // Reload all participants when any row changes
                const updatedRows = await participantsGoClient.getParticipants(table.id)
                const updatedData = await Promise.all(
                  (updatedRows || []).map((row: any) => 
                    tableRowToParticipant(row, table.id, link?.id)
                  )
                )
                setParticipants(updatedData)
              }
            )
            .subscribe()
          
          // Subscribe to realtime changes for row_links (enrollments)
          if (link) {
            linksChannel = supabase
              .channel(`row_links:${link.id}`)
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'table_row_links',
                  filter: `link_id=eq.${link.id}`
                },
                async (payload) => {
                  console.log('Enrollment link change:', payload)
                  // Reload all participants to reflect enrollment changes
                  const updatedRows = await participantsGoClient.getParticipants(table.id)
                  const updatedData = await Promise.all(
                    (updatedRows || []).map((row: any) => 
                      tableRowToParticipant(row, table.id, link.id)
                    )
                  )
                  setParticipants(updatedData)
                }
              )
              .subscribe()
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
    
    // Cleanup subscriptions on unmount
    return () => {
      rowsChannel?.unsubscribe()
      linksChannel?.unsubscribe()
    }
  }, [workspaceId])

  const handleAddParticipant = async (data: CreateParticipantInput, programIds: string[]) => {
    if (!participantsTableId || !linkId) return
    
    try {
      const { participantToTableRowData } = await import('@/lib/api/participants-helpers')
      const { participantsGoClient, rowLinksGoClient } = await import('@/lib/api/participants-go-client')
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup')
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return
      
      // Convert participant data to table row format (without enrolled_programs)
      const rowData = participantToTableRowData(data)
      
      // Create participant table row via Go API
      const newRow = await participantsGoClient.createParticipant(
        participantsTableId,
        rowData,
        user.id
      )
      
      // Enroll participant in selected programs via row links
      if (newRow?.id && programIds.length > 0) {
        // Get activities table to find activity row IDs
        const { tablesSupabase } = await import('@/lib/api/tables-supabase')
        const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id)
        const activityRows = await tablesSupabase.getTableRows(activitiesTable.id)
        
        // Create row_links for each enrollment
        for (const programId of programIds) {
          const activityRow = activityRows?.find((row: any) => 
            row.data?.legacy_activity_id === programId || row.id === programId
          )
          
          if (activityRow?.id) {
            await rowLinksGoClient.createRowLink(
              newRow.id,
              activityRow.id,
              linkId,
              {
                enrolled_date: new Date().toISOString(),
                status: 'active',
                notes: ''
              }
            )
          }
        }
      }
      
      // Reload participants (will be replaced by realtime subscription)
      const rows = await participantsGoClient.getParticipants(participantsTableId)
      const { tableRowToParticipant } = await import('@/lib/api/participants-helpers')
      const participantsData = await Promise.all(
        (rows || []).map((row: any) => 
          tableRowToParticipant(row, participantsTableId, linkId)
        )
      )
      setParticipants(participantsData)
      
    } catch (error) {
      console.error('Error adding participant:', error)
    }
  }

  const handleSaveParticipant = async (id: string, updates: UpdateParticipantInput) => {
    if (!linkId || !participantsTableId) return
    
    try {
      const { participantToTableRowData } = await import('@/lib/api/participants-helpers')
      const { participantsGoClient } = await import('@/lib/api/participants-go-client')
      
      // Convert participant data (without enrolled_programs)
      const rowData = participantToTableRowData(updates)
      
      // Update participant table row via Go API
      await participantsGoClient.updateParticipant(participantsTableId, id, rowData)
      
      // Reload participants (will be replaced by realtime subscription)
      const rows = await participantsGoClient.getParticipants(participantsTableId)
      const { tableRowToParticipant } = await import('@/lib/api/participants-helpers')
      const participantsData = await Promise.all(
        (rows || []).map((row: any) => 
          tableRowToParticipant(row, participantsTableId, linkId)
        )
      )
      setParticipants(participantsData)
      
    } catch (error) {
      console.error('Error updating participant:', error)
    }
  }

  const handleDeleteParticipant = async (id: string) => {
    if (!linkId || !participantsTableId) return
    
    try {
      const { participantsGoClient } = await import('@/lib/api/participants-go-client')
      
      // Delete table row via Go API (cascade deletes row_links)
      await participantsGoClient.deleteParticipant(participantsTableId, id)
      
      // Update local state (will be replaced by realtime subscription)
      setParticipants(prev => prev.filter(p => p.id !== id))
      setSelectedParticipant(null)
    } catch (error) {
      console.error('Error deleting participant:', error)
    }
  }

  const handleUnenroll = async (participantId: string, rowLinkId: string) => {
    if (!linkId || !participantsTableId) return
    
    try {
      const { rowLinksGoClient } = await import('@/lib/api/participants-go-client')
      
      // Remove row link via Go API
      await rowLinksGoClient.deleteRowLink(rowLinkId)
      
      // Reload participants (will be replaced by realtime subscription)
      const { participantsGoClient } = await import('@/lib/api/participants-go-client')
      const { tableRowToParticipant } = await import('@/lib/api/participants-helpers')
      const rows = await participantsGoClient.getParticipants(participantsTableId)
      const participantsData = await Promise.all(
        (rows || []).map((row: any) => 
          tableRowToParticipant(row, participantsTableId, linkId)
        )
      )
      setParticipants(participantsData)
    } catch (error) {
      console.error('Error unenrolling participant:', error)
    }
  }

  const handleEnroll = async (participantId: string, activityId: string) => {
    if (!linkId || !participantsTableId) return
    
    try {
      const { rowLinksGoClient } = await import('@/lib/api/participants-go-client')
      const { tablesSupabase } = await import('@/lib/api/tables-supabase')
      const { getOrCreateActivitiesTable } = await import('@/lib/api/activities-table-setup')
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return
      
      // Get activities table to find activity row ID
      const activitiesTable = await getOrCreateActivitiesTable(workspaceId, user.id)
      const activityRows = await tablesSupabase.getTableRows(activitiesTable.id)
      
      // Find the activity row
      const activityRow = activityRows?.find((row: any) => 
        row.data?.legacy_activity_id === activityId || row.id === activityId
      )
      
      if (activityRow?.id) {
        // Create row link via Go API
        await rowLinksGoClient.createRowLink(
          participantId,
          activityRow.id,
          linkId,
          {
            enrolled_date: new Date().toISOString(),
            status: 'active',
            notes: ''
          }
        )
        
        // Reload participants (will be replaced by realtime subscription)
        const { participantsGoClient } = await import('@/lib/api/participants-go-client')
        const { tableRowToParticipant } = await import('@/lib/api/participants-helpers')
        const rows = await participantsGoClient.getParticipants(participantsTableId)
        const participantsData = await Promise.all(
          (rows || []).map((row: any) => 
            tableRowToParticipant(row, participantsTableId, linkId)
          )
        )
        setParticipants(participantsData)
      }
    } catch (error) {
      console.error('Error enrolling participant:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading participants...</div>
      </div>
    )
  }

  return (
    <>
      <EnrolledView
        activities={activities}
        participants={participants}
        onAddParticipant={() => setAddDialogOpen(true)}
        onSelectParticipant={setSelectedParticipant}
      />
      <AddParticipantDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={handleAddParticipant}
        activities={activities}
      />
      <ParticipantDetailPanel
        participant={selectedParticipant}
        activities={activities}
        onClose={() => setSelectedParticipant(null)}
        onSave={handleSaveParticipant}
        onDelete={handleDeleteParticipant}
        onUnenroll={handleUnenroll}
        onEnroll={handleEnroll}
      />
    </>
  )
}

export function TabContentRouter({ tab: propTab, workspaceId }: TabContentRouterProps) {
  const { activeTab, tabManager } = useTabContext()
  
  // Use prop tab or context active tab
  const tab = propTab !== undefined ? propTab : activeTab

  if (!tab) {
    return <WorkspaceDashboard workspaceId={workspaceId} />
  }

  // Route tab content based on type and URL
  switch (tab.type) {
    case 'form':
      // Check if it's the forms list page or a specific form
      if (tab.url?.includes('/forms') && !tab.url?.includes('/forms/')) {
        return <FormsListComponent workspaceId={workspaceId} />
      }
      return (
        <div className="h-full p-6 bg-gray-50">
          <div className="h-full bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="font-medium mb-2">Form Builder</p>
              <p className="text-sm">Form builder coming soon</p>
            </div>
          </div>
        </div>
      )
      
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
      
    case 'calendar':
      return (
        <div className="h-full p-6">
          <div className="h-full bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Calendar view coming soon</p>
            </div>
          </div>
        </div>
      )
      
    case 'project':
      return (
        <div className="h-full p-6">
          <div className="h-full bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Project view coming soon</p>
            </div>
          </div>
        </div>
      )
      
    case 'custom':
      // Handle Attendance view
      if (tab.url?.includes('/attendance')) {
        return <AttendanceViewWrapper workspaceId={workspaceId} />
      }

      // Handle Enrolled view
      if (tab.url?.includes('/enrolled')) {
        return <EnrolledViewWrapper workspaceId={workspaceId} />
      }

      // Handle Activities Hub list page
      if (tab.url?.includes('/activities-hubs') && !tab.url?.includes('/activities-hubs/')) {
        return <ActivitiesHubListPage workspaceId={workspaceId} />
      }

      // Handle Request Hub list page
      if (tab.url?.includes('/request-hubs') && !tab.url?.includes('/request-hubs/')) {
        return <RequestHubListPage workspaceId={workspaceId} />
      }

      // Handle Request Hub viewer
      if (tab.url?.includes('/request-hub/')) {
        const hubId = tab.metadata?.hubId
        if (hubId) {
          return <RequestHubViewer hubId={hubId} workspaceId={workspaceId} />
        }
      }

      // Handle Overview - show Dashboard
      if (tab.url === `/w/${workspaceId}` || tab.url === `/workspace/${workspaceId}` || tab.title === 'Overview') {
        return <WorkspaceDashboard workspaceId={workspaceId} />
      }
      
      // Handle Applications Hub
      if (tab.url?.includes('/applications')) {
        return <ApplicationsHub workspaceId={workspaceId} />
      }

      // Handle People Hub
      if (tab.url?.includes('/people')) {
        return (
          <div className="h-full p-6 bg-gray-50">
            <div className="h-full bg-white rounded-lg border border-gray-200 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="font-medium mb-2">People Hub</p>
                <p className="text-sm">Directory coming soon</p>
              </div>
            </div>
          </div>
        )
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
      title: 'Create Document',
      description: 'Start a new collaborative document',
      icon: FileText,
      action: 'new-document'
    },
    {
      title: 'Create Form',
      description: 'Build a new form',
      icon: FileText,
      action: 'new-form'
    },
    {
      title: 'Open Calendar',
      description: 'View your schedule',
      icon: Calendar,
      action: 'calendar'
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

// Calendar view placeholder
function CalendarView({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Calendar</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Calendar Coming Soon
          </h3>
          <p className="text-gray-600">
            Calendar functionality will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  )
}

// Project view placeholder
function ProjectView({ projectId, workspaceId }: { 
  projectId: string
  workspaceId: string 
}) {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Project</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Project Management Coming Soon
          </h3>
          <p className="text-gray-600">
            Project functionality will be available in a future update.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Project ID: {projectId}
          </p>
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

  const handleNavigate = (hub: string) => {
    if (!tabManager) return
    
    switch (hub) {
      case 'activities':
        tabManager.addTab({
          title: 'Activities Hub',
          type: 'custom',
          url: `/workspace/${workspaceId}/activities-hubs`,
          workspaceId,
          metadata: { hub: 'activities' }
        })
        break
      case 'applications':
        tabManager.addTab({
          title: 'Applications',
          type: 'custom',
          url: `/workspace/${workspaceId}/applications`,
          workspaceId,
          metadata: { hub: 'applications' }
        })
        break
      case 'requests':
        tabManager.addTab({
          title: 'Request Hub',
          type: 'custom',
          url: `/workspace/${workspaceId}/request-hubs`,
          workspaceId,
          metadata: { hub: 'requests' }
        })
        break
      case 'data':
        tabManager.addTab({
          title: 'Data Tables',
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
      case 'settings':
        // Settings usually opens a modal, but we can have a tab too
        console.log('Open settings')
        break
    }
  }

  // Mock data for stats
  const stats = [
    { label: 'Active Programs', value: '12', subtext: '+2 this week', icon: ActivityIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending Requests', value: '8', subtext: '3 high priority', icon: Inbox, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Apps in Review', value: '45', subtext: '12 due today', icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Attendance Rate', value: '94%', subtext: 'Last 7 days', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  // Mock data for hubs with more details
  const hubs = [
    { 
      id: 'activities', 
      name: 'Activities Hub', 
      icon: ActivityIcon, 
      description: 'Manage programs, events, and attendance tracking.', 
      color: 'blue',
      preview: '3 programs today',
      action: 'View Programs'
    },
    { 
      id: 'requests', 
      name: 'Request Hub', 
      icon: Inbox, 
      description: 'Centralize incoming requests and approvals.', 
      color: 'orange',
      preview: '12 pending requests',
      action: 'Review Requests'
    },
    { 
      id: 'applications', 
      name: 'Applications Hub', 
      icon: GraduationCap, 
      description: 'Manage scholarships, grants, and admissions.', 
      color: 'green',
      preview: '5 new applications',
      action: 'Review Apps'
    },
    { 
      id: 'data', 
      name: 'Data Hub', 
      icon: Database, 
      description: 'System tables, data management, and reporting.', 
      color: 'slate',
      preview: '18 active tables',
      action: 'Manage Data'
    },
    { 
      id: 'people', 
      name: 'People Hub', 
      icon: Users, 
      description: 'Directory, profiles, and user management.', 
      color: 'purple',
      preview: '128 total users',
      action: 'View Directory'
    },
  ]

  // Mock activity feed
  const activities = [
    { user: 'Sarah Smith', action: 'submitted a field trip request', target: 'Science Museum Trip', time: '10 mins ago', hub: 'Request Hub' },
    { user: 'John Doe', action: 'completed attendance for', target: 'Afternoon Arts Program', time: '1 hour ago', hub: 'Activities' },
    { user: 'Maria Garcia', action: 'submitted new application', target: 'Fall Scholarship', time: '2 hours ago', hub: 'Applications' },
    { user: 'System', action: 'generated weekly report', target: 'Attendance Summary', time: '5 hours ago', hub: 'Data Hub' },
    { user: 'Alex Chen', action: 'updated profile', target: 'Emergency Contacts', time: '1 day ago', hub: 'People Hub' },
  ]

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header with Customization */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Workspace Overview
          </h1>
          <p className="text-gray-600">
            Welcome back! Here's what's happening in your workspace.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
          <Settings className="w-4 h-4" />
          <span>Customize Dashboard</span>
        </button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              {/* Optional trend indicator could go here */}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
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
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Manage Hubs</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hubs.map((hub) => (
              <div 
                key={hub.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all group flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-${hub.color}-50 group-hover:bg-${hub.color}-100 transition-colors`}>
                    <hub.icon className={`w-6 h-6 text-${hub.color}-600`} />
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-2">{hub.name}</h3>
                <p className="text-gray-600 text-sm mb-6 flex-1">{hub.description}</p>
                
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">At a glance</span>
                    <span className="text-xs font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded-full">{hub.preview}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleNavigate(hub.id)}
                    className={`w-full py-2 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 group-hover:border-${hub.color}-200 group-hover:text-${hub.color}-700 group-hover:bg-${hub.color}-50`}
                  >
                    {hub.action}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed (Sidebar - 1 col) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Activity Feed</h2>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {activities.map((activity, i) => (
                <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                      {activity.user.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{activity.user}</span> {activity.action} <span className="font-medium text-blue-600">{activity.target}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{activity.time}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs font-medium text-gray-500">{activity.hub}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <button className="text-sm text-blue-600 font-medium hover:text-blue-700">View all activity</button>
            </div>
          </div>

          {/* Optional: Pinned Items or Quick Links could go here */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-blue-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Pin className="w-4 h-4 text-blue-600" />
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li><button className="text-sm text-gray-600 hover:text-blue-600 hover:underline">Weekly Attendance Report</button></li>
              <li><button className="text-sm text-gray-600 hover:text-blue-600 hover:underline">Pending Approvals (3)</button></li>
              <li><button className="text-sm text-gray-600 hover:text-blue-600 hover:underline">New Program Template</button></li>
            </ul>
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
