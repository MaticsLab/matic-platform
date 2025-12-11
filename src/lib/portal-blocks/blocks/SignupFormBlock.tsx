'use client';

/**
 * Signup Form Block
 * 
 * Customizable signup/registration form for portal authentication.
 * Supports additional fields, terms acceptance, and social signup.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { Checkbox } from '@/ui-components/checkbox';
import { Separator } from '@/ui-components/separator';
import { Mail, Lock, User, UserPlus, Loader2 } from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface SignupConfig {
  title?: string;
  description?: string;
  collectName?: boolean;
  collectPhone?: boolean;
  requireTerms?: boolean;
  termsUrl?: string;
  privacyUrl?: string;
  showSocialSignup?: boolean;
  socialProviders?: ('google' | 'github' | 'microsoft')[];
  loginLink?: string;
  redirectAfterSignup?: string;
  confirmPassword?: boolean;
}

interface SignupFormBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'signup-form';
    category: 'auth';
    config: SignupConfig;
  };
}

export default function SignupFormBlock({ 
  block, 
  mode, 
  themeColor,
  onAction,
  className 
}: SignupFormBlockProps) {
  const { 
    title = 'Create Account',
    description = 'Start your application today',
    collectName = true,
    collectPhone = false,
    requireTerms = true,
    termsUrl,
    privacyUrl,
    showSocialSignup = false,
    socialProviders = ['google'],
    loginLink,
    redirectAfterSignup,
    confirmPassword = false,
  } = block.config;
  
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  
  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };
  
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (collectName && !formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (confirmPassword && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (requireTerms && !formData.acceptTerms) {
      newErrors.terms = 'You must accept the terms';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'preview' || mode === 'edit') return;
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      await onAction?.('signup', { 
        ...formData,
        redirectTo: redirectAfterSignup,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSocialSignup = (provider: string) => {
    if (mode === 'preview' || mode === 'edit') return;
    onAction?.('socialSignup', { provider, redirectTo: redirectAfterSignup });
  };
  
  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          {collectName && (
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={cn('pl-10', errors.name && 'border-red-500')}
                  disabled={mode === 'preview'}
                />
              </div>
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
          )}
          
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={cn('pl-10', errors.email && 'border-red-500')}
                disabled={mode === 'preview'}
                required
              />
            </div>
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>
          
          {/* Phone */}
          {collectPhone && (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                disabled={mode === 'preview'}
              />
            </div>
          )}
          
          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                className={cn('pl-10', errors.password && 'border-red-500')}
                disabled={mode === 'preview'}
                required
              />
            </div>
            {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
          </div>
          
          {/* Confirm Password */}
          {confirmPassword && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={cn('pl-10', errors.confirmPassword && 'border-red-500')}
                  disabled={mode === 'preview'}
                  required
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
            </div>
          )}
          
          {/* Terms Checkbox */}
          {requireTerms && (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => updateField('acceptTerms', !!checked)}
                  disabled={mode === 'preview'}
                />
                <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                  I agree to the{' '}
                  {termsUrl ? (
                    <a href={termsUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                      Terms of Service
                    </a>
                  ) : (
                    'Terms of Service'
                  )}
                  {privacyUrl && (
                    <>
                      {' '}and{' '}
                      <a href={privacyUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                        Privacy Policy
                      </a>
                    </>
                  )}
                </Label>
              </div>
              {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}
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
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Create Account
          </Button>
        </form>
        
        {/* Social Signup */}
        {showSocialSignup && socialProviders.length > 0 && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-gray-400">
                or sign up with
              </span>
            </div>
            
            <div className="flex gap-2">
              {socialProviders.includes('google') && (
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleSocialSignup('google')}
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
                  onClick={() => handleSocialSignup('github')}
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
                  onClick={() => handleSocialSignup('microsoft')}
                  disabled={mode === 'preview'}
                >
                  Microsoft
                </Button>
              )}
            </div>
          </>
        )}
        
        {/* Login Link */}
        {loginLink && (
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href={loginLink} className="text-blue-600 hover:underline">
              Sign in
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
