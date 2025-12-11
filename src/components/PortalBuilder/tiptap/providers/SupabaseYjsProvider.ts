/**
 * Supabase Yjs Provider
 * 
 * A Yjs provider that uses Supabase Realtime for document synchronization.
 * This enables real-time collaborative editing without a separate WebSocket server.
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseProviderOptions {
  supabaseUrl: string;
  supabaseKey: string;
  roomId: string;
  doc: Y.Doc;
  awareness?: Awareness;
  userId?: string;
  userName?: string;
  userColor?: string;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { anchor: number; head: number };
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
  private userName: string;
  private userColor: string;
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
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
    this.doc = options.doc;
    this.roomId = options.roomId;
    this.userId = options.userId || crypto.randomUUID();
    this.userName = options.userName || 'Anonymous';
    this.userColor = options.userColor || this.generateRandomColor();

    // Initialize or use provided awareness
    this.awareness = options.awareness || new Awareness(this.doc);
    
    // Set local awareness state
    this.awareness.setLocalState({
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      cursor: null,
      selection: null,
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

    // Load initial document state from database (if any)
    await this.loadInitialState();

    // Create realtime channel
    this.channel = this.supabase.channel(`yjs:${this.roomId}`, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
        presence: { key: this.userId },
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
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        
        // Track presence
        await this.channel?.track({
          id: this.userId,
          name: this.userName,
          color: this.userColor,
          online_at: new Date().toISOString(),
        });

        // Send initial awareness
        this.broadcastAwareness();
        
        this.onConnect?.();
        
        // Mark as synced after initial state is loaded
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
    
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
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
   * Update local user's selection
   */
  updateSelection(selection: { anchor: number; head: number } | null): void {
    const state = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({
      ...state,
      selection,
    });
  }

  /**
   * Get all connected users
   */
  getUsers(): UserPresence[] {
    const states = this.awareness.getStates();
    const users: UserPresence[] = [];
    
    states.forEach((state, clientId) => {
      if (state && clientId !== this.awareness.clientID) {
        users.push(state as UserPresence);
      }
    });
    
    return users;
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

    // Broadcast to other clients
    this.channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: {
        update: base64Update,
        sender: this.userId,
      },
    });

    // Persist to database (debounced)
    this.persistDocument();
  };

  private handleRemoteUpdate = (payload: { update: string; sender: string }): void => {
    if (payload.sender === this.userId) return;

    const update = this.base64ToArray(payload.update);
    Y.applyUpdate(this.doc, update, 'remote');
  };

  private handleAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }): void => {
    // Broadcast awareness changes
    this.broadcastAwareness();
    
    // Notify listeners
    this.onAwarenessUpdate?.(this.getUsers());
  };

  private handleRemoteAwareness = (payload: { state: any; clientId: number }): void => {
    if (payload.clientId === this.awareness.clientID) return;
    
    // Apply remote awareness state
    this.awareness.setLocalStateField('remote', payload.state);
    this.onAwarenessUpdate?.(this.getUsers());
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
        clientId: this.awareness.clientID,
      },
    });
  };

  private handlePresenceSync = (): void => {
    if (!this.channel) return;
    
    const presenceState = this.channel.presenceState();
    // Presence state is available here for tracking who's online
    this.onAwarenessUpdate?.(this.getUsers());
  };

  private async loadInitialState(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('portal_documents')
        .select('content')
        .eq('room_id', this.roomId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load document:', error);
        return;
      }

      if (data?.content) {
        const update = this.base64ToArray(data.content);
        Y.applyUpdate(this.doc, update, 'remote');
      }
    } catch (error) {
      console.error('Error loading initial state:', error);
    }
  }

  private persistDocument = this.debounce(async (): Promise<void> => {
    try {
      const state = Y.encodeStateAsUpdate(this.doc);
      const base64State = this.arrayToBase64(state);

      await this.supabase
        .from('portal_documents')
        .upsert({
          room_id: this.roomId,
          content: base64State,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'room_id' });
    } catch (error) {
      console.error('Error persisting document:', error);
    }
  }, 1000);

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

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), wait);
    };
  }
}

export default SupabaseYjsProvider;
