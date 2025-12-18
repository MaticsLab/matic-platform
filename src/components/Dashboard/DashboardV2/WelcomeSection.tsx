'use client'

import { Badge } from '@/ui-components/badge'

interface WelcomeSectionProps {
  email: string
  applicationStatus: string
  welcomeTitle?: string
  welcomeText?: string
  submissionData?: Record<string, any>
}

const getStatusDisplay = (status: string) => {
  const statusMap: Record<string, { label: string; className: string }> = {
    'draft': { label: 'Draft', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
    'submitted': { label: 'Submitted', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
    'under_review': { label: 'Under Review', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
    'approved': { label: 'Approved', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
    'rejected': { label: 'Rejected', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
    'revision_requested': { label: 'Revision Requested', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
    'pending': { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
    'in_progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  }
  
  return statusMap[status] || statusMap['draft']
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const getUserName = (email: string) => {
  const name = email.split('@')[0]
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[._-]/g, ' ')
}

/**
 * Parse and replace {{variable}} mentions with actual values
 */
const parseText = (text: string, data: Record<string, any>, email: string): string => {
  if (!text) return text
  
  // Extract first name and full name from data or email
  const firstName = data.firstName || data.first_name || getUserName(email).split(' ')[0]
  const fullName = data.fullName || data.full_name || data.name || getUserName(email)
  
  // Replace built-in variables
  let parsed = text
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{fullName\}\}/g, fullName)
    .replace(/\{\{email\}\}/g, email)
  
  // Replace field-specific variables (by field ID)
  Object.keys(data).forEach(key => {
    const value = data[key]
    if (value !== null && value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      parsed = parsed.replace(regex, String(value))
    }
  })
  
  return parsed
}

export function WelcomeSection({
  email,
  applicationStatus,
  welcomeTitle,
  welcomeText,
  submissionData = {}
}: WelcomeSectionProps) {
  const statusDisplay = getStatusDisplay(applicationStatus)
  const userName = getUserName(email)
  
  // Parse custom text or use default with dynamic greeting
  const displayTitle = welcomeTitle 
    ? parseText(welcomeTitle, submissionData, email)
    : `${getGreeting()}, ${userName} 👋`
    
  const displayText = welcomeText
    ? parseText(welcomeText, submissionData, email)
    : "Here's an overview of your scholarship application."
  
  return (
    <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
      <div className="flex-1">
        <h1 className="text-xl sm:text-2xl text-gray-900 mb-1">
          {displayTitle}
        </h1>
        <p className="text-sm text-gray-600">
          {displayText}
        </p>
      </div>
      
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
          <span className="text-xs text-gray-600">Status</span>
          <Badge className={`text-xs ${statusDisplay.className}`}>
            {statusDisplay.label}
          </Badge>
        </div>
      </div>
    </div>
  )
}
