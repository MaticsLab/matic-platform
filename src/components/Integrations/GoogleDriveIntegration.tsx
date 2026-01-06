'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/ui-components/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog'
import { Checkbox } from '@/ui-components/checkbox'
import { Plus } from 'lucide-react'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import { Button } from '@/ui-components/button'
import { Badge } from '@/ui-components/badge'
import { Switch } from '@/ui-components/switch'
import { Label } from '@/ui-components/label'
import { Separator } from '@/ui-components/separator'
import {
  HardDrive,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Loader2,
  FolderSync,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import {
  integrationsClient,
  googleDriveClient,
  connectGoogleDrive
} from '@/lib/api/integrations-client'
import type { WorkspaceIntegration, GoogleDriveConfig } from '@/types/integrations'

interface GoogleDriveIntegrationProps {
  workspaceId: string
  formId?: string // Optional, for form-level config
}

export function GoogleDriveIntegration({ workspaceId, formId }: GoogleDriveIntegrationProps) {
  const [integration, setIntegration] = useState<WorkspaceIntegration | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [applicants, setApplicants] = useState<any[]>([])
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [fileNameTemplate, setFileNameTemplate] = useState<string>('${applicant_name}_${field_label}')
  const [uploadFields, setUploadFields] = useState<string[]>([])
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [fieldOptions, setFieldOptions] = useState<{ key: string, label: string }[]>([])
  const [sampleData, setSampleData] = useState<Record<string, any>>({})

  // Fetch integration status on mount
  useEffect(() => {
    fetchIntegration()
    fetchApplicants()
  }, [workspaceId])

  // Fetch all applicants (existing submissions) from table_rows
  const fetchApplicants = async () => {
    if (!formId) return
    try {
      const rows = await tablesGoClient.getRowsByTable(formId)
      // Map to applicant objects for Drive UI (flatten data, add id)
      const applicants = rows.map(row => ({
        id: row.id,
        ...row.data,
        created_at: row.created_at,
        updated_at: row.updated_at,
        // Optionally add full_name/email if present in data
        full_name: row.data?.full_name || row.data?.name || row.data?.personalEmail || row.data?.personal?.personalEmail,
        email: row.data?.email || row.data?.personalEmail || row.data?.personal?.personalEmail,
      }))
      setApplicants(applicants)
      if (applicants.length > 0) setSampleData(applicants[0])
    } catch {
      setApplicants([])
    }
  }

  // Fetch available fields for modal (from first applicant)
  useEffect(() => {
    if (!sampleData) return
    const keys = Object.keys(sampleData)
    setFieldOptions(keys.map(k => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })))
  }, [sampleData])

  // Fetch form integration settings (for upload fields and template)
  useEffect(() => {
    if (!formId) return
    (async () => {
      try {
        const settings = await googleDriveClient.getFormSettings(formId)
        if (typeof settings?.settings?.file_name_template === 'string') setFileNameTemplate(settings.settings.file_name_template)
        else setFileNameTemplate('')
        if (Array.isArray(settings?.settings?.upload_fields)) setUploadFields(settings.settings.upload_fields)
        else setUploadFields([])
      } catch {}
    })()
  }, [formId])
  // Sync all applicants to Drive (with file name template and upload fields)
  const handleSyncAllApplicants = async () => {
    if (!formId || applicants.length === 0) return
    setIsSyncingAll(true)
    try {
      for (const applicant of applicants) {
        await googleDriveClient.createApplicantFolder(applicant.id)
        // Optionally, sync files for each applicant here if needed
      }
      toast.success('All applicants synced to Google Drive')
    } catch (error) {
      toast.error('Failed to sync applicants to Drive')
    } finally {
      setIsSyncingAll(false)
    }
  }

  // Save Drive settings (file name template, upload fields)
  const handleSaveSettings = async () => {
    if (!formId) return
    setIsSavingSettings(true)
    try {
      await googleDriveClient.updateFormSettings(formId, {
        settings: {
          file_name_template: fileNameTemplate,
          upload_fields: uploadFields
        }
      })
      toast.success('Drive settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Check for OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('integration') === 'google_drive' && params.get('status') === 'connected') {
      toast.success('Google Drive connected successfully!')
      fetchIntegration()
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const fetchIntegration = async () => {
    try {
      const data = await integrationsClient.get(workspaceId, 'google_drive')
      setIntegration(data)
    } catch {
      // Integration doesn't exist yet
      setIntegration(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      // Create integration record if doesn't exist
      if (!integration) {
        await integrationsClient.create(workspaceId, 'google_drive')
      }
      // Start OAuth flow
      await connectGoogleDrive(workspaceId)
    } catch (error) {
      console.error('Failed to connect Google Drive:', error)
      toast.error('Failed to start Google Drive connection')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await googleDriveClient.disconnect(workspaceId)
      await fetchIntegration()
      toast.success('Google Drive disconnected')
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error('Failed to disconnect Google Drive')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!integration) return
    try {
      const updated = await integrationsClient.update(workspaceId, 'google_drive', {
        is_enabled: enabled
      })
      setIntegration(updated)
      toast.success(enabled ? 'Google Drive integration enabled' : 'Google Drive integration disabled')
    } catch (error) {
      console.error('Failed to update integration:', error)
      toast.error('Failed to update settings')
    }
  }

  const config = integration?.config as GoogleDriveConfig | undefined

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <HardDrive className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Drive</CardTitle>
              <CardDescription>
                Automatically sync application files and documents
              </CardDescription>
            </div>
          </div>
          {integration?.is_connected ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-gray-50 text-gray-600">
              <X className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!integration?.is_connected ? (
          // Not connected state
          <div className="text-center py-6 px-4 bg-gray-50 rounded-lg border border-dashed">
            <FolderSync className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-4">
              Connect Google Drive to automatically sync applicant files and documents.
              Each application will get its own folder.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              Connect Google Drive
            </Button>
          </div>
        ) : (
          // Connected state
          <>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{integration.connected_email}</p>
                  <p className="text-xs text-gray-500">
                    Connected {integration.connected_at 
                      ? new Date(integration.connected_at).toLocaleDateString()
                      : 'recently'
                    }
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Disconnect'
                )}
              </Button>
            </div>

            <Separator />

            {/* Enable/Disable toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Integration</Label>
                <p className="text-xs text-gray-500">
                  When enabled, files will sync to Google Drive
                </p>
              </div>
              <Switch
                checked={integration.is_enabled}
                onCheckedChange={handleToggleEnabled}
              />
            </div>

            {/* Root folder info */}
            {config?.root_folder_url && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {config.root_folder_name || 'Root Folder'}
                  </p>
                  <p className="text-xs text-blue-700">
                    All application files will be stored here
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-blue-600"
                >
                  <a 
                    href={config.root_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </a>
                </Button>
              </div>
            )}

            {/* Applicants sync section */}
            {formId && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label>Applicants</Label>
                  <Button size="sm" onClick={handleSyncAllApplicants} disabled={isSyncingAll || applicants.length === 0}>
                    {isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSync className="h-4 w-4 mr-1" />}
                    Sync All to Drive
                  </Button>
                </div>
                <ul className="max-h-40 overflow-y-auto border rounded bg-white">
                  {applicants.length === 0 ? (
                    <li className="p-2 text-xs text-gray-500">No applicants found.</li>
                  ) : (
                    applicants.map(app => (
                      <li key={app.id} className="p-2 border-b last:border-b-0 flex items-center gap-2">
                        <span className="text-xs text-gray-700">{app.full_name || app.email || app.id}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {/* Folder/fields config UI */}
            {formId && (
              <div className="mt-6 space-y-4">
                <Label>File Name Template</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={fileNameTemplate}
                    onChange={e => setFileNameTemplate(e.target.value)}
                    placeholder="e.g. ${applicant_name}_${field_label}"
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setShowConfigModal(true)} title="Insert field">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Label>Upload Fields</Label>
                <Input
                  value={uploadFields.join(',')}
                  readOnly
                  placeholder="Comma-separated field keys"
                  className="mb-2"
                />
                            {/* Config Modal */}
                            <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Insert Field & Pick Upload Fields</DialogTitle>
                                </DialogHeader>
                                <div className="mb-4">
                                  <div className="mb-2 font-medium">Available Fields</div>
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {fieldOptions.map(f => (
                                    <Button key={f.key} size="sm" variant="secondary" onClick={() => setFileNameTemplate(t => t + `${f.key}`)}>
                                        {`$${f.key}`}
                                      </Button>
                                    ))}
                                  </div>
                                  <div className="mb-2">
                                    <Label>Upload Fields</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {fieldOptions.map(f => (
                                        <Checkbox
                                          key={f.key}
                                          checked={uploadFields.includes(f.key)}
                                          onCheckedChange={checked => {
                                            setUploadFields(fields => checked ? [...fields, f.key] : fields.filter(x => x !== f.key))
                                          }}
                                        >
                                          {f.label}
                                        </Checkbox>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="mt-4 p-2 bg-gray-50 rounded">
                                    <div className="text-xs text-gray-500 mb-1">Preview</div>
                                    <div className="font-mono text-sm">
                                      {fileNameTemplate.replace(/\$\{([^}]+)\}/g, (_, k) => sampleData[k] || `[${k}]`)}
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={() => setShowConfigModal(false)}>Done</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                <Button size="sm" onClick={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
                </Button>
              </div>
            )}

            {/* Last sync info */}
            {integration.last_sync_at && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <RefreshCw className="h-3 w-3" />
                Last synced: {new Date(integration.last_sync_at).toLocaleString()}
              </div>
            )}
          </>
        )}

        {/* Info message */}
        <div className="flex gap-2 p-3 bg-amber-50 rounded-lg text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium">How it works:</p>
            <ul className="mt-1 space-y-0.5 text-amber-700">
              <li>• A folder is created for each application/form</li>
              <li>• Each applicant gets their own subfolder</li>
              <li>• Uploaded files are automatically synced</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
