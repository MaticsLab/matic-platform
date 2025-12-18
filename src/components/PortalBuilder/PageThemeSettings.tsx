'use client'

import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon, Loader2, X, Maximize2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui-components/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { PortalConfig } from '@/types/portal'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PageThemeSettingsProps {
  pageType: 'login' | 'signup' | 'sections'
  settings: PortalConfig['settings']
  onUpdate: (updates: Partial<PortalConfig['settings']>) => void
  formId?: string
  onTabChange?: (tab: 'login' | 'signup') => void
}

export function PageThemeSettings({ pageType: initialPageType, settings, onUpdate, formId, onTabChange }: PageThemeSettingsProps) {
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

      const { data, error } = await supabase.storage
        .from('workspace-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
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

      const { data, error } = await supabase.storage
        .from('workspace-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
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
    return (
      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Form Theme</h2>
          <p className="text-xs text-gray-500 mt-1">Customize the appearance of your form sections.</p>
        </div>

        <div className="space-y-4">
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
                <div className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                  <img src={currentLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
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
                className="w-full h-32 border-2 border-dashed"
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
          </div>

          <div className="space-y-2">
            <Label>Questions Background Color</Label>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                style={{ backgroundColor: settings.formTheme?.questionsBackgroundColor || '#ffffff' }}
              />
              <Input 
                value={settings.formTheme?.questionsBackgroundColor || '#ffffff'} 
                onChange={(e) => onUpdate({ 
                  formTheme: { 
                    ...settings.formTheme, 
                    questionsBackgroundColor: e.target.value 
                  } 
                })}
                className="flex-1 font-mono text-sm"
                placeholder="#ffffff"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                style={{ backgroundColor: settings.formTheme?.primaryColor || settings.themeColor || '#3B82F6' }}
              />
              <Input 
                value={settings.formTheme?.primaryColor || settings.themeColor || '#3B82F6'} 
                onChange={(e) => onUpdate({ 
                  formTheme: { 
                    ...settings.formTheme, 
                    primaryColor: e.target.value 
                  } 
                })}
                className="flex-1 font-mono text-sm"
                placeholder="#3B82F6"
              />
            </div>
          </div>
        </div>
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

        {/* Theme Color */}
        <div className="space-y-2">
          <Label>Brand Color</Label>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
              style={{ backgroundColor: settings.themeColor }}
            />
            <Input 
              value={settings.themeColor} 
              onChange={(e) => onUpdate({ themeColor: e.target.value })}
              className="flex-1 font-mono text-sm"
              placeholder="#3B82F6"
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
