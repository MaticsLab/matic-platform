'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { crmClient } from '@/lib/api/crm-client';
import { Application } from './types';

/**
 * Owns the "reset applicant password" dialog's state + handlers.
 * Split out of ApplicationDetail so the dialog's plumbing lives with the rest
 * of the reset-password UI concern rather than in the main component body.
 */
export function useApplicationPasswordReset(application: Application, workspaceId: string | undefined) {
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [passwordMode, setPasswordMode] = useState<'generate' | 'custom'>('generate');
  const [customPassword, setCustomPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleResetPassword = async () => {
    if (!workspaceId) {
      toast.error('Workspace ID not found');
      return;
    }

    // Validate custom password if in custom mode
    if (passwordMode === 'custom') {
      if (!customPassword || customPassword.length < 8) {
        toast.error('Password must be at least 8 characters long');
        return;
      }
    }

    const applicantId = application.applicant_id;
    if (!applicantId) {
      toast.error('Cannot reset password: applicant account not found');
      return;
    }

    setIsResettingPassword(true);
    try {
      if (passwordMode === 'generate') {
        const result = await crmClient.resetPassword(applicantId, workspaceId);
        setTemporaryPassword(result.temporary_password);
        toast.success('Password reset successfully');
      } else {
        await crmClient.setPassword(applicantId, workspaceId, customPassword);
        setTemporaryPassword(customPassword);
        toast.success('Password set successfully');
      }
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseResetModal = () => {
    setShowResetPasswordModal(false);
    setTemporaryPassword(null);
    setPasswordMode('generate');
    setCustomPassword('');
    setCopied(false);
  };

  return {
    showResetPasswordModal,
    setShowResetPasswordModal,
    isResettingPassword,
    temporaryPassword,
    setTemporaryPassword,
    passwordMode,
    setPasswordMode,
    customPassword,
    setCustomPassword,
    copied,
    handleResetPassword,
    handleCopyPassword,
    handleCloseResetModal,
  };
}
