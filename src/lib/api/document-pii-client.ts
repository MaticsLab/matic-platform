import { goFetch } from './go-client'

export interface PIILocation {
  text: string
  type: 'name' | 'email' | 'phone' | 'ssn' | 'address' | 'dob' | 'id' | 'other'
  page: number
  bounding_box?: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
}

export interface PIIDetectionResponse {
  locations: PIILocation[]
  total_found: number
  processing_ms: number
  error?: string
}

export interface AnalyzePIIRequest {
  document_url: string
  document_type?: 'pdf' | 'image'
  known_pii?: Record<string, string>
  redact_all?: boolean
}

/**
 * Analyze a document for PII using Gemini Vision
 */
export async function analyzeDocumentPII(
  request: AnalyzePIIRequest
): Promise<PIIDetectionResponse> {
  return goFetch<PIIDetectionResponse>('/documents/analyze-pii', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Analyze multiple documents for PII in batch
 */
export async function batchAnalyzeDocumentsPII(
  documents: AnalyzePIIRequest[]
): Promise<{ results: PIIDetectionResponse[]; total: number }> {
  return goFetch<{ results: PIIDetectionResponse[]; total: number }>(
    '/documents/analyze-pii/batch',
    {
      method: 'POST',
      body: JSON.stringify({ documents }),
    }
  )
}

/**
 * Build known PII map from application data
 */
export function extractKnownPII(
  formData: Record<string, any>,
  hiddenFields: string[]
): Record<string, string> {
  const knownPII: Record<string, string> = {}
  
  // Common PII field patterns
  const piiPatterns = [
    { pattern: /^(full[_\s]?)?name$/i, type: 'name' },
    { pattern: /^first[_\s]?name$/i, type: 'first_name' },
    { pattern: /^last[_\s]?name$/i, type: 'last_name' },
    { pattern: /^email$/i, type: 'email' },
    { pattern: /^phone|mobile|cell/i, type: 'phone' },
    { pattern: /^address|street/i, type: 'address' },
    { pattern: /^city$/i, type: 'city' },
    { pattern: /^state$/i, type: 'state' },
    { pattern: /^zip|postal/i, type: 'zip' },
    { pattern: /^ssn|social[_\s]?security/i, type: 'ssn' },
    { pattern: /^dob|date[_\s]?of[_\s]?birth|birthday/i, type: 'dob' },
    { pattern: /^student[_\s]?id/i, type: 'student_id' },
  ]
  
  // Extract values from hidden fields
  for (const field of hiddenFields) {
    const value = formData[field]
    if (value && typeof value === 'string' && value.trim()) {
      knownPII[field] = value.trim()
    }
  }
  
  // Also extract common PII patterns from all fields
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value !== 'string' || !value.trim()) continue
    
    for (const { pattern, type } of piiPatterns) {
      if (pattern.test(key) && !knownPII[type]) {
        knownPII[type] = value.trim()
        break
      }
    }
  }
  
  return knownPII
}

export interface RedactedDocumentResponse {
  redacted: boolean
  content_type?: string
  data?: string
  data_url?: string
  locations?: PIILocation[]
  total_redacted?: number
  processing_ms?: number
  original_url?: string
  message?: string
  error?: string
}

/**
 * Get a document with PII redacted (black boxes drawn over detected PII)
 * Returns a base64-encoded image with redactions applied
 */
export async function getRedactedDocument(
  request: AnalyzePIIRequest
): Promise<RedactedDocumentResponse> {
  return goFetch<RedactedDocumentResponse>('/documents/redact/base64', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
