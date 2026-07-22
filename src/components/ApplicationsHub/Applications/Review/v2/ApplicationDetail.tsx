'use client';

import React, { useState, useMemo } from 'react';
import { ApplicationDetailProps } from './types';
import { cn } from '@/lib/utils';
import { EmailSettingsDialog } from '../../Communications/EmailSettingsDialog';
import { EmailAIComposer } from '../EmailAIComposer';

import { ApplicationDetailHeader } from './ApplicationDetailHeader';
import { ApplicationOverviewPanel } from './ApplicationOverviewPanel';
import { ApplicationRecommendersPanel } from './ApplicationRecommendersPanel';
import { ApplicationDocumentsPanel } from './ApplicationDocumentsPanel';
import { ApplicationActivityPanel } from './ApplicationActivityPanel';
import { ApplicationActionIconRail } from './ApplicationActionIconRail';
import { ApplicationResetPasswordDialog } from './ApplicationResetPasswordDialog';

import { useApplicationEmailComposer } from './useApplicationEmailComposer';
import { useApplicationRecommendations } from './useApplicationRecommendations';
import { useApplicationDocuments } from './useApplicationDocuments';
import { useApplicationPasswordReset } from './useApplicationPasswordReset';

export function ApplicationDetail({
  application,
  reviewersMap,
  onClose,
  workspaceId,
  formId,
  fields = [],
  sections = [],
  onActivityCreated,
  isExternalReviewer = false
}: ApplicationDetailProps) {
  const [showActivityPanel, setShowActivityPanel] = useState(false); // Toggle between details and activity
  const [showRecommendersPanel, setShowRecommendersPanel] = useState(false); // Toggle recommenders panel
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(false); // Toggle documents panel
  const [viewMode, setViewMode] = useState<'modal' | 'fullscreen' | 'sidebar'>('sidebar');

  const email = useApplicationEmailComposer(application, workspaceId, formId, onActivityCreated);
  const recommendationsState = useApplicationRecommendations(application.id, email.emailAccounts);
  const documentsState = useApplicationDocuments(
    application,
    workspaceId,
    formId,
    fields,
    recommendationsState.recommendationDocuments,
    recommendationsState.refreshRecommendations,
  );
  const passwordReset = useApplicationPasswordReset(application, workspaceId);

  // Format relative time
  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getReviewerName = (reviewerId: string) => {
    return reviewersMap[reviewerId]?.name || 'Reviewer';
  };

  // Build activities from real data (stageHistory and reviewHistory)
  const activities = useMemo(() => {
    const items: Array<{
      id: string | number;
      type: 'status' | 'review' | 'comment' | 'email';
      message: string;
      user: string;
      time: string;
      timestamp: number;
    }> = [];

    // Stage history removed - workflow feature deleted

    // Add review history items
    if (application.reviewHistory && Array.isArray(application.reviewHistory)) {
      application.reviewHistory.forEach((review, idx) => {
        items.push({
          id: `review-${idx}`,
          type: 'review',
          message: review.total_score ? `Review submitted (Score: ${review.total_score})` : 'Review submitted',
          user: review.reviewer_name || getReviewerName(review.reviewer_id) || 'Reviewer',
          time: formatRelativeTime(review.reviewed_at),
          timestamp: review.reviewed_at ? new Date(review.reviewed_at).getTime() : 0,
        });
      });
    }

    // Add submission as first activity if no other activities
    if (items.length === 0) {
      items.push({
        id: 'submitted',
        type: 'status',
        message: 'Application submitted',
        user: application.name || application.email || 'Applicant',
        time: formatRelativeTime(application.submittedDate),
        timestamp: application.submittedDate ? new Date(application.submittedDate).getTime() : 0,
      });
    }

    // Current status tracking - simplified without workflow stages

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }, [application.reviewHistory, application.lastActivity, application.submittedDate, application.name, application.email]);

  const composerProps = { application, ...email };

  const closeAllRightPanels = () => {
    setShowActivityPanel(false);
    setShowRecommendersPanel(false);
    setShowDocumentsPanel(false);
  };

  // Main content JSX
  const mainContent = (
    <div className={cn(
      "bg-white flex flex-col h-full relative",
      viewMode === 'modal' && "max-w-5xl mx-auto my-8 rounded-xl shadow-2xl border border-gray-200",
      viewMode === 'fullscreen' && "fixed inset-0 z-50 w-full h-full"
    )}>
      <ApplicationDetailHeader onClose={onClose} viewMode={viewMode} setViewMode={setViewMode} />

      {/* Split View: Overview (Left) + Icons (Middle) + Activity (Right) - Always visible */}
      <div className={cn(
        "flex-1 min-h-0 flex overflow-hidden",
        viewMode === 'modal' && "rounded-lg"
      )}>
        {/* Application Details Panel - Show when no panel is active in sidebar, or always in fullscreen */}
        {((viewMode !== 'fullscreen' && !showActivityPanel && !showRecommendersPanel && !showDocumentsPanel) || viewMode === 'fullscreen') && (
          <ApplicationOverviewPanel
            application={application}
            reviewersMap={reviewersMap}
            fields={fields}
            sections={sections}
            isExternalReviewer={isExternalReviewer}
            onResetPasswordClick={() => passwordReset.setShowResetPasswordModal(true)}
          />
        )}

        {/* Recommenders Panel - Show in fullscreen when showRecommendersPanel is true */}
        {viewMode === 'fullscreen' && showRecommendersPanel && (
          <ApplicationRecommendersPanel
            variant="fullscreen"
            recommendations={recommendationsState.recommendations}
            loadingRecommendations={recommendationsState.loadingRecommendations}
            emailAccounts={email.emailAccounts}
            selectedReminderAccount={recommendationsState.selectedReminderAccount}
            setSelectedReminderAccount={recommendationsState.setSelectedReminderAccount}
            sendingReminder={recommendationsState.sendingReminder}
            handleSendReminder={recommendationsState.handleSendReminder}
            onClose={() => setShowRecommendersPanel(false)}
            expandedRecommendations={recommendationsState.expandedRecommendations}
            setExpandedRecommendations={recommendationsState.setExpandedRecommendations}
          />
        )}

        {/* Documents Panel - Show in fullscreen when showDocumentsPanel is true */}
        {viewMode === 'fullscreen' && showDocumentsPanel && (
          <ApplicationDocumentsPanel
            variant="fullscreen"
            isLoadingFiles={documentsState.isLoadingFiles}
            storageFiles={documentsState.storageFiles}
            availableDocuments={documentsState.availableDocuments}
            recommendationDocuments={recommendationsState.recommendationDocuments}
            getFieldLabel={documentsState.getFieldLabel}
            isExternalReviewer={isExternalReviewer}
            isSyncingAllSubmissionsToDrive={documentsState.isSyncingAllSubmissionsToDrive}
            isSyncingRecommendationsToDrive={documentsState.isSyncingRecommendationsToDrive}
            handleSyncAllSubmissionsToDrive={documentsState.handleSyncAllSubmissionsToDrive}
            handleSyncRecommendationDocumentsToDrive={documentsState.handleSyncRecommendationDocumentsToDrive}
            formId={formId}
            onClose={() => setShowDocumentsPanel(false)}
          />
        )}

        {/* Recommenders Panel - Replaces details when active (sidebar mode), or shows to the right (fullscreen mode) */}
        {showRecommendersPanel && viewMode !== 'fullscreen' && (
          <ApplicationRecommendersPanel
            variant="sidebar"
            recommendations={recommendationsState.recommendations}
            loadingRecommendations={recommendationsState.loadingRecommendations}
            emailAccounts={email.emailAccounts}
            selectedReminderAccount={recommendationsState.selectedReminderAccount}
            setSelectedReminderAccount={recommendationsState.setSelectedReminderAccount}
            sendingReminder={recommendationsState.sendingReminder}
            handleSendReminder={recommendationsState.handleSendReminder}
            onClose={() => setShowRecommendersPanel(false)}
            expandedRecommendations={recommendationsState.expandedRecommendations}
            setExpandedRecommendations={recommendationsState.setExpandedRecommendations}
          />
        )}

        {/* Documents Panel - Replaces details when active (sidebar mode), or shows to the right (fullscreen mode) */}
        {showDocumentsPanel && viewMode !== 'fullscreen' && (
          <ApplicationDocumentsPanel
            variant="sidebar"
            isLoadingFiles={documentsState.isLoadingFiles}
            storageFiles={documentsState.storageFiles}
            availableDocuments={documentsState.availableDocuments}
            recommendationDocuments={recommendationsState.recommendationDocuments}
            getFieldLabel={documentsState.getFieldLabel}
            isExternalReviewer={isExternalReviewer}
            isSyncingAllSubmissionsToDrive={documentsState.isSyncingAllSubmissionsToDrive}
            isSyncingRecommendationsToDrive={documentsState.isSyncingRecommendationsToDrive}
            handleSyncAllSubmissionsToDrive={documentsState.handleSyncAllSubmissionsToDrive}
            handleSyncRecommendationDocumentsToDrive={documentsState.handleSyncRecommendationDocumentsToDrive}
            formId={formId}
            onClose={() => setShowDocumentsPanel(false)}
          />
        )}

        {/* Activity Panel - Replaces details in sidebar (left), or shows on right in modal/fullscreen */}
        {/* Internal staff comms + email composer — never shown to external reviewers */}
        {!isExternalReviewer && showActivityPanel && viewMode !== 'fullscreen' ? (
          <ApplicationActivityPanel
            variant="sidebar"
            activities={activities}
            onClose={() => setShowActivityPanel(false)}
            composerProps={composerProps}
          />
        ) : null}

        {/* Action Buttons - Vertical Icons - Always visible, positioned after left panel */}
        <ApplicationActionIconRail
          isExternalReviewer={isExternalReviewer}
          showActivityPanel={showActivityPanel}
          setShowActivityPanel={setShowActivityPanel}
          showRecommendersPanel={showRecommendersPanel}
          setShowRecommendersPanel={setShowRecommendersPanel}
          showDocumentsPanel={showDocumentsPanel}
          setShowDocumentsPanel={setShowDocumentsPanel}
          recommendations={recommendationsState.recommendations}
          documentCounts={documentsState.documentCounts}
        />

        {/* Activity Panel - Show on the right in modal/fullscreen */}
        {/* Internal staff comms + email composer — never shown to external reviewers */}
        {!isExternalReviewer && (((viewMode === 'modal' || viewMode === 'fullscreen') && !showActivityPanel && !showRecommendersPanel && !showDocumentsPanel) ||
         (viewMode === 'fullscreen' && showActivityPanel)) ? (
          <ApplicationActivityPanel
            variant="fullscreen"
            activities={activities}
            onClose={closeAllRightPanels}
            showCloseButton={viewMode === 'fullscreen' && (showActivityPanel || showRecommendersPanel || showDocumentsPanel)}
            composerProps={composerProps}
          />
        ) : null}
      </div>
    </div>
  );

  // Wrap content with dialogs
  const contentWithDialogs = (
    <>
      {mainContent}

      {/* Email Settings Dialog */}
      {workspaceId && (
        <EmailSettingsDialog
          workspaceId={workspaceId}
          open={email.showEmailSettings}
          onOpenChange={email.setShowEmailSettings}
          onAccountsUpdated={email.refreshConnection}
        />
      )}

      {/* AI Email Composer */}
      <EmailAIComposer
        open={email.showAIComposer}
        onClose={() => email.setShowAIComposer(false)}
        currentSubject={email.emailSubject}
        currentBody={email.emailBody}
        applicationData={{
          name: application.name,
          email: application.email,
          raw_data: application.raw_data,
        }}
        fields={fields}
        onApply={(subject, body) => {
          email.setEmailSubject(subject);
          email.setEmailBody(body);
          // Update editor content if editor is available
          if (email.emailEditorRef.current) {
            email.emailEditorRef.current.commands.setContent(body);
          }
        }}
      />

      {/* Reset Password Dialog — never reachable by external reviewers (trigger button is hidden above), gated again here as defense in depth */}
      <ApplicationResetPasswordDialog
        open={!isExternalReviewer && passwordReset.showResetPasswordModal}
        application={application}
        isResettingPassword={passwordReset.isResettingPassword}
        temporaryPassword={passwordReset.temporaryPassword}
        passwordMode={passwordReset.passwordMode}
        setPasswordMode={passwordReset.setPasswordMode}
        customPassword={passwordReset.customPassword}
        setCustomPassword={passwordReset.setCustomPassword}
        copied={passwordReset.copied}
        handleResetPassword={passwordReset.handleResetPassword}
        handleCopyPassword={passwordReset.handleCopyPassword}
        handleCloseResetModal={passwordReset.handleCloseResetModal}
        onRequestNewPassword={() => passwordReset.setTemporaryPassword(null)}
      />
    </>
  );

  // For modal, wrap in portal-like container with backdrop
  if (viewMode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        {contentWithDialogs}
      </div>
    );
  }

  // For fullscreen, it's already fixed positioned in mainContent
  if (viewMode === 'fullscreen') {
    return contentWithDialogs;
  }

  // Default sidebar view
  return contentWithDialogs;
}
