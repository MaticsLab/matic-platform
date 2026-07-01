/**
 * WebSocket Yjs Provider
 *
 * A Yjs provider that uses the Go backend's own WebSocket relay for document
 * synchronization, replacing SupabaseYjsProvider now that Supabase Realtime is gone.
 * Same public interface as SupabaseYjsProvider — only the transport changed, so
 * collaboration-store.ts only needs its instantiation call updated.
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { getSessionToken } from '@/lib/auth-helpers';

export interface WebSocketProviderOptions {
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

function getWsBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1';
  const origin = apiUrl.replace(/\/api\/v\d+\/?$/, '');
  return origin.replace(/^http/, 'ws');
}

/**
 * Go backend WebSocket relay-based Yjs provider
 */
export class WebSocketYjsProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private awareness: Awareness;
  private roomId: string;
  private userId: string;
  private userName: string;
  private userColor: string;
  private userAvatarUrl?: string;
  private connected: boolean = false;
  private synced: boolean = false;
  private pendingUpdates: Uint8Array[] = [];
  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = true;

  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onSync?: () => void;
  public onAwarenessUpdate?: (users: UserPresence[]) => void;

  constructor(options: WebSocketProviderOptions) {
    this.doc = options.doc;
    this.roomId = options.roomId;
    this.userId = options.userId || crypto.randomUUID();
    this.userName = options.userName || 'Anonymous';
    this.userColor = options.userColor || this.generateRandomColor();
    this.userAvatarUrl = options.userAvatarUrl;

    this.awareness = options.awareness || new Awareness(this.doc);

    this.awareness.setLocalState({
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      avatarUrl: this.userAvatarUrl,
      cursor: null,
      selection: null,
      selectedBlockId: null,
    });

    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  async connect(): Promise<void> {
    if (this.connected || this.ws) return;
    this.shouldReconnect = true;

    const token = await getSessionToken().catch(() => null);
    const base = getWsBaseUrl();
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    const url = `${base}/ws/collaboration/${encodeURIComponent(this.roomId)}${params.toString() ? `?${params.toString()}` : ''}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.send({
        type: 'join',
        user: {
          id: this.userId,
          name: this.userName,
          color: this.userColor,
          avatarUrl: this.userAvatarUrl,
        },
      });
      this.onConnect?.();
      if (!this.synced) {
        this.synced = true;
        this.onSync?.();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.onDisconnect?.();
      if (this.shouldReconnect) {
        this.reconnectTimeout = setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = () => {
      // onclose fires right after; reconnection is handled there.
    };
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.onDisconnect?.();
  }

  destroy(): void {
    this.disconnect();
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    this.awareness.destroy();
    this.remoteUsers.clear();

    if (this.updateTimeout) clearTimeout(this.updateTimeout);
  }

  updateSelectedBlock(blockId: string | null): void {
    const state = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({ ...state, selectedBlockId: blockId });
  }

  updateCursor(position: { x: number; y: number } | null): void {
    const state = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({ ...state, cursor: position });
  }

  getUsers(): UserPresence[] {
    return Array.from(this.remoteUsers.values());
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Private methods

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'presence':
        this.handlePresence(msg.users || []);
        break;
      case 'yjs-update':
        this.handleRemoteUpdate(msg);
        break;
      case 'awareness-update':
        this.handleRemoteAwareness(msg);
        break;
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: any): void => {
    if (origin === 'remote') return;

    this.pendingUpdates.push(update);
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => this.flushUpdates(), 50);
  };

  private flushUpdates = (): void => {
    if (this.pendingUpdates.length === 0) return;

    const mergedUpdate = Y.mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];

    this.send({
      type: 'yjs-update',
      update: this.arrayToBase64(mergedUpdate),
      sender: this.userId,
    });
  };

  private handleRemoteUpdate = (payload: { update: string; sender: string }): void => {
    if (payload.sender === this.userId) return;
    const update = this.base64ToArray(payload.update);
    Y.applyUpdate(this.doc, update, 'remote');
  };

  private awarenessDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastUsersJson: string = '';

  private notifyAwarenessUpdate = (): void => {
    if (this.awarenessDebounceTimeout) clearTimeout(this.awarenessDebounceTimeout);

    this.awarenessDebounceTimeout = setTimeout(() => {
      const users = this.getUsers();
      const usersJson = JSON.stringify(
        users.map((u) => ({
          id: u.id,
          name: u.name,
          selectedBlockId: u.selectedBlockId,
          currentSection: u.currentSection,
          currentSectionTitle: u.currentSectionTitle,
          isTyping: u.isTyping,
        }))
      );
      if (usersJson !== this.lastUsersJson) {
        this.lastUsersJson = usersJson;
        this.onAwarenessUpdate?.(users);
      }
    }, 300);
  };

  private handleAwarenessUpdate = ({
    added,
    updated,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void => {
    if (added.length > 0 || updated.includes(this.awareness.clientID)) {
      this.broadcastAwareness();
    }
    this.notifyAwarenessUpdate();
  };

  // Presence is server-authoritative (unlike SupabaseYjsProvider, which merged
  // client-side); a fresh "presence" message always replaces the whole map.
  private remoteUsers: Map<string, UserPresence> = new Map();

  private handlePresence = (users: Array<{ id: string; name: string; color: string; avatarUrl?: string }>): void => {
    const next = new Map<string, UserPresence>();
    for (const u of users) {
      if (u.id === this.userId) continue;
      const existing = this.remoteUsers.get(u.id);
      next.set(u.id, { ...existing, ...u });
    }
    this.remoteUsers = next;
    this.notifyAwarenessUpdate();
  };

  private handleRemoteAwareness = (payload: { state: any; userId: string }): void => {
    if (payload.userId === this.userId) return;
    if (!payload.state || !payload.userId) return;

    const existingUser = this.remoteUsers.get(payload.userId);
    if (!existingUser) return; // Not a known presence member yet — ignore.

    this.remoteUsers.set(payload.userId, {
      ...existingUser,
      ...payload.state,
      id: payload.userId,
      currentSection: payload.state.currentSection,
      currentSectionTitle: payload.state.currentSectionTitle,
      selectedBlockId: payload.state.selectedBlockId,
      cursor: payload.state.cursor,
      isTyping: payload.state.isTyping,
    });

    this.notifyAwarenessUpdate();
  };

  private broadcastAwareness = (): void => {
    const localState = this.awareness.getLocalState();
    if (!localState) return;

    this.send({
      type: 'awareness-update',
      state: localState,
      userId: this.userId,
    });
  };

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

export default WebSocketYjsProvider;
