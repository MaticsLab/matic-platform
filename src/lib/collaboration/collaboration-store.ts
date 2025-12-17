'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as Y from 'yjs';
import { SupabaseYjsProvider, type UserPresence } from './index';
import { supabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface CollaboratorCursor {
  x: number;
  y: number;
  timestamp?: number;
}

export interface Collaborator extends UserPresence {
  cursor?: CollaboratorCursor;
  currentSection?: string;
  currentSectionTitle?: string;
  isTyping?: boolean;
  lastActivity?: number;
}

interface CollaborationState {
  // Connection state
  isConnected: boolean;
  isSynced: boolean;
  roomId: string | null;
  
  // Users
  collaborators: Collaborator[];
  currentUser: { id: string; name: string; avatarUrl?: string } | null;
  
  // Internal refs (not reactive)
  _ydoc: Y.Doc | null;
  _provider: SupabaseYjsProvider | null;
  _cursorThrottleTimeout: NodeJS.Timeout | null;
  _typingTimeout: NodeJS.Timeout | null;
}

interface CollaborationActions {
  // Initialization
  initialize: (roomId: string) => Promise<void>;
  destroy: () => void;
  
  // Actions
  updateCursor: (position: { x: number; y: number } | null) => void;
  updateCurrentSection: (sectionId: string | null, sectionTitle?: string) => void;
  updateSelectedBlock: (blockId: string | null) => void;
  setIsTyping: (typing: boolean) => void;
  
  // Internal setters
  _setConnected: (connected: boolean) => void;
  _setSynced: (synced: boolean) => void;
  _setCollaborators: (collaborators: Collaborator[]) => void;
  _setCurrentUser: (user: { id: string; name: string; avatarUrl?: string } | null) => void;
}

type CollaborationStore = CollaborationState & CollaborationActions;

// ============================================================================
// Store
// ============================================================================

export const useCollaborationStore = create<CollaborationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isConnected: false,
    isSynced: false,
    roomId: null,
    collaborators: [],
    currentUser: null,
    _ydoc: null,
    _provider: null,
    _cursorThrottleTimeout: null,
    _typingTimeout: null,

    // Internal setters - these update state without triggering full re-renders
    _setConnected: (connected) => {
      if (get().isConnected !== connected) {
        set({ isConnected: connected });
      }
    },
    _setSynced: (synced) => {
      if (get().isSynced !== synced) {
        set({ isSynced: synced });
      }
    },
    _setCollaborators: (collaborators) => {
      // Only update if collaborators actually changed (already debounced in provider)
      set({ collaborators });
    },
    _setCurrentUser: (user) => set({ currentUser: user }),

    // Initialize collaboration
    initialize: async (roomId: string) => {
      const state = get();
      
      // Already initialized for this room
      if (state.roomId === roomId && state._provider) {
        return;
      }
      
      // Cleanup existing
      if (state._provider) {
        state._provider.destroy();
      }

      // Fetch current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No user for collaboration');
        return;
      }

      const currentUser = {
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
        avatarUrl: user.user_metadata?.avatar_url
      };

      const ydoc = new Y.Doc();
      
      const provider = new SupabaseYjsProvider({
        supabaseClient: supabase,  // Reuse existing client to avoid multiple GoTrueClient warning
        roomId: `portal-builder:${roomId}`,
        doc: ydoc,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatarUrl: currentUser.avatarUrl,
      });

      // Set up callbacks
      provider.onConnect = () => get()._setConnected(true);
      provider.onDisconnect = () => get()._setConnected(false);
      provider.onSync = () => get()._setSynced(true);
      provider.onAwarenessUpdate = (users) => {
        const currentUserId = get().currentUser?.id;
        
        // Deduplicate users by userId (in case same user has multiple tabs open)
        const userMap = new Map<string, Collaborator>();
        users
          .filter(u => u.id !== currentUserId)
          .forEach(u => {
            // Keep first instance of each user (deduplicates by userId)
            if (!userMap.has(u.id)) {
              userMap.set(u.id, {
                ...u,
                lastActivity: Date.now(),
              });
            }
          });
        
        const others = Array.from(userMap.values());
        get()._setCollaborators(others);
      };

      provider.connect();

      set({
        roomId,
        currentUser,
        _ydoc: ydoc,
        _provider: provider,
      });
    },

    // Cleanup
    destroy: () => {
      const state = get();
      
      if (state._cursorThrottleTimeout) {
        clearTimeout(state._cursorThrottleTimeout);
      }
      if (state._typingTimeout) {
        clearTimeout(state._typingTimeout);
      }
      if (state._provider) {
        state._provider.destroy();
      }
      
      set({
        isConnected: false,
        isSynced: false,
        roomId: null,
        collaborators: [],
        _ydoc: null,
        _provider: null,
        _cursorThrottleTimeout: null,
        _typingTimeout: null,
      });
    },

    // Update cursor position (throttled)
    updateCursor: (position) => {
      const state = get();
      if (!state._provider) return;
      
      // Throttle cursor updates to 20fps
      if (state._cursorThrottleTimeout) return;
      
      const timeout = setTimeout(() => {
        set({ _cursorThrottleTimeout: null });
      }, 50);
      
      set({ _cursorThrottleTimeout: timeout });
      state._provider.updateCursor(position);
    },

    // Update current section
    updateCurrentSection: (sectionId, sectionTitle) => {
      const state = get();
      if (!state._provider) return;
      
      const awareness = (state._provider as any).awareness;
      if (awareness) {
        const localState = awareness.getLocalState() || {};
        awareness.setLocalState({
          ...localState,
          currentSection: sectionId,
          currentSectionTitle: sectionTitle,
        });
      }
    },

    // Update selected block
    updateSelectedBlock: (blockId) => {
      const state = get();
      if (!state._provider) return;
      state._provider.updateSelectedBlock(blockId);
    },

    // Set typing indicator
    setIsTyping: (typing) => {
      const state = get();
      if (!state._provider) return;
      
      const awareness = (state._provider as any).awareness;
      if (awareness) {
        const localState = awareness.getLocalState() || {};
        awareness.setLocalState({
          ...localState,
          isTyping: typing,
        });
      }
      
      // Auto-clear typing after 2 seconds
      if (typing) {
        if (state._typingTimeout) {
          clearTimeout(state._typingTimeout);
        }
        const timeout = setTimeout(() => {
          const awareness = (get()._provider as any)?.awareness;
          if (awareness) {
            const localState = awareness.getLocalState() || {};
            awareness.setLocalState({
              ...localState,
              isTyping: false,
            });
          }
        }, 2000);
        set({ _typingTimeout: timeout });
      }
    },
  }))
);

