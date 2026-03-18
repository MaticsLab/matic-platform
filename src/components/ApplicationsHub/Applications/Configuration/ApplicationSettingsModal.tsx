'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { toast } from 'sonner'
import { connectGoogleDrive, googleDriveClient, isGoogleDriveConnected, isGoogleDriveEnabledForForm } from '@/lib/api/integrations-client'
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Cloud,
  Edit3,
  Languages,
  Link as LinkIcon,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApplicationSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  workspaceId: string
  onSave?: () => void
}

type AppStatus = 'open' | 'closed' | 'draft'
type SettingsTabId = 'notifications' | 'url' | 'behavior' | 'access' | 'language' | 'integrations'
type NotificationSubTabId = 'general' | 'custom'

interface ApplicationSettings {
  applicationDeadline?: string | null
  applicationStatus: AppStatus
  maxSubmissions?: number | null
  notificationEmail?: string
  allowEditsAfterSubmission: boolean
  selfEmailNotifications: boolean
  respondentNotifications: boolean
  customSelfEmailSubject: string
  customSelfEmailBody: string
  customRespondentSubject: string
  customRespondentBody: string
  urlUtmSource: string
  urlUtmCampaign: string
  urlUtmMedium: string
  languageDefault: string
}

interface NotificationSettingsShape {
  recipients?: string[]
  on_submit?: boolean
  respondent_notifications?: boolean
}

interface CustomEmailSettingsShape {
  selfSubject?: string
  selfBody?: string
  respondentSubject?: string
  respondentBody?: string
}

interface UrlParameterSettingsShape {
  utm_source?: string
  utm_campaign?: string
  utm_medium?: string
}

const DEFAULT_SETTINGS: ApplicationSettings = {
  applicationDeadline: null,
  applicationStatus: 'open',
  maxSubmissions: null,
  notificationEmail: '',
  allowEditsAfterSubmission: false,
  selfEmailNotifications: false,
  respondentNotifications: false,
  customSelfEmailSubject: '',
  customSelfEmailBody: '',
  customRespondentSubject: '',
  customRespondentBody: '',
  urlUtmSource: '',
  urlUtmCampaign: '',
  urlUtmMedium: '',
  languageDefault: 'en',
}

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'url', label: 'URL parameters', icon: LinkIcon },
  { id: 'behavior', label: 'Form behavior', icon: Settings },
  { id: 'access', label: 'Access', icon: Lock },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'integrations', label: 'Integrations', icon: Plug },
]

