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
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';
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
  const [loginMethod, setLoginMethod] = React.useState<'password' | 'magic'>('password');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'preview' || mode === 'edit') return;
    
    setIsLoading(true);
    try {
      await onAction?.('login', { 
        email, 
        password: loginMethod === 'password' ? password : undefined,
        method: loginMethod,
        redirectTo: redirectAfterLogin,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSocialLogin = (provider: string) => {
    if (mode === 'preview' || mode === 'edit') return;
    onAction?.('socialLogin', { provider, redirectTo: redirectAfterLogin });
  };
  
  return (
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
  );
}