// ============================================================================
// Selector Hooks - Only re-render when specific data changes
// ============================================================================

/** Get connection status only */
export const useIsConnected = () => useCollaborationStore((s) => s.isConnected);

/** Get sync status only */
export const useIsSynced = () => useCollaborationStore((s) => s.isSynced);

/** Get current user only */
export const useCurrentUser = () => useCollaborationStore((s) => s.currentUser);

/** Get collaborators list only */
export const useCollaborators = () => useCollaborationStore((s) => s.collaborators);

/** Get collaborators in a specific section */
export const useSectionCollaborators = (sectionId: string) => 
  useCollaborationStore((s) => s.collaborators.filter(c => c.currentSection === sectionId));

/** Get collaborator editing a specific block */
export const useBlockCollaborator = (blockId: string) => 
  useCollaborationStore((s) => s.collaborators.find(c => c.selectedBlockId === blockId));

/** Get Yjs document */
export const useYDoc = () => useCollaborationStore((s) => s._ydoc);

// ============================================================================
// Non-reactive getters for actions
// ============================================================================

export const getCollaborationActions = () => ({
  initialize: useCollaborationStore.getState().initialize,
  destroy: useCollaborationStore.getState().destroy,
  updateCursor: useCollaborationStore.getState().updateCursor,
  updateCurrentSection: useCollaborationStore.getState().updateCurrentSection,
  updateSelectedBlock: useCollaborationStore.getState().updateSelectedBlock,
  setIsTyping: useCollaborationStore.getState().setIsTyping,
});
