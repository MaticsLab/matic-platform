'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to main page
    router.replace('/')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Redirecting...</h1>
        <p className="text-gray-600">Taking you back to the homepage.</p>
      </div>
    </div>
  )
}
