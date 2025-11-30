'use client'

import { useState, useRef, useCallback } from 'react'
import { 
  Upload, File, FileText, FileImage, X, Eye, Download, 
  CheckCircle2, AlertCircle, Loader2 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/ui-components/dialog'
import { supabase } from '@/lib/supabase'

export interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
  preview?: string
  mime_type?: string
}

interface FileUploadFieldProps {
  value: UploadedFile | UploadedFile[] | null
  onChange: (files: UploadedFile | UploadedFile[] | null) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // in bytes
  maxFiles?: number
  disabled?: boolean
  imageOnly?: boolean
  className?: string
  /** Storage bucket name (default: 'workspace-assets') */
  storageBucket?: string
  /** Storage path prefix (e.g., 'submissions/form-id/') */
  storagePath?: string
  /** Row ID for linking files to a specific row */
  rowId?: string
  /** Table ID for linking files to a specific table */
  tableId?: string
  /** Field ID for linking files to a specific field */
  fieldId?: string
  /** Workspace ID for linking files to a workspace */
  workspaceId?: string
  /** Whether to register files in table_files (default: true) */
  registerFiles?: boolean
  /** Callback when file is registered in table_files */
  onFileRegistered?: (fileRecord: any) => void
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Infer MIME type from filename extension
const inferTypeFromName = (name?: string): string | undefined => {
  if (!name) return undefined
  const ext = name.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
  }
  return ext ? mimeTypes[ext] : undefined
}

const getFileType = (file: { type?: string; name?: string }): string | undefined => {
  return file.type || inferTypeFromName(file.name)
}

const getFileIcon = (type?: string, name?: string) => {
  const resolvedType = type || inferTypeFromName(name)
  if (!resolvedType) return File
  if (resolvedType.startsWith('image/')) return FileImage
  if (resolvedType.includes('pdf') || resolvedType.includes('document')) return FileText
  return File
}

const isImageFile = (type?: string, name?: string) => {
  const resolvedType = type || inferTypeFromName(name)
  return resolvedType?.startsWith('image/') || false
}

