"use client";

import { Key, LogOut, Moon, Plug, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  AuthDialog,
  isSingleProviderSignInInitiated,
} from "@/components/auth/dialog";
import { ApiKeysOverlay } from "@/components/overlays/api-keys-overlay";
import { IntegrationsOverlay } from "@/components/overlays/integrations-overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { SettingsOverlay } from "@/components/overlays/settings-overlay";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui-components/avatar";
import { Button } from "@/ui-components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui-components/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";

// Helper to get user display name from Supabase user metadata
function getUserName(user: { user_metadata?: { name?: string; full_name?: string }; email?: string } | null | undefined): string {
  return user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
}

// Helper to get user avatar from Supabase user metadata
function getUserAvatar(user: { image?: string | null; [key: string]: any } | null | undefined): string {
  return user?.image || (user as any)?.avatarUrl || (user as any)?.user_metadata?.avatar_url || (user as any)?.user_metadata?.picture || "";
}

export const UserMenu = () => {
  const { data: session, isPending } = useSession();
  const { theme, setTheme } = useTheme();
  const { open: openOverlay } = useOverlay();
  const [providerId, setProviderId] = useState<string | null>(null);

  // Fetch provider info when session is available
  useEffect(() => {
    if (session?.user) {
      // For Supabase, the provider is in app_metadata
      const provider = (session.user as any).app_metadata?.provider || null;
      setProviderId(provider);
    }
  }, [session?.user]);

  const handleLogout = async () => {
    await signOut();
  };

  // OAuth users can't edit their profile
  const isOAuthUser =
    providerId === "google" || providerId === "github";

  const getUserInitials = () => {
    const name = getUserName(session?.user);
    if (name) {
      return name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (session?.user?.email) {
      return session.user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const signInInProgress = isSingleProviderSignInInitiated.current;

  // Don't render anything while session is loading to prevent flash
  // BUT if sign-in is in progress, keep showing the AuthDialog with loading state
  if (isPending && !signInInProgress) {
    return (
      <div className="h-9 w-9" /> // Placeholder to maintain layout
    );
  }

  // Check if user is anonymous
  const isAnonymous = !session?.user;

  // Show Sign In button if user is anonymous or not logged in
  if (isAnonymous) {
    return (
      <div className="flex items-center gap-2">
        <AuthDialog>
          <Button
            className="h-9 disabled:opacity-100 disabled:[&>*]:text-muted-foreground"
            size="sm"
            variant="default"
          >
            Sign In
          </Button>
        </AuthDialog>
      </div>
    );
  }

  const userName = getUserName(session?.user);
  const userAvatar = getUserAvatar(session?.user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="relative h-9 w-9 rounded-full border p-0"
          variant="ghost"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage
              alt={userName}
              src={userAvatar}
            />
            <AvatarFallback>{getUserInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="font-medium text-sm leading-none">
              {userName}
            </p>
            <p className="text-muted-foreground text-xs leading-none">
              {session?.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isOAuthUser && (
          <DropdownMenuItem onClick={() => openOverlay(SettingsOverlay)}>
            <Settings className="size-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => openOverlay(IntegrationsOverlay)}>
          <Plug className="size-4" />
          <span>Connections</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openOverlay(ApiKeysOverlay)}>
          <Key className="size-4" />
          <span>API Keys</span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup onValueChange={setTheme} value={theme}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
