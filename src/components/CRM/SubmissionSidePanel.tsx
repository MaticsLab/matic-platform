'use client'

import { useEffect, useState } from 'react'
import { goClient } from '@/lib/api/go-client'
import { toast } from 'sonner'
import { Sheet, SheetPortal, SheetOverlay } from '@/ui-components/sheet'
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { Badge } from '@/ui-components/badge'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Loader2, Download, ExternalLink, CheckCircle2, Clock, AlertCircle, X, Mail, User, Calendar, FileText } from 'lucide-react'

interface SubmissionSidePanelProps {
  isOpen: boolean
  onClose: () => void
  submissionId: string
  formId: string
  formName: string
  applicantName?: string
  applicantEmail?: string
  status?: string
}

interface TableRow {
  id: string
  table_id: string
  data: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

interface TableField {
  id: string
  name: string
  field_type: string
  position: number
  config?: Record<string, any>
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'submitted':
      return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Submitted</Badge>
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>
    case 'not_started':
      return <Badge className="bg-gray-100 text-gray-600"><AlertCircle className="w-3 h-3 mr-1" />Not Started</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function SubmissionSidePanel({
  isOpen,
  onClose,
  submissionId,
  formId,
  formName,
  applicantName,
  applicantEmail,
  status,
}: SubmissionSidePanelProps) {
  const [loading, setLoading] = useState(true)
  const [submission, setSubmission] = useState<TableRow | null>(null)
  const [fields, setFields] = useState<TableField[]>([])

  useEffect(() => {
    if (isOpen && submissionId) {
      loadSubmission()
    }
  }, [isOpen, submissionId])

  async function loadSubmission() {
    try {
      setLoading(true)
      const [rowData, formData] = await Promise.all([
        goClient.get<TableRow>(`/tables/${formId}/rows/${submissionId}`),
        goClient.get<{ fields: TableField[] }>(`/forms/${formId}`),
      ])
      setSubmission(rowData)
      setFields(formData.fields || [])
    } catch (err: any) {
      console.error('Failed to load submission:', err)
      toast.error('Failed to load submission details')
    } finally {
      setLoading(false)
    }
  }

  function formatValue(value: any, fieldType: string): React.ReactNode {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>
    }

    switch (fieldType) {
      case 'file':
      case 'file_upload':
        if (typeof value === 'object' && value.url) {
          return (
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <Download className="w-4 h-4" />
              {value.name || 'Download file'}
            </a>
          )
        }
        return String(value)

      case 'url':
      case 'link':
        return (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            {String(value).substring(0, 40)}...
          </a>
        )

      case 'date':
        try {
          return new Date(value).toLocaleDateString()
        } catch {
          return String(value)
        }

      case 'checkbox':
      case 'boolean':
        return value ? 'Yes' : 'No'

      case 'select':
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return String(value)

      case 'address':
        if (typeof value === 'object') {
          return value.full_address || value.street_address || JSON.stringify(value)
        }
        return String(value)

      case 'repeater':
        if (Array.isArray(value)) {
          return (
            <div className="space-y-2">
              {value.map((item, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                  {typeof item === 'object' ? (
                    Object.entries(item)
                      .filter(([k]) => !k.startsWith('_'))
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-gray-500">{k}:</span>
                          <span>{String(v)}</span>
                        </div>
                      ))
                  ) : (
                    String(item)
                  )}
                </div>
              ))}
            </div>
          )
        }
        return String(value)

      default:
        if (typeof value === 'object') {
          return JSON.stringify(value, null, 2)
        }
        return String(value)
    }
  }

  // Filter out internal/system fields
  const displayFields = fields.filter(f => 
    !f.name.startsWith('_') && 
    !['section', 'page_break', 'divider'].includes(f.field_type)
  )

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetPortal>
        {/* Transparent overlay - matches review workspace style */}
        <SheetOverlay className="bg-black/20" />
        <SheetPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 h-full w-[60vw] md:w-[50vw] lg:w-[45vw] border-l-2 border-gray-200 bg-white shadow-2xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right overflow-hidden"
        >
          {/* Close button */}
          <SheetPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full p-2 bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="h-5 w-5 text-gray-600" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          
          {/* Header */}
          <div className="border-b border-gray-200 bg-white px-6 py-5">
            <div className="pr-12">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {formName}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{applicantName || 'Unnamed Applicant'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  <span>{applicantEmail}</span>
                </div>
                {status && (
                  <div>{getStatusBadge(status)}</div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="h-[calc(100%-100px)]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
                  <p className="mt-3 text-sm text-gray-500">Loading form data...</p>
                </div>
              </div>
            ) : submission ? (
              <ScrollArea className="h-full">
                <div className="px-6 py-6 space-y-6">
                  {/* Submission Info */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>Submitted {new Date(submission.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-5">
                    {displayFields.map((field) => {
                      const value = submission.data?.[field.id]
                      return (
                        <div key={field.id} className="group">
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">
                            {field.name}
                          </label>
                          <div className="text-base text-gray-900 bg-gray-50 p-4 rounded-lg border border-gray-100 group-hover:border-gray-200 transition-colors">
                            {formatValue(value, field.field_type)}
                          </div>
                        </div>
                      )
                    })}

                    {displayFields.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">No form responses available</p>
                        <p className="text-sm mt-1">The form data may not have been submitted yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No submission data found</p>
                  <p className="text-sm mt-1">Unable to load the form submission.</p>
                </div>
              </div>
            )}
          </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  )
}
