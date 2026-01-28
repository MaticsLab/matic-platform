'use client'

import { useState } from 'react'
import { 
  X, Bell, Link as LinkIcon, Settings, Lock, Languages, 
  GraduationCap, Code, BarChart3, Loader2, Plus, Trash2, Mail
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { PortalConfig } from '@/types/portal'
import { translateResource, translateResourceIncremental } from '@/lib/ai/translation'
import { collectTranslatableContentNew, normalizeTranslations } from '@/lib/portal-translations'
import { LANGUAGES, getLanguageName } from '@/lib/languages'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/ui-components/dropdown-menu'
import type { TranslationResource } from '@/lib/i18n/types'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
}

const TABS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'url', label: 'URL parameters', icon: LinkIcon },
  { id: 'behavior', label: 'Form behavior', icon: Settings },
  { id: 'access', label: 'Access', icon: Lock },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'quiz', label: 'Quiz mode', icon: GraduationCap },
  { id: 'custom', label: 'Custom code', icon: Code },
  { id: 'conversion', label: 'Conversion kit', icon: BarChart3 },
]

export function SettingsModal({ open, onOpenChange, config, onUpdate }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('email')
  const [isTranslating, setIsTranslating] = useState(false)
  const [lastLanguage, setLastLanguage] = useState<string | null>(null)

  const defaultLanguage = config.settings.language?.default || 'en'
  const supportedLanguages = config.settings.language?.supported || []

  const toggleLanguage = async (langCode: string, enable: boolean) => {
    if (enable) {
      await handleAddLanguage(langCode)
    } else {
      // Prevent removing default language
      if (langCode === (config.settings.language?.default || 'en')) {
        toast.error('Cannot remove the default language')
        return
      }
      handleRemoveLanguage(langCode)
    }
  }

  const handleAddLanguage = async (langCode: string) => {
    if (!langCode) return
    
    console.log('🌐 Starting translation for:', langCode)
    console.log('📋 Current config:', config)
    
    setIsTranslating(true)
    setLastLanguage(langCode)
    try {
      // Use new i18next format for content collection
      const contentToTranslate = collectTranslatableContentNew(config)
      console.log('📝 Content to translate (new format):', contentToTranslate)

      const targetLanguageName = getLanguageName(langCode)
      
      // Check if we have existing translations for this language
      const currentTranslations = normalizeTranslations(config.translations || {})
      const existingLangTranslations = currentTranslations[langCode]

      let translatedResource: TranslationResource = {
        portal: { name: '' },
        sections: {},
        fields: {}
      }
      
      // Only translate if auto-translate is NOT disabled
      if (!config.settings.language?.disableAutoTranslate) {
        // Use incremental translation if we have existing translations
        if (existingLangTranslations && Object.keys(existingLangTranslations.fields || {}).length > 0) {
          const existingCount = Object.keys(existingLangTranslations.fields || {}).length
          const newCount = Object.keys(contentToTranslate.fields || {}).length
          const diff = newCount - existingCount
          if (diff > 0) {
            toast.success(`Updating ${targetLanguageName} translations (${diff} new items)`)
            translatedResource = await translateResourceIncremental(
              contentToTranslate,
              existingLangTranslations,
              targetLanguageName
            )
          } else {
            // No new content, use existing translations
            toast.success(`${targetLanguageName} translations are up to date`)
            translatedResource = existingLangTranslations
          }
        } else {
          toast.success(`Starting translation to ${targetLanguageName}`)
          translatedResource = await translateResource(contentToTranslate, targetLanguageName)
        }
        console.log('✅ Translations received (new format):', translatedResource)
      } else {
        console.log('🚫 Auto-translate disabled, skipping AI translation')
        toast.success(`Added ${targetLanguageName} (Auto-translate disabled)`)
      }
      
      // Merge with existing translations
      const newTranslations = {
        ...currentTranslations,
        [langCode]: translatedResource
      }
      
      const currentSupported = supportedLanguages
      
      onUpdate({
        settings: {
          ...config.settings,
          language: {
            default: config.settings.language?.default || 'en',
            enabled: true,
            supported: [...new Set([...currentSupported, langCode])],
            rightToLeft: config.settings.language?.rightToLeft || false,
            disableAutoTranslate: config.settings.language?.disableAutoTranslate || false
          }
        },
        translations: newTranslations
      })
      
      if (!config.settings.language?.disableAutoTranslate) {
        toast.success(`Added ${LANGUAGES.find(l => l.code === langCode)?.name || langCode} translation`)
      }
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
      
      const currentTranslations = { ...(config.translations || {}) }
      delete currentTranslations[langCode]
      
      onUpdate({
          settings: {
              ...config.settings,
              language: {
                  default: config.settings.language?.default || 'en',
                  enabled: config.settings.language?.enabled ?? false,
                  supported: newSupported,
                  rightToLeft: config.settings.language?.rightToLeft || false,
                  disableAutoTranslate: config.settings.language?.disableAutoTranslate || false
              }
          },
          translations: currentTranslations
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[750px] p-0 gap-0 overflow-hidden flex bg-white sm:rounded-2xl border-0 shadow-2xl">
        <DialogTitle className="sr-only">Portal Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure portal settings, languages, and more.</DialogDescription>
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-100 flex flex-col py-6 bg-white shrink-0">
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
                
                {activeTab === 'email' && (
                  <div className="space-y-8">
                    <p className="text-gray-500 text-lg leading-relaxed">Configure how outbound emails appear to applicants and recommenders.</p>
                    
                    <div className="border border-gray-200 rounded-2xl p-8 space-y-8 bg-white shadow-sm">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <Label className="text-base font-medium text-gray-900">Sender Name</Label>
                        </div>
                        <Input
                          value={config.settings.emailSettings?.senderName || ''}
                          onChange={(e) => onUpdate({
                            settings: {
                              ...config.settings,
                              emailSettings: {
                                ...config.settings.emailSettings,
                                senderName: e.target.value
                              }
                            }
                          })}
                          placeholder={config.settings.name || 'Your organization name'}
                          className="h-11"
                        />
                        <p className="text-sm text-gray-500">
                          This name will appear in the "From" field of emails sent to recommenders and applicants. 
                          If left blank, your portal name will be used.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <Label className="text-base font-medium text-gray-900">Reply-To Email</Label>
                        </div>
                        <Input
                          type="email"
                          value={config.settings.emailSettings?.replyToEmail || ''}
                          onChange={(e) => onUpdate({
                            settings: {
                              ...config.settings,
                              emailSettings: {
                                ...config.settings.emailSettings,
                                replyToEmail: e.target.value
                              }
                            }
                          })}
                          placeholder="replies@yourorganization.com"
                          className="h-11"
                        />
                        <p className="text-sm text-gray-500">
                          When recipients reply to emails, their responses will be sent to this address.
                          Leave blank to disable replies.
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-8 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-900">Email Preview</h4>
                          <p className="text-blue-700 text-sm mt-1">This is how your emails will appear:</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-200 font-mono text-sm">
                        <div className="text-gray-600">
                          <span className="text-gray-400">From: </span>
                          <span className="text-gray-900 font-medium">
                            {config.settings.emailSettings?.senderName || config.settings.name || 'Your Portal Name'}
                          </span>
                          <span className="text-gray-500"> &lt;hello@notifications.maticsapp.com&gt;</span>
                        </div>
                        {config.settings.emailSettings?.replyToEmail && (
                          <div className="text-gray-600 mt-1">
                            <span className="text-gray-400">Reply-To: </span>
                            <span className="text-gray-900">{config.settings.emailSettings.replyToEmail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
                                        default: v,
                                        enabled: config.settings.language?.enabled ?? false,
                                        supported: config.settings.language?.supported || [],
                                        rightToLeft: config.settings.language?.rightToLeft || false,
                                        disableAutoTranslate: config.settings.language?.disableAutoTranslate || false
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
                        <Switch 
                            className="scale-110"
                            checked={config.settings.language?.disableAutoTranslate || false}
                            onCheckedChange={(c) => onUpdate({
                                settings: {
                                    ...config.settings,
                                    language: {
                                        default: config.settings.language?.default || 'en',
                                        enabled: config.settings.language?.enabled ?? false,
                                        supported: config.settings.language?.supported || [],
                                        rightToLeft: config.settings.language?.rightToLeft || false,
                                        disableAutoTranslate: c
                                    }
                                }
                            })}
                        />
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
                                        default: config.settings.language?.default || 'en',
                                        enabled: config.settings.language?.enabled ?? false,
                                        supported: config.settings.language?.supported || [],
                                        rightToLeft: c,
                                        disableAutoTranslate: config.settings.language?.disableAutoTranslate || false
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

                         <div className="w-full max-w-md bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-left space-y-2">
                           <div className="flex items-center justify-between">
                             <span className="text-sm text-gray-500">Selected languages</span>
                             <span className="text-xs text-gray-400">Default cannot be removed</span>
                           </div>
                           <div className="text-sm font-medium text-gray-900 flex flex-wrap gap-2">
                             {(config.settings.language?.supported || []).length === 0 ? 'None' : (config.settings.language?.supported || []).map(code => {
                               const name = LANGUAGES.find(l => l.code === code)?.name || code
                               const isDefault = code === (config.settings.language?.default || 'en')
                               return (
                                 <span key={code} className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                   {name}{isDefault ? ' (default)' : ''}
                                 </span>
                               )
                             })}
                           </div>
                           <div className="flex items-center gap-2 text-sm text-gray-500">
                             {isTranslating ? (
                               <>
                                 <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                 <span>Translating {LANGUAGES.find(l => l.code === lastLanguage)?.name || lastLanguage}</span>
                               </>
                             ) : (
                               <span>Translation status: Idle</span>
                             )}
                           </div>
                         </div>

                         <div className="flex items-center justify-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="min-w-[180px] bg-white border-gray-200 shadow-sm h-11 px-5 font-medium text-blue-600 hover:border-blue-300 transition-colors"
                                  disabled={isTranslating}
                                >
                                  <div className="flex items-center gap-2">
                                    <Plus className="w-5 h-5" />
                                    <span>{isTranslating ? 'Translating…' : 'Select languages'}</span>
                                  </div>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-56">
                                {(() => {
                                  const supported = config.settings.language?.supported || []
                                  const defaultLang = config.settings.language?.default || 'en'
                                  return LANGUAGES.map(l => {
                                    const checked = supported.includes(l.code)
                                    const isDefault = l.code === defaultLang
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={l.code}
                                      checked={checked}
                                      disabled={isDefault || (isTranslating && !checked)}
                                      onSelect={(e) => {
                                        e.preventDefault()
                                        const next = !checked
                                        toggleLanguage(l.code, next)
                                      }}
                                    >
                                      {l.name}{isDefault ? ' (default)' : ''}
                                    </DropdownMenuCheckboxItem>
                                  )
                                  })
                                })()}
                              </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab !== 'language' && activeTab !== 'email' && (
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