export function FileUploadField({
  value,
  onChange,
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  disabled = false,
  imageOnly = false,
  className,
  storageBucket = 'workspace-assets',
  storagePath = '',
  rowId,
  tableId,
  fieldId,
  workspaceId,
  registerFiles = true,
  onFileRegistered
}: FileUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normalize value to array for easier handling
  const files: UploadedFile[] = value 
    ? Array.isArray(value) ? value : [value]
    : []

  const handleFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    setError(null)
    setIsUploading(true)

    const fileArray = Array.from(newFiles)
    
    // Validate file count
    if (!multiple && fileArray.length > 1) {
      setError('Only one file can be uploaded')
      setIsUploading(false)
      return
    }
    if (multiple && files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      setIsUploading(false)
      return
    }

    const processedFiles: UploadedFile[] = []

    for (const file of fileArray) {
      // Validate file size
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`)
        continue
      }

      // Validate image type if imageOnly
      if (imageOnly && !file.type.startsWith('image/')) {
        setError('Only image files are allowed')
        continue
      }

      try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = storagePath ? `${storagePath}${uniqueName}` : uniqueName

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(storageBucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('File upload error:', uploadError)
          setError(`Failed to upload "${file.name}": ${uploadError.message}`)
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(filePath)

        const uploadedFile: UploadedFile = {
          name: file.name,
          size: file.size,
          type: file.type,
          mime_type: file.type,
          url: publicUrl
        }

        // Create local preview URL for images (for immediate display)
        if (isImageFile(file.type)) {
          uploadedFile.preview = URL.createObjectURL(file)
        }

        // Register file in table_files if enabled
        if (registerFiles) {
          try {
            const { registerUploadedFile } = await import('@/lib/api/files-client')
            const fileRecord = await registerUploadedFile({
              file,
              storagePath: filePath,
              publicUrl,
              rowId,
              tableId,
              fieldId,
              workspaceId,
              storageBucket,
            })
            // Attach the file record ID to the uploaded file
            ;(uploadedFile as any).file_id = fileRecord.id
            onFileRegistered?.(fileRecord)
          } catch (registerError) {
            // Log but don't fail the upload - file is already in storage
            console.warn('Failed to register file in table_files:', registerError)
          }
        }

        processedFiles.push(uploadedFile)
      } catch (err: any) {
        console.error('Upload error:', err)
        setError(`Failed to upload "${file.name}": ${err.message || 'Unknown error'}`)
      }
    }

    setIsUploading(false)

    if (processedFiles.length > 0) {
      if (multiple) {
        onChange([...files, ...processedFiles])
      } else {
        onChange(processedFiles[0])
      }
    }
  }, [files, multiple, maxFiles, maxSize, imageOnly, onChange, storageBucket, storagePath, rowId, tableId, fieldId, workspaceId, registerFiles, onFileRegistered])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!disabled) {
      handleFiles(e.dataTransfer.files)
    }
  }, [disabled, handleFiles])

  const handleRemoveFile = useCallback((index: number) => {
    if (multiple) {
      const newFiles = [...files]
      // Revoke object URL if exists
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      onChange(newFiles.length > 0 ? newFiles : null)
    } else {
      if (files[0]?.preview) {
        URL.revokeObjectURL(files[0].preview)
      }
      onChange(null)
    }
  }, [files, multiple, onChange])

  const acceptString = imageOnly 
    ? 'image/*' 
    : accept || '.pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif'

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          (disabled || isUploading) && 'opacity-50 cursor-not-allowed',
          files.length > 0 && !multiple && 'hidden'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || isUploading}
          className="hidden"
        />
        
        <div className={cn(
          'flex flex-col items-center gap-3',
          isDragging ? 'text-blue-600' : 'text-gray-500'
        )}>
          <div className={cn(
            'p-4 rounded-full',
            isDragging ? 'bg-blue-100' : 'bg-gray-100'
          )}>
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {isUploading 
                ? 'Uploading...' 
                : isDragging 
                  ? 'Drop files here' 
                  : 'Drag and drop files here'}
            </p>
            {!isUploading && (
              <p className="text-xs text-gray-400 mt-1">
                or click to browse
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {imageOnly ? 'PNG, JPG, GIF' : 'PDF, DOC, XLS, PNG, JPG'} up to {formatFileSize(maxSize)}
            {multiple && ` • Max ${maxFiles} files`}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => {
            // Debug: log file structure
            console.log('FileUploadField file data:', file)
            
            const FileIcon = getFileIcon(file.type, file.name)
            const isImage = isImageFile(file.type, file.name)
            // Use preview URL if available, otherwise fall back to url from backend
            const imageUrl = isImage ? (file.preview || file.url) : undefined
            // Check if file has any viewable URL
            const hasViewableUrl = !!(file.preview || file.url)
            
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg group"
              >
                {/* Thumbnail or Icon */}
                {isImage && imageUrl ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                    <img 
                      src={imageUrl} 
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                    <FileIcon className="w-6 h-6 text-gray-500" />
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Preview button - show for any file that has a preview or url */}
                  {(file.preview || file.url) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewFile(file)
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {file.url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(file.url, '_blank')
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFile(index)
                    }}
                    disabled={disabled}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Success indicator */}
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              </div>
            )
          })}

          {/* Add more files button for multiple */}
          {multiple && files.length < maxFiles && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              <Upload className="w-4 h-4 mr-2" />
              Add more files
            </Button>
          )}
        </div>
      )}

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewFile?.name}
              {previewFile?.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => window.open(previewFile.url, '_blank')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const previewUrl = previewFile?.preview || previewFile?.url
            const fileType = getFileType(previewFile || {})
            const isPdf = fileType?.includes('pdf')
            const isImage = isImageFile(previewFile?.type, previewFile?.name)
            
            if (!previewUrl) return null
            
            if (isImage) {
              return (
                <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
                  <img 
                    src={previewUrl} 
                    alt={previewFile?.name}
                    className="max-w-full max-h-[70vh] object-contain rounded"
                  />
                </div>
              )
            }
            
            if (isPdf) {
              return (
                <div className="w-full h-[70vh] bg-gray-100 rounded-lg overflow-hidden">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    title={previewFile?.name}
                  />
                </div>
              )
            }
            
            // For other file types, show a message with download option
            return (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-100 rounded-lg gap-4">
                <File className="w-16 h-16 text-gray-400" />
                <p className="text-gray-600">Preview not available for this file type</p>
                <Button onClick={() => window.open(previewUrl, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
