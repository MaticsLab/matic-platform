/**
 * Supabase Yjs Provider
 * 
 * A Yjs provider that uses Supabase Realtime for document synchronization.
 * This enables real-time collaborative editing without a separate WebSocket server.
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseProviderOptions {
  /** Existing Supabase client instance - reuse to avoid multiple GoTrueClient warning */
  supabaseClient: SupabaseClient;
  roomId: string;
  doc: Y.Doc;
  awareness?: Awareness;
  userId?: string;
  userName?: string;
  userColor?: string;
  userAvatarUrl?: string;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number; timestamp?: number };
  selection?: { anchor: number; head: number };
  selectedBlockId?: string;
  currentSection?: string;
  currentSectionTitle?: string;
  isTyping?: boolean;
}

/**
 * Supabase-based Yjs provider for real-time collaboration
 */
export class SupabaseYjsProvider {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private doc: Y.Doc;
  private awareness: Awareness;
  private roomId: string;
  private userId: string;
  private clientId: string; // Unique per browser tab/session
  private userName: string;
  private userColor: string;
  private userAvatarUrl?: string;
  private connected: boolean = false;
  private synced: boolean = false;
  private pendingUpdates: Uint8Array[] = [];
  private updateTimeout: NodeJS.Timeout | null = null;

  // Event handlers
  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onSync?: () => void;
  public onAwarenessUpdate?: (users: UserPresence[]) => void;

