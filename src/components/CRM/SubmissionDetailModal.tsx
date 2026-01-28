'use client'

import { useEffect, useState } from 'react'
import { goClient } from '@/lib/api/go-client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/ui-components/dialog'
import { Badge } from '@/ui-components/badge'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Loader2, FileText, Calendar, User, Mail, MapPin, Phone, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/ui-components/button'

interface SubmissionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  submissionId: string
  formId: string
  applicantName?: string
  applicantEmail?: string
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

export function SubmissionDetailModal({
  isOpen,
  onClose,
  submissionId,
  formId,
  applicantName,
  applicantEmail,
}: SubmissionDetailModalProps) {
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
      // Load the row data and form fields in parallel
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

  // Format field value for display
  function formatValue(value: any, fieldType: string): React.ReactNode {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>
    }

    // Handle different field types
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

      case 'address':
        if (typeof value === 'object') {
          return (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <span>{value.full_address || value.street_address || JSON.stringify(value)}</span>
            </div>
          )
        }
        return String(value)

      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {String(value)}
          </a>
        )

      case 'phone':
        return (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-gray-400" />
            {String(value)}
          </span>
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

      case 'multi_select':
      case 'tags':
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((v, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {String(v)}
                </Badge>
              ))}
            </div>
          )
        }
        return String(value)

      case 'repeater':
        if (Array.isArray(value)) {
          return (
            <div className="space-y-2">
              {value.map((item, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                  {typeof item === 'object' ? (
                    <div className="space-y-1">
                      {Object.entries(item)
                        .filter(([k]) => !k.startsWith('_'))
                        .map(([k, v]) => (
                          <div key={k}>
                            <span className="text-gray-500">{k}:</span>{' '}
                            <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    String(item)
                  )}
                </div>
              ))}
            </div>
          )
        }
        return String(value)

      case 'rich_text':
      case 'long_text':
        return <div className="whitespace-pre-wrap">{String(value)}</div>

      default:
        if (typeof value === 'object') {
          return <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(value, null, 2)}</pre>
        }
        return String(value)
    }
  }

  // Get a friendly field label
  function getFieldLabel(field: TableField, fieldId: string): string {
    if (field) return field.name
    // Try to make the ID more readable
    return fieldId.replace(/-/g, ' ').replace(/_/g, ' ')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {applicantName ? `${applicantName}'s Submission` : 'Submission Details'}
          </DialogTitle>
          {applicantEmail && (
            <p className="text-sm text-gray-500">{applicantEmail}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : submission ? (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Metadata section */}
              <div className="flex items-center gap-4 text-sm text-gray-500 pb-4 border-b">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Submitted: {new Date(submission.created_at).toLocaleString()}
                </div>
                {submission.metadata?.status && (
                  <Badge
                    className={
                      submission.metadata.status === 'submitted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }
                  >
                    {submission.metadata.status}
                  </Badge>
                )}
              </div>

              {/* Form responses */}
              <div className="space-y-4">
                {fields.length > 0 ? (
                  // Display in field order
                  fields
                    .sort((a, b) => a.position - b.position)
                    .filter((field) => {
                      const value = submission.data[field.id]
                      // Skip internal fields and empty values for cleaner display
                      return (
                        !field.id.startsWith('_') &&
                        value !== null &&
                        value !== undefined &&
                        value !== ''
                      )
                    })
                    .map((field) => (
                      <div key={field.id} className="border-b pb-3">
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          {field.name}
                        </label>
                        <div className="text-gray-900">
                          {formatValue(submission.data[field.id], field.field_type)}
                        </div>
                      </div>
                    ))
                ) : (
                  // Fallback: display all data fields
                  Object.entries(submission.data)
                    .filter(([key]) => !key.startsWith('_'))
                    .map(([key, value]) => (
                      <div key={key} className="border-b pb-3">
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          {key.replace(/-/g, ' ').replace(/_/g, ' ')}
                        </label>
                        <div className="text-gray-900">{formatValue(value, 'text')}</div>
                      </div>
                    ))
                )}
              </div>

              {/* Internal metadata (collapsed by default) */}
              {submission.data._applicant_email && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Submission Info</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    {submission.data._applicant_email && (
                      <div>Email: {submission.data._applicant_email}</div>
                    )}
                    {submission.data._ip_address && (
                      <div>IP: {submission.data._ip_address}</div>
                    )}
                    {submission.data._user_agent && (
                      <div className="truncate">Browser: {submission.data._user_agent}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-gray-500">
            Submission not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
