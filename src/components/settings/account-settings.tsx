'use client';

import { useState } from "react";
import { Card, CardContent } from "@/ui-components/card";
import { Input } from "@/ui-components/input";
import { Label } from "@/ui-components/label";
import { Button } from "@/ui-components/button";
import { authClient } from "@/lib/better-auth-client";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";

type AccountSettingsProps = {
  accountName: string;
  accountEmail: string;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
};

export function AccountSettings({
  accountName,
  accountEmail,
  onNameChange,
  onEmailChange,
}: AccountSettingsProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to change password");
      } else {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Card className="border-0 py-0 shadow-none">
      <CardContent className="space-y-6 p-0">
        {/* Profile Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="ml-1" htmlFor="accountName">
              Name
            </Label>
            <Input
              id="accountName"
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Your name"
              value={accountName}
            />
          </div>

          <div className="space-y-2">
            <Label className="ml-1" htmlFor="accountEmail">
              Email
            </Label>
            <Input
              id="accountEmail"
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="your.email@example.com"
              type="email"
              value={accountEmail}
            />
          </div>
        </div>

        {/* Password Change Section */}
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">Change Password</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="ml-1" htmlFor="currentPassword">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="ml-1" htmlFor="newPassword">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="ml-1" htmlFor="confirmPassword">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
