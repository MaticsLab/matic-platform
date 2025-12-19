'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Link2, ExternalLink, AlertCircle, Loader2, Sparkles, X, ChevronRight, Globe, ArrowLeft, Upload, Edit2, Image as ImageIcon, FileDown } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'
import { cn } from '@/lib/utils'
import { formsClient, Form } from '@/lib/api/forms-client'
import { workspacesClient, Workspace } from '@/lib/api/workspaces-client'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

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
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewDescription, setPreviewDescription] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [isEditingPreview, setIsEditingPreview] = useState(false)
  const [isSavingPreview, setIsSavingPreview] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // For dev/preview environments, use window.location.origin
  // This includes localhost and Vercel preview deployments (*.vercel.app)
  const isDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('vercel.app')
  )
  const devBaseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Load data on mount and when formId/workspaceId changes
  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const promises: Promise<any>[] = []
        if (formId) {
          promises.push(
            formsClient.get(formId).then((formData) => {
              setForm(formData)
              setCustomSlug(formData.custom_slug || '')
              setPreviewTitle(formData.preview_title || formData.name)
              setPreviewDescription(formData.preview_description || formData.description || '')
              setPreviewImageUrl(formData.preview_image_url || '')
            })
          )
        }
        if (workspaceId) {
          promises.push(
            workspacesClient.get(workspaceId).then((wsData) => {
              setWorkspace(wsData)
              setSubdomain(wsData.custom_subdomain || '')
            })
          )
        }
        await Promise.all(promises)
      } catch (err) {
        console.error('Failed to load share data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [formId, workspaceId])

  const loadForm = async () => {
    if (!formId) return
    setIsLoading(true)
    try {
      const formData = await formsClient.get(formId)
      setForm(formData)
      setCustomSlug(formData.custom_slug || '')
      setPreviewTitle(formData.preview_title || formData.name)
      setPreviewDescription(formData.preview_description || formData.description || '')
      setPreviewImageUrl(formData.preview_image_url || '')
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

  // Default URL: forms.maticapp.com/{UUID} or dev URL when in dev environment
  const getDefaultUrl = () => {
    if (!formId) return ''
    // In dev/preview, use /apply/[formId] route
    if (isDev) {
      return `${devBaseUrl}/apply/${formId}`
    }
    return `https://${FORMS_DOMAIN}/${formId}`
  }

  // Pretty URL: {subdomain}.maticapp.com/{custom_slug} or dev URL with custom_slug
  const getPrettyUrl = () => {
    if (!workspace?.custom_subdomain || !form?.custom_slug) return ''
    // In dev/preview, use /apply/[custom_slug] route
    if (isDev) {
      return `${devBaseUrl}/apply/${form.custom_slug}`
    }
    return `https://${workspace.custom_subdomain}.${APP_DOMAIN}/${form.custom_slug}`
  }

  // Check if pretty URL is available
  const hasPrettyUrl = !!workspace?.custom_subdomain && !!form?.custom_slug
  
  // Check if subdomain is set but slug is missing (incomplete setup)
  const hasIncompleteSetup = !!workspace?.custom_subdomain && !form?.custom_slug

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

  const handleSavePreview = async () => {
    if (!formId) return
    setIsSavingPreview(true)
    try {
      const updatedForm = await formsClient.update(formId, {
        preview_title: previewTitle || null,
        preview_description: previewDescription || null,
        preview_image_url: previewImageUrl || null
      })
      setForm(updatedForm)
      setIsEditingPreview(false)
      toast.success('Preview updated successfully')
    } catch (err: any) {
      console.error('Failed to update preview:', err)
      toast.error(err?.message || 'Failed to update preview')
    } finally {
      setIsSavingPreview(false)
    }
  }

  const handleExportPDF = () => {
    if (!form) return

    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.print()
      return
    }

    // Generate PDF content
    const pdfContent = generatePDFContent()
    
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => printWindow.close()
    }
  }

  const generatePDFContent = () => {
    if (!form) return ''

    const formName = form.name || 'Application Form'
    const formDescription = form.description || ''
    const logoUrl = (form.settings as any)?.logoUrl || ''
    
    // Get sections metadata from settings
    const sections = (form.settings as any)?.sections || []
    // Get all fields from the form (flat array)
    const allFields = form.fields || []
    
    // Build a map of section_id -> fields with nested structure
    const buildNestedFields = (fields: any[], sectionId: string): any[] => {
      // First, get all fields for this section
      const sectionFields = fields.filter(f => {
        const fieldSectionId = (f.config as any)?.section_id || f.section_id
        return fieldSectionId === sectionId
      })
      
      // Build parent-child relationships
      // Fields with children store them in config.fields (for groups/repeaters)
      const fieldMap = new Map()
      sectionFields.forEach(f => fieldMap.set(f.id, { ...f, children: [] }))
      
      // Now check each field's config to see if it has subfields
      sectionFields.forEach(field => {
        const configFields = (field.config as any)?.fields
        if (configFields && Array.isArray(configFields)) {
          // This field (group or repeater) has children defined in config
          const parentField = fieldMap.get(field.id)
          if (parentField) {
            // Map config field IDs to actual field objects
            parentField.children = configFields.map((cfId: string) => {
              const childField = allFields.find((f: any) => f.id === cfId)
              return childField ? { ...childField, children: [] } : null
            }).filter((f: any) => f !== null)
          }
        }
      })
      
      // Return only top-level fields (those not referenced as children)
      const allChildIds = new Set()
      fieldMap.forEach(field => {
        field.children.forEach((c: any) => allChildIds.add(c.id))
      })
      
      return Array.from(fieldMap.values()).filter(f => !allChildIds.has(f.id))
    }
    
    // Helper function to render a field and its subfields
    const renderField = (field: any, indent: number = 0): string => {
      const isRequired = (field.config as any)?.is_required || field.required ? '<span style="color: #dc2626;">*</span>' : ''
      const description = (field.config as any)?.description || field.description || ''
      const indentPadding = indent * 20
      
      // Handle groups - render the group label and all subfields
      if (field.type === 'group') {
        const subfields = field.children || []
        if (subfields.length === 0) return '' // Skip empty groups
        
        let groupHtml = `
          <tr>
            <td colspan="2" style="padding: 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600; color: #111827; padding-left: ${indentPadding}px;">
                ${field.label}${isRequired}
              </div>
              ${description ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px; padding-left: ${indentPadding}px;">${description}</div>` : ''}
            </td>
          </tr>
        `
        // Render all subfields within the group
        subfields.forEach((subfield: any) => {
          groupHtml += renderField(subfield, indent + 1)
        })
        return groupHtml
      }
      
      // Handle repeaters - show the repeater label and subfields
      if (field.type === 'repeater') {
        const subfields = field.children || []
        if (subfields.length === 0) return '' // Skip empty repeaters
        
        let repeaterHtml = `
          <tr>
            <td colspan="2" style="padding: 12px; background: #fef3c7; border-bottom: 1px solid #fde68a;">
              <div style="font-weight: 600; color: #92400e; padding-left: ${indentPadding}px;">
                ${field.label}${isRequired}
                <span style="font-size: 11px; font-weight: normal; color: #b45309; margin-left: 8px;">(Repeatable section - can add multiple entries)</span>
              </div>
              ${description ? `<div style="font-size: 11px; color: #b45309; margin-top: 4px; padding-left: ${indentPadding}px;">${description}</div>` : ''}
            </td>
          </tr>
        `
        // Show subfields once as template
        repeaterHtml += `
          <tr>
            <td colspan="2" style="padding: 8px 12px; padding-left: ${indentPadding + 20}px; background: #fffbeb; border-bottom: 1px solid #fde68a;">
              <div style="font-size: 11px; color: #92400e; margin-bottom: 8px;">Entry 1:</div>
            </td>
          </tr>
        `
        subfields.forEach((subfield: any) => {
          repeaterHtml += renderField(subfield, indent + 2)
        })
        // Add space for additional entries
        repeaterHtml += `
          <tr>
            <td colspan="2" style="padding: 8px 12px; padding-left: ${indentPadding + 20}px; background: #fffbeb; border-bottom: 1px solid #fde68a;">
              <div style="font-size: 11px; color: #92400e; font-style: italic;">Additional entries can be added...</div>
            </td>
          </tr>
        `
        return repeaterHtml
      }
      
      // Skip dividers and paragraphs
      if (field.type === 'divider' || field.type === 'paragraph') {
        return ''
      }
      
      // Regular field
      return `
        <tr>
          <td style="padding: 10px 12px; padding-left: ${12 + indentPadding}px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 35%; vertical-align: top;">
            ${field.label}${isRequired}
            ${description ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">${description}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">
            <div style="min-height: 20px; color: #9ca3af;">[To be filled]</div>
          </td>
        </tr>
      `
    }

    // Generate HTML for each section
    let sectionsHtml = ''
    
    if (sections.length > 0) {
      sections.filter((s: any) => s.sectionType === 'form').forEach((section: any) => {
        // Build nested field structure for this section
        const sectionFields = buildNestedFields(allFields, section.id)
        if (sectionFields.length === 0) return

        let fieldsHtml = ''
        sectionFields.forEach((field: any) => {
          fieldsHtml += renderField(field)
        })
        
        sectionsHtml += `
          <div style="margin-bottom: 24px; break-inside: avoid;">
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">${section.title}</h2>
            ${section.description ? `<p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">${section.description}</p>` : ''}
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              ${fieldsHtml}
            </table>
          </div>
        `
      })
    } else {
      // No sections - use flat fields array as fallback
      let fieldsHtml = ''
      allFields.forEach((field: any) => {
        fieldsHtml += renderField(field)
      })
      
      sectionsHtml = `
        <div style="margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            ${fieldsHtml}
          </table>
        </div>
      `
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${formName} - Application Form</title>
        <style>
          @page {
            margin: 0.75in;
            size: letter;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            line-height: 1.5;
            margin: 0;
            padding: 0;
          }
          .header {
            border-bottom: 3px solid #111827;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
          }
          .logo {
            max-height: 50px;
            max-width: 150px;
          }
          .app-title {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
          }
          .app-description {
            font-size: 14px;
            color: #6b7280;
            margin-top: 8px;
            line-height: 1.6;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : ''}
            <div class="app-title">${formName}</div>
          </div>
          ${formDescription ? `<div class="app-description">${formDescription}</div>` : ''}
        </div>
        
        ${sectionsHtml}
        
        <div class="footer">
          <p>This blank application form was generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `
  }

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG or JPG)')
      return
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast.error('File size must be less than 2MB')
      return
    }

    setIsUploading(true)
    try {
      const supabase = createClient()
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${formId}-preview-${Date.now()}.${fileExt}`
      const filePath = `form-previews/${fileName}`
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.error('Failed to upload image')
        return
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('workspace-assets')
        .getPublicUrl(filePath)
      
      setPreviewImageUrl(publicUrl)
      toast.success('Image uploaded successfully')
    } catch (err: any) {
      console.error('Failed to upload image:', err)
      toast.error('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
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

        {/* Share Preview Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Change share preview</h3>
              <p className="text-xs text-gray-500 mt-0.5">Customize how your form appears when shared</p>
            </div>
            {!isEditingPreview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingPreview(true)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            {isEditingPreview ? (
              <>
                {/* Thumbnail Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Thumbnail Image</Label>
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center space-y-3 transition-all",
                      isDragging 
                        ? "border-blue-400 bg-blue-50" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <p className="text-sm text-gray-600">Uploading image...</p>
                      </div>
                    ) : previewImageUrl ? (
                      <div className="space-y-3">
                        <img
                          src={previewImageUrl}
                          alt="Preview"
                          className="mx-auto max-h-32 rounded-lg object-contain"
                        />
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Change
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewImageUrl('')}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Add a thumbnail image</p>
                          <p className="text-xs text-gray-500 mt-1">PNG or JPG (max. 2GB)</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="mx-auto"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Image
                          </Button>
                          <p className="text-xs text-gray-500">or drag and drop</p>
                        </div>
                        <Input
                          type="url"
                          placeholder="Or enter image URL..."
                          value={previewImageUrl}
                          onChange={(e) => setPreviewImageUrl(e.target.value)}
                          className="max-w-md mx-auto"
                        />
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </div>
                </div>

                {/* Preview Title */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview Title</Label>
                  <Input
                    value={previewTitle}
                    onChange={(e) => setPreviewTitle(e.target.value)}
                    placeholder={form?.name || 'Form title'}
                    maxLength={100}
                  />
                </div>

                {/* Preview Description */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview Description</Label>
                  <Textarea
                    value={previewDescription}
                    onChange={(e) => setPreviewDescription(e.target.value)}
                    placeholder="A brief description of your form..."
                    maxLength={200}
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    {previewDescription.length}/200 characters
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingPreview(false)
                      setPreviewTitle(form?.preview_title || form?.name || '')
                      setPreviewDescription(form?.preview_description || form?.description || '')
                      setPreviewImageUrl(form?.preview_image_url || '')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePreview}
                    disabled={isSavingPreview}
                  >
                    {isSavingPreview ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Preview Display */}
                {previewImageUrl && (
                  <img
                    src={previewImageUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">
                    {previewTitle || form?.name || 'Form Title'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {previewDescription || form?.description || 'No description provided.'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Export Blank PDF */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Export Blank Application</h3>
            <p className="text-xs text-gray-500 mt-0.5">Download a PDF version of your form to print or share</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <FileDown className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 mb-1">Blank Application Form</h4>
                <p className="text-xs text-gray-600 mb-3">
                  Generate a printable PDF with all form fields, your logo, and application name. Perfect for offline applications or physical submissions.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="w-full sm:w-auto"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download Blank PDF
                </Button>
              </div>
            </div>
          </div>
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

          {/* Incomplete Setup Warning */}
          {hasIncompleteSetup && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-amber-800 font-medium">Almost there!</p>
                <p className="text-xs text-amber-700">
                  Your subdomain <span className="font-mono font-medium">{workspace?.custom_subdomain}</span> is set up. 
                  Click "Customize your link" to add a custom slug and activate your pretty URL.
                </p>
              </div>
            </div>
          )}

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
