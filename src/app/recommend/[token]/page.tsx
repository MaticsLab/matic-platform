'use client'

import { useState, useEffect } from 'react'
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
import { Star, Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import recommendationsClient, { 
  RecommendationByTokenResponse, 
  RecommendationQuestion 
} from '@/lib/api/recommendations-client'

export default function RecommendPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    
    // Validate required fields
    const missingFields = data?.questions?.filter(q => {
      if (!q.required) return false
      const value = responses[q.id]
      if (q.type === 'checkbox') return !value
      return !value || (typeof value === 'string' && value.trim() === '')
    })

    if (missingFields && missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await recommendationsClient.submit(token, { response: responses })
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading recommendation request...</p>
        </div>
      </div>
    )
  }

  // Error state (invalid/expired link)
  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to Load</h2>
              <p className="text-slate-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Thank You!</h2>
              <p className="text-slate-600">
                Your recommendation has been submitted successfully. 
                The applicant will be notified.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const request = data?.request
  const deadline = request?.expires_at ? new Date(request.expires_at) : null
  const isExpiringSoon = deadline && (deadline.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Recommendation Request
          </h1>
          <p className="text-slate-600">
            {data?.applicant_name} has requested your recommendation for their application to{' '}
            <span className="font-medium">{data?.form_title}</span>
          </p>
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

              {/* Default questions if none configured */}
              {(!data?.questions || data.questions.length === 0) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="relationship">
                      How do you know {data?.applicant_name}? *
                    </Label>
                    <Input
                      id="relationship"
                      placeholder="e.g., Professor, Supervisor, Colleague"
                      value={responses['relationship'] || ''}
                      onChange={(e) => updateResponse('relationship', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recommendation">
                      Recommendation Letter *
                    </Label>
                    <Textarea
                      id="recommendation"
                      placeholder="Please provide your recommendation..."
                      value={responses['recommendation'] || ''}
                      onChange={(e) => updateResponse('recommendation', e.target.value)}
                      rows={10}
                      required
                    />
                  </div>
                </>
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
