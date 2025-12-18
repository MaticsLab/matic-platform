'use client'

import { Card } from '@/ui-components/card'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { ChevronDown, ChevronUp, Upload, AlertCircle, FileText, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { PortalConfig } from '@/types/portal'

interface PriorityActionsProps {
  config: PortalConfig
  submissionData: Record<string, any>
  formId: string
  rowId?: string
  isPreview?: boolean
}

interface ActionItem {
  id: string
  title: string
  description: string
  type: 'document' | 'field'
  fieldName?: string
  fieldId?: string
  documentName?: string
  dueDate?: string
  required?: boolean
}

export function PriorityActions({
  config,
  submissionData,
  formId,
  rowId,
  isPreview = false
}: PriorityActionsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  // Extract incomplete required fields from config
  const getIncompleteActions = (): ActionItem[] => {
    const actions: ActionItem[] = []
    
    config.sections.forEach(section => {
      section.fields?.forEach(field => {
        if (field.required && !submissionData[field.id]) {
          actions.push({
            id: field.id,
            title: `Complete ${field.label}`,
            description: 'Required field missing',
            type: 'field',
            fieldName: field.label,
            fieldId: field.id,
            required: true
          })
        }
      })
    })
    
    return actions
  }

  const [pendingActions, setPendingActions] = useState<ActionItem[]>(getIncompleteActions())

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleFileSelect = (actionId: string, file: File | null) => {
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [actionId]: file }))
    }
  }

  const handleUpload = (actionId: string) => {
    const file = selectedFiles[actionId]
    if (!file) return

    setUploadingId(actionId)

    // Simulate upload
    setTimeout(() => {
      setCompletedIds(prev => new Set([...prev, actionId]))
      setPendingActions(prev => prev.filter(a => a.id !== actionId))
      setUploadingId(null)
      setSelectedFiles(prev => {
        const newFiles = { ...prev }
        delete newFiles[actionId]
        return newFiles
      })
      setExpandedId(null)
    }, 1000)
  }

  const activePending = pendingActions.filter(a => !completedIds.has(a.id))
  const completedActions = pendingActions.filter(a => completedIds.has(a.id))

  if (isPreview && activePending.length === 0) {
    // Show sample data for preview
    const sampleActions: ActionItem[] = [
      {
        id: 'sample-1',
        title: 'Upload Financial Aid Form',
        description: 'Required document missing',
        type: 'document',
        documentName: 'Financial Aid Form',
        dueDate: 'Due March 10',
      },
      {
        id: 'sample-2',
        title: 'Complete Essay Question',
        description: 'Required field missing',
        type: 'field',
        fieldName: 'Personal Statement',
      },
    ]
    
    return (
      <Card className="p-4 sm:p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-lg text-gray-900">What You Need To Do</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full">
            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-xs text-orange-600">{sampleActions.length} pending</span>
          </div>
        </div>
        
        <div className="space-y-1.5">
          {sampleActions.map((action) => (
            <div
              key={action.id}
              className="border border-gray-200 bg-white rounded-lg p-3"
            >
              <div className="flex gap-2.5 items-center">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{action.title}</p>
                  {action.dueDate && (
                    <p className="text-xs text-orange-600 mt-0.5">{action.dueDate}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (activePending.length === 0 && completedActions.length === 0) {
    return (
      <Card className="p-4 sm:p-6 border border-gray-200">
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg text-gray-900 mb-1">All caught up!</h3>
          <p className="text-sm text-gray-600">You've completed all required actions.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg text-gray-900">What You Need To Do</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {completedActions.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-600">
                {completedActions.length} completed
              </span>
            </div>
          )}
          {activePending.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-xs text-orange-600">{activePending.length} pending</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
        {/* Pending Items */}
        {activePending.length > 0 && (
          <div className="space-y-1.5">
            {activePending.map((action) => (
              <div
                key={action.id}
                className={`border rounded-lg overflow-hidden transition-all duration-500 ${
                  uploadingId === action.id 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  onClick={() => toggleExpand(action.id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors touch-manipulation active:bg-gray-100"
                >
                  <div className="flex gap-2.5 flex-1 text-left items-center min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      uploadingId === action.id ? 'bg-green-100' : 'bg-orange-50'
                    }`}>
                      {uploadingId === action.id ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-gray-900">{action.title}</p>
                      {action.dueDate && (
                        <p className="text-xs text-orange-600 mt-0.5">{action.dueDate}</p>
                      )}
                    </div>
                  </div>
                  {expandedId === action.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-3" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-3" />
                  )}
                </button>

                {expandedId === action.id && (
                  <div className="px-3 pb-3 pt-2 bg-gray-50 border-t border-gray-200">
                    {action.type === 'document' && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm text-gray-700 mb-2 block">
                            Upload {action.documentName}
                          </Label>
                          <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center hover:border-gray-400 transition-colors cursor-pointer block touch-manipulation">
                            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-600 mb-1">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PDF, DOC, DOCX (max 10MB)</p>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => handleFileSelect(action.id, e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                        {selectedFiles[action.id] && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-sm text-gray-900 break-all">{selectedFiles[action.id].name}</span>
                            <Button 
                              size="sm" 
                              className="w-full sm:w-auto touch-manipulation min-h-[44px] sm:min-h-0"
                              onClick={() => handleUpload(action.id)}
                              disabled={uploadingId === action.id}
                              style={{ backgroundColor: '#3B82F6' }}
                            >
                              {uploadingId === action.id ? 'Uploading...' : 'Upload'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {action.type === 'field' && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm text-gray-700 mb-2 block">
                            {action.fieldName}
                          </Label>
                          <Input
                            placeholder={`Enter ${action.fieldName?.toLowerCase()}`}
                            className="border-gray-200 min-h-[44px]"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setExpandedId(null)} className="touch-manipulation min-h-[44px] sm:min-h-0">
                            Cancel
                          </Button>
                          <Button size="sm" className="touch-manipulation min-h-[44px] sm:min-h-0" style={{ backgroundColor: '#3B82F6' }}>
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Completed Items */}
        {completedActions.length > 0 && (
          <div className="space-y-1.5">
            {activePending.length > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-500">Completed</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
            )}
            {completedActions.map((action) => (
              <div
                key={action.id}
                className="border border-green-200 bg-green-50 rounded-lg overflow-hidden"
              >
                <div className="w-full p-3 flex items-center justify-between cursor-default">
                  <div className="flex gap-2.5 flex-1 text-left items-center min-w-0">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-green-700">{action.title}</p>
                      <p className="text-xs text-green-600 mt-0.5">Submitted</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
