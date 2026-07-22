'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Upload, Image as ImageIcon, Loader2, X, Maximize2,
  MoreVertical, Pencil, Copy, Star, Trash2, Save, Plus
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui-components/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Switch } from '@/ui-components/switch'
import { Slider } from '@/ui-components/slider'
import { PortalConfig, PortalTheme } from '@/types/portal'
import { storageClient } from '@/lib/api/storage-client'
import { portalThemesClient, PortalThemeInput } from '@/lib/api/portal-themes-client'
import { GOOGLE_FONTS, DEFAULT_FONT_KEY, getGoogleFont } from '@/lib/fonts'
import { useGoogleFont } from '@/hooks/useGoogleFont'
import { meetsWCAGAA } from '@/lib/utils/contrast'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ColorPicker } from './ColorPicker'

type FormTheme = NonNullable<PortalConfig['settings']['formTheme']>
type ImagePosition = NonNullable<FormTheme['imagePosition']>

interface PageThemeSettingsProps {
  pageType: 'login' | 'signup' | 'sections'
  settings: PortalConfig['settings']
  onUpdate: (updates: Partial<PortalConfig['settings']>) => void
  formId?: string
  workspaceId?: string
  onTabChange?: (tab: 'login' | 'signup') => void
}

const THEME_FIELD_KEYS = [
  'questionsBackgroundColor', 'primaryColor', 'questionsColor', 'answersColor',
  'showLogo', 'logoUrls', 'font', 'imagePosition',
  'coverImageUrl', 'coverImageBrightness', 'questionSize',
] as const

function formThemeEqual(a?: FormTheme, b?: FormTheme): boolean {
  for (const key of THEME_FIELD_KEYS) {
    const av = a?.[key]
    const bv = b?.[key]
    if (Array.isArray(av) || Array.isArray(bv)) {
      if (JSON.stringify(av || []) !== JSON.stringify(bv || [])) return false
    } else if (av !== bv) {
      return false
    }
  }
  return true
}

function themeToFormTheme(theme: PortalTheme): FormTheme {
  return {
    questionsBackgroundColor: theme.colors.questions_background_color,
    primaryColor: theme.colors.primary_color,
    questionsColor: theme.colors.questions_color,
    answersColor: theme.colors.answers_color,
    showLogo: theme.logo.enabled,
    logoUrls: theme.logo.urls,
    font: theme.font,
    imagePosition: theme.image.position,
    coverImageUrl: theme.image.asset_url,
    coverImageBrightness: theme.image.brightness,
    questionSize: theme.question_size,
  }
}

function formThemeToThemeInputFields(formTheme?: FormTheme, legacyThemeColor?: string): Omit<PortalThemeInput, 'workspace_id' | 'name'> {
  return {
    colors: {
      questions_background_color: formTheme?.questionsBackgroundColor || '#F8FAFC',
      primary_color: formTheme?.primaryColor || legacyThemeColor || '#0F172A',
      questions_color: formTheme?.questionsColor || '#334155',
      answers_color: formTheme?.answersColor || '#334155',
    },
    font: formTheme?.font || DEFAULT_FONT_KEY,
    logo: {
      enabled: formTheme?.showLogo !== false,
      urls: formTheme?.logoUrls || [],
    },
    image: {
      position: formTheme?.imagePosition || 'none',
      asset_url: formTheme?.coverImageUrl,
      brightness: formTheme?.coverImageBrightness ?? 50,
    },
    question_size: formTheme?.questionSize || 'normal',
  }
}

