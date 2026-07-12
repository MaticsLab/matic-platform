'use client'

import { useState, useEffect } from 'react';
import {
  User,
  Settings,
  Smartphone,
  LogOut,
  KeyRound,
  Camera,
  Loader2,
  Monitor,
  Clock,
  MapPin,
  Moon,
  Sun
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui-components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/ui-components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/ui-components/dialog';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { useTheme } from 'next-themes';
import { authClient } from '@/auth/client/main';
import { storageClient } from '@/lib/api/storage-client';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { toast } from 'sonner';

interface UserMenuProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  onSignOut: () => void;
  textColor?: string;
  onOpenSettings?: () => void;
}

interface DeviceSession {
  id: string;
  token: string;
  userAgent: string;
  ipAddress: string | null;
  lastActive: Date;
  isCurrent: boolean;
}

function getDeviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || (ua.includes('mobile') && ua.includes('android'))) return 'Phone';
  if (ua.includes('ipad') || ua.includes('tablet')) return 'Tablet';
  return 'Computer';
}

export function UserMenu({ user, onSignOut, textColor = '#BCE7F4', onOpenSettings }: UserMenuProps) {
  const [showSessions, setShowSessions] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!showSessions) return;
    let cancelled = false;
    setIsLoadingSessions(true);
    Promise.all([authClient.listSessions(), authClient.getSession()])
      .then(([sessionsRes, currentRes]) => {
        if (cancelled) return;
        const currentToken = currentRes?.data?.session?.token;
        const list = (sessionsRes.data ?? []).map((s: any) => ({
          id: s.id,
          token: s.token,
          userAgent: s.userAgent || 'Unknown device',
          ipAddress: s.ipAddress ?? null,
          lastActive: new Date(s.updatedAt || s.createdAt),
          isCurrent: s.token === currentToken,
        }));
        setSessions(list);
      })
      .catch((error) => {
        console.error('Failed to load sessions:', error);
        toast.error('Failed to load sessions');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showSessions]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await storageClient
        .from('user-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = storageClient.from('user-assets').getPublicUrl(filePath);

      const result = await authClient.updateUser({ image: publicUrl });
      if (result.error) throw new Error(result.error.message || 'Failed to update photo');

      toast.success('Photo updated');
      setShowPhotoUpload(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRevokeSession = async (deviceSession: DeviceSession) => {
    setRevokingToken(deviceSession.token);
    try {
      await authClient.revokeSession({ token: deviceSession.token });
      toast.success('Session revoked');
      setSessions((prev) => prev.filter((s) => s.token !== deviceSession.token));
    } catch (error) {
      console.error('Failed to revoke session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setRevokingToken(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="w-full flex items-center gap-3 px-3 py-3 hover:opacity-80 rounded-lg transition-all text-left"
            style={{ backgroundColor: `${textColor}15` }}
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: textColor }}>
                {user.name}
              </p>
              <p className="text-xs truncate opacity-70" style={{ color: textColor }}>
                {user.email}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" side="top">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? (
              <><Sun className="mr-2 h-4 w-4" /><span>Light Mode</span></>
            ) : (
              <><Moon className="mr-2 h-4 w-4" /><span>Dark Mode</span></>
            )}
          </DropdownMenuItem>
          
          {onOpenSettings && (
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Account Settings</span>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={() => setShowPhotoUpload(true)}>
            <Camera className="mr-2 h-4 w-4" />
            <span>Change Photo</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowPasswordReset(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            <span>Change Password</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowSessions(true)}>
            <Smartphone className="mr-2 h-4 w-4" />
            <span>Sessions & Devices</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onSignOut} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sessions Dialog */}
      <Dialog open={showSessions} onOpenChange={setShowSessions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Active Sessions & Devices</DialogTitle>
            <DialogDescription>
              Manage your active sessions across different devices. You can revoke access from any device.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active sessions found</p>
            ) : (
              sessions.map((deviceSession) => (
                <div key={deviceSession.id} className="flex items-start justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      {getDeviceLabel(deviceSession.userAgent) === 'Phone' ? (
                        <Smartphone className="h-5 w-5 text-primary" />
                      ) : (
                        <Monitor className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{getDeviceLabel(deviceSession.userAgent)}</p>
                        {deviceSession.isCurrent && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {deviceSession.ipAddress && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {deviceSession.ipAddress}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {deviceSession.lastActive.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!deviceSession.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(deviceSession)}
                      disabled={revokingToken === deviceSession.token}
                      className="text-red-600 hover:text-red-700"
                    >
                      {revokingToken === deviceSession.token ? 'Revoking...' : 'Revoke'}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <ChangePasswordForm email={user.email} />
        </DialogContent>
      </Dialog>

      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoUpload} onOpenChange={setShowPhotoUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Profile Photo</DialogTitle>
            <DialogDescription>
              Upload a new profile photo. Recommended size: 400x400px
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-2xl">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="w-full">
                <Label
                  htmlFor="photo-upload"
                  className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  aria-disabled={isUploadingPhoto}
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <span>{isUploadingPhoto ? 'Uploading...' : 'Click to upload photo'}</span>
                </Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                />
                <p className="text-xs text-muted-foreground text-center mt-2">
                  JPG, PNG or GIF (max. 2MB)
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
