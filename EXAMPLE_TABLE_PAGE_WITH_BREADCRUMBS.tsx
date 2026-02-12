'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { Database, Download, Share2, Settings } from 'lucide-react'
import { Button } from '@/ui-components/button'

export function TableDetailPage() {
  const params = useParams()
  const workspaceSlug = params.slug as string
  const tableId = params.tableId as string

  // Fetch table data...
  const tableName = "Applicants" // from your data

  // Set breadcrumbs with actions
  useBreadcrumbs(
    [
      {
        label: 'Tables',
        href: `/workspace/${workspaceSlug}/tables`,
        icon: Database
      },
      {
        label: tableName,
        href: `/workspace/${workspaceSlug}/tables/${tableId}`
      }
    ],
    {
      actions: (
        <>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </>
      )
    }
  )

  return (
    <div className="p-6">
      {/* Your table content here */}
      <h1>{tableName}</h1>
      {/* ... */}
    </div>
  )
}

// ============================================
// Example 2: Applications List
// ============================================

export function ApplicationsListPage() {
  const params = useParams()
  const workspaceSlug = params.slug as string

  useBreadcrumbs([
    { label: 'Applications', href: `/workspace/${workspaceSlug}/applications` }
  ])

  return (
    <div className="p-6">
      {/* Applications grid/list */}
    </div>
  )
}

// ============================================
// Example 3: CRM Page with Sub-navigation
// ============================================

export function CRMPage() {
  const params = useParams()
  const workspaceSlug = params.slug as string
  const [activeView, setActiveView] = useState('pipeline')

  useBreadcrumbs(
    [
      { label: 'CRM', href: `/workspace/${workspaceSlug}/crm` }
    ],
    {
      // You can still have sub-navigation here if needed
      title: activeView === 'pipeline' ? 'Pipeline View' : 'List View'
    }
  )

  return (
    <div className="p-6">
      {/* CRM content */}
    </div>
  )
}
