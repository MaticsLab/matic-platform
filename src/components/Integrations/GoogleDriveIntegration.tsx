'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/ui-components/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog'
import { Checkbox } from '@/ui-components/checkbox'
import { Plus } from 'lucide-react'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { rowFilesClient } from '@/lib/api/files-client'
import { formsClient } from '@/lib/api/forms-client'
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
    const [filesByApplicant, setFilesByApplicant] = useState<Record<string, any[]>>({})
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
  const [fieldLabelMap, setFieldLabelMap] = useState<Record<string, string>>({})

  // Fetch integration status
  const fetchIntegration = async () => {
    setIsLoading(true)
    try {
      const integ = await integrationsClient.get(workspaceId, 'google_drive')
      setIntegration(integ)
      setIsLoading(false)
    } catch {
      setIntegration(null)
      setIsLoading(false)
    }
  }

  // Fetch form fields for fieldOptions
  const fetchFieldOptions = async () => {
    if (!formId) return;
    try {
      const form = await formsClient.get(formId)
      if (form?.fields) {
        setFieldOptions(form.fields.map((f: any) => ({ key: f.key, label: f.label || f.key })))
        // Optionally set fieldLabelMap
        setFieldLabelMap(Object.fromEntries(form.fields.map((f: any) => [f.key, f.label || f.key])))
      }
    } catch {
      setFieldOptions([])
    }
  }

  // Sync all applicants to Drive
  const handleSyncAllApplicants = async () => {
    setIsSyncingAll(true)
    try {
      await Promise.all(applicants.map(app => googleDriveClient.syncAllFiles(app.id)))
      toast.success('All applicants synced to Drive')
    } catch {
      toast.error('Failed to sync all applicants')
    }
    setIsSyncingAll(false)
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
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    }
    setIsSavingSettings(false)
  }

  // Connect to Google Drive
  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      await connectGoogleDrive(workspaceId)
      await fetchIntegration()
    } catch {
      toast.error('Failed to connect to Google Drive')
    }
    setIsConnecting(false)
  }

  useEffect(() => {
    fetchIntegration()
    if (formId) fetchFieldOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, formId])

  // Fetch all applicants (existing submissions) from table_rows using the correct table_id
  const fetchApplicants = async () => {
    if (!formId) return;
    try {
      // formId should be the table_id from PortalEditor
      const rows = await tablesGoClient.getRowsByTable(formId);
      // For each applicant, fetch their Drive folder (if exists)
      const applicants = await Promise.all(rows.map(async row => {
        let driveFolderUrl = null;
        try {
          const folder = await googleDriveClient.createApplicantFolder(row.id as string);
          driveFolderUrl = folder.folder_url;
        } catch {}
        return {
          id: row.id,
          ...row.data,
          created_at: row.created_at,
          updated_at: row.updated_at,
          full_name: row.data?.full_name || row.data?.name || row.data?.personalEmail || row.data?.personal?.personalEmail,
          email: row.data?.email || row.data?.personalEmail || row.data?.personal?.personalEmail,
          driveFolderUrl,
        };
      }));
      setApplicants(applicants);
      if (applicants.length > 0) setSampleData(applicants[0]);
      // Fetch files for each applicant
      const filesMap: Record<string, any[]> = {};
      for (const app of applicants) {
        const rowId = String(app.id || '');
        if (!rowId) {
          filesMap[rowId] = [];
          continue;
        }
        try {
          // Use rowFilesClient.list to fetch files for a row/applicant
          const files = await rowFilesClient.list(rowId) || [];
          filesMap[rowId] = files;
        } catch {
          filesMap[rowId] = [];
        }
      }
      setFilesByApplicant(filesMap);
    } catch {
      setApplicants([]);
    }
  } 

  // Fetch form config and build field label map
  useEffect(() => {

    if (!formId) return;
    // (Async logic for fetching form config can be added here if needed)
  }, [formId]);

  // Main render
  return (

    <Card>
      <CardContent>
        {/* DEBUG: Show raw applicants data for troubleshooting */}
        <pre className="text-xs bg-gray-100 p-2 rounded mb-2 max-h-40 overflow-auto">{JSON.stringify(applicants, null, 2)}</pre>
        {/* Google Drive Connect Button */}
        {isLoading ? (
          <div className="py-8 text-center text-gray-400">Loading integration status...</div>
        ) : !integration?.is_connected ? (
          <div className="flex flex-col items-center py-8">
            <Button size="lg" onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HardDrive className="h-4 w-4 mr-2" />}
              Connect Google Drive
            </Button>
            <div className="text-xs text-gray-500 mt-2">Connect your Google Drive to enable file sync.</div>
          </div>
        ) : (
          <>
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
                      <li key={app.id} className="p-2 border-b last:border-b-0 flex items-center gap-2 justify-between">
                        <span className="text-xs text-gray-700">{app.full_name || app.email || app.id}</span>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            {app.driveFolderUrl && (
                              <a href={app.driveFolderUrl} target="_blank" rel="noopener noreferrer" title="Open Drive Folder">
                                <ExternalLink className="h-4 w-4 text-blue-600" />
                              </a>
                            )}
                            <input
                              type="file"
                              id={`file-upload-${app.id}`}
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  // @ts-ignore
                                  const uploaded = await (window as any).uploadFile?.(file)
                                  if (!uploaded) throw new Error('Upload failed')
                                  const result = await import('@/lib/api/integrations-client').then(m => m.autoSyncFileToGoogleDrive(app.id, uploaded))
                                  if (result && result.file_url) {
                                    toast.success(<span>File uploaded. <a href={result.file_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Open in Drive</a></span>)
                                  } else if (result) {
                                    toast.success('File uploaded and synced to Drive')
                                  } else {
                                    toast.error('File uploaded but failed to sync to Drive')
                                  }
                                } catch (err) {
                                  toast.error('Upload failed')
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Add document"
                              onClick={() => {
                                const input = document.getElementById(`file-upload-${app.id}`) as HTMLInputElement
                                input?.click()
                              }}
                            >
                              <Plus className="h-4 w-4 text-blue-500" />
                            </Button>
                          </div>
                          {/* File picker for already-uploaded files */}
                          {filesByApplicant[app.id]?.length > 0 && (
                            <div className="flex flex-col gap-1 mt-2">
                              <span className="text-xs text-gray-500">Already uploaded files:</span>
                              <ul className="flex flex-wrap gap-2">
                                {filesByApplicant[app.id].map(file => (
                                  <li key={file.id} className="flex items-center gap-1">
                                    <span className="text-xs">{file.name}</span>
                                    <Button size="sm" variant="outline" onClick={async () => {
                                      try {
                                        const result = await import('@/lib/api/integrations-client').then(m => m.autoSyncFileToGoogleDrive(app.id, file))
                                        if (result && result.file_url) {
                                          toast.success(<span>File synced. <a href={result.file_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Open in Drive</a></span>)
                                        } else if (result) {
                                          toast.success('File synced to Drive')
                                        } else {
                                          toast.error('Failed to sync file to Drive')
                                        }
                                      } catch {
                                        toast.error('Failed to sync file')
                                      }
                                    }}>
                                      Sync to Drive
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </>
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
                  <div className="flex flex-wrap gap-2 mb-2 max-h-40 overflow-y-auto pr-1" style={{minWidth: '200px'}}>
                    {fieldOptions.map(f => (
                      <Button key={f.key} size="sm" variant="secondary" onClick={() => setFileNameTemplate(t => t + `${f.key}`)}>
                        {`$${f.key}`}
                      </Button>
                    ))}
                  </div>
                  <div className="mb-2">
                    <Label>Upload Fields</Label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1" style={{minWidth: '200px'}}>
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
        {integration && integration.last_sync_at && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw className="h-3 w-3" />
            Last synced: {new Date(integration.last_sync_at).toLocaleString()}
          </div>
        )}

        {/* Info message */}
        <div className="flex gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 mt-4">
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
  );
}