const IMAGE_POSITIONS: Array<{
  value: ImagePosition
  label: string
  col?: boolean
  center?: boolean
  // Only the selected tile shows blue — unselected tiles stay all-gray so the
  // one active choice reads clearly at a glance instead of every tile looking "on".
  render: (isSelected: boolean) => React.ReactNode
}> = [
  {
    value: 'none', label: 'No image', center: true,
    render: () => <div className="w-full h-full rounded-sm bg-gray-200" />,
  },
  {
    value: 'left', label: 'Image left',
    render: (isSelected) => (
      <>
        <div className={cn('rounded-sm', isSelected ? 'bg-blue-400' : 'bg-gray-300')} style={{ width: '40%' }} />
        <div className="flex-1 rounded-sm bg-gray-200" />
      </>
    ),
  },
  {
    value: 'right', label: 'Image right',
    render: (isSelected) => (
      <>
        <div className="flex-1 rounded-sm bg-gray-200" />
        <div className={cn('rounded-sm', isSelected ? 'bg-blue-400' : 'bg-gray-300')} style={{ width: '40%' }} />
      </>
    ),
  },
  {
    value: 'banner_top', label: 'Banner top', col: true,
    render: (isSelected) => (
      <>
        <div className={cn('rounded-sm', isSelected ? 'bg-blue-400' : 'bg-gray-300')} style={{ height: '40%' }} />
        <div className="flex-1 rounded-sm bg-gray-200" />
      </>
    ),
  },
  {
    value: 'full_background', label: 'Full background', center: true,
    render: (isSelected) => <div className={cn('w-full h-full rounded-sm', isSelected ? 'bg-blue-400' : 'bg-gray-300')} />,
  },
  {
    value: 'card_on_image', label: 'Card on image', center: true,
    render: (isSelected) => (
      <div className={cn('w-full h-full rounded-sm flex items-center justify-center', isSelected ? 'bg-blue-400' : 'bg-gray-300')}>
        <div className="rounded-sm bg-gray-100" style={{ width: '62%', height: '66%' }} />
      </div>
    ),
  },
]