export function ApplicationSettingsModal({ open, onOpenChange, formId, workspaceId, onSave }: ApplicationSettingsModalProps) {
  const [form, setForm] = useState<Form | null>(null)
  const [settings, setSettings] = useState<ApplicationSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTabId>('notifications')
  const [notificationSubTab, setNotificationSubTab] = useState<NotificationSubTabId>('general')
  const [requireAuth, setRequireAuth] = useState(false)
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(true)
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false)
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(false)
  const [isIntegrationLoading, setIsIntegrationLoading] = useState(false)

  useEffect(() => {
    if (open && formId) {
      void fetchForm()
    }
  }, [open, formId])

  const fetchForm = async () => {
    setIsLoading(true)
    try {
      const data = await goClient.get<Form>(`/forms/${formId}`)
      setForm(data)
      setRequireAuth(Boolean(data.require_auth))
      setAllowMultipleSubmissions(Boolean(data.allow_multiple_submissions))

      const existing = data.settings || {}
      const notifications: NotificationSettingsShape = (existing.notifications as NotificationSettingsShape) || {}
      const customEmails: CustomEmailSettingsShape = (existing.customEmails as CustomEmailSettingsShape) || {}
      const urlParameters: UrlParameterSettingsShape = (existing.urlParameters as UrlParameterSettingsShape) || {}

      setSettings({
        applicationDeadline: existing.applicationDeadline || null,
        applicationStatus: existing.applicationStatus || 'open',
        maxSubmissions: existing.maxSubmissions || null,
        notificationEmail: existing.notificationEmail || notifications.recipients?.[0] || '',
        allowEditsAfterSubmission: Boolean(existing.allowEditsAfterSubmission),
        selfEmailNotifications: Boolean(notifications.on_submit),
        respondentNotifications: Boolean(notifications.respondent_notifications),
        customSelfEmailSubject: customEmails.selfSubject || '',
        customSelfEmailBody: customEmails.selfBody || '',
        customRespondentSubject: customEmails.respondentSubject || '',
        customRespondentBody: customEmails.respondentBody || '',
        urlUtmSource: urlParameters.utm_source || '',
        urlUtmCampaign: urlParameters.utm_campaign || '',
        urlUtmMedium: urlParameters.utm_medium || '',
        languageDefault: existing.language?.default || 'en',
      })

      await refreshGoogleDriveStatus()
    } catch (error) {
      console.error('Failed to fetch form:', error)
      toast.error('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshGoogleDriveStatus = async () => {
    setIsIntegrationLoading(true)
    try {
      const [connected, enabled] = await Promise.all([
        isGoogleDriveConnected(workspaceId),
        isGoogleDriveEnabledForForm(formId),
      ])
      setGoogleDriveConnected(connected)
      setGoogleDriveEnabled(enabled)
    } catch (error) {
      console.error('Failed to refresh integration status:', error)
      toast.error('Failed to load integration status')
    } finally {
      setIsIntegrationLoading(false)
    }
  }

  const updateSetting = <K extends keyof ApplicationSettings>(key: K, value: ApplicationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form) return

    setIsSaving(true)
    try {
      const updatedSettings = {
        ...form.settings,
        ...settings,
        notifications: {
          ...(form.settings?.notifications || {}),
          enabled: settings.selfEmailNotifications || settings.respondentNotifications,
          recipients: settings.notificationEmail ? [settings.notificationEmail] : [],
          on_submit: settings.selfEmailNotifications,
          respondent_notifications: settings.respondentNotifications,
        },
        customEmails: {
          selfSubject: settings.customSelfEmailSubject,
          selfBody: settings.customSelfEmailBody,
          respondentSubject: settings.customRespondentSubject,
          respondentBody: settings.customRespondentBody,
        },
        urlParameters: {
          utm_source: settings.urlUtmSource,
          utm_campaign: settings.urlUtmCampaign,
          utm_medium: settings.urlUtmMedium,
        },
        language: {
          ...(form.settings?.language || {}),
          default: settings.languageDefault,
        },
        applicationDeadline: settings.applicationDeadline || null,
        maxSubmissions: settings.maxSubmissions || null,
      }

      await goClient.patch(`/forms/${formId}`, {
        settings: updatedSettings,
        require_auth: requireAuth,
        allow_multiple_submissions: allowMultipleSubmissions,
      })

      if (googleDriveConnected) {
        await googleDriveClient.updateFormSettings(formId, { is_enabled: googleDriveEnabled })
      }

      toast.success('Settings saved successfully')
      onSave?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConnectGoogleDrive = async () => {
    try {
      await connectGoogleDrive(workspaceId)
      toast.info('Google Drive connection opened via Composio flow. Complete auth in the popup, then click Refresh status.')
    } catch (error) {
      console.error('Failed to start Google Drive connection:', error)
      toast.error('Unable to start Google Drive connection')
    }
  }

  const handleDisconnectGoogleDrive = async () => {
    try {
      setIsIntegrationLoading(true)
      await googleDriveClient.disconnect(workspaceId)
      setGoogleDriveConnected(false)
      setGoogleDriveEnabled(false)
      toast.success('Google Drive disconnected')
    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error)
      toast.error('Unable to disconnect Google Drive')
    } finally {
      setIsIntegrationLoading(false)
    }
  }

  const isDeadlinePassed = settings.applicationDeadline ? new Date(settings.applicationDeadline) < new Date() : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1180px] h-[720px] p-0 gap-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">Application Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure notifications, access, and integrations for this application.</DialogDescription>

        <div className="h-full flex">
          <aside className="w-[300px] border-r border-gray-200 bg-[#f8fafc] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                <Settings className="h-5 w-5 text-blue-500" />
                Settings
              </h2>
              <button type="button" onClick={() => onOpenChange(false)} className="text-gray-500 hover:text-gray-800" aria-label="Close settings">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {SETTINGS_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-colors border',
                    activeTab === tab.id ? 'bg-white border-gray-200 text-gray-900 shadow-sm' : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex-1 min-w-0 flex flex-col">
            <div className="px-7 py-6 border-b border-gray-200">
              <h3 className="text-3xl font-bold text-gray-900 capitalize">{SETTINGS_TABS.find(t => t.id === activeTab)?.label}</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {activeTab === 'notifications' && (
                    <div className="space-y-6">
                      <div className="border-b border-gray-200">
                        <div className="flex items-center gap-6">
                          <button
                            type="button"
                            onClick={() => setNotificationSubTab('general')}
                            className={cn('pb-3 text-sm font-medium transition-colors border-b-2', notificationSubTab === 'general' ? 'text-gray-900 border-gray-900' : 'text-gray-500 border-transparent hover:text-gray-700')}
                          >
                            General
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationSubTab('custom')}
                            className={cn('pb-3 text-sm font-medium transition-colors border-b-2', notificationSubTab === 'custom' ? 'text-gray-900 border-gray-900' : 'text-gray-500 border-transparent hover:text-gray-700')}
                          >
                            Custom emails
                          </button>
                        </div>
                      </div>

                      {notificationSubTab === 'general' ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">Self-email notifications</p>
                              <p className="text-sm text-gray-500 mt-1">Get an email whenever your form is submitted</p>
                            </div>
                            <Switch checked={settings.selfEmailNotifications} onCheckedChange={(checked) => updateSetting('selfEmailNotifications', checked)} />
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">Respondent notifications</p>
                              <p className="text-sm text-gray-500 mt-1">Send an email to the person who filled out your form upon submission</p>
                            </div>
                            <Switch checked={settings.respondentNotifications} onCheckedChange={(checked) => updateSetting('respondentNotifications', checked)} />
                          </div>

                          {(settings.selfEmailNotifications || settings.respondentNotifications) && (
                            <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 space-y-2">
                              <Label className="text-sm font-medium text-gray-700">Notification recipient email</Label>
                              <Input type="email" placeholder="admin@organization.org" value={settings.notificationEmail || ''} onChange={(e) => updateSetting('notificationEmail', e.target.value)} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
                            <p className="font-semibold text-gray-900">Self-notification template</p>
                            <Input placeholder="Subject" value={settings.customSelfEmailSubject} onChange={(e) => updateSetting('customSelfEmailSubject', e.target.value)} />
                            <textarea className="w-full min-h-[120px] rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Email body" value={settings.customSelfEmailBody} onChange={(e) => updateSetting('customSelfEmailBody', e.target.value)} />
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
                            <p className="font-semibold text-gray-900">Respondent template</p>
                            <Input placeholder="Subject" value={settings.customRespondentSubject} onChange={(e) => updateSetting('customRespondentSubject', e.target.value)} />
                            <textarea className="w-full min-h-[120px] rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Email body" value={settings.customRespondentBody} onChange={(e) => updateSetting('customRespondentBody', e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'url' && (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
                      <p className="text-sm text-gray-500">Set default tracking query params appended to shared links.</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2"><Label>utm_source</Label><Input value={settings.urlUtmSource} onChange={(e) => updateSetting('urlUtmSource', e.target.value)} placeholder="newsletter" /></div>
                        <div className="space-y-2"><Label>utm_medium</Label><Input value={settings.urlUtmMedium} onChange={(e) => updateSetting('urlUtmMedium', e.target.value)} placeholder="email" /></div>
                        <div className="space-y-2"><Label>utm_campaign</Label><Input value={settings.urlUtmCampaign} onChange={(e) => updateSetting('urlUtmCampaign', e.target.value)} placeholder="spring_2026" /></div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'behavior' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
                        <Label className="text-sm font-medium">Application Status</Label>
                        <Select value={settings.applicationStatus} onValueChange={(v) => updateSetting('applicationStatus', v as AppStatus)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" />Application Deadline</Label>
                            <Input type="datetime-local" value={settings.applicationDeadline || ''} onChange={(e) => updateSetting('applicationDeadline', e.target.value || null)} />
                            {isDeadlinePassed && settings.applicationDeadline && <p className="text-xs text-red-500">This deadline has passed.</p>}
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2"><Users className="h-4 w-4 text-gray-500" />Maximum Submissions</Label>
                            <Input type="number" min="0" placeholder="Unlimited" value={settings.maxSubmissions || ''} onChange={(e) => updateSetting('maxSubmissions', e.target.value ? parseInt(e.target.value, 10) : null)} />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 flex items-center gap-2"><Edit3 className="h-4 w-4 text-gray-500" />Allow edits after submission</p>
                          <p className="text-sm text-gray-500 mt-1">Let applicants update their responses until the deadline.</p>
                        </div>
                        <Switch checked={settings.allowEditsAfterSubmission} onCheckedChange={(checked) => updateSetting('allowEditsAfterSubmission', checked)} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'access' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Require login to submit</p>
                          <p className="text-sm text-gray-500 mt-1">Only authenticated users can access and submit this form.</p>
                        </div>
                        <Switch checked={requireAuth} onCheckedChange={setRequireAuth} />
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Allow multiple submissions</p>
                          <p className="text-sm text-gray-500 mt-1">Permit applicants to submit more than once.</p>
                        </div>
                        <Switch checked={allowMultipleSubmissions} onCheckedChange={setAllowMultipleSubmissions} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'language' && (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
                      <Label className="text-sm font-medium text-gray-700">Default language</Label>
                      <Select value={settings.languageDefault} onValueChange={(v) => updateSetting('languageDefault', v)}>
                        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {activeTab === 'integrations' && (
                    <div className="space-y-5">
                      <div className="rounded-xl border border-gray-200 bg-white p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Cloud className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">Google Drive</p>
                              <p className="text-sm text-gray-500 mt-1">Connect using Composio to sync uploaded files to your Drive workspace.</p>
                              <div className="mt-3 flex items-center gap-2 text-sm">
                                {googleDriveConnected ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-emerald-700 font-medium">Connected</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <span className="text-amber-700 font-medium">Not connected</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={refreshGoogleDriveStatus} disabled={isIntegrationLoading}>
                              {isIntegrationLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                              Refresh status
                            </Button>
                            {googleDriveConnected ? (
                              <Button variant="outline" onClick={handleDisconnectGoogleDrive} disabled={isIntegrationLoading}>Disconnect</Button>
                            ) : (
                              <Button onClick={handleConnectGoogleDrive} disabled={isIntegrationLoading}>Connect with Composio</Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Enable form sync</p>
                          <p className="text-sm text-gray-500 mt-1">When enabled, this form can sync uploaded documents to Google Drive.</p>
                        </div>
                        <Switch checked={googleDriveEnabled} disabled={!googleDriveConnected} onCheckedChange={setGoogleDriveEnabled} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-7 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || isLoading}>
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
