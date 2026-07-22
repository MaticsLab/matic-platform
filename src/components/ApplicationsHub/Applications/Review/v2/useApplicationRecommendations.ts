'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { recommendationsClient, RecommendationRequest } from '@/lib/api/recommendations-client';
import { GmailAccount } from '@/lib/api/email-client';

/**
 * Owns recommendation/reference-request state for a submission: fetching the list,
 * sending reminders, and deriving the "recommendation documents" shown in the
 * Documents panel. Split out of ApplicationDetail so the References panel's data
 * layer lives with the rest of that concern.
 */
export function useApplicationRecommendations(applicationId: string, emailAccounts: GmailAccount[]) {
  const [recommendations, setRecommendations] = useState<RecommendationRequest[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());
  const [selectedReminderAccount, setSelectedReminderAccount] = useState<string>('');

  const refreshRecommendations = useCallback(async () => {
    if (!applicationId) return;
    try {
      const data = await recommendationsClient.getForReview(applicationId);
      setRecommendations(data || []);
    } catch (err) {
      console.error('[ApplicationDetail] Failed to fetch recommendations:', err);
      setRecommendations([]);
    }
  }, [applicationId]);

  // Fetch recommendation requests for this submission
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!applicationId) return;
      setLoadingRecommendations(true);
      try {
        const data = await recommendationsClient.getForReview(applicationId);
        setRecommendations(data || []);
      } catch (err) {
        console.error('[ApplicationDetail] Failed to fetch recommendations:', err);
        setRecommendations([]);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    fetchRecommendations();
  }, [applicationId]);

  // Extract recommendation documents for display
  const recommendationDocuments = useMemo(() => {
    const docs: { name: string; url: string; contentType: string; recommenderName: string; submittedAt?: string }[] = [];

    recommendations.forEach(rec => {
      if (rec.status === 'submitted' && rec.response) {
        try {
          const response = typeof rec.response === 'string' ? JSON.parse(rec.response) : rec.response;

          // Check for uploaded_document in response
          if (response.uploaded_document) {
            const doc = response.uploaded_document;
            if (doc.url) {
              docs.push({
                name: doc.name || doc.filename || `Reference from ${rec.recommender_name}`,
                url: doc.url,
                contentType: doc.content_type || doc.mime_type || 'application/pdf',
                recommenderName: rec.recommender_name,
                submittedAt: rec.submitted_at
              });
            }
          }
        } catch (err) {
          console.error('[ApplicationDetail] Failed to parse recommendation response:', err);
        }
      }
    });

    return docs;
  }, [recommendations]);

  // Send reminder to recommender
  const handleSendReminder = async (requestId: string) => {
    setSendingReminder(requestId);
    try {
      // Use selected account or default account
      const accountId = selectedReminderAccount || (emailAccounts.find(acc => acc.is_default)?.id);
      await recommendationsClient.sendReminder(requestId, accountId);
      toast.success('Reminder sent successfully');
      // Refresh recommendations list
      await refreshRecommendations();
    } catch (err) {
      console.error('[ApplicationDetail] Failed to send reminder:', err);
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  return {
    recommendations,
    setRecommendations,
    loadingRecommendations,
    sendingReminder,
    expandedRecommendations,
    setExpandedRecommendations,
    selectedReminderAccount,
    setSelectedReminderAccount,
    recommendationDocuments,
    handleSendReminder,
    refreshRecommendations,
  };
}
