'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/ui-components/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui-components/dialog'
import { Checkbox } from '@/ui-components/checkbox'
import { Plus } from 'lucide-react'
import { tablesGoClient } from '@/lib/api/tables-go-client'
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

  // Fetch form config and build field label map
  useEffect(() => {
    if (!formId) return
    (async () => {
      try {
        // Try to get full form config (with sections)
        let allFields: any[] = []
        try {
          const full = await formsClient.getFull(formId)
          if (full?.form && full.form.portal_config && Array.isArray(full.form.portal_config.sections)) {
            export function GoogleDriveIntegration({ workspaceId, formId }: GoogleDriveIntegrationProps) {
            <ExternalLink className="h-4 w-4 mr-1" />
            Open
          </a>
        </Button>
      </div>
      <div className="text-xs text-blue-800 mt-1">
        <span className="font-semibold">Structure:</span> <br />
        <span className="ml-2">{folderName}/</span><br />
        <span className="ml-6">[applicant1]/</span><br />
        <span className="ml-6">[applicant2]/</span><br />
        <span className="ml-6">...</span>
      </div>
    </div>
  )
}

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
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id={`file-upload-${app.id}`}
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              // Upload file to your storage (e.g., Supabase Storage, S3, etc.)
                              // For demo, assume a function uploadFile returns { url, name, type, id }
                              try {
                                // TODO: Replace with your actual upload logic
                                const uploaded = await window.uploadFile?.(file)
                                if (!uploaded) throw new Error('Upload failed')
                                // Sync to Google Drive
                                const result = await import('@/lib/api/integrations-client').then(m => m.autoSyncFileToGoogleDrive(app.id, uploaded))
                                if (result) {
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
