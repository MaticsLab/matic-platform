'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Shield,
  AlertTriangle,
  X,
  Maximize2,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyzeDocumentPII, getRedactedDocument, PIILocation } from '@/lib/api/document-pii-client'

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
  knownPII?: Record<string, string> // Known PII values from form data
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
  knownPII = {},
  onExpand,
  onPIIDetected
}: { 
  file: FileData
  isPrivacyMode?: boolean
  piiValuesToRedact?: string[]
  knownPII?: Record<string, string>
  onExpand?: () => void
  onPIIDetected?: (pii: PIILocation[]) => void
}) {
  const [imageError, setImageError] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [detectedPII, setDetectedPII] = useState<PIILocation[]>([])
  const [redactedImageUrl, setRedactedImageUrl] = useState<string | null>(null)
  const fileType = getFileType(file)
  
  // In privacy mode, always show redacted version
  const showRedactions = isPrivacyMode
  
  // Auto-scan document when in privacy mode and get redacted version
  useEffect(() => {
    if (isPrivacyMode && file.url && !scanComplete && !isScanning && !scanError) {
      const scanDocument = async () => {
        setIsScanning(true)
        try {
          // For images, get the redacted version directly
          if (fileType === 'image') {
            const result = await getRedactedDocument({
              document_url: file.url!,
              document_type: 'image',
              known_pii: knownPII,
              redact_all: true,
            })
            
            if (result.error) {
              console.error('Redaction returned error:', result.error)
              setScanError(result.error)
            } else if (result.redacted && result.data_url) {
              // We have a redacted image
              setRedactedImageUrl(result.data_url)
              setDetectedPII(result.locations || [])
              setScanComplete(true)
            } else {
              // No PII found, no redactions needed
              setDetectedPII([])
              setScanComplete(true)
            }
          } else {
            // For PDFs and other types, just analyze (no redaction yet)
            const result = await analyzeDocumentPII({
              document_url: file.url!,
              document_type: fileType === 'pdf' ? 'pdf' : undefined,
              known_pii: knownPII,
              redact_all: true,
            })
            
            if (result.error) {
              console.error('PII scan returned error:', result.error)
              setScanError(result.error)
            } else {
              setDetectedPII(result.locations || [])
              setScanComplete(true)
            }
          }
        } catch (err: any) {
          console.error('Document PII scan failed:', err)
          // Extract meaningful error message
          const errorMessage = err?.response?.error || err?.message || 'Scan failed'
          setScanError(errorMessage)
        } finally {
          setIsScanning(false)
        }
      }
      
      scanDocument()
    }
  }, [isPrivacyMode, file.url, scanComplete, isScanning, scanError, fileType, knownPII])
  
  // Report detected PII to parent
  useEffect(() => {
    if (scanComplete && onPIIDetected) {
      onPIIDetected(detectedPII)
    }
  }, [scanComplete, detectedPII, onPIIDetected])
  
  // Redact PII from filename if needed
  const displayName = (() => {
    let name = file.name || 'Document'
    if (showRedactions && piiValuesToRedact.length > 0) {
      piiValuesToRedact.forEach(pii => {
        const regex = new RegExp(pii.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        name = name.replace(regex, '████')
      })
    }
    return name
  })()
  
  // Get scan status info
  const scanStatusInfo = () => {
    if (isScanning) return { icon: Loader2, text: 'Scanning for PII...', bgColor: 'bg-blue-500', animate: true }
    if (scanError) return { icon: AlertTriangle, text: 'AI scan unavailable - manual review required', bgColor: 'bg-amber-500', animate: false }
    if (scanComplete) {
      if (detectedPII.length > 0) {
        return { icon: Shield, text: `${detectedPII.length} items redacted`, bgColor: 'bg-amber-500', animate: false }
      }
      return { icon: CheckCircle, text: 'No PII detected', bgColor: 'bg-green-500', animate: false }
    }
    return null
  }
  
  const status = scanStatusInfo()
  
  // Check if we found PII that needs redaction
  const hasPIIToRedact = scanComplete && detectedPII.length > 0
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Preview Area */}
      <div className="relative bg-gray-50 h-48 flex items-center justify-center overflow-hidden">
        {/* Status banner */}
        {isPrivacyMode && status && (
          <div className={cn(
            "absolute top-0 left-0 right-0 px-3 py-1.5 z-30 flex items-center justify-center gap-2 text-xs text-white",
            status.bgColor
          )}>
            <status.icon className={cn("w-3.5 h-3.5", status.animate && "animate-spin")} />
            <span>{status.text}</span>
          </div>
        )}
        
        {/* Document preview with redaction overlays */}
        {fileType === 'image' && !imageError ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative inline-block">
              {/* Show redacted image if available, otherwise show original */}
              <img
                src={isPrivacyMode && redactedImageUrl ? redactedImageUrl : file.url}
                alt={displayName}
                className={cn(
                  "max-h-full max-w-full object-contain",
                  isPrivacyMode ? "mt-6" : ""
                )}
                style={{ maxHeight: isPrivacyMode ? 'calc(100% - 1.5rem)' : '100%' }}
                onError={() => setImageError(true)}
              />
              {/* Blur overlay while scanning */}
              {showRedactions && isScanning && (
                <div 
                  className="absolute inset-0 pointer-events-none flex items-center justify-center" 
                  style={{ top: isPrivacyMode ? '1.5rem' : 0 }}
                >
                  <div className="absolute inset-0 backdrop-blur-lg bg-black/40" />
                  <div className="relative bg-black/80 text-white px-4 py-3 rounded-lg text-center">
                    <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    <div className="text-sm font-medium">Scanning for PII...</div>
                  </div>
                </div>
              )}
              {/* No overlay needed when redacted - the image itself has black boxes */}
            </div>
          </div>
        ) : fileType === 'pdf' ? (
          <div className={cn("w-full h-full relative", isPrivacyMode ? "pt-6" : "")}>
            {/* Show PDF while scanning with loading overlay */}
            {showRedactions && isScanning ? (
              <div className="absolute inset-0 pt-6 bg-gray-100 flex flex-col items-center justify-center">
                <div className="relative">
                  <FileText className="w-16 h-16 text-gray-300" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-600 mt-3">Scanning PDF...</span>
              </div>
            ) : showRedactions && hasPIIToRedact ? (
              /* Block PDF view when PII detected - show redacted placeholder */
              <div className="absolute inset-0 pt-6 bg-gray-900 flex flex-col items-center justify-center text-white">
                <div className="relative mb-4">
                  <FileText className="w-16 h-16 text-gray-600" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Shield className="w-10 h-10 text-amber-500" />
                  </div>
                </div>
                <div className="text-center px-4">
                  <h4 className="font-semibold text-lg mb-1">Document Redacted</h4>
                  <p className="text-sm text-gray-400 mb-3">
                    {detectedPII.length} PII items detected and blocked
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 mb-4 max-w-xs">
                    {detectedPII.slice(0, 5).map((pii, idx) => (
                      <span key={idx} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs">
                        {pii.type}
                      </span>
                    ))}
                    {detectedPII.length > 5 && (
                      <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs">
                        +{detectedPII.length - 5} more
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Disable Privacy Mode to view original document
                  </p>
                </div>
              </div>
            ) : (
              <>
                <iframe
                  src={`${file.url}#toolbar=0&navpanes=0`}
                  className="w-full h-full border-0"
                  title={displayName}
                />
                {/* Warning when scan failed */}
                {showRedactions && scanError && (
                  <div className="absolute bottom-2 left-2 right-2 bg-amber-500/90 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2 z-20">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>AI scan unavailable - please review document manually for PII</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <FileIcon type={fileType} className="w-12 h-12" />
              {showRedactions && scanComplete && detectedPII.length > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {fileType.toUpperCase()} File
            </span>
          </div>
        )}
        
        {/* Expand button */}
        {file.url && (
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
        {isPrivacyMode ? (
          <div className="mt-3">
            {/* Only download button in privacy mode */}
            <a
              href={file.url}
              download={file.name}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}

// Full-screen modal for document viewing
function DocumentModal({ 
  file, 
  isOpen, 
  onClose,
  isPrivacyMode,
  knownPII = {},
  detectedPII = []
}: { 
  file: FileData
  isOpen: boolean
  onClose: () => void
  isPrivacyMode?: boolean
  knownPII?: Record<string, string>
  detectedPII?: PIILocation[]
}) {
  const fileType = getFileType(file)
  const [redactedImageUrl, setRedactedImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const hasPIIToRedact = detectedPII.length > 0
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      
      // Fetch redacted version for images in privacy mode
      if (isPrivacyMode && file.url && fileType === 'image' && !redactedImageUrl) {
        setIsLoading(true)
        getRedactedDocument({
          document_url: file.url,
          document_type: 'image',
          known_pii: knownPII,
          redact_all: true,
        }).then(result => {
          if (result.redacted && result.data_url) {
            setRedactedImageUrl(result.data_url)
          }
        }).catch(console.error).finally(() => setIsLoading(false))
      }
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, isPrivacyMode, file.url, fileType, knownPII, redactedImageUrl])
  
  // Reset redacted URL when file changes
  useEffect(() => {
    setRedactedImageUrl(null)
  }, [file.url])
  
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
      
      {/* Privacy mode banner */}
      {isPrivacyMode && (
        <div className="absolute top-4 left-4 right-20 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            Privacy Mode: {hasPIIToRedact ? `${detectedPII.length} PII items redacted` : 'Document scanned for PII'}
          </span>
        </div>
      )}
      
      {/* Content */}
      <div className="max-w-5xl w-full max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl">
        {fileType === 'image' ? (
          isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <img
              src={isPrivacyMode && redactedImageUrl ? redactedImageUrl : file.url}
              alt={file.name || 'Document'}
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )
        ) : fileType === 'pdf' ? (
          isPrivacyMode && hasPIIToRedact ? (
            /* Block PDF view when PII detected in privacy mode */
            <div className="h-[85vh] bg-gray-900 flex flex-col items-center justify-center text-white">
              <div className="relative mb-6">
                <FileText className="w-24 h-24 text-gray-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-14 h-14 text-amber-500" />
                </div>
              </div>
              <div className="text-center px-8 max-w-md">
                <h3 className="font-semibold text-2xl mb-2">Document Redacted</h3>
                <p className="text-gray-400 mb-4">
                  {detectedPII.length} PII items have been detected and blocked in this document
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {detectedPII.slice(0, 8).map((pii, idx) => (
                    <span key={idx} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                      {pii.type}: {pii.text.substring(0, 20)}{pii.text.length > 20 ? '...' : ''}
                    </span>
                  ))}
                  {detectedPII.length > 8 && (
                    <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                      +{detectedPII.length - 8} more
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Disable Privacy Mode to view the original document
                </p>
              </div>
            </div>
          ) : (
            <iframe
              src={file.url}
              className="w-full h-[85vh]"
              title={file.name || 'Document'}
            />
          )
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
  knownPII = {},
  className 
}: DocumentPreviewProps) {
  const [expandedFile, setExpandedFile] = useState<FileData | null>(null)
  const [filePIIMap, setFilePIIMap] = useState<Map<string, PIILocation[]>>(new Map())
  
  // Parse the value into file(s)
  const files: FileData[] = (() => {
    if (Array.isArray(value)) {
      return value.map(parseFileData).filter((f): f is FileData => f !== null)
    }
    const single = parseFileData(value)
    return single ? [single] : []
  })()
  
  // Get detected PII for expanded file
  const expandedFilePII = expandedFile?.url ? filePIIMap.get(expandedFile.url) || [] : []
  
  // Handler to store detected PII for a file
  const handlePIIDetected = (fileUrl: string, pii: PIILocation[]) => {
    setFilePIIMap(prev => new Map(prev).set(fileUrl, pii))
  }
  
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
          knownPII={knownPII}
          onExpand={() => setExpandedFile(files[0])}
          onPIIDetected={(pii) => files[0].url && handlePIIDetected(files[0].url, pii)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {files.map((file, idx) => (
            <SingleFilePreview
              key={idx}
              file={file}
              isPrivacyMode={isPrivacyMode}
              piiValuesToRedact={piiValuesToRedact}
              knownPII={knownPII}
              onExpand={() => setExpandedFile(file)}
              onPIIDetected={(pii) => file.url && handlePIIDetected(file.url, pii)}
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
          knownPII={knownPII}
          detectedPII={expandedFilePII}
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
