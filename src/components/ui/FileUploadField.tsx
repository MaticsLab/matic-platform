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

export interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
  preview?: string
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
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return FileImage
  if (type.includes('pdf') || type.includes('document')) return FileText
  return File
}

const isImageFile = (type: string) => type.startsWith('image/')

export function FileUploadField({
  value,
  onChange,
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  disabled = false,
  imageOnly = false,
  className
}: FileUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normalize value to array for easier handling
  const files: UploadedFile[] = value 
    ? Array.isArray(value) ? value : [value]
    : []

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    setError(null)

    const fileArray = Array.from(newFiles)
    
    // Validate file count
    if (!multiple && fileArray.length > 1) {
      setError('Only one file can be uploaded')
      return
    }
    if (multiple && files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
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

      const uploadedFile: UploadedFile = {
        name: file.name,
        size: file.size,
        type: file.type
      }

      // Create preview URL for images
      if (isImageFile(file.type)) {
        uploadedFile.preview = URL.createObjectURL(file)
      }

      processedFiles.push(uploadedFile)
    }

    if (processedFiles.length > 0) {
      if (multiple) {
        onChange([...files, ...processedFiles])
      } else {
        onChange(processedFiles[0])
      }
    }
  }, [files, multiple, maxFiles, maxSize, imageOnly, onChange])

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
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed',
          files.length > 0 && !multiple && 'hidden'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
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
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragging ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              or click to browse
            </p>
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
            const FileIcon = getFileIcon(file.type)
            const isImage = isImageFile(file.type)
            
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg group"
              >
                {/* Thumbnail or Icon */}
                {isImage && file.preview ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                    <img 
                      src={file.preview} 
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
                  {isImage && file.preview && (
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

      {/* Image Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile?.preview && (
            <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
              <img 
                src={previewFile.preview} 
                alt={previewFile.name}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
