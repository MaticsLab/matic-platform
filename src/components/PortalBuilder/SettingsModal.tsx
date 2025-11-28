'use client'

import { useState } from 'react'
import { 
  X, Bell, Link as LinkIcon, Settings, Lock, Languages, 
  GraduationCap, Code, BarChart3, Loader2, Plus, Trash2
} from 'lucide-react'
import { Dialog, DialogContent } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { PortalConfig } from '@/types/portal'
import { translateContent } from '@/lib/ai-translation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
}

const TABS = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'url', label: 'URL parameters', icon: LinkIcon },
  { id: 'behavior', label: 'Form behavior', icon: Settings },
  { id: 'access', label: 'Access', icon: Lock },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'quiz', label: 'Quiz mode', icon: GraduationCap },
  { id: 'custom', label: 'Custom code', icon: Code },
  { id: 'conversion', label: 'Conversion kit', icon: BarChart3 },
]

const LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
]

export function SettingsModal({ open, onOpenChange, config, onUpdate }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('language')
  const [isTranslating, setIsTranslating] = useState(false)

  const handleAddLanguage = async (langCode: string) => {
    if (!langCode) return
    
    setIsTranslating(true)
    try {
      // Collect all translatable text
      const contentToTranslate: Record<string, string> = {}
      
      // Portal settings
      contentToTranslate['portal_name'] = config.settings.name
      
      // Sections and Fields
      config.sections.forEach(section => {
        contentToTranslate[`section_${section.id}_title`] = section.title
        if (section.description) {
          contentToTranslate[`section_${section.id}_desc`] = section.description
        }
        
        section.fields.forEach(field => {
          contentToTranslate[`field_${field.id}_label`] = field.label
          if (field.placeholder) {
            contentToTranslate[`field_${field.id}_placeholder`] = field.placeholder
          }
          // Add options for select/radio etc
          if (field.options) {
             field.options.forEach((opt, idx) => {
                 contentToTranslate[`field_${field.id}_opt_${idx}`] = opt
             })
          }
        })
      })

      // Call AI
      const translations = await translateContent(contentToTranslate, LANGUAGES.find(l => l.code === langCode)?.name || langCode)
      
      // Update config
      const currentTranslations = config.translations || {}
      const newTranslations = {
        ...currentTranslations,
        [langCode]: translations
      }
      
      const currentSupported = config.settings.language?.supported || []
      
      onUpdate({
        settings: {
          ...config.settings,
          language: {
            default: config.settings.language?.default || 'en',
            enabled: true,
            supported: [...new Set([...currentSupported, langCode])],
            rightToLeft: config.settings.language?.rightToLeft || false
          }
        },
        translations: newTranslations
      })
      
      toast.success(`Added ${LANGUAGES.find(l => l.code === langCode)?.name} translation`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to translate content')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleRemoveLanguage = (langCode: string) => {
      const currentSupported = config.settings.language?.supported || []
      const newSupported = currentSupported.filter(c => c !== langCode)
      
      const currentTranslations = { ...config.translations }
      delete currentTranslations[langCode]
      
      onUpdate({
          settings: {
              ...config.settings,
              language: {
                  ...config.settings.language!,
                  supported: newSupported
              }
          },
          translations: currentTranslations
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[750px] p-0 gap-0 overflow-hidden flex bg-white sm:rounded-2xl border-0 shadow-2xl">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-100 flex flex-col py-6 bg-white shrink-0 rounded-l-2xl">
          <div className="px-6 mb-6">
            <h2 className="font-semibold flex items-center gap-2 text-lg text-gray-900">
              <Settings className="w-5 h-5 text-blue-600" />
              Settings
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
                  activeTab === tab.id 
                    ? "bg-white border border-blue-500 text-blue-600 shadow-sm" 
                    : "text-gray-600 hover:bg-gray-50 border border-transparent"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-600" : "text-gray-400")} />
                {tab.label}
                {['custom', 'conversion'].includes(tab.id) && (
                  <span className={cn(
                    "ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                    tab.id === 'custom' ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
                  )}>
                    {tab.id === 'custom' ? 'Business' : 'Add-on'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
          <div className="flex-1 overflow-y-auto p-10">
             <div className="max-w-3xl mx-auto pt-2">
                <h3 className="font-bold text-3xl mb-3 text-gray-900">{TABS.find(t => t.id === activeTab)?.label}</h3>
                
                {activeTab === 'language' && (
                  <div className="space-y-8">
                    <p className="text-gray-500 text-lg leading-relaxed">Allow your form to be translated into multiple languages.</p>
                    
                    <div className="border border-gray-200 rounded-2xl p-8 space-y-8 bg-white shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Languages className="w-5 h-5 text-gray-400" />
                          <Label className="text-base font-medium text-gray-900">Default language</Label>
                        </div>
                        <Select 
                            value={config.settings.language?.default || 'en'}
                            onValueChange={(v) => onUpdate({
                                settings: {
                                    ...config.settings,
                                    language: {
                                        ...config.settings.language!,
                                        default: v
                                    }
                                }
                            })}
                        >
                          <SelectTrigger className="w-40 h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            {LANGUAGES.map(l => (
                                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium text-gray-900">Disable auto-translate</Label>
                        <Switch className="scale-110" />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium text-gray-900">Right to left</Label>
                        <Switch 
                            className="scale-110"
                            checked={config.settings.language?.rightToLeft || false}
                            onCheckedChange={(c) => onUpdate({
                                settings: {
                                    ...config.settings,
                                    language: {
                                        ...config.settings.language!,
                                        rightToLeft: c
                                    }
                                }
                            })}
                        />
                      </div>
                    </div>

                    <div className="bg-[#F0F6FF] rounded-2xl p-10 text-center space-y-6 flex flex-col items-center justify-center min-h-[360px]">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                        <Languages className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xl text-blue-900">Enable translations</h4>
                        <p className="text-blue-600/80 mt-2 max-w-[240px] mx-auto leading-relaxed text-base">Allow users to view your form in different languages</p>
                      </div>
                      
                      <div className="pt-4 w-full flex flex-col items-center">
                         <div className="flex flex-wrap gap-3 justify-center mb-8 max-w-md">
                            {(config.settings.language?.supported || []).map(langCode => (
                                <div key={langCode} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-blue-200 text-blue-800 shadow-sm transition-shadow hover:shadow-md">
                                    <span className="font-medium">{LANGUAGES.find(l => l.code === langCode)?.name || langCode}</span>
                                    <button onClick={() => handleRemoveLanguage(langCode)} className="hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                         </div>

                         <div className="flex items-center justify-center gap-2">
                            <Select onValueChange={handleAddLanguage} disabled={isTranslating}>
                                <SelectTrigger className="w-auto min-w-[160px] bg-white border-gray-200 shadow-sm h-11 px-5 font-medium text-blue-600 hover:border-blue-300 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Plus className="w-5 h-5" />
                                        <span>{isTranslating ? 'Translating...' : 'Add language'}</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.filter(l => !(config.settings.language?.supported || []).includes(l.code)).map(l => (
                                        <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab !== 'language' && (
                    <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
                        <Settings className="w-16 h-16 mb-6 opacity-20" />
                        <p className="text-lg">Settings for {TABS.find(t => t.id === activeTab)?.label} coming soon.</p>
                    </div>
                )}
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