  constructor(options: SupabaseProviderOptions) {
    this.supabase = options.supabaseClient;
    this.doc = options.doc;
    this.roomId = options.roomId;
    this.userId = options.userId || crypto.randomUUID();
    this.clientId = crypto.randomUUID(); // Always unique per tab/session
    this.userName = options.userName || 'Anonymous';
    this.userColor = options.userColor || this.generateRandomColor();
    this.userAvatarUrl = options.userAvatarUrl;

    // Initialize or use provided awareness
    this.awareness = options.awareness || new Awareness(this.doc);
    
    // Set local awareness state
    this.awareness.setLocalState({
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      avatarUrl: this.userAvatarUrl,
      cursor: null,
      selection: null,
      selectedBlockId: null,
    });

    // Listen for document updates
    this.doc.on('update', this.handleDocUpdate);

    // Listen for awareness updates
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  /**
   * Connect to the Supabase Realtime channel
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    // Create realtime channel
    this.channel = this.supabase.channel(`yjs:${this.roomId}`, {
      config: {
        broadcast: { self: true }, // Receive own broadcasts to sync across tabs
        presence: { key: this.clientId }, // Use clientId to differentiate tabs
      },
    });

    // Handle document updates from other clients
    this.channel.on('broadcast', { event: 'yjs-update' }, (payload) => {
      this.handleRemoteUpdate(payload.payload);
    });

    // Handle awareness updates from other clients
    this.channel.on('broadcast', { event: 'awareness-update' }, (payload) => {
      this.handleRemoteAwareness(payload.payload);
    });

    // Handle presence sync for user list
    this.channel.on('presence', { event: 'sync' }, () => {
      this.handlePresenceSync();
    });

    // Subscribe to channel
    await this.channel.subscribe(async (status) => {
      console.log('[Collab] Channel status:', status, 'Room:', this.roomId);
      
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        
        // Track presence
        console.log('[Collab] Tracking presence for:', this.userName, 'userId:', this.userId, 'clientId:', this.clientId);
        await this.channel?.track({
          id: this.userId,
          clientId: this.clientId, // Track both user and client ID
          name: this.userName,
          color: this.userColor,
          avatarUrl: this.userAvatarUrl,
          online_at: new Date().toISOString(),
        });

        // Send initial awareness
        this.broadcastAwareness();
        
        this.onConnect?.();
        
        // Mark as synced
        if (!this.synced) {
          this.synced = true;
          this.onSync?.();
        }
      }
    });
  }

  /**
   * Disconnect from the channel
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    this.connected = false;
    this.onDisconnect?.();
  }

  /**
   * Destroy the provider
   */
  destroy(): void {
    this.disconnect();
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    this.awareness.destroy();
    this.remoteUsers.clear();
    
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    if (this.awarenessDebounceTimeout) {
      clearTimeout(this.awarenessDebounceTimeout);
    }
  }

  /**
   * Update which block the user has selected
   */
  updateSelectedBlock(blockId: string | null): void {
    const state = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({
      ...state,
      selectedBlockId: blockId,
    });
  }

  /**
   * Update local user's cursor position
   */
  updateCursor(position: { x: number; y: number } | null): void {
    const state = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({
      ...state,
      cursor: position,
    });
  }

  /**
   * Get all connected users
   */
  getUsers(): UserPresence[] {
    // Return users from our tracked remote users map
    // This is populated by handleRemoteAwareness and handlePresenceSync
    return Array.from(this.remoteUsers.values());
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // Private methods

  private handleDocUpdate = (update: Uint8Array, origin: any): void => {
    // Don't broadcast updates that came from remote
    if (origin === 'remote') return;

    // Batch updates for better performance
    this.pendingUpdates.push(update);
    
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    this.updateTimeout = setTimeout(() => {
      this.flushUpdates();
    }, 50); // Debounce updates
  };

  private flushUpdates = (): void => {
    if (this.pendingUpdates.length === 0 || !this.channel) return;

    // Merge all pending updates
    const mergedUpdate = Y.mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];

    // Convert to base64 for transmission
    const base64Update = this.arrayToBase64(mergedUpdate);

    console.log('[Collab] 📤 Broadcasting yjs-update, size:', base64Update.length);

    // Broadcast to other clients
    this.channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: {
        update: base64Update,
        sender: this.clientId, // Use clientId to identify this specific tab
      },
    });
  };

  private handleRemoteUpdate = (payload: { update: string; sender: string }): void => {
    if (payload.sender === this.clientId) return; // Filter by clientId, not userId

    console.log('[Collab] 📥 Received yjs-update from:', payload.sender);

    const update = this.base64ToArray(payload.update);
    Y.applyUpdate(this.doc, update, 'remote');
    
    console.log('[Collab] ✅ Applied remote yjs-update');
  };

  // Debounce awareness notifications to prevent infinite loops
  private awarenessDebounceTimeout: NodeJS.Timeout | null = null;
  private lastUsersJson: string = '';
  
  private notifyAwarenessUpdate = (): void => {
    if (this.awarenessDebounceTimeout) {
      clearTimeout(this.awarenessDebounceTimeout);
    }
    
    this.awarenessDebounceTimeout = setTimeout(() => {
      const users = this.getUsers();
      // Include all relevant fields in comparison to detect section/block changes
      const usersJson = JSON.stringify(users.map(u => ({
        id: u.id,
        name: u.name,
        selectedBlockId: u.selectedBlockId,
        currentSection: u.currentSection,
        currentSectionTitle: u.currentSectionTitle,
        isTyping: u.isTyping
      })));
      if (usersJson !== this.lastUsersJson) {
        this.lastUsersJson = usersJson;
        console.log('[Collab] Awareness changed, notifying:', users.map(u => ({ name: u.name, section: u.currentSection, block: u.selectedBlockId })));
        this.onAwarenessUpdate?.(users);
      }
    }, 300); // Debounce by 300ms to reduce flickering
  };

  private handleAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }): void => {
    // Only broadcast if there are actual changes to our local state
    if (added.length > 0 || updated.includes(this.awareness.clientID)) {
      this.broadcastAwareness();
    }
    
    // Debounced notification to prevent loops
    this.notifyAwarenessUpdate();
  };

  // Store remote user states since we're using broadcast, not native Yjs awareness sync
  private remoteUsers: Map<string, UserPresence> = new Map();
  
  private handleRemoteAwareness = (payload: { state: any; clientId: string }): void => {
    // Filter by clientId instead of awareness clientID (which uses numbers)
    if (payload.clientId === this.clientId) return;
    
    // Store/update the remote user's state with all awareness fields
    // Use clientId as the key to support same user in multiple tabs
    if (payload.state && payload.clientId) {
      const existingUser = this.remoteUsers.get(payload.clientId);
      // Merge with existing data to preserve any fields from presence
      const updatedUser: UserPresence = {
        ...existingUser,
        ...payload.state,
        id: payload.state.id || payload.clientId, // Use userId from state, fallback to clientId
        // Ensure these fields are always updated from awareness
        currentSection: payload.state.currentSection,
        currentSectionTitle: payload.state.currentSectionTitle,
        selectedBlockId: payload.state.selectedBlockId,
        cursor: payload.state.cursor,
        isTyping: payload.state.isTyping,
      };
      console.log('[Collab] Remote awareness received:', updatedUser.name, 'section:', updatedUser.currentSection, 'block:', updatedUser.selectedBlockId);
      this.remoteUsers.set(payload.clientId, updatedUser);
    }
    
    // Debounced notification to prevent loops
    this.notifyAwarenessUpdate();
  };

  private broadcastAwareness = (): void => {
    if (!this.channel) return;

    const localState = this.awareness.getLocalState();
    if (!localState) return;

    this.channel.send({
      type: 'broadcast',
      event: 'awareness-update',
      payload: {
        state: localState,
        clientId: this.clientId, // Include clientId to identify this tab
      },
    });
  };

  private handlePresenceSync = (): void => {
    if (!this.channel) return;
    
    // Get presence state and update remote users
    const presenceState = this.channel.presenceState();
    console.log('[Collab] Presence sync, state:', presenceState);
    
    // Clear and rebuild remote users from presence
    const currentRemoteUserIds = new Set<string>();
    const now = Date.now();
    const staleThreshold = 60000; // 60 seconds - consider presence stale after this
    
    Object.entries(presenceState).forEach(([presenceKey, presences]) => {
      // Each presence key can have multiple presence objects (multiple tabs)
      // Supabase presence returns objects with our tracked data plus presence_ref
      const presenceArray = presences as unknown as Array<{
        id: string;
        clientId?: string;
        name: string;
        color: string;
        avatarUrl?: string;
        online_at: string;
        presence_ref: string;
      }>;
      
      // When there are duplicates, only keep the most recent one
      if (presenceArray.length > 1) {
        console.log('[Collab] Multiple presence entries for same key:', presenceArray.length, presenceArray.map(p => ({ name: p.name, clientId: p.clientId, online_at: p.online_at })));
        presenceArray.sort((a, b) => {
          const timeA = new Date(a.online_at).getTime();
          const timeB = new Date(b.online_at).getTime();
          return timeB - timeA; // Sort descending (most recent first)
        });
      }
      
      // Only process the first (most recent) entry
      const presence = presenceArray[0];
      
      // Use presenceKey as clientId if not in the data (Supabase uses key as identifier)
      const effectiveClientId = presence.clientId || presenceKey;
      
      console.log('[Collab] Processing presence entry:', { 
        name: presence?.name, 
        clientId: effectiveClientId,
        myClientId: this.clientId,
        isSelf: effectiveClientId === this.clientId,
        hasData: !!presence
      });
      
      if (presence && effectiveClientId && effectiveClientId !== this.clientId) {
        // Check if presence is stale
        const onlineAt = new Date(presence.online_at).getTime();
        const age = now - onlineAt;
        
        if (age > staleThreshold) {
          console.log('[Collab] Skipping stale presence:', presence.name, 'age:', Math.round(age / 1000) + 's');
          return;
        }
        
        currentRemoteUserIds.add(effectiveClientId);
        console.log('[Collab] ✅ Added remote user from presence:', presence.name, 'userId:', presence.id, 'clientId:', effectiveClientId);
        // Only add if not already in remoteUsers (preserve cursor/selection data)
        if (!this.remoteUsers.has(effectiveClientId)) {
          this.remoteUsers.set(effectiveClientId, {
            id: presence.id, // Keep userId for display
            name: presence.name,
            color: presence.color,
            avatarUrl: presence.avatarUrl,
          });
        }
      } else {
        const reason = !presence ? 'no presence' : !effectiveClientId ? 'no clientId' : 'is self';
        console.log('[Collab] Skipped presence entry - reason:', reason);
      }
    });
    
    // Remove users who are no longer in presence
    this.remoteUsers.forEach((_, clientId) => {
      if (!currentRemoteUserIds.has(clientId)) {
        console.log('[Collab] Removing disconnected user:', clientId);
        this.remoteUsers.delete(clientId);
      }
    });
    
    console.log('[Collab] Total remote users after sync:', this.remoteUsers.size, Array.from(this.remoteUsers.values()).map(u => u.name));
    
    // Use debounced notification to prevent loops
    this.notifyAwarenessUpdate();
  };

  // Utility methods

  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  }

  private base64ToArray(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private generateRandomColor(): string {
    const colors = [
      '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399',
      '#22D3EE', '#60A5FA', '#A78BFA', '#F472B6', '#FB7185',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export default SupabaseYjsProvider;
