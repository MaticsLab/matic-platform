'use client';

/**
 * Login Form Block
 * 
 * Customizable login form for portal authentication.
 * Supports email/password, magic link, and social login options.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { Separator } from '@/ui-components/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui-components/dialog';
import { Mail, Lock, LogIn, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface LoginConfig {
  title?: string;
  description?: string;
  showMagicLink?: boolean;
  showSocialLogin?: boolean;
  socialProviders?: ('google' | 'github' | 'microsoft')[];
  forgotPasswordLink?: string;
  signupLink?: string;
  redirectAfterLogin?: string;
}

interface LoginFormBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'login-form';
    category: 'auth';
    config: LoginConfig;
  };
}

export default function LoginFormBlock({ 
  block, 
  mode, 
  themeColor,
  onAction,
  className 
}: LoginFormBlockProps) {
  const { 
    title = 'Welcome Back',
    description = 'Sign in to continue your application',
    showMagicLink = true,
    showSocialLogin = false,
    socialProviders = ['google'],
    forgotPasswordLink,
    signupLink,
    redirectAfterLogin,
  } = block.config;
  
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [resetRequestStatus, setResetRequestStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [loginMethod, setLoginMethod] = React.useState<'password' | 'magic'>('password');
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'preview' || mode === 'edit') return;
    
    setIsLoading(true);
    setMagicLinkSent(false);
    try {
      await onAction?.('login', { 
        email, 
        password: loginMethod === 'password' ? password : undefined,
        method: loginMethod,
        redirectTo: redirectAfterLogin,
      });
      
      // If magic link was sent, show success message
      if (loginMethod === 'magic') {
        setMagicLinkSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSocialLogin = (provider: string) => {
    if (mode === 'preview' || mode === 'edit') return;
    onAction?.('social-login', { provider });
  };

  const handlePasswordResetRequest = async () => {
    if (!email) {
      alert('Please enter your email address first');
      return;
    }

    setResetRequestStatus('loading');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL}/api/v1/portal/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setResetRequestStatus('success');
      } else {
        setResetRequestStatus('error');
      }
    } catch (error) {
      console.error('Failed to request password reset:', error);
      setResetRequestStatus('error');
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowResetModal(true);
    setResetRequestStatus('idle');
  };
  
  return (
    <>
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetRequestStatus === 'success' ? (
                <div className="flex items-center gap-2 text-green-600 mt-4">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Request submitted successfully! An administrator will reset your password shortly.</span>
                </div>
              ) : resetRequestStatus === 'error' ? (
                <div className="flex items-center gap-2 text-red-600 mt-4">
                  <AlertCircle className="h-5 w-5" />
                  <span>Failed to submit request. Please try again or contact support.</span>
                </div>
              ) : (
                <>
                  <p className="mt-2">
                    To reset your password, click the button below to notify an administrator.
                    They will reset your password and provide you with new credentials.
                  </p>
                  {email && (
                    <p className="mt-4 text-sm text-gray-600">
                      Request will be sent for: <strong>{email}</strong>
                    </p>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {resetRequestStatus === 'success' ? (
            <Button onClick={() => setShowResetModal(false)} className="w-full">
              Close
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowResetModal(false)}
                className="flex-1"
                disabled={resetRequestStatus === 'loading'}
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePasswordResetRequest}
                className="flex-1"
                disabled={!email || resetRequestStatus === 'loading'}
              >
                {resetRequestStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  'Request Password Reset from Admin'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={mode === 'preview'}
                required
              />
            </div>
          </div>
          
          {/* Password (if not magic link) */}
          {loginMethod === 'password' && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                {forgotPasswordLink && (
                  <a 
                    href={forgotPasswordLink}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={mode === 'preview'}
                  required
                />
              </div>
            </div>
          )}
          
          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || mode === 'preview'}
            style={{ backgroundColor: themeColor }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {loginMethod === 'magic' ? 'Send Magic Link' : 'Sign In'}
          </Button>
          
          {/* Magic Link Success Message */}
          {magicLinkSent && loginMethod === 'magic' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <p>Check your email! We sent you a login link to <strong>{email}</strong></p>
            </div>
          )}
        </form>
        
        {/* Magic Link Toggle */}
        {showMagicLink && (
          <button
            type="button"
            className="w-full text-sm text-gray-500 hover:text-gray-700"
            onClick={() => setLoginMethod(m => m === 'password' ? 'magic' : 'password')}
          >
            {loginMethod === 'password' 
              ? 'Sign in with magic link instead' 
              : 'Sign in with password instead'}
          </button>
        )}
        
        {/* Social Login */}
        {showSocialLogin && socialProviders.length > 0 && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-gray-400">
                or continue with
              </span>
            </div>
            
            <div className="flex gap-2">
              {socialProviders.includes('google') && (
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleSocialLogin('google')}
                  disabled={mode === 'preview'}
                >
                  Google
                </Button>
              )}
              {socialProviders.includes('github') && (
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleSocialLogin('github')}
                  disabled={mode === 'preview'}
                >
                  GitHub
                </Button>
              )}
              {socialProviders.includes('microsoft') && (
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleSocialLogin('microsoft')}
                  disabled={mode === 'preview'}
                >
                  Microsoft
                </Button>
              )}
            </div>
          </>
        )}
        
        {/* Sign Up Link */}
        {signupLink && (
          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <a href={signupLink} className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        )}
        
        {/* Edit mode info */}
        {mode === 'edit' && (
          <p className="text-xs text-gray-400 text-center italic border-t pt-3">
            Authentication is handled by Supabase
          </p>
        )}
      </CardContent>
    </Card>
    </>
  );
}
