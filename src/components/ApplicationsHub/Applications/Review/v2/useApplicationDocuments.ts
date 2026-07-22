'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { filesClient, rowFilesClient } from '@/lib/api/files-client';
import type { TableFileResponse } from '@/types/files';
import { recommendationsClient } from '@/lib/api/recommendations-client';
import { googleDriveClient } from '@/lib/api/integrations-client';
import { Application, ApplicationDetailProps } from './types';
import { parseValueIfNeeded, isFileValue } from './ApplicationFieldValueDisplay';

type FieldDef = NonNullable<ApplicationDetailProps['fields']>[number];

interface RecommendationDocument {
  name: string;
  url: string;
  contentType: string;
  recommenderName: string;
  submittedAt?: string;
}

/**
 * Owns the Documents panel's data layer: storage files fetched from `table_files`,
 * file-like values discovered in `raw_data`, the Drive-sync actions, and the field
 * map used to label storage files by which form field they came from.
 */
export function useApplicationDocuments(
  application: Application,
  workspaceId: string | undefined,
  formId: string | undefined,
  fields: FieldDef[],
  recommendationDocuments: RecommendationDocument[],
  refreshRecommendations: () => Promise<void>,
) {
  const [storageFiles, setStorageFiles] = useState<TableFileResponse[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSyncingRecommendationsToDrive, setIsSyncingRecommendationsToDrive] = useState(false);
  const [isSyncingAllSubmissionsToDrive, setIsSyncingAllSubmissionsToDrive] = useState(false);

  // Extract available documents from application for attachment
  const availableDocuments = useMemo(() => {
    const docs: { name: string; url: string; contentType: string }[] = [];
    const rawData = application.raw_data || {};

    Object.entries(rawData).forEach(([key, value]) => {
      // Check for string URLs
      if (typeof value === 'string' && (
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.includes('supabase') ||
        value.includes('storage')
      )) {
        const lowerKey = key.toLowerCase();
        const lowerValue = value.toLowerCase();
        if (
          lowerKey.includes('file') ||
          lowerKey.includes('document') ||
          lowerKey.includes('upload') ||
          lowerKey.includes('attachment') ||
          lowerKey.includes('resume') ||
          lowerKey.includes('transcript') ||
          lowerKey.includes('essay') ||
          lowerKey.includes('pdf') ||
          lowerValue.includes('.pdf') ||
          lowerValue.includes('.doc') ||
          lowerValue.includes('.docx') ||
          lowerValue.includes('.png') ||
          lowerValue.includes('.jpg') ||
          lowerValue.includes('.jpeg')
        ) {
          let contentType = 'application/octet-stream';
          if (lowerValue.includes('.pdf')) contentType = 'application/pdf';
          else if (lowerValue.includes('.doc')) contentType = 'application/msword';
          else if (lowerValue.includes('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (lowerValue.includes('.png')) contentType = 'image/png';
          else if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) contentType = 'image/jpeg';

          docs.push({
            name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: value,
            contentType
          });
        }
      }

      // Also check for file objects (not just string URLs)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const fileUrl = (value as any).url || (value as any).Url || (value as any).URL;
        const fileName = (value as any).name || (value as any).Name || (value as any).filename;

        if (fileUrl && (typeof fileUrl === 'string')) {
          let contentType = (value as any).mimeType || (value as any).mime_type || (value as any).type || 'application/octet-stream';
          docs.push({
            name: fileName || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: fileUrl,
            contentType
          });
        }
      }

      // Check for arrays of files
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            const fileUrl = item.url || item.Url || item.URL;
            const fileName = item.name || item.Name || item.filename;

            if (fileUrl && (typeof fileUrl === 'string')) {
              let contentType = item.mimeType || item.mime_type || item.type || 'application/octet-stream';
              docs.push({
                name: fileName || `${key} ${idx + 1}`,
                url: fileUrl,
                contentType
              });
            }
          }
        });
      }
    });

    return docs;
  }, [application.raw_data]);

  // Fetch files from table_files (uploaded to Supabase storage)
  useEffect(() => {
    const fetchStorageFiles = async () => {
      if (!application.id) return;

      setIsLoadingFiles(true);
      try {
        // Try the dedicated row files endpoint first (cleaner API)
        const files = await rowFilesClient.list(application.id);
        setStorageFiles(files || []);
      } catch (error) {
        console.warn('[ApplicationDetail] rowFilesClient failed, trying filesClient:', error);
        // Fallback to general files endpoint
        try {
          const files = await filesClient.list({
            row_id: application.id,
            workspace_id: workspaceId
          });
          setStorageFiles(files || []);
        } catch (fallbackError) {
          console.error('[ApplicationDetail] Failed to fetch storage files:', fallbackError);
          setStorageFiles([]);
        }
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchStorageFiles();
  }, [application.id, workspaceId]);

  // Create a field map for looking up field labels by ID
  const fieldMap = useMemo(() => {
    const map = new Map<string, any>();
    fields.forEach(f => {
      const fieldId = f.id || (f as any).field_id;
      const fieldLabel = f.label || (f as any).name;

      if (fieldId) {
        map.set(fieldId, f);
        if (!fieldId.startsWith('Field-')) {
          map.set(`Field-${fieldId}`, f);
        }
        if (fieldId.startsWith('Field-')) {
          map.set(fieldId.replace(/^Field-/, ''), f);
        }
      }
      if (fieldLabel) {
        map.set(fieldLabel, f);
        map.set(fieldLabel.toLowerCase().replace(/\s+/g, '_'), f);
        map.set(fieldLabel.replace(/\s+/g, '_'), f);
      }
      // Also index by field_key / name so repeater sub-field keys resolve to labels
      const fieldName = (f as any).name;
      if (fieldName && fieldName !== fieldLabel) {
        map.set(fieldName, f);
      }
      // Map child fields for repeater/group fields
      const children = (f as any).children || (f as any).child_fields || [];
      if (Array.isArray(children)) {
        children.forEach((child: any) => {
          const childId = child.id || child.field_id;
          const childLabel = child.label || child.name;

          if (childId) {
            map.set(childId, child);
            if (!childId.startsWith('Field-')) {
              map.set(`Field-${childId}`, child);
            }
            if (childId.startsWith('Field-')) {
              map.set(childId.replace(/^Field-/, ''), child);
            }
          }
          if (childLabel) {
            map.set(childLabel, child);
            map.set(childLabel.toLowerCase().replace(/\s+/g, '_'), child);
            map.set(childLabel.replace(/\s+/g, '_'), child);
          }
        });
      }
    });
    return map;
  }, [fields]);

  // Helper to get field label from field_id
  const getFieldLabel = (fieldId?: string): string | null => {
    if (!fieldId) return null;
    const field = fieldMap.get(fieldId);
    if (field) {
      return field.label || field.name || null;
    }
    return null;
  };

  // Count documents and missing documents for tab badge
  const documentCounts = useMemo(() => {
    let uploaded = 0;
    let missing = 0;

    // Count storage files first (these are reliable)
    uploaded += storageFiles.length;

    // Count recommendation documents
    uploaded += recommendationDocuments.length;

    // Check fields for file/image upload types
    if (fields && fields.length > 0) {
      fields.forEach(field => {
        const isFileField = field.type === 'file_upload' || field.type === 'image_upload' ||
                           field.type === 'file' || field.type === 'image' ||
                           field.label?.toLowerCase().includes('upload') ||
                           field.label?.toLowerCase().includes('document') ||
                           field.label?.toLowerCase().includes('attachment');

        if (isFileField) {
          // Try field.id first (UUID key), then fallback to field name/label
          const value = application.raw_data?.[field.id] ||
                       (field.name && application.raw_data?.[field.name]) ||
                       application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                       application.raw_data?.[field.label];
          const parsedValue = parseValueIfNeeded(value);

          if (parsedValue && isFileValue(parsedValue)) {
            // Only count if not a blob URL and not already counted from storage
            const url = parsedValue?.url || parsedValue?.Url || '';
            if (url && !url.startsWith('blob:') && storageFiles.length === 0) {
              uploaded++;
            }
          } else if (storageFiles.length === 0) {
            // Only mark as missing if no storage files found
            missing++;
          }
        }
      });
    }

    // Also scan raw_data for any file values not tracked in fields
    if (application.raw_data && storageFiles.length === 0) {
      const trackedFields = new Set(fields.map(f => f.id));
      Object.entries(application.raw_data).forEach(([key, value]) => {
        if (trackedFields.has(key)) return;
        const parsedValue = parseValueIfNeeded(value);
        if (isFileValue(parsedValue)) {
          const url = parsedValue?.url || parsedValue?.Url || '';
          if (url && !url.startsWith('blob:')) {
            uploaded++;
          }
        }
      });
    }

    return { uploaded, missing };
  }, [fields, application.raw_data, storageFiles, recommendationDocuments]);

  const handleSyncRecommendationDocumentsToDrive = async () => {
    if (!application.id || isSyncingRecommendationsToDrive) return;

    setIsSyncingRecommendationsToDrive(true);
    try {
      const [rowSyncResult, submissionSyncResult] = await Promise.allSettled([
        googleDriveClient.syncAllFiles(application.id),
        recommendationsClient.syncSubmissionDocumentsToDrive(application.id),
      ]);

      const rowSynced = rowSyncResult.status === 'fulfilled' ? (rowSyncResult.value?.total || 0) : 0;
      const submissionFound = submissionSyncResult.status === 'fulfilled' ? submissionSyncResult.value.documents_found : 0;
      const submissionSynced = submissionSyncResult.status === 'fulfilled' ? submissionSyncResult.value.documents_synced : 0;
      const submissionExisting = submissionSyncResult.status === 'fulfilled' ? (submissionSyncResult.value as any).documents_existing || 0 : 0;
      const submissionFailed = submissionSyncResult.status === 'fulfilled' ? submissionSyncResult.value.documents_failed : 0;
      const failedUploadFieldDocs = submissionSyncResult.status === 'fulfilled'
        ? (submissionSyncResult.value.sync_results || []).filter((item) =>
            !!item.error && (item.source === 'submission_file' || item.source === 'submission_raw_data')
          )
        : [];

      if (rowSyncResult.status === 'rejected' && submissionSyncResult.status === 'rejected') {
        toast.error('Failed to sync Drive documents for this submission.')
      } else if (submissionFound === 0 && rowSynced === 0) {
        toast.info('No documents were found to sync for this submission.')
      } else if (submissionFailed > 0) {
        const failureList = failedUploadFieldDocs
          .slice(0, 5)
          .map((item) => {
            const label = (item.field_label || '').trim();
            const file = (item.filename || item.url || 'unknown file').trim();
            return label ? `${label}: ${file}` : file;
          });
        const extraCount = failedUploadFieldDocs.length > 5 ? ` (+${failedUploadFieldDocs.length - 5} more)` : '';
        const uploadFailDetails = failureList.length > 0
          ? ` Upload-field failures: ${failureList.join(' | ')}${extraCount}`
          : '';
        toast.warning(`Drive sync complete: ${submissionSynced} synced, ${submissionExisting} already in Drive, ${submissionFailed} failed, ${rowSynced} row file(s) processed.${uploadFailDetails}`)
      } else {
        toast.success(`Drive sync complete: ${submissionSynced} synced, ${submissionExisting} already in Drive, ${rowSynced} row file(s) processed.`)
      }

      await refreshRecommendations();
    } catch (err) {
      console.error('[ApplicationDetail] Failed to sync recommendation documents to Google Drive:', err);
      toast.error('Failed to sync Drive documents to Google Drive');
    } finally {
      setIsSyncingRecommendationsToDrive(false);
    }
  };

  const handleSyncAllSubmissionsToDrive = async () => {
    if (!formId || isSyncingAllSubmissionsToDrive) return;

    setIsSyncingAllSubmissionsToDrive(true);
    try {
      const result = await recommendationsClient.backfillFormDocumentsToDrive(formId);

      if (result.submissions_checked === 0) {
        toast.info('No submissions were found for this form.');
      } else if (result.documents_found === 0) {
        if (application.id) {
          try {
            const singleResult = await recommendationsClient.syncSubmissionDocumentsToDrive(application.id);
            if (singleResult.documents_found > 0) {
              toast.warning(`Form-wide scan found 0 docs, but current submission found ${singleResult.documents_found}. Synced ${singleResult.documents_synced}, failed ${singleResult.documents_failed}. This usually means the selected form ID does not match all submission records.`);
            } else {
              toast.info(`Scanned ${result.submissions_checked} submission(s), but found no documents to sync.`);
            }
          } catch {
            toast.info(`Scanned ${result.submissions_checked} submission(s), but found no documents to sync.`);
          }
        } else {
          toast.info(`Scanned ${result.submissions_checked} submission(s), but found no documents to sync.`);
        }
      } else if (result.documents_failed > 0) {
        toast.warning(`Scanned ${result.submissions_checked} submission(s): ${result.documents_synced} synced, ${result.documents_existing} already in Drive, ${result.documents_failed} failed.`);
      } else {
        toast.success(`Scanned ${result.submissions_checked} submission(s): ${result.documents_synced} synced, ${result.documents_existing} already in Drive.`);
      }
    } catch (err) {
      console.error('[ApplicationDetail] Failed to sync all submissions to Google Drive:', err);
      toast.error('Failed to sync all submissions to Google Drive');
    } finally {
      setIsSyncingAllSubmissionsToDrive(false);
    }
  };

  return {
    storageFiles,
    isLoadingFiles,
    availableDocuments,
    getFieldLabel,
    documentCounts,
    isSyncingRecommendationsToDrive,
    isSyncingAllSubmissionsToDrive,
    handleSyncRecommendationDocumentsToDrive,
    handleSyncAllSubmissionsToDrive,
  };
}
