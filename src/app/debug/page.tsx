'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { tablesSupabase } from '@/lib/api/tables-supabase'
import { formsSupabase } from '@/lib/api/forms-supabase'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'

export default function DebugPage() {
  const [user, setUser] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [forms, setForms] = useState<any[]>([])
  const [errors, setErrors] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    setLoading(true)
    const errorLog: any = {}

    try {
      // Check authentication
      const { authClient } = await import('@/lib/better-auth-client')
      const session = await authClient.getSession()
      const currentUser = session?.data?.user
      const authError = session ? null : new Error('Not authenticated')
      if (authError) {
        errorLog.auth = authError.message
      } else {
        setUser(currentUser)

        if (currentUser) {
          // Try to fetch workspaces
          try {
            const workspaceData = await workspacesSupabase.getWorkspacesForUser(currentUser.id)
            setWorkspaces(workspaceData)
            
            if (workspaceData.length > 0) {
              const firstWorkspace = workspaceData[0]

              // Try to fetch tables
              try {
                const tableData = await tablesSupabase.getTablesByWorkspace(firstWorkspace.id)
                setTables(tableData)
              } catch (err: any) {
                errorLog.tables = err.message
              }

              // Try to fetch forms
              try {
                const formData = await formsSupabase.getFormsByWorkspace(firstWorkspace.id)
                setForms(formData)
              } catch (err: any) {
                errorLog.forms = err.message
              }

            }
          } catch (err: any) {
            errorLog.workspaces = err.message
          }
        }
      }
    } catch (err: any) {
      errorLog.general = err.message
    }

    setErrors(errorLog)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Running Diagnostics...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8">🔍 Supabase Diagnostics</h1>

        {/* Authentication Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {user ? '✅ Authenticated' : '❌ Not Authenticated'}
          </h2>
          {user ? (
            <div className="space-y-2">
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-red-600">You need to log in to see data. Go to <a href="/login" className="underline">/login</a></p>
          )}
          {errors.auth && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <strong>Auth Error:</strong> {errors.auth}
            </div>
          )}
        </div>

        {/* Workspaces */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            📁 Workspaces ({workspaces.length})
          </h2>
          {workspaces.length > 0 ? (
            <div className="space-y-2">
              {workspaces.map((ws: any) => (
                <div key={ws.id} className="p-3 bg-gray-50 rounded">
                  <p><strong>{ws.name}</strong></p>
                  <p className="text-sm text-gray-600">ID: {ws.id}</p>
                  <p className="text-sm text-gray-600">Slug: {ws.slug}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No workspaces found. Create one in the app.</p>
          )}
          {errors.workspaces && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <strong>Error:</strong> {errors.workspaces}
            </div>
          )}
        </div>

        {/* Tables */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            📊 Data Tables ({tables.length})
          </h2>
          {tables.length > 0 ? (
            <div className="space-y-2">
              {tables.map((table: any) => (
                <div key={table.id} className="p-3 bg-gray-50 rounded">
                  <p><strong>{table.name}</strong></p>
                  <p className="text-sm text-gray-600">ID: {table.id}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No tables found. Create one in the workspace.</p>
          )}
          {errors.tables && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <strong>Error:</strong> {errors.tables}
            </div>
          )}
        </div>

        {/* Forms */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            📝 Forms ({forms.length})
          </h2>
          {forms.length > 0 ? (
            <div className="space-y-2">
              {forms.map((form: any) => (
                <div key={form.id} className="p-3 bg-gray-50 rounded">
                  <p><strong>{form.name}</strong></p>
                  <p className="text-sm text-gray-600">ID: {form.id}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No forms found. Create one in the workspace.</p>
          )}
          {errors.forms && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <strong>Error:</strong> {errors.forms}
            </div>
          )}
        </div>


        {/* Environment Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">⚙️ Configuration</h2>
          <div className="space-y-2">
            <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
            <p><strong>Go API URL:</strong> {process.env.NEXT_PUBLIC_GO_API_URL || 'Not configured'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">🔄 Actions</h2>
          <button 
            onClick={runDiagnostics}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Diagnostics
          </button>
        </div>
      </div>
    </div>
  )
}
