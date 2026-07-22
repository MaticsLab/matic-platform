'use client';

import React from 'react';
import { Key, Loader2, Check, Copy, RefreshCw, Pencil } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/ui-components/dialog';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs';
import { Application } from './types';

interface ApplicationResetPasswordDialogProps {
  /** Already gated by `!isExternalReviewer` at the call site — never reachable by external reviewers. */
  open: boolean;
  application: Application;
  isResettingPassword: boolean;
  temporaryPassword: string | null;
  passwordMode: 'generate' | 'custom';
  setPasswordMode: (mode: 'generate' | 'custom') => void;
  customPassword: string;
  setCustomPassword: (value: string) => void;
  copied: boolean;
  handleResetPassword: () => void;
  handleCopyPassword: () => void;
  handleCloseResetModal: () => void;
  /** Clears `temporaryPassword` to return to the Generate/Custom tabs. */
  onRequestNewPassword: () => void;
}

export function ApplicationResetPasswordDialog({
  open,
  application,
  isResettingPassword,
  temporaryPassword,
  passwordMode,
  setPasswordMode,
  customPassword,
  setCustomPassword,
  copied,
  handleResetPassword,
  handleCopyPassword,
  handleCloseResetModal,
  onRequestNewPassword,
}: ApplicationResetPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleCloseResetModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Set Password
          </DialogTitle>
          <DialogDescription>
            {temporaryPassword
              ? `Password for ${application.name || application.email}`
              : `Set password for ${application.name || application.email}`
            }
          </DialogDescription>
        </DialogHeader>

        {isResettingPassword ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : temporaryPassword ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium mb-2">
                ✓ Password set successfully
              </p>
              <p className="text-xs text-green-700">
                Share this password with {application.name || 'the applicant'}:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-lg p-3 font-mono text-lg font-bold text-center">
                {temporaryPassword}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPassword}
                className="h-11"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Email:</strong> {application.email}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Send this password to the applicant via email or your preferred communication method.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={onRequestNewPassword}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Set New Password
            </Button>
          </div>
        ) : (
          <Tabs
            value={passwordMode}
            onValueChange={(mode) => setPasswordMode(mode as 'generate' | 'custom')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">Generate</TabsTrigger>
              <TabsTrigger value="custom">Set Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">
                  Click below to generate a secure 12-character password with letters, numbers, and special characters.
                </p>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={isResettingPassword}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Password
              </Button>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Enter Custom Password
                </label>
                <Input
                  type="text"
                  placeholder="Minimum 8 characters"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">
                  Password must be at least 8 characters long
                </p>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={isResettingPassword || customPassword.length < 8}
                className="w-full"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Set Password
              </Button>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button onClick={handleCloseResetModal}>
            {temporaryPassword ? 'Done' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
