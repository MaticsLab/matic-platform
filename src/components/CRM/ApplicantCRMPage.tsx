'use client'

import { useEffect, useState } from 'react'
import { crmClient } from '@/lib/api/crm-client'
import type { ApplicantCRM } from '@/types/crm'
import { toast } from 'sonner'
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
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Key,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SubmissionSidePanel } from './SubmissionSidePanel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui-components/dialog'

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

interface ApplicantCRMPageProps {
  workspaceId: string
  workspaceSlug?: string
}

interface SelectedSubmission {
  submissionId: string
  formId: string
  formName: string
  applicantName?: string
  applicantEmail?: string
  status?: string
}

export function ApplicantCRMPage({ workspaceId, workspaceSlug }: ApplicantCRMPageProps) {
  const [applicants, setApplicants] = useState<ApplicantCRM[]>([])
  const [filteredApplicants, setFilteredApplicants] = useState<ApplicantCRM[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<SelectedSubmission | null>(null)
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean
    applicant: ApplicantCRM | null
    loading: boolean
    tempPassword: string | null
  }>({
    open: false,
    applicant: null,
    loading: false,
    tempPassword: null,
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadData()
  }, [workspaceId])

  useEffect(() => {
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
      const data = await crmClient.getApplicants(workspaceId)
      setApplicants(data || [])
      setFilteredApplicants(data || [])
    } catch (err: any) {
      console.error('Failed to load CRM data:', err)
      toast.error('Failed to load applicants')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(applicant: ApplicantCRM) {
    setResetPasswordDialog({
      open: true,
      applicant,
      loading: true,
      tempPassword: null,
    })

    try {
      const result = await crmClient.resetPassword(applicant.id, workspaceId)
      setResetPasswordDialog({
        open: true,
        applicant,
        loading: false,
        tempPassword: result.temporary_password,
      })
      toast.success('Password reset successfully')
    } catch (err: any) {
      console.error('Failed to reset password:', err)
      toast.error(err.message || 'Failed to reset password')
      setResetPasswordDialog({
        open: false,
        applicant: null,
        loading: false,
        tempPassword: null,
      })
    }
  }

  function handleCopyPassword() {
    if (resetPasswordDialog.tempPassword) {
      navigator.clipboard.writeText(resetPasswordDialog.tempPassword)
      setCopied(true)
      toast.success('Password copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function closeResetDialog() {
    setResetPasswordDialog({
      open: false,
      applicant: null,
      loading: false,
      tempPassword: null,
    })
    setCopied(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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
                <TableHead>Form</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                  const app = applicant.applications[0]
                  return (
                    <TableRow
                      key={applicant.id}
                      className={cn(
                        "cursor-pointer hover:bg-gray-50 transition-colors",
                        app?.submission_id && "hover:bg-blue-50"
                      )}
                      onClick={() => {
                        if (app?.submission_id) {
                          setSelectedSubmission({
                            submissionId: app.submission_id,
                            formId: app.form_id,
                            formName: app.form_name,
                            applicantName: applicant.name || undefined,
                            applicantEmail: applicant.email,
                            status: app.status,
                          })
                        }
                      }}
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
                        {app ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className={cn(
                              "text-sm",
                              app.submission_id && "text-blue-600 hover:underline"
                            )}>
                              {app.form_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No form</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {app && getStatusBadge(app.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <Calendar className="w-3 h-3" />
                          {new Date(applicant.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResetPassword(applicant)
                          }}
                          className="h-8"
                        >
                          <Key className="w-4 h-4 mr-1" />
                          Reset Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Side Panel for Form Data */}
      {selectedSubmission && (
        <SubmissionSidePanel
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          submissionId={selectedSubmission.submissionId}
          formId={selectedSubmission.formId}
          formName={selectedSubmission.formName}
          applicantName={selectedSubmission.applicantName}
          applicantEmail={selectedSubmission.applicantEmail}
          status={selectedSubmission.status}
        />
      )}

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialog.open} onOpenChange={(open) => !open && closeResetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              {resetPasswordDialog.applicant && (
                <span>
                  Generate a temporary password for <strong>{resetPasswordDialog.applicant.name || resetPasswordDialog.applicant.email}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {resetPasswordDialog.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : resetPasswordDialog.tempPassword ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium mb-2">
                  ✓ Password reset successfully
                </p>
                <p className="text-xs text-green-700">
                  Share this temporary password with {resetPasswordDialog.applicant?.name || 'the applicant'}:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-lg p-3 font-mono text-lg font-bold text-center">
                  {resetPasswordDialog.tempPassword}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPassword}
                  className="h-11"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Email:</strong> {resetPasswordDialog.applicant?.email}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Send this password to the applicant via email or your preferred communication method.
                  They should change it after logging in.
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={closeResetDialog}>
              {resetPasswordDialog.tempPassword ? 'Done' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
