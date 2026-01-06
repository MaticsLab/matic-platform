"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/better-auth-client'
import { organizationsClient } from '@/lib/api/organizations-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { Loader2 } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    workspaceName: ''
  })

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      // Validate password length
      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }

      // Validate workspace name
      if (!formData.workspaceName.trim()) {
        throw new Error('Workspace name is required')
      }

      // Create Better Auth user
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      
      const signUpResult = await authClient.signUp.email({
        email: formData.email,
        password: formData.password,
        name: fullName,
      })

      if (signUpResult.error) {
        if (signUpResult.error.message?.includes('already') || signUpResult.error.message?.includes('exists')) {
          setError('This email is already registered. Please login instead.')
          setTimeout(() => router.push('/login'), 2000)
          return
        }
        throw new Error(signUpResult.error.message || 'Failed to create account')
      }
      
      if (!signUpResult.data?.user) {
        throw new Error('Failed to create account')
      }

      // 3. Check if user already has workspaces
      try {
        const existingWorkspaces = await workspacesClient.list()
        if (existingWorkspaces && existingWorkspaces.length > 0) {
          console.log('User already has workspaces, redirecting...')
          router.push(`/workspace/${existingWorkspaces[0].slug}`)
          return
        }
      } catch (err) {
        console.log('No existing workspaces found, creating new ones...')
      }

      // 4. Create organization for the user
      const legacyOrgSlug = formData.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-org'

      console.log('Creating organization:', { name: `${formData.workspaceName} Organization`, slug: legacyOrgSlug })

      const organization = await organizationsClient.create({
        name: `${formData.workspaceName} Organization`,
        slug: legacyOrgSlug,
        description: `Organization for ${formData.workspaceName}`
      })

      console.log('Organization created:', organization.id)

      // 5. Create the user's first workspace within the organization
      const legacyWorkspaceSlug = formData.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      console.log('Creating workspace:', { 
        name: formData.workspaceName, 
        slug: legacyWorkspaceSlug, 
        organizationId: organization.id 
      })

      const workspace = await workspacesClient.create({
        organization_id: organization.id,
        name: formData.workspaceName,
        slug: legacyWorkspaceSlug
      })

      console.log('Workspace created:', workspace.id)

      // 6. Redirect to the new workspace
      router.push(`/workspace/${workspace.slug}`)
    } catch (err: any) {
      console.error('Signup error:', err)
      
      // Provide more specific error messages
      let errorMessage = err.message || 'Failed to create account'
      
      if (err.message?.includes('organization_id')) {
        errorMessage = 'Failed to create organization. Please ensure the backend is running on port 8080.'
      } else if (err.message?.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend server. Please ensure it is running on port 8080.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:bg-[#181818] dark:text-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-[#FAFAFA] mb-2">Matic</h1>
          <p className="text-gray-600 dark:text-[#FAFAFA]/80">Create your account and workspace</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[#FAFAFA] mb-6">Sign Up</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-[#232323] border border-red-200 dark:border-red-400 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* First Name and Last Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
                  placeholder="John"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
                  placeholder="Doe"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
                placeholder="At least 6 characters"
                disabled={loading}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
                placeholder="Re-enter your password"
                disabled={loading}
              />
            </div>

            {/* Workspace Name */}
            <div className="pt-4 border-t border-gray-200">
              <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700 mb-1">
                Workspace Name
              </label>
              <input
                id="workspaceName"
                type="text"
                required
                value={formData.workspaceName}
                onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Company"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be your first workspace. You can create more later.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account & Workspace'
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-[#FAFAFA]/80">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
