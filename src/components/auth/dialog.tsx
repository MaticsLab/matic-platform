"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui-components/dialog";
import { Button } from "@/ui-components/button";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Export for workflow components that check this
export const isSingleProviderSignInInitiated = { current: false };

interface AuthDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function AuthDialog({ open, onOpenChange, children }: AuthDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    isSingleProviderSignInInitiated.current = true;
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    isSingleProviderSignInInitiated.current = true;
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open ?? isOpen} onOpenChange={handleOpenChange}>
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Sign in to save and manage your workflows
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button onClick={handleGoogleSignIn} disabled={isLoading} variant="outline">
            Continue with Google
          </Button>
          <Button onClick={handleGitHubSignIn} disabled={isLoading} variant="outline">
            Continue with GitHub
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
