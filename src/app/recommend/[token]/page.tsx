'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Alert, AlertDescription } from '@/ui-components/alert'
import { Checkbox } from '@/ui-components/checkbox'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/ui-components/select'
import { Star, Loader2, CheckCircle, XCircle, Clock, AlertCircle, Upload, FileText, X, User, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import recommendationsClient, { 
  RecommendationByTokenResponse, 
  RecommendationQuestion 
} from '@/lib/api/recommendations-client'
import { createClient } from '@/lib/supabase'

// File Upload Component
function FileUpload({ value, onChange }: { value?: File | null; onChange: (file: File | null) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (isValidFile(file)) {
        onChange(file)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (isValidFile(file)) {
        onChange(file)
      }
    }
  }

  const isValidFile = (file: File) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF or Word document')
      return false
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB')
      return false
    }
    return true
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <FileText className="h-8 w-8 text-slate-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{value.name}</p>
          <p className="text-xs text-slate-500">{formatFileSize(value.size)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        dragActive ? "border-slate-500 bg-slate-50" : "border-slate-300 hover:border-slate-400"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleChange}
        className="hidden"
      />
      <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
      <p className="text-sm text-slate-600">
        <span className="text-slate-800 font-medium">Click to upload</span> or drag and drop
      </p>
      <p className="text-xs text-slate-400 mt-1">PDF or Word documents (max 10MB)</p>
    </div>
  )
}

