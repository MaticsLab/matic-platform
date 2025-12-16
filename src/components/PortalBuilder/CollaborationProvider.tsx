'use client';

import React, { useEffect, useRef, ReactNode } from 'react';
import { 
  useCollaborationStore, 
  getCollaborationActions,
  type Collaborator,
  type CollaboratorCursor,
} from '@/lib/collaboration/collaboration-store';

// Re-export types
export type { Collaborator, CollaboratorCursor };

// Re-export hooks from the store for direct usage
export {
  useCollaborationStore,
  useIsConnected,
  useIsSynced,
  useCurrentUser,
  useCollaborators,
  useSectionCollaborators,
  useBlockCollaborator,
  useYDoc,
  getCollaborationActions,
} from '@/lib/collaboration/collaboration-store';

// ============================================================================
// Provider Component - Just initializes the Zustand store
// ============================================================================

interface CollaborationProviderProps {
  children: ReactNode;
  roomId: string;
  enabled?: boolean;
}

/**
 * CollaborationProvider - Initializes collaboration for a room
 * 
 * This component uses Zustand instead of React Context to avoid re-render issues
 * with Radix UI components. The store is external, so updates don't propagate
 * through the React component tree.
 * 
 * Child components use the exported hooks to subscribe to specific state slices.
 */
export function CollaborationProvider({ children, roomId, enabled = true }: CollaborationProviderProps) {
  const initialize = useCollaborationStore((s) => s.initialize);
  const destroy = useCollaborationStore((s) => s.destroy);
  
  // Use ref to track initialization and avoid infinite loops
  // (subscribing to store.roomId in useEffect deps causes loops when initialize sets it)
  const initializedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;
    
    // Only initialize if room changed (check against ref, not store state)
    if (initializedRoomRef.current !== roomId) {
      initializedRoomRef.current = roomId;
      initialize(roomId);
    }
  }, [enabled, roomId, initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      initializedRoomRef.current = null;
      destroy();
    };
  }, [destroy]);

  return <>{children}</>;
}

// ============================================================================
// Legacy compatibility hooks - for existing code that uses these
// ============================================================================

/**
 * Hook for components that need full collaboration state
 * Note: Prefer using specific hooks like useIsConnected, useCollaborators for better performance
 */
export function useCollaboration() {
  const isConnected = useCollaborationStore((s) => s.isConnected);
  const isSynced = useCollaborationStore((s) => s.isSynced);
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const currentUser = useCollaborationStore((s) => s.currentUser);
  const ydoc = useCollaborationStore((s) => s._ydoc);
  const actions = getCollaborationActions();

  return {
    isConnected,
    isSynced,
    collaborators,
    currentUser,
    ydoc,
    ...actions,
  };
}

/**
 * Optional version that returns null if not initialized
 * Note: Prefer using specific hooks like useIsConnected, useCollaborators for better performance
 */
export function useCollaborationOptional() {
  const isConnected = useCollaborationStore((s) => s.isConnected);
  const isSynced = useCollaborationStore((s) => s.isSynced);
  const collaborators = useCollaborationStore((s) => s.collaborators);
  const currentUser = useCollaborationStore((s) => s.currentUser);
  const roomId = useCollaborationStore((s) => s.roomId);
  const ydoc = useCollaborationStore((s) => s._ydoc);
  const actions = getCollaborationActions();

  // Return null if not initialized
  if (!roomId) return null;

  return {
    isConnected,
    isSynced,
    collaborators,
    currentUser,
    ydoc,
    ...actions,
  };
}
