'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

interface VisualWorkflowBuilderProps {
  workspaceId: string
  formId?: string | null
  className?: string
}

// The URL of the visual workflow builder service
const WORKFLOW_BUILDER_URL = process.env.NEXT_PUBLIC_WORKFLOW_BUILDER_URL || 'http://localhost:3001'

export function VisualWorkflowBuilder({ workspaceId, formId, className }: VisualWorkflowBuilderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const supabase = createClient()

  // Get auth token for passing to the workflow builder
  useEffect(() => {
    const getAuthToken = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Error getting session:', sessionError)
          setError('Authentication required. Please log in.')
          return
        }

        if (!session) {
          setError('Please log in to access the workflow builder.')
          return
        }

        setAuthToken(session.access_token)
        setError(null)
      } catch (err) {
        console.error('Error getting auth token:', err)
        setError('Failed to authenticate. Please refresh and try again.')
      }
    }

    getAuthToken()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session) {
        setAuthToken(session.access_token)
        setError(null)
      } else {
        setAuthToken(null)
        setError('Please log in to access the workflow builder.')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  // Build the iframe URL with auth context
  const getIframeUrl = () => {
    const url = new URL(WORKFLOW_BUILDER_URL)
    
    // Pass context parameters
    if (workspaceId) {
      url.searchParams.set('workspace_id', workspaceId)
    }
    if (formId) {
      url.searchParams.set('form_id', formId)
    }
    if (authToken) {
      // Pass token in hash to avoid it appearing in server logs
      url.hash = `token=${authToken}`
    }
    
    // Mark as embedded mode
    url.searchParams.set('embedded', 'true')
    
    return url.toString()
  }

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false)
    
    // Post auth token to iframe via postMessage for security
    if (iframeRef.current?.contentWindow && authToken) {
      iframeRef.current.contentWindow.postMessage({
        type: 'MATIC_AUTH',
        token: authToken,
        workspaceId,
        formId
      }, WORKFLOW_BUILDER_URL)
    }
  }

  // Handle iframe errors
  const handleIframeError = () => {
    setIsLoading(false)
    setError('Failed to load workflow builder. Please try again.')
  }

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Refresh the iframe
  const handleRefresh = () => {
    setIsLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = getIframeUrl()
    }
  }

  // Open in new tab
  const openInNewTab = () => {
    window.open(getIframeUrl(), '_blank')
  }

  // Show error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-gray-50 p-8", className)}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Workflow Builder</h3>
        <p className="text-gray-500 text-center mb-4 max-w-md">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Page
        </Button>
      </div>
    )
  }

  // Show loading state while waiting for auth
  if (!authToken) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-gray-50", className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-gray-500">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "relative h-full bg-white",
      isFullscreen && "fixed inset-0 z-50",
      className
    )}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="bg-white/90 backdrop-blur-sm"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className="bg-white/90 backdrop-blur-sm"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={openInNewTab}
          className="bg-white/90 backdrop-blur-sm"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-gray-500">Loading Visual Workflow Builder...</p>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={getIframeUrl()}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        allow="clipboard-write; clipboard-read"
        title="Visual Workflow Builder"
      />
    </div>
  )
}
