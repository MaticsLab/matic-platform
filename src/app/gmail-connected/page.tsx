'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

function GmailConnectedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const handleClose = () => {
    // Try to close the window first (works if opened as popup)
    window.close()
    // If we're still here, go back in history or redirect to home
    if (window.history.length > 2) {
      window.history.go(-2) // Go back 2 pages (before OAuth redirect)
    } else {
      router.push('/')
    }
  }

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'true') {
      setStatus('success')
      setMessage('Gmail connected successfully! You can now send emails from the platform.')
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose()
      }, 2000)
    } else if (error) {
      setStatus('error')
      const errorMessages: Record<string, string> = {
        cancelled: 'Gmail connection was cancelled.',
        invalid_callback: 'Invalid callback. Please try again.',
        invalid_workspace: 'Invalid workspace. Please try again.',
        token_exchange_failed: 'Failed to get access token. Please try again.',
        gmail_service_failed: 'Failed to connect to Gmail service. Please try again.',
        profile_fetch_failed: 'Failed to fetch Gmail profile. Please try again.',
        save_failed: 'Failed to save connection. The database table may need to be created. Please contact support.',
      }
      setMessage(errorMessages[error] || `An error occurred: ${error}`)
    } else {
      setStatus('loading')
      setMessage('Processing...')
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Connecting Gmail...</h1>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Gmail Connected!</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">Redirecting you back...</p>
            <button
              onClick={handleClose}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Close
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Connection Failed</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Go Back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function GmailConnectedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <GmailConnectedContent />
    </Suspense>
  )
}
