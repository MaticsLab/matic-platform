'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  ExternalLink, 
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  X,
  Maximize2,
  File,
  FileImage,
  FileVideo,
  FileAudio
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileData {
  url?: string
  Url?: string
  name?: string
  Name?: string
  size?: number
  Size?: number
  mimeType?: string
  'Mime Type'?: string
  mime_type?: string
}

interface DocumentPreviewProps {
  value: FileData | FileData[] | string
  fieldName: string
  isPrivacyMode?: boolean
  piiValuesToRedact?: string[]
  className?: string
}

// Parse file data from various formats
function parseFileData(value: any): FileData | null {
  if (!value) return null
  
  // If it's a string URL
  if (typeof value === 'string') {
    if (value.startsWith('http')) {
      return { url: value, name: value.split('/').pop() || 'Document' }
    }
    // Try parsing as JSON
    try {
      const parsed = JSON.parse(value)
      return parseFileData(parsed)
    } catch {
      return null
    }
  }
  
  // If it's an object with file data
  if (typeof value === 'object' && value !== null) {
    const url = value.url || value.Url || value.URL
    const name = value.name || value.Name || value.filename || value.fileName
    const size = value.size || value.Size
    const mimeType = value.mimeType || value['Mime Type'] || value.mime_type || value.type
    
    if (url) {
      return { url, name, size, mimeType }
    }
  }
  
  return null
}

// Get file type from mime type or URL
function getFileType(file: FileData): 'pdf' | 'image' | 'video' | 'audio' | 'other' {
  const mimeType = (file.mimeType || '').toLowerCase()
  const url = (file.url || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  
  if (mimeType.includes('pdf') || url.includes('.pdf') || name.includes('.pdf')) {
    return 'pdf'
  }
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)/.test(url) || /\.(jpg|jpeg|png|gif|webp|svg|bmp)/.test(name)) {
    return 'image'
  }
  if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|avi)/.test(url) || /\.(mp4|webm|mov|avi)/.test(name)) {
    return 'video'
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg)/.test(url) || /\.(mp3|wav|ogg)/.test(name)) {
    return 'audio'
  }
  
  return 'other'
}

// Format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Get icon for file type
function FileIcon({ type, className }: { type: 'pdf' | 'image' | 'video' | 'audio' | 'other', className?: string }) {
  switch (type) {
    case 'pdf':
      return <FileText className={cn("text-red-500", className)} />
    case 'image':
      return <FileImage className={cn("text-blue-500", className)} />
    case 'video':
      return <FileVideo className={cn("text-purple-500", className)} />
    case 'audio':
      return <FileAudio className={cn("text-green-500", className)} />
    default:
      return <File className={cn("text-gray-500", className)} />
  }
}

