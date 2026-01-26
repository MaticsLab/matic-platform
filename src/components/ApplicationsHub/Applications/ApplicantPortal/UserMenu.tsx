'use client'

import { useState } from 'react';
import { 
  User, 
  Settings, 
  Smartphone, 
  LogOut, 
  KeyRound,
  Camera,
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
  DialogTitle, 
  DialogFooter 
} from '@/ui-components/dialog';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { useTheme } from 'next-themes';

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

// Mock session data - in real app this would come from Better Auth
const mockSessions = [
  {
    id: '1',
    device: 'MacBook Pro',
    browser: 'Chrome',
    location: 'Chicago, IL',
    lastActive: '2 minutes ago',
    isCurrent: true
  },
  {
    id: '2',
    device: 'iPhone 14',
    browser: 'Safari',
    location: 'Chicago, IL',
    lastActive: '1 hour ago',
    isCurrent: false
  }
];

export function UserMenu({ user, onSignOut, textColor = '#BCE7F4', onOpenSettings }: UserMenuProps) {
  const [showSessions, setShowSessions] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { theme, setTheme } = useTheme();

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    // In real app, call Better Auth API
    alert('Password reset successfully!');
    setShowPasswordReset(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In real app, upload to storage and update user profile
      alert('Photo uploaded successfully!');
      setShowPhotoUpload(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    // In real app, call Better Auth API to revoke session
    alert(`Session ${sessionId} revoked`);
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
            <span>Reset Password</span>
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
            {mockSessions.map((session) => (
              <div key={session.id} className="flex items-start justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {session.device.includes('iPhone') ? (
                      <Smartphone className="h-5 w-5 text-primary" />
                    ) : (
                      <Monitor className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{session.device}</p>
                      {session.isCurrent && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{session.browser}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.lastActive}
                      </span>
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your new password below. Make sure it's strong and secure.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordReset(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordReset}>
              Reset Password
            </Button>
          </DialogFooter>
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
                  className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  <span>Click to upload photo</span>
                </Label>
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
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
