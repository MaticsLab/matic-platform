'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Separator } from '@/ui-components/separator'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { toast } from 'sonner'
import { Loader2, Calendar, Users, Mail, Edit3, AlertCircle } from 'lucide-react'

interface ApplicationSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  onSave?: () => void
}

interface ApplicationSettings {
  applicationDeadline?: string | null
  applicationStatus: 'open' | 'closed' | 'draft'
  maxSubmissions?: number | null
  notificationEmail?: string
  allowEditsAfterSubmission: boolean
}

const DEFAULT_SETTINGS: ApplicationSettings = {
  applicationDeadline: null,
  applicationStatus: 'open',
  maxSubmissions: null,
  notificationEmail: '',
  allowEditsAfterSubmission: false
}

export function ApplicationSettingsModal({ 
  open, 
  onOpenChange, 
  formId, 
  onSave 
}: ApplicationSettingsModalProps) {
  const [form, setForm] = useState<Form | null>(null)
  const [settings, setSettings] = useState<ApplicationSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load form data when modal opens
  useEffect(() => {
    if (open && formId) {
      fetchForm()
    }
  }, [open, formId])

  const fetchForm = async () => {
    setIsLoading(true)
    try {
      const data = await goClient.get<Form>(`/forms/${formId}`)
      setForm(data)
      
      // Parse existing settings
      const existingSettings = data.settings || {}
      setSettings({
        applicationDeadline: existingSettings.applicationDeadline || null,
        applicationStatus: existingSettings.applicationStatus || 'open',
        maxSubmissions: existingSettings.maxSubmissions || null,
        notificationEmail: existingSettings.notificationEmail || '',
        allowEditsAfterSubmission: existingSettings.allowEditsAfterSubmission || false
      })
    } catch (error) {
      console.error('Failed to fetch form:', error)
      toast.error('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form) return

    setIsSaving(true)
    try {
      // Merge with existing settings
      const updatedSettings = {
        ...form.settings,
        ...settings,
        // Clean up null values for optional fields
        applicationDeadline: settings.applicationDeadline || null,
        maxSubmissions: settings.maxSubmissions || null
      }

      await goClient.patch(`/forms/${formId}`, {
        settings: updatedSettings
      })

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

  const updateSetting = <K extends keyof ApplicationSettings>(
    key: K, 
    value: ApplicationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Calculate if deadline has passed
  const isDeadlinePassed = settings.applicationDeadline 
    ? new Date(settings.applicationDeadline) < new Date() 
    : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Application Settings
          </DialogTitle>
          <DialogDescription>
            Configure how this application accepts and manages submissions
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Application Status */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                Application Status
              </Label>
              <Select
                value={settings.applicationStatus}
                onValueChange={(v) => updateSetting('applicationStatus', v as ApplicationSettings['applicationStatus'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Open - Accepting submissions
                    </div>
                  </SelectItem>
                  <SelectItem value="closed">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      Closed - Not accepting submissions
                    </div>
                  </SelectItem>
                  <SelectItem value="draft">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      Draft - Hidden from applicants
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Control whether the application accepts new submissions
              </p>
            </div>

            <Separator />

            {/* Application Deadline */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Application Deadline
              </Label>
              <Input
                type="datetime-local"
                value={settings.applicationDeadline || ''}
                onChange={(e) => updateSetting('applicationDeadline', e.target.value || null)}
              />
              {isDeadlinePassed && settings.applicationDeadline && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  This deadline has passed
                </p>
              )}
              <p className="text-xs text-gray-500">
                The form will automatically stop accepting submissions after this date
              </p>
            </div>

            <Separator />

            {/* Maximum Submissions */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                Maximum Submissions
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Unlimited"
                value={settings.maxSubmissions || ''}
                onChange={(e) => updateSetting('maxSubmissions', e.target.value ? parseInt(e.target.value) : null)}
              />
              <p className="text-xs text-gray-500">
                Leave empty for unlimited. Form closes when limit is reached.
              </p>
            </div>

            <Separator />

            {/* Notification Email */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                Notification Email
              </Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={settings.notificationEmail || ''}
                onChange={(e) => updateSetting('notificationEmail', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Receive email notifications when new applications are submitted
              </p>
            </div>

            <Separator />

            {/* Allow Edits After Submission */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-gray-500" />
                  Allow Edits After Submission
                </Label>
                <p className="text-xs text-gray-500">
                  Let applicants update their application until the deadline
                </p>
              </div>
              <Switch
                checked={settings.allowEditsAfterSubmission}
                onCheckedChange={(checked) => updateSetting('allowEditsAfterSubmission', checked)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
