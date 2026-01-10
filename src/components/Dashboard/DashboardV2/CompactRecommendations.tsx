'use client'

import { Card } from '@/ui-components/card'
import { UserCheck, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/ui-components/badge'
import { useState, useEffect } from 'react'
import { recommendationsClient } from '@/lib/api/recommendations-client'

interface CompactRecommendationsProps {
  formId: string
  rowId?: string
  isPreview?: boolean
}

interface Recommender {
  id: string
  name: string
  status: 'submitted' | 'pending' | 'not-sent'
  submittedDate?: string
}

const sampleRecommenders: Recommender[] = [
  {
    id: '1',
    name: 'Dr. Sarah Johnson',
    status: 'submitted',
    submittedDate: 'Feb 12, 2025',
  },
  {
    id: '2',
    name: 'Prof. Michael Chen',
    status: 'pending',
  },
]

export function CompactRecommendations({
  formId,
  rowId,
  isPreview = false
}: CompactRecommendationsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [recommenders, setRecommenders] = useState<Recommender[]>(isPreview ? sampleRecommenders : [])
  const [isLoading, setIsLoading] = useState(!isPreview && !!rowId)

  // Fetch real recommendations when not in preview mode
  useEffect(() => {
    if (isPreview || !rowId) return

    const fetchRecommendations = async () => {
      try {
        setIsLoading(true)
        const requests = await recommendationsClient.listFromPortal(rowId)
        
        // Transform API response to Recommender format
        const transformed: Recommender[] = requests.map(req => ({
          id: req.id,
          name: req.recommender_name,
          status: req.status === 'submitted' ? 'submitted' : 
                  req.status === 'pending' ? 'pending' : 'not-sent',
          submittedDate: req.submitted_at 
            ? new Date(req.submitted_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })
            : undefined
        }))
        
        setRecommenders(transformed)
      } catch (error: any) {
        // Silently handle 404s - endpoint may not exist yet
        if (error?.status !== 404) {
          console.error('Failed to fetch recommendations:', error)
        }
        setRecommenders([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [isPreview, rowId])

  const submittedCount = recommenders.filter(r => r.status === 'submitted').length
  const pendingRecs = recommenders.filter(r => r.status !== 'submitted')

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-600" />
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />
    }
  }

  // Show loading spinner while fetching
  if (isLoading) {
    return (
      <Card className="p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg text-gray-900">Recommendations</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </Card>
    )
  }

  // Hide if no recommendations (and not loading)
  if (recommenders.length === 0) {
    return null
  }

  return (
    <Card className="p-4 sm:p-6 border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4 touch-manipulation"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <UserCheck className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg text-gray-900">Recommendations</h2>
          <Badge variant="outline" className="text-xs">
            {submittedCount}/{recommenders.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
        )}
      </button>

      {/* Always show pending/not sent */}
      {pendingRecs.length > 0 && (
        <div className="space-y-2 mb-3">
          {pendingRecs.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getStatusIcon(rec.status)}
                <p className="text-sm text-gray-900 truncate">{rec.name}</p>
              </div>
              <span className="text-xs text-gray-600 ml-2 flex-shrink-0">
                {rec.status === 'pending' ? 'Pending' : 'Not sent'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable submitted recommendations */}
      {isExpanded && submittedCount > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Submitted</p>
          <div className="space-y-2">
            {recommenders.filter(r => r.status === 'submitted').map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-gray-700 truncate">{rec.name}</p>
                </div>
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{rec.submittedDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