// Single file preview component
function SingleFilePreview({ 
  file, 
  isPrivacyMode, 
  piiValuesToRedact = [],
  onExpand 
}: { 
  file: FileData
  isPrivacyMode?: boolean
  piiValuesToRedact?: string[]
  onExpand?: () => void
}) {
  const [imageError, setImageError] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const fileType = getFileType(file)
  
  // Redact PII from filename if needed
  const displayName = (() => {
    let name = file.name || 'Document'
    if (isPrivacyMode && piiValuesToRedact.length > 0) {
      piiValuesToRedact.forEach(pii => {
        const regex = new RegExp(pii.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        name = name.replace(regex, '████')
      })
    }
    return name
  })()
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Preview Area */}
      <div className="relative bg-gray-50 h-48 flex items-center justify-center">
        {isPrivacyMode && (
          <div className="absolute inset-0 bg-amber-50/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4">
            <Shield className="w-8 h-8 text-amber-600 mb-2" />
            <span className="text-sm font-medium text-amber-800">Privacy Mode Active</span>
            <span className="text-xs text-amber-600 text-center mt-1">
              Document may contain sensitive information
            </span>
            <button
              onClick={() => setShowPreview(true)}
              className="mt-3 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              View Anyway
            </button>
          </div>
        )}
        
        {(!isPrivacyMode || showPreview) && (
          <>
            {fileType === 'image' && !imageError ? (
              <img
                src={file.url}
                alt={displayName}
                className="max-h-full max-w-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : fileType === 'pdf' ? (
              <div className="w-full h-full">
                <iframe
                  src={`${file.url}#toolbar=0&navpanes=0`}
                  className="w-full h-full border-0"
                  title={displayName}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileIcon type={fileType} className="w-12 h-12" />
                <span className="text-sm text-gray-500">{fileType.toUpperCase()} File</span>
              </div>
            )}
          </>
        )}
        
        {/* Expand button */}
        {file.url && (!isPrivacyMode || showPreview) && (
          <button
            onClick={onExpand}
            className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm transition-colors z-20"
            title="View full size"
          >
            <Maximize2 className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
      
      {/* File Info */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-start gap-2">
          <FileIcon type={fileType} className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
              {displayName}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              {file.size && <span>{formatFileSize(file.size)}</span>}
              {file.mimeType && <span className="truncate">{file.mimeType}</span>}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
          <a
            href={file.url}
            download={file.name}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </div>
    </div>
  )
}

// Full-screen modal for document viewing
function DocumentModal({ 
  file, 
  isOpen, 
  onClose,
  isPrivacyMode
}: { 
  file: FileData
  isOpen: boolean
  onClose: () => void
  isPrivacyMode?: boolean
}) {
  const fileType = getFileType(file)
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      
      {/* Privacy warning banner */}
      {isPrivacyMode && (
        <div className="absolute top-4 left-4 right-20 bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            Privacy Mode: This document may contain sensitive information that should be reviewed carefully.
          </span>
        </div>
      )}
      
      {/* Content */}
      <div className="max-w-5xl w-full max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl">
        {fileType === 'image' ? (
          <img
            src={file.url}
            alt={file.name || 'Document'}
            className="w-full h-auto max-h-[90vh] object-contain"
          />
        ) : fileType === 'pdf' ? (
          <iframe
            src={file.url}
            className="w-full h-[85vh]"
            title={file.name || 'Document'}
          />
        ) : (
          <div className="p-8 text-center">
            <FileIcon type={fileType} className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">{file.name}</p>
            <p className="text-gray-500 mb-4">Preview not available for this file type</p>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// Main component
export function DocumentPreview({ 
  value, 
  fieldName,
  isPrivacyMode = false,
  piiValuesToRedact = [],
  className 
}: DocumentPreviewProps) {
  const [expandedFile, setExpandedFile] = useState<FileData | null>(null)
  
  // Parse the value into file(s)
  const files: FileData[] = (() => {
    if (Array.isArray(value)) {
      return value.map(parseFileData).filter((f): f is FileData => f !== null)
    }
    const single = parseFileData(value)
    return single ? [single] : []
  })()
  
  if (files.length === 0) {
    return (
      <div className="text-gray-400 italic text-sm">No document attached</div>
    )
  }
  
  return (
    <div className={cn("space-y-3", className)}>
      {files.length === 1 ? (
        <SingleFilePreview
          file={files[0]}
          isPrivacyMode={isPrivacyMode}
          piiValuesToRedact={piiValuesToRedact}
          onExpand={() => setExpandedFile(files[0])}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {files.map((file, idx) => (
            <SingleFilePreview
              key={idx}
              file={file}
              isPrivacyMode={isPrivacyMode}
              piiValuesToRedact={piiValuesToRedact}
              onExpand={() => setExpandedFile(file)}
            />
          ))}
        </div>
      )}
      
      {/* Full-screen modal */}
      {expandedFile && (
        <DocumentModal
          file={expandedFile}
          isOpen={!!expandedFile}
          onClose={() => setExpandedFile(null)}
          isPrivacyMode={isPrivacyMode}
        />
      )}
    </div>
  )
}

// Helper to check if a value is a file/document
export function isFileValue(value: any): boolean {
  if (!value) return false
  
  // Check if it's a string URL pointing to a file
  if (typeof value === 'string') {
    if (value.includes('storage') && value.includes('object')) return true
    if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx)($|\?)/i.test(value)) return true
  }
  
  // Check if it's an object with file properties
  if (typeof value === 'object' && value !== null) {
    const hasUrl = !!(value.url || value.Url || value.URL)
    const hasMime = !!(value.mimeType || value['Mime Type'] || value.mime_type || value.type)
    const hasFileIndicator = hasUrl || hasMime
    return hasFileIndicator
  }
  
  // Check if it's an array of files
  if (Array.isArray(value) && value.length > 0) {
    return isFileValue(value[0])
  }
  
  return false
}