export default function RecommendPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [data, setData] = useState<RecommendationByTokenResponse | null>(null)
  const [responses, setResponses] = useState<Record<string, any>>({})

  // Load recommendation request data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await recommendationsClient.getByToken(token)
        setData(result)
        
        // Initialize responses with empty values
        const initialResponses: Record<string, any> = {}
        result.questions?.forEach(q => {
          initialResponses[q.id] = q.type === 'checkbox' ? false : ''
        })
        setResponses(initialResponses)
      } catch (err: any) {
        setError(err.message || 'Failed to load recommendation request')
        // Check for details in the error response
        if (err.response?.details) {
          setErrorDetails(err.response.details)
        }
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadData()
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required custom questions
    const missingFields = data?.questions?.filter(q => {
      if (!q.required) return false
      const value = responses[q.id]
      if (q.type === 'checkbox') return !value
      return !value || (typeof value === 'string' && value.trim() === '')
    }) || []

    // Validate relationship if required
    if (data?.require_relationship && (!responses['relationship'] || responses['relationship'].trim() === '')) {
      missingFields.push({ label: 'How do you know the applicant' } as any)
    }

    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    // Extract file from responses before sending
    const file = responses['document'] as File | null | undefined
    const responsesToSend = { ...responses }
    delete responsesToSend['document'] // Remove file from JSON payload

    try {
      setSubmitting(true)
      setError(null)

      // If a file was selected, upload it directly from the browser to Supabase Storage
      if (file) {
        const supabase = createClient()
        const ext = file.name.split('.').pop()
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
        const storagePath = `uploads/recommendations/${token}/${uniqueName}`
        const { error: uploadErr } = await supabase.storage
          .from('workspace-assets')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })
        if (uploadErr) throw new Error(`Failed to upload file: ${uploadErr.message}`)
        const { data: { publicUrl } } = supabase.storage.from('workspace-assets').getPublicUrl(storagePath)
        responsesToSend['uploaded_document'] = {
          url: publicUrl,
          filename: file.name,
          size: file.size,
          type: file.type,
        }
      }

      // Submit as plain JSON (no multipart) — file URL already included above
      await recommendationsClient.submit(token, { response: responsesToSend })
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to submit recommendation')
    } finally {
      setSubmitting(false)
    }
  }

  const updateResponse = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Loading recommendation request...</p>
        </div>
      </div>
    )
  }

  // Error state (invalid/expired link)
  if (error && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 border border-red-200 mb-4">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to Load</h2>
              <p className="text-slate-600 mb-2">{error}</p>
              {errorDetails && (
                <p className="text-sm text-slate-500 mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {errorDetails}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already submitted - show read-only view of what they submitted
  if (data?.already_submitted) {
    const request = data.request
    const submittedResponse = request?.response || {}
    const uploadedDoc = submittedResponse['uploaded_document'] as { url?: string; filename?: string } | undefined
    const submittedAt = request?.submitted_at ? new Date(request.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    return (
      <div className="min-h-screen bg-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {data.logo_url && (
            <div className="flex justify-center mb-8">
              <img src={data.logo_url} alt={data.form_title} className="max-h-16 max-w-[200px] object-contain" />
            </div>
          )}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 mb-4">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Recommendation Submitted</h1>
            {submittedAt && <p className="text-sm text-slate-500">Submitted on {submittedAt}</p>}
            <p className="text-slate-600 mt-2">Thank you, <strong>{request?.recommender_name}</strong>. Your recommendation for <strong>{data.form_title}</strong> has been received.</p>
          </div>
          {(data.questions?.length > 0 || uploadedDoc) && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-semibold text-slate-800">Your Submission</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {data.questions?.map((q) => {
                  const val = submittedResponse[q.id]
                  if (val === undefined || val === '' || val === false) return null
                  return (
                    <div key={q.id}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{q.label}</p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{String(val)}</p>
                    </div>
                  )
                })}
                {uploadedDoc?.url && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Uploaded Document</p>
                    <a href={uploadedDoc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 underline">
                      <FileText className="h-4 w-4" />
                      {uploadedDoc.filename || 'View Document'}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // Success state (just submitted in this session)
  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {data?.logo_url && (
            <div className="flex justify-center mb-6">
              <img src={data.logo_url} alt={data.form_title} className="max-h-14 max-w-[180px] object-contain" />
            </div>
          )}
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 mb-4">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Thank You!</h2>
                <p className="text-slate-600">
                  Your recommendation has been submitted successfully.
                  The applicant will be notified.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const request = data?.request
  const deadline = request?.expires_at ? new Date(request.expires_at) : null
  const isExpiringSoon = deadline && (deadline.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000

  return (
    <div className="min-h-screen bg-[#fafafa] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Form logo */}
        {data?.logo_url && (
          <div className="flex justify-center mb-6">
            <img src={data.logo_url} alt={data.form_title} className="max-h-16 max-w-[220px] object-contain" />
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Recommendation Request
          </h1>
          <p className="text-slate-600">
            <span className="font-medium">{data?.applicant_name || 'An applicant'}</span> has requested your recommendation for their application to{' '}
            <span className="font-medium">{data?.form_title}</span>
          </p>
          {/* Applicant Info Card */}
          {(data?.applicant_name || data?.applicant_email) && (
            <div className="mt-4 inline-flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              {data?.applicant_name && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>{data.applicant_name}</span>
                </div>
              )}
              {data?.applicant_email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{data.applicant_email}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deadline warning */}
        {deadline && (
          <Alert 
            className={cn(
              "mb-6",
              isExpiringSoon ? "border-amber-300 bg-amber-50" : "border-slate-200"
            )}
          >
            <Clock className={cn("h-4 w-4", isExpiringSoon ? "text-amber-600" : "text-slate-600")} />
            <AlertDescription className={isExpiringSoon ? "text-amber-800" : ""}>
              {isExpiringSoon ? (
                <strong>Deadline approaching: </strong>
              ) : (
                'Deadline: '
              )}
              {deadline.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              {' at '}
              {deadline.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </AlertDescription>
          </Alert>
        )}

        {/* Error display */}
        {error && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        {data?.instructions && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 whitespace-pre-wrap">{data.instructions}</p>
            </CardContent>
          </Card>
        )}

        {/* Recommendation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Recommendation</CardTitle>
            <CardDescription>
              Please complete all required fields marked with *
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {data?.questions?.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={responses[question.id]}
                  onChange={(value) => updateResponse(question.id, value)}
                />
              ))}

              {/* Relationship question - only if enabled in settings */}
              {data?.require_relationship && (
                <div className="space-y-2">
                  <Label htmlFor="relationship">
                    How do you know {data?.applicant_name || 'the applicant'}? *
                  </Label>
                  <Input
                    id="relationship"
                    placeholder="e.g., Professor, Supervisor, Colleague"
                    value={responses['relationship'] || ''}
                    onChange={(e) => updateResponse('relationship', e.target.value)}
                    required
                  />
                </div>
              )}

              {/* File Upload - only if enabled in settings or no questions configured (legacy support) */}
              {(data?.show_file_upload || (!data?.questions || data.questions.length === 0)) && (
                <div className="space-y-2">
                  <Label htmlFor="document">
                    Upload Letter Document {data?.show_file_upload ? '(Optional)' : ''}
                  </Label>
                  <p className="text-sm text-slate-500 mb-2">
                    You can upload a PDF or Word document with your letter of recommendation.
                  </p>
                  <FileUpload 
                    value={responses['document']}
                    onChange={(file) => updateResponse('document', file)}
                  />
                </div>
              )}

              {/* Show message if no questions configured */}
              {(!data?.questions || data.questions.length === 0) && !data?.require_relationship && (
                <div className="text-center py-8 text-slate-500">
                  <p>Please upload your letter of recommendation using the file upload above.</p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Recommendation'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Your recommendation will be kept confidential and shared only with the review committee.
        </p>
      </div>
    </div>
  )
}

// Question Field Component
interface QuestionFieldProps {
  question: RecommendationQuestion
  value: any
  onChange: (value: any) => void
}

function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  const label = (
    <Label htmlFor={question.id} className="flex items-center gap-1">
      {question.label}
      {question.required && <span className="text-red-500">*</span>}
    </Label>
  )

  const description = question.description && (
    <p className="text-sm text-slate-500 mt-1">{question.description}</p>
  )

  switch (question.type) {
    case 'text':
      return (
        <div className="space-y-2">
          {label}
          {description}
          <Input
            id={question.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={question.max_length}
            required={question.required}
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="space-y-2">
          {label}
          {description}
          <Textarea
            id={question.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={question.max_length}
            rows={5}
            required={question.required}
          />
          {question.max_length && (
            <p className="text-xs text-slate-400 text-right">
              {(value || '').length} / {question.max_length}
            </p>
          )}
        </div>
      )

    case 'rating':
      const maxRating = question.max_rating || 5
      return (
        <div className="space-y-2">
          {label}
          {description}
          <div className="flex gap-1">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(rating)}
                className="p-1 transition-colors"
              >
                <Star
                  className={cn(
                    "h-8 w-8 transition-colors",
                    rating <= (value || 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-slate-300 hover:text-yellow-300"
                  )}
                />
              </button>
            ))}
          </div>
          {value && (
            <p className="text-sm text-slate-600">
              {value} out of {maxRating} stars
            </p>
          )}
        </div>
      )

    case 'select':
      return (
        <div className="space-y-2">
          {label}
          {description}
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    case 'checkbox':
      return (
        <div className="flex items-start space-x-3">
          <Checkbox
            id={question.id}
            checked={value || false}
            onCheckedChange={onChange}
          />
          <div className="space-y-1 leading-none">
            <Label htmlFor={question.id} className="cursor-pointer">
              {question.label}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {description}
          </div>
        </div>
      )

    default:
      return null
  }
}