export function PageThemeSettings({ pageType: initialPageType, settings, onUpdate, formId, workspaceId, onTabChange }: PageThemeSettingsProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialPageType === 'sections' ? 'signup' : initialPageType)

  const handleTabChange = (tab: 'login' | 'signup') => {
    setActiveTab(tab)
    onTabChange?.(tab)
  }
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [showPositionDialog, setShowPositionDialog] = useState(false)
  const [tempImagePosition, setTempImagePosition] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // ── Form Theme (sections) state ──────────────────────────────────────────
  const [activeThemeTab, setActiveThemeTab] = useState<'current' | 'all'>('current')
  const [savedThemes, setSavedThemes] = useState<PortalTheme[]>([])
  const [isLoadingThemes, setIsLoadingThemes] = useState(false)
  const [isSavingTheme, setIsSavingTheme] = useState(false)
  const [themeDialogOpen, setThemeDialogOpen] = useState(false)
  const [themeDialogValue, setThemeDialogValue] = useState('')
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false)
  const [isUploadingFirstLogo, setIsUploadingFirstLogo] = useState(false)
  const [isUploadingSecondLogo, setIsUploadingSecondLogo] = useState(false)
  const coverImageInputRef = useRef<HTMLInputElement>(null)
  const firstLogoInputRef = useRef<HTMLInputElement>(null)
  const secondLogoInputRef = useRef<HTMLInputElement>(null)

  const formTheme = settings.formTheme || {}
  useGoogleFont(formTheme.font)

  useEffect(() => {
    if (!workspaceId) return
    setIsLoadingThemes(true)
    portalThemesClient.list(workspaceId)
      .then(setSavedThemes)
      .catch(() => {})
      .finally(() => setIsLoadingThemes(false))
  }, [workspaceId])

  const appliedTheme = useMemo(
    () => savedThemes.find(t => t.id === settings.themeId),
    [savedThemes, settings.themeId]
  )
  const hasUnsavedThemeChanges = appliedTheme
    ? !formThemeEqual(themeToFormTheme(appliedTheme), formTheme)
    : false

  const handleSaveToTheme = async () => {
    if (!appliedTheme) return
    setIsSavingTheme(true)
    try {
      const updated = await portalThemesClient.update(appliedTheme.id, {
        workspace_id: appliedTheme.workspace_id,
        name: appliedTheme.name,
        ...formThemeToThemeInputFields(formTheme, settings.themeColor),
      })
      setSavedThemes(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      toast.success(`Saved changes to "${updated.name}"`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save theme')
    } finally {
      setIsSavingTheme(false)
    }
  }

  const handleSaveAsNewTheme = async (name: string) => {
    if (!workspaceId) return
    setIsSavingTheme(true)
    try {
      const created = await portalThemesClient.create({
        workspace_id: workspaceId,
        name,
        ...formThemeToThemeInputFields(formTheme, settings.themeColor),
      })
      setSavedThemes(prev => [...prev, created])
      onUpdate({ themeId: created.id } as any)
      toast.success(`Saved as "${created.name}"`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save theme')
    } finally {
      setIsSavingTheme(false)
    }
  }

  const handleRenameTheme = async (name: string) => {
    if (!appliedTheme) return
    try {
      const updated = await portalThemesClient.update(appliedTheme.id, {
        workspace_id: appliedTheme.workspace_id,
        name,
        ...formThemeToThemeInputFields(formTheme, settings.themeColor),
      })
      setSavedThemes(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      toast.success('Theme renamed')
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename theme')
    }
  }

  const handleDuplicateTheme = async () => {
    if (!appliedTheme) return
    try {
      const created = await portalThemesClient.duplicate(appliedTheme.id)
      setSavedThemes(prev => [...prev, created])
      toast.success(`Duplicated as "${created.name}"`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to duplicate theme')
    }
  }

  const handleSetDefaultTheme = async () => {
    if (!appliedTheme) return
    try {
      const updated = await portalThemesClient.setDefault(appliedTheme.id)
      setSavedThemes(prev => prev.map(t => ({ ...t, is_default: t.id === updated.id })))
      toast.success(`"${updated.name}" set as default`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to set default theme')
    }
  }

  const handleDeleteTheme = async () => {
    if (!appliedTheme) return
    try {
      await portalThemesClient.remove(appliedTheme.id)
      setSavedThemes(prev => prev.filter(t => t.id !== appliedTheme.id))
      onUpdate({ themeId: undefined } as any)
      toast.success('Theme deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete theme')
    }
  }

  const handleApplyTheme = (theme: PortalTheme) => {
    onUpdate({ formTheme: themeToFormTheme(theme), themeId: theme.id } as any)
    setActiveThemeTab('current')
    toast.success(`Applied "${theme.name}"`)
  }

  const handleFirstLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }
    setIsUploadingFirstLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logos/${formId || 'default'}/theme-1-${Date.now()}.${fileExt}`
      const { data, error } = await storageClient.from('workspace-assets').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = storageClient.from('workspace-assets').getPublicUrl(fileName)
      onUpdate({ formTheme: { ...formTheme, logoUrls: [publicUrl, ...(formTheme.logoUrls?.slice(1) || [])] } })
      toast.success('Logo uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setIsUploadingFirstLogo(false)
      if (firstLogoInputRef.current) firstLogoInputRef.current.value = ''
    }
  }

  const handleSecondLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }
    setIsUploadingSecondLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logos/${formId || 'default'}/theme-2-${Date.now()}.${fileExt}`
      const { data, error } = await storageClient.from('workspace-assets').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = storageClient.from('workspace-assets').getPublicUrl(fileName)
      onUpdate({ formTheme: { ...formTheme, logoUrls: [formTheme.logoUrls?.[0], publicUrl].filter(Boolean) as string[] } })
      toast.success('Logo uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setIsUploadingSecondLogo(false)
      if (secondLogoInputRef.current) secondLogoInputRef.current.value = ''
    }
  }

  const handleRemoveLogoSlot = (index: 0 | 1) => {
    const urls = [...(formTheme.logoUrls || [])]
    urls.splice(index, 1)
    onUpdate({ formTheme: { ...formTheme, logoUrls: urls } })
  }

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB')
      return
    }
    setIsUploadingCoverImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `form-theme/${formId || 'default'}/cover-${Date.now()}.${fileExt}`
      const { data, error } = await storageClient.from('workspace-assets').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = storageClient.from('workspace-assets').getPublicUrl(fileName)
      onUpdate({ formTheme: { ...formTheme, coverImageUrl: publicUrl } })
      toast.success('Cover image uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload cover image')
    } finally {
      setIsUploadingCoverImage(false)
      if (coverImageInputRef.current) coverImageInputRef.current.value = ''
    }
  }

  // Use activeTab for auth pages, fall back to initialPageType for sections
  const pageType = initialPageType === 'sections' ? 'sections' : activeTab


  const currentImage = pageType === 'login' ? settings.loginPageImage : pageType === 'signup' ? settings.signupPageImage : undefined
  const currentLogo = pageType === 'login' ? settings.loginPageLogo : pageType === 'signup' ? settings.signupPageLogo : settings.logoUrl
  const currentMediaType = pageType === 'login' ? (settings as any).loginPageMediaType : (settings as any).signupPageMediaType

  // Detect if current media is a video
  const isVideo = currentImage && (
    currentImage.endsWith('.mp4') || 
    currentImage.endsWith('.webm') || 
    currentImage.endsWith('.mov') ||
    currentMediaType === 'video'
  )

  // Handle background media upload (image, video, or GIF)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImageFile = file.type.startsWith('image/')
    const isVideoFile = file.type.startsWith('video/')

    if (!isImageFile && !isVideoFile) {
      toast.error('Please upload an image or video file')
      return
    }

    const maxSize = isVideoFile ? 50 * 1024 * 1024 : 10 * 1024 * 1024 // 50MB for video, 10MB for image
    if (file.size > maxSize) {
      toast.error(`File must be less than ${isVideoFile ? '50MB' : '10MB'}`)
      return
    }

    setIsUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `auth-media/${formId || 'default'}/${pageType}-${Date.now()}.${fileExt}`

      const { data, error } = await storageClient
        .from('workspace-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = storageClient
        .from('workspace-assets')
        .getPublicUrl(fileName)

      const mediaType = isVideoFile ? 'video' : 'image'

      if (pageType === 'login') {
        onUpdate({ 
          loginPageImage: publicUrl,
          loginPageMediaType: mediaType
        } as any)
      } else if (pageType === 'signup') {
        onUpdate({ 
          signupPageImage: publicUrl,
          signupPageMediaType: mediaType
        } as any)
      }
      toast.success(`Background ${mediaType} uploaded successfully`)
    } catch (error: any) {
      console.error('Media upload error:', error)
      toast.error(error.message || 'Failed to upload media')
    } finally {
      setIsUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    setIsUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logos/${formId || 'default'}/${pageType}-${Date.now()}.${fileExt}`

      const { data, error } = await storageClient
        .from('workspace-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = storageClient
        .from('workspace-assets')
        .getPublicUrl(fileName)

      if (pageType === 'login') {
        onUpdate({ loginPageLogo: publicUrl })
      } else if (pageType === 'signup') {
        onUpdate({ signupPageLogo: publicUrl })
      } else {
        onUpdate({ logoUrl: publicUrl })
      }
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      console.error('Logo upload error:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    if (pageType === 'login') {
      onUpdate({ loginPageImage: '' })
    } else if (pageType === 'signup') {
      onUpdate({ signupPageImage: '' })
    }
  }

  const handleRemoveLogo = () => {
    if (pageType === 'login') {
      onUpdate({ loginPageLogo: '' })
    } else if (pageType === 'signup') {
      onUpdate({ signupPageLogo: '' })
    } else {
      onUpdate({ logoUrl: '' })
    }
  }

  // Show different settings based on page type
  if (pageType === 'sections') {
    const imagePosition: ImagePosition = formTheme.imagePosition || 'none'
    const questionSize = formTheme.questionSize || 'normal'

    const primaryContrastOk = meetsWCAGAA('#FFFFFF', formTheme.primaryColor || settings.themeColor || '#0F172A')
    const questionsContrastOk = meetsWCAGAA(formTheme.questionsColor || '#334155', formTheme.questionsBackgroundColor || '#F8FAFC')
    const answersContrastOk = meetsWCAGAA(formTheme.answersColor || '#334155', formTheme.questionsBackgroundColor || '#F8FAFC')

    return (
      <div className="flex flex-col h-full">
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold text-gray-900">Theme</h2>
        </div>

        <Tabs
          value={activeThemeTab}
          onValueChange={(v) => setActiveThemeTab(v as 'current' | 'all')}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-4 pt-3">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1">
              <TabsTrigger value="current" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Current
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                All themes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="current" className="flex-1 overflow-y-auto p-4 space-y-5 mt-0">
            {/* Theme name + actions */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {appliedTheme ? appliedTheme.name : 'Unsaved theme'}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {appliedTheme ? (
                    <>
                      <DropdownMenuItem onClick={() => { setThemeDialogValue(appliedTheme.name); setThemeDialogOpen(true) }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDuplicateTheme}>
                        <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSetDefaultTheme} disabled={appliedTheme.is_default}>
                        <Star className="w-3.5 h-3.5 mr-2" /> {appliedTheme.is_default ? 'Default theme' : 'Set as default'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDeleteTheme} className="text-red-600">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => { setThemeDialogValue(''); setThemeDialogOpen(true) }}>
                      <Save className="w-3.5 h-3.5 mr-2" /> Save as new theme
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {appliedTheme && hasUnsavedThemeChanges && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-800 leading-snug">
                  Unsaved changes to {appliedTheme.name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2 flex-shrink-0"
                  onClick={handleSaveToTheme}
                  disabled={isSavingTheme}
                >
                  Save to theme
                </Button>
              </div>
            )}
            {!appliedTheme && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => { setThemeDialogValue(''); setThemeDialogOpen(true) }}
                disabled={!workspaceId}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save as new theme
              </Button>
            )}

            {/* Colors */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Colors</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Questions background</Label>
                <ColorPicker
                  value={formTheme.questionsBackgroundColor || '#F8FAFC'}
                  onChange={(color) => onUpdate({ formTheme: { ...formTheme, questionsBackgroundColor: color } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Primary</Label>
                <ColorPicker
                  value={formTheme.primaryColor || settings.themeColor || '#0F172A'}
                  onChange={(color) => onUpdate({ formTheme: { ...formTheme, primaryColor: color } })}
                />
                {!primaryContrastOk && (
                  <p className="text-[11px] text-amber-600">Low contrast against white button text</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Questions</Label>
                <ColorPicker
                  value={formTheme.questionsColor || '#334155'}
                  onChange={(color) => onUpdate({ formTheme: { ...formTheme, questionsColor: color } })}
                />
                {!questionsContrastOk && (
                  <p className="text-[11px] text-amber-600">Low contrast against background</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Answers</Label>
                <ColorPicker
                  value={formTheme.answersColor || '#334155'}
                  onChange={(color) => onUpdate({ formTheme: { ...formTheme, answersColor: color } })}
                />
                {!answersContrastOk && (
                  <p className="text-[11px] text-amber-600">Low contrast against background</p>
                )}
              </div>
            </div>

            {/* Font */}
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Font</h3>
              <Select
                value={formTheme.font || DEFAULT_FONT_KEY}
                onValueChange={(value) => onUpdate({ formTheme: { ...formTheme, font: value } })}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Aa</span>
                    <span className="text-sm">{getGoogleFont(formTheme.font).label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {GOOGLE_FONTS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Logo</h3>
                <Switch
                  checked={formTheme.showLogo !== false}
                  onCheckedChange={(checked) => onUpdate({ formTheme: { ...formTheme, showLogo: checked } })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input ref={firstLogoInputRef} type="file" accept="image/*" onChange={handleFirstLogoUpload} className="hidden" />
                {formTheme.logoUrls?.[0] ? (
                  <div className="relative group w-14 h-14 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <img src={formTheme.logoUrls[0]} alt="Logo 1" className="max-h-full max-w-full object-contain" />
                    <button
                      onClick={() => handleRemoveLogoSlot(0)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => firstLogoInputRef.current?.click()}
                    disabled={isUploadingFirstLogo}
                    className="w-14 h-14 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-300 flex-shrink-0"
                  >
                    {isUploadingFirstLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </button>
                )}
                {formTheme.logoUrls?.[0] && (
                  <>
                    <input ref={secondLogoInputRef} type="file" accept="image/*" onChange={handleSecondLogoUpload} className="hidden" />
                    {formTheme.logoUrls?.[1] ? (
                      <div className="relative group w-14 h-14 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <img src={formTheme.logoUrls[1]} alt="Logo 2" className="max-h-full max-w-full object-contain" />
                        <button
                          onClick={() => handleRemoveLogoSlot(1)}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => secondLogoInputRef.current?.click()}
                        disabled={isUploadingSecondLogo}
                        className="w-14 h-14 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-300 flex-shrink-0"
                      >
                        {isUploadingSecondLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Image position */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Image position</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {IMAGE_POSITIONS.map((pos) => (
                  <button
                    key={pos.value}
                    title={pos.label}
                    onClick={() => onUpdate({ formTheme: { ...formTheme, imagePosition: pos.value } })}
                    className={cn(
                      'h-11 rounded-md border p-1 flex gap-0.5',
                      pos.col ? 'flex-col' : 'flex-row',
                      pos.center && 'items-center justify-center',
                      imagePosition === pos.value ? 'border-2 border-blue-500' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {pos.render(imagePosition === pos.value)}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover image + brightness */}
            {imagePosition !== 'none' && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cover image</h3>
                <input ref={coverImageInputRef} type="file" accept="image/*" onChange={handleCoverImageUpload} className="hidden" />
                <button
                  onClick={() => coverImageInputRef.current?.click()}
                  disabled={isUploadingCoverImage}
                  className="w-full h-16 rounded-lg overflow-hidden relative flex items-center justify-center bg-gradient-to-br from-blue-200 to-blue-100 bg-cover bg-center"
                  style={formTheme.coverImageUrl ? { backgroundImage: `url(${formTheme.coverImageUrl})` } : undefined}
                >
                  {isUploadingCoverImage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <span className="text-xs font-semibold text-gray-900 bg-white/90 rounded-md px-2.5 py-1">Change image</span>
                  )}
                </button>
                <div className="space-y-1.5">
                  <Label className="text-xs">Brightness</Label>
                  <Slider
                    value={[formTheme.coverImageBrightness ?? 50]}
                    onValueChange={([v]) => onUpdate({ formTheme: { ...formTheme, coverImageBrightness: v } })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            )}

            {/* Question size */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Question size</h3>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                {(['small', 'normal', 'large'] as const).map((size, i) => (
                  <button
                    key={size}
                    onClick={() => onUpdate({ formTheme: { ...formTheme, questionSize: size } })}
                    className={cn(
                      'flex-1 text-xs py-1.5 capitalize',
                      i > 0 && 'border-l border-gray-200',
                      questionSize === size ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="all" className="flex-1 overflow-y-auto p-4 space-y-2 mt-0">
            {isLoadingThemes ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : savedThemes.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6 leading-relaxed">
                No saved themes yet. Save your current theme to reuse it on other forms.
              </p>
            ) : (
              savedThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleApplyTheme(theme)}
                  className={cn(
                    'w-full text-left p-2.5 rounded-lg border transition-colors',
                    theme.id === settings.themeId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{theme.name}</span>
                    {theme.is_default && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[
                        theme.colors.questions_background_color,
                        theme.colors.primary_color,
                        theme.colors.questions_color,
                        theme.colors.answers_color,
                      ].map((c, i) => (
                        <div key={i} className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ background: c }} />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-400">{getGoogleFont(theme.font).label}</span>
                  </div>
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{appliedTheme ? 'Rename theme' : 'Save as new theme'}</DialogTitle>
            </DialogHeader>
            <Input
              value={themeDialogValue}
              onChange={(e) => setThemeDialogValue(e.target.value)}
              placeholder="Theme name"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setThemeDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={!themeDialogValue.trim() || isSavingTheme}
                onClick={async () => {
                  const name = themeDialogValue.trim()
                  if (!name) return
                  if (appliedTheme) {
                    await handleRenameTheme(name)
                  } else {
                    await handleSaveAsNewTheme(name)
                  }
                  setThemeDialogOpen(false)
                }}
              >
                {appliedTheme ? 'Rename' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Login/Signup page settings
  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Auth Page Theme</h2>
        <p className="text-xs text-gray-500 mt-1">Customize login and signup page appearance.</p>
      </div>

      {/* Tabs for Login vs Signup */}
      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as 'login' | 'signup')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1">
          <TabsTrigger 
            value="login"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Login
          </TabsTrigger>
          <TabsTrigger 
            value="signup"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Signup
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Auth Page Settings */}
      <div className="space-y-4">
        {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          {currentLogo ? (
            <div className="relative group">
              <div className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                <img src={currentLogo} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
              </div>
              <button
                onClick={handleRemoveLogo}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed"
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Upload Logo</span>
                  <span className="text-xs text-gray-400">PNG, JPG up to 2MB</span>
                </div>
              )}
            </Button>
          )}
          <p className="text-xs text-gray-500">Logo shown in the {pageType} form</p>
        </div>

        {/* Background Media Upload */}
        <div className="space-y-2">
          <Label>Background Media</Label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {currentImage ? (
            <div className="relative group">
              <div className="w-full h-48 border-2 border-dashed border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                {isVideo ? (
                  <video 
                    src={currentImage} 
                    className="w-full h-full object-cover" 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                  />
                ) : (
                  <img src={currentImage} alt="Background" className="w-full h-full object-cover" />
                )}
              </div>
              <button
                onClick={() => {
                  // Load current focal point or default to center
                  const currentFocalPoint = pageType === 'login' 
                    ? (settings as any).loginImageFocalPoint 
                    : (settings as any).signupImageFocalPoint
                  
                  if (currentFocalPoint) {
                    // Parse focal point like "50% center" to extract x value
                    const match = currentFocalPoint.match(/(\d+)%/)
                    const x = match ? parseInt(match[1]) : 50
                    setTempImagePosition({ x, y: 50 })
                  } else {
                    setTempImagePosition({ x: 50, y: 50 })
                  }
                  
                  setShowPositionDialog(true)
                }}
                className="absolute top-2 left-2 px-3 py-1.5 rounded-md bg-white border border-gray-200 shadow-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Position</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (pageType === 'login') {
                    onUpdate({ 
                      loginPageImage: '',
                      loginPageMediaType: undefined,
                      loginImageFocalPoint: undefined
                    } as any)
                  } else {
                    onUpdate({ 
                      signupPageImage: '',
                      signupPageMediaType: undefined,
                      signupImageFocalPoint: undefined
                    } as any)
                  }
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed"
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm font-medium">Upload Background Media</span>
                  <span className="text-xs text-gray-400">Image: PNG, JPG, GIF up to 10MB</span>
                  <span className="text-xs text-gray-400">Video: MP4, WebM up to 50MB</span>
                </div>
              )}
            </Button>
          )}
          <p className="text-xs text-gray-500">Displayed on the side in split-screen layout</p>
        </div>

        {/* Image Position */}
        {currentImage && (
          <div className="space-y-2">
            <Label>Image Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (pageType === 'login') {
                    onUpdate({ loginImagePosition: 'left' })
                  } else {
                    onUpdate({ signupImagePosition: 'left' })
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
                  (pageType === 'login' ? settings.loginImagePosition : settings.signupImagePosition) === 'left'
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                )}
              >
                <div className="flex gap-1">
                  <div className="w-3 h-4 bg-gray-400 rounded-sm" />
                  <div className="w-5 h-4 bg-gray-300 rounded-sm" />
                </div>
                <span className="text-xs font-medium">Left</span>
              </button>
              <button
                onClick={() => {
                  if (pageType === 'login') {
                    onUpdate({ loginImagePosition: 'right' })
                  } else {
                    onUpdate({ signupImagePosition: 'right' })
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
                  (pageType === 'login' ? settings.loginImagePosition : settings.signupImagePosition) !== 'left'
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                )}
              >
                <div className="flex gap-1">
                  <div className="w-5 h-4 bg-gray-300 rounded-sm" />
                  <div className="w-3 h-4 bg-gray-400 rounded-sm" />
                </div>
                <span className="text-xs font-medium">Right</span>
              </button>
            </div>
          </div>
        )}

        {/* Font Selection */}
        <div className="space-y-2">
          <Label>Font</Label>
          <p className="text-xs text-gray-500">
            By default we use "Inter", but you can switch to a different font below. Note that this font only affects your portal and not the internal user experience.
          </p>
          <Select
            value={settings.font || 'inter'}
            onValueChange={(value) => onUpdate({ font: value as 'inter' | 'roboto' | 'serif' | 'mono' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inter">Inter</SelectItem>
              <SelectItem value="roboto">Roboto</SelectItem>
              <SelectItem value="serif">Serif</SelectItem>
              <SelectItem value="mono">Mono</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Brand Colors Section */}
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Brand colors</h3>
            <p className="text-xs text-gray-500">
              Customize the colors in your portal. Note that these colors only affect your portal and not the internal user experience. The accent is used for buttons, tags, and other UI elements.
            </p>
          </div>

          {/* Accent Color (Primary/Button Color) */}
          <div className="space-y-2">
            <Label>Accent color</Label>
            <ColorPicker
              value={settings.themeColor || '#3B82F6'}
              onChange={(color) => onUpdate({ themeColor: color })}
            />
            <p className="text-xs text-gray-500">Used for buttons, tags, and other UI elements</p>
          </div>

          {/* Sidebar Background Color */}
          <div className="space-y-2">
            <Label>Sidebar background color</Label>
            <ColorPicker
              value={(settings as any).sidebarBackgroundColor || '#101010'}
              onChange={(color) => onUpdate({ sidebarBackgroundColor: color } as any)}
            />
          </div>

          {/* Sidebar Text Color */}
          <div className="space-y-2">
            <Label>Sidebar text color</Label>
            <ColorPicker
              value={(settings as any).sidebarTextColor || '#BCE7F4'}
              onChange={(color) => onUpdate({ sidebarTextColor: color } as any)}
            />
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label>Background color</Label>
            <ColorPicker
              value={(settings as any).backgroundColor || '#FFFFFF'}
              onChange={(color) => onUpdate({ backgroundColor: color } as any)}
            />
          </div>

          {/* Text Color */}
          <div className="space-y-2">
            <Label>Text color</Label>
            <ColorPicker
              value={(settings as any).textColor || '#1F2937'}
              onChange={(color) => onUpdate({ textColor: color } as any)}
            />
          </div>
        </div>
      </div>

      {/* Image Position Dialog */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              Adjust media position
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Drag the frame to select which part of the {isVideo ? 'video' : 'image'} will be shown on the login page
            </p>
            <div 
              ref={imageContainerRef}
              className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden select-none"
            >
              {currentImage && (
                <>
                  {/* Full background media */}
                  {isVideo ? (
                    <video 
                      src={currentImage} 
                      className="w-full h-full object-cover opacity-50"
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                    />
                  ) : (
                    <img 
                      src={currentImage} 
                      alt="Background" 
                      className="w-full h-full object-cover opacity-50"
                      draggable={false}
                    />
                  )}
                  
                  {/* Highlighted crop area (simulates what will be visible on split screen) */}
                  <div 
                    className="absolute inset-0 flex items-center"
                    style={{
                      left: `${tempImagePosition.x}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <div className="relative w-1/2 h-full overflow-hidden">
                      {isVideo ? (
                        <video 
                          src={currentImage} 
                          className="absolute h-full object-cover"
                          style={{
                            width: '200%',
                            left: `${50 - tempImagePosition.x}%`,
                            objectPosition: `center ${tempImagePosition.y}%`
                          }}
                          autoPlay 
                          loop 
                          muted 
                          playsInline
                        />
                      ) : (
                        <img 
                          src={currentImage} 
                          alt="Cropped preview" 
                          className="absolute h-full object-cover"
                          style={{
                            width: '200%',
                            left: `${50 - tempImagePosition.x}%`,
                            objectPosition: `center ${tempImagePosition.y}%`
                          }}
                          draggable={false}
                        />
                      )}
                      <div className="absolute inset-0 border-4 border-white shadow-2xl pointer-events-none" />
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-md text-xs font-medium text-gray-900">
                        Visible area
                      </div>
                    </div>
                  </div>

                  {/* Draggable handle */}
                  <div
                    className={cn(
                      "absolute top-1/2 w-12 h-12 -mt-6 -ml-6 cursor-grab active:cursor-grabbing",
                      "bg-white rounded-full shadow-xl border-4 border-blue-500",
                      "flex items-center justify-center transition-transform hover:scale-110",
                      isDragging && "scale-110 cursor-grabbing"
                    )}
                    style={{
                      left: `${tempImagePosition.x}%`,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                      const container = imageContainerRef.current
                      if (!container) return

                      const rect = container.getBoundingClientRect()
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const x = ((moveEvent.clientX - rect.left) / rect.width) * 100
                        const clampedX = Math.max(25, Math.min(75, x)) // Keep within bounds so half-width view stays visible
                        setTempImagePosition(prev => ({
                          ...prev,
                          x: clampedX
                        }))
                      }
                      
                      const handleMouseUp = () => {
                        setIsDragging(false)
                        document.removeEventListener('mousemove', handleMouseMove)
                        document.removeEventListener('mouseup', handleMouseUp)
                      }
                      
                      document.addEventListener('mousemove', handleMouseMove)
                      document.addEventListener('mouseup', handleMouseUp)
                    }}
                  >
                    <div className="flex gap-0.5">
                      <div className="w-0.5 h-4 bg-blue-500 rounded-full" />
                      <div className="w-0.5 h-4 bg-blue-500 rounded-full" />
                    </div>
                  </div>

                  {/* Center reference line */}
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/30 pointer-events-none" />
                </>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Current position: {tempImagePosition.x.toFixed(0)}%
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setTempImagePosition({ x: 50, y: 50 })}
                >
                  Reset to Center
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => {
                setShowPositionDialog(false)
                setTempImagePosition({ x: 50, y: 50 })
              }}>
                Cancel
              </Button>
              <Button onClick={() => {
                // Convert x position to object-position percentage
                const objectPosition = `${tempImagePosition.x}% center`
                
                if (pageType === 'login') {
                  onUpdate({ 
                    loginImagePosition: tempImagePosition.x < 50 ? 'left' : 'right',
                    loginImageFocalPoint: objectPosition
                  } as any)
                } else {
                  onUpdate({ 
                    signupImagePosition: tempImagePosition.x < 50 ? 'left' : 'right',
                    signupImageFocalPoint: objectPosition
                  } as any)
                }
                setShowPositionDialog(false)
              }}>
                Apply Position
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
