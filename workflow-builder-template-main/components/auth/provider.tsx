"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMaticAuth, isEmbeddedMode } from "@/hooks/use-matic-auth";

interface AuthContextValue {
  isEmbedded: boolean;
  workspaceId: string | null;
  formId: string | null;
  maticToken: string | null;
  hasMounted: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isEmbedded: false,
  workspaceId: null,
  formId: null,
  maticToken: null,
  hasMounted: false,
});

export function useAuthContext() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const maticAuth = useMaticAuth();

  const contextValue: AuthContextValue = {
    isEmbedded: maticAuth.isEmbedded,
    workspaceId: maticAuth.workspaceId,
    formId: maticAuth.formId,
    maticToken: maticAuth.token,
    hasMounted: maticAuth.hasMounted,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
