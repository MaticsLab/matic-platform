'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Link2, ExternalLink, AlertCircle, Loader2, Sparkles, X, ChevronRight, Globe, ArrowLeft } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { cn } from '@/lib/utils'
import { formsClient, Form } from '@/lib/api/forms-client'
import { workspacesClient, Workspace } from '@/lib/api/workspaces-client'
import { toast } from 'sonner'

interface ShareTabProps {
  formId: string | null
  isPublished: boolean
  workspaceId?: string
}

// Production domains
const FORMS_DOMAIN = 'forms.maticsapp.com'
const APP_DOMAIN = 'maticsapp.com'

type ModalStep = 'options' | 'subdomain' | 'slug' | null

export function ShareTab({ formId, isPublished, workspaceId }: ShareTabProps) {
  const [form, setForm] = useState<Form | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [customSlug, setCustomSlug] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalStep, setModalStep] = useState<ModalStep>(null)

  // For local development, use window.location.origin
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const devBaseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (formId) {
      loadForm()
    }
    if (workspaceId) {
      loadWorkspace()
    }
  }, [formId, workspaceId])

  const loadForm = async () => {
    if (!formId) return
    setIsLoading(true)
    try {
      const formData = await formsClient.get(formId)
      setForm(formData)
      setCustomSlug(formData.custom_slug || '')
    } catch (err) {
      console.error('Failed to load form:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadWorkspace = async () => {
    if (!workspaceId) return
    try {
      const wsData = await workspacesClient.get(workspaceId)
      setWorkspace(wsData)
      setSubdomain(wsData.custom_subdomain || '')
    } catch (err) {
      console.error('Failed to load workspace:', err)
    }
  }

  // Generate a suggested slug from form name
  const getSuggestedSlug = (): string => {
    if (!form?.name) return 'your-form'
    return form.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'your-form'
  }

  const handleSaveSubdomain = async () => {
    if (!workspaceId) return
    setIsSaving(true)
    setError(null)

    try {
      const subdomainValue = subdomain.trim().toLowerCase() || null
      const updatedWorkspace = await workspacesClient.updateCustomSubdomain(workspaceId, subdomainValue)
      setWorkspace(updatedWorkspace)
      setSubdomain(updatedWorkspace.custom_subdomain || '')
      toast.success(subdomainValue ? 'Subdomain saved!' : 'Subdomain removed')
      // Move to slug step after saving subdomain, pre-populate slug if empty
      if (subdomainValue) {
        if (!customSlug) {
          setCustomSlug(getSuggestedSlug())
        }
        setModalStep('slug')
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to save subdomain'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveCustomSlug = async () => {
    if (!formId) return
    setIsSaving(true)
    setError(null)

    try {
      const slugValue = customSlug.trim().toLowerCase() || null
      const updatedForm = await formsClient.updateCustomSlug(formId, slugValue)
      setForm(updatedForm)
      setCustomSlug(updatedForm.custom_slug || '')
      toast.success(slugValue ? 'Custom URL saved!' : 'Custom URL removed')
      setModalStep(null) // Close modal on success
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to save custom URL'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  // Get the current active URL (pretty if available, otherwise default)
  const getCurrentUrl = () => {
    if (hasPrettyUrl) {
      return getPrettyUrl()
    }
    return getDefaultUrl()
  }

  // Default URL: forms.maticapp.com/{UUID} (or localhost in dev)
  const getDefaultUrl = () => {
    if (!formId) return ''
    if (isDev) return `${devBaseUrl}/apply/${formId}`
    return `https://${FORMS_DOMAIN}/${formId}`
  }

  // Pretty URL: {subdomain}.maticapp.com/{custom_slug}
  const getPrettyUrl = () => {
    if (!workspace?.custom_subdomain || !form?.custom_slug) return ''
    if (isDev) return `${devBaseUrl}/apply/${form.custom_slug}` // Dev fallback
    return `https://${workspace.custom_subdomain}.${APP_DOMAIN}/${form.custom_slug}`
  }

  // Check if pretty URL is available
  const hasPrettyUrl = !!workspace?.custom_subdomain && !!form?.custom_slug

  const isValidSlug = (slug: string): boolean => {
    if (!slug) return true // Empty is valid (means remove custom slug)
    if (slug.length < 3 || slug.length > 50) return false
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) return false
    if (slug.includes('--')) return false
    return true
  }

  const isValidSubdomain = (sub: string): boolean => {
    if (!sub) return true // Empty is valid (means remove subdomain)
    if (sub.length < 3 || sub.length > 63) return false
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(sub)) return false
    if (sub.includes('--')) return false
    return true
  }

  const openCustomizeModal = () => {
    setError(null)
    // If workspace already has subdomain, go straight to slug step
    if (workspace?.custom_subdomain) {
      // Pre-populate slug with form name if not set
      if (!customSlug) {
        setCustomSlug(getSuggestedSlug())
      }
      setModalStep('slug')
    } else {
      setModalStep('options')
    }
  }

  const closeModal = () => {
    setModalStep(null)
    setError(null)
    // Reset to current values
    setSubdomain(workspace?.custom_subdomain || '')
    setCustomSlug(form?.custom_slug || '')
  }

  if (!formId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Portal Created Yet</h3>
        <p className="text-gray-500 text-sm max-w-sm">
          Save your portal first to get a shareable link. Click the Publish button to create your portal.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <>
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isPublished ? "bg-green-500" : "bg-yellow-500"
          )} />
          <span className="text-sm font-medium text-gray-700">
            {isPublished ? 'Published' : 'Draft'}
          </span>
        </div>

        {/* Main Link Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              {hasPrettyUrl ? 'Your Portal Link' : 'Portal Link'}
            </Label>
            {hasPrettyUrl && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Pretty URL
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700 truncate flex-1 font-mono">
                {getCurrentUrl()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-10"
              onClick={() => copyToClipboard(getCurrentUrl())}
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-10"
              onClick={() => window.open(getCurrentUrl(), '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>

          {/* Customize Button */}
          <Button
            variant="outline"
            className="w-full justify-between group hover:border-blue-300 hover:bg-blue-50/50"
            onClick={openCustomizeModal}
          >
            <span className="flex items-center gap-2 text-gray-700 group-hover:text-blue-700">
              <Sparkles className="w-4 h-4" />
              Customize your link
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </Button>
        </div>

        {/* Default Link (if pretty URL is active) */}
        {hasPrettyUrl && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium">Default link (always works)</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono truncate flex-1">
                {getDefaultUrl()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => copyToClipboard(getDefaultUrl())}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Customize Modal */}
      {modalStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {(modalStep === 'subdomain' || modalStep === 'slug') && (
                  <button 
                    onClick={() => setModalStep(modalStep === 'slug' && workspace?.custom_subdomain ? 'options' : 'options')}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                <h2 className="text-lg font-semibold text-gray-900">
                  {modalStep === 'options' && 'Customize your link'}
                  {modalStep === 'subdomain' && 'Set your subdomain'}
                  {modalStep === 'slug' && 'Customize your form link'}
                </h2>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Options Step */}
              {modalStep === 'options' && (
                <div className="space-y-3">
                  {/* Pretty URL Option */}
                  <button
                    onClick={() => setModalStep('subdomain')}
                    className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-blue-700">Pretty URL</p>
                      <p className="text-sm text-gray-500 truncate">
                        your-org.{APP_DOMAIN}/{getSuggestedSlug()}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 shrink-0" />
                  </button>

                  {/* Custom Domain Option (Coming Soon) */}
                  <div className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl opacity-50 cursor-not-allowed">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">Custom Domain</p>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Coming Soon</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        forms.yourdomain.com
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                  </div>
                </div>
              )}

              {/* Subdomain Step */}
              {modalStep === 'subdomain' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Choose a subdomain for your workspace. This will be used for all your forms.
                  </p>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Subdomain</Label>
                    <div className="flex items-center">
                      <Input
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="your-org"
                        className="rounded-r-none flex-1"
                        maxLength={63}
                      />
                      <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-500 whitespace-nowrap">
                        .{APP_DOMAIN}
                      </span>
                    </div>
                    
                    {subdomain && !isValidSubdomain(subdomain) && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Must be 3-63 characters, lowercase alphanumeric with hyphens
                      </p>
                    )}

                    {error && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </p>
                    )}
                  </div>

                  {/* Preview */}
                  {subdomain && isValidSubdomain(subdomain) && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium mb-1">Preview</p>
                      <p className="text-sm text-blue-800 font-mono">
                        https://{subdomain}.{APP_DOMAIN}/{getSuggestedSlug()}
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleSaveSubdomain}
                    disabled={isSaving || !subdomain || !isValidSubdomain(subdomain) || subdomain === workspace?.custom_subdomain}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {workspace?.custom_subdomain ? 'Update Subdomain' : 'Save & Continue'}
                  </Button>
                </div>
              )}

              {/* Slug Step */}
              {modalStep === 'slug' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800">
                        Subdomain: <span className="font-mono font-medium">{workspace?.custom_subdomain}.{APP_DOMAIN}</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600">
                    Now customize the path for this form.
                  </p>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Form Path</Label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-sm text-gray-500 whitespace-nowrap">
                        {workspace?.custom_subdomain}.{APP_DOMAIN}/
                      </span>
                      <Input
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder={getSuggestedSlug()}
                        className="rounded-l-none flex-1"
                        maxLength={50}
                      />
                    </div>
                    
                    {customSlug && !isValidSlug(customSlug) && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Must be 3-50 characters, lowercase alphanumeric with hyphens
                      </p>
                    )}

                    {error && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </p>
                    )}
                  </div>

                  {/* Preview */}
                  {customSlug && isValidSlug(customSlug) && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium mb-1">Your new link</p>
                      <p className="text-sm text-blue-800 font-mono">
                        https://{workspace?.custom_subdomain}.{APP_DOMAIN}/{customSlug}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setModalStep('subdomain')}
                    >
                      Change Subdomain
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSaveCustomSlug}
                      disabled={isSaving || !customSlug || !isValidSlug(customSlug) || customSlug === form?.custom_slug}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
