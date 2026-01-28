'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { crmClient } from '@/lib/api/crm-client'
import type { Workspace } from '@/types/workspaces'
import type { ApplicantCRM } from '@/types/crm'
import { toast } from 'sonner'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui-components/table'
import { Input } from '@/ui-components/input'
import { Badge } from '@/ui-components/badge'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import {
  Users,
  Search,
  Mail,
  Calendar,
  FileText,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function getStatusBadge(status: string) {
  switch (status) {
    case 'submitted':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Submitted</Badge>
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>
    case 'not_started':
      return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100"><AlertCircle className="w-3 h-3 mr-1" />Not Started</Badge>
    case 'approved':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>
    case 'rejected':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><AlertCircle className="w-3 h-3 mr-1" />Rejected</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function CRMPageContent() {
  const params = useParams()
  const slug = params.slug as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [applicants, setApplicants] = useState<ApplicantCRM[]>([])
  const [filteredApplicants, setFilteredApplicants] = useState<ApplicantCRM[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantCRM | null>(null)

  useEffect(() => {
    if (slug) {
      loadData()
    }
  }, [slug])

  useEffect(() => {
    // Filter applicants based on search query
    if (!searchQuery.trim()) {
      setFilteredApplicants(applicants)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredApplicants(
        applicants.filter(
          (a) =>
            a.email.toLowerCase().includes(query) ||
            (a.name && a.name.toLowerCase().includes(query)) ||
            a.applications.some((app) => app.form_name.toLowerCase().includes(query))
        )
      )
    }
  }, [searchQuery, applicants])

  async function loadData() {
    try {
      setLoading(true)
      const ws = await workspacesSupabase.getWorkspaceBySlug(slug)
      if (!ws) throw new Error('Workspace not found')
      setWorkspace(ws)

      const data = await crmClient.getApplicants(ws.id)
      setApplicants(data || [])
      setFilteredApplicants(data || [])
    } catch (err: any) {
      console.error('Failed to load CRM data:', err)
      toast.error('Failed to load applicants')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingOverlay message="Loading applicants..." />
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Workspace not found</p>
      </div>
    )
  }

  const totalApplicants = applicants.length
  const submittedCount = applicants.filter((a) =>
    a.applications.some((app) => app.status === 'submitted')
  ).length
  const inProgressCount = applicants.filter((a) =>
    a.applications.some((app) => app.status === 'in_progress')
  ).length

  return (
    <NavigationLayout workspaceSlug={workspace.slug}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Applicant CRM
            </h1>
            <p className="text-gray-500 mt-1">
              View and manage all applicants and their form submissions
            </p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Applicants</CardDescription>
              <CardTitle className="text-3xl">{totalApplicants}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Submitted</CardDescription>
              <CardTitle className="text-3xl text-green-600">{submittedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{inProgressCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name, email, or form..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Applicants Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Forms Applied</TableHead>
                  <TableHead>Latest Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplicants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? 'No applicants match your search' : 'No applicants yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplicants.map((applicant) => {
                    const latestApp = applicant.applications[0]
                    return (
                      <TableRow
                        key={applicant.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedApplicant(
                          selectedApplicant?.id === applicant.id ? null : applicant
                        )}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {applicant.name || 'Unnamed'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-gray-600">
                            <Mail className="w-3 h-3" />
                            {applicant.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-gray-400" />
                            {applicant.total_forms} form{applicant.total_forms !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          {latestApp && getStatusBadge(latestApp.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-gray-500 text-sm">
                            <Calendar className="w-3 h-3" />
                            {new Date(applicant.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRight
                            className={cn(
                              "w-4 h-4 text-gray-400 transition-transform",
                              selectedApplicant?.id === applicant.id && "rotate-90"
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Expanded Applicant Details */}
        {selectedApplicant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Applications by {selectedApplicant.name || selectedApplicant.email}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedApplicant.applications.map((app, idx) => (
                  <div
                    key={`${app.form_id}-${idx}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{app.form_name}</div>
                      <div className="text-sm text-gray-500">
                        {app.completion_percentage}% complete
                        {app.last_saved_at && (
                          <> · Last saved {new Date(app.last_saved_at).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(app.status)}
                      {app.submission_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `/workspace/${slug}?tab=forms&form=${app.form_id}&submission=${app.submission_id}`
                          }}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </NavigationLayout>
  )
}

export default function CRMPage() {
  return (
    <ProtectedRoute>
      <CRMPageContent />
    </ProtectedRoute>
  )
}
