'use client';

import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { useYDoc, useIsConnected } from './CollaborationProvider';
import type { PortalConfig } from '@/types/portal';

interface PortalConfigSyncBridgeProps {
  config: PortalConfig;
  setConfig: React.Dispatch<React.SetStateAction<PortalConfig>>;
  /** Skip initial sync if we're loading from server */
  skipInitialSync?: boolean;
}

/**
 * Bridge component that syncs PortalConfig with Yjs for real-time collaboration.
 * 
 * This must be rendered inside a CollaborationProvider.
 * It handles both:
 * - Pushing local config changes to Yjs (for other users to receive)
 * - Receiving remote config changes from Yjs (from other users)
 */
export function PortalConfigSyncBridge({ 
  config, 
  setConfig,
  skipInitialSync = false 
}: PortalConfigSyncBridgeProps) {
  const ydoc = useYDoc();
  const isConnected = useIsConnected();
  
  // Track if we're applying a remote update to avoid loops
  const isApplyingRemoteRef = useRef(false);
  const yTextRef = useRef<Y.Text | null>(null);
  const lastSyncedJsonRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  // Setup Yjs observer for remote changes
  useEffect(() => {
    if (!ydoc) return;

    const yText = ydoc.getText('portal-config');
    yTextRef.current = yText;

    // Observer for remote changes
    const observer = (event: Y.YTextEvent) => {
      // Skip local transactions
      if (event.transaction.local) return;
      
      isApplyingRemoteRef.current = true;
      
      try {
        const text = yText.toString();
        if (!text) {
          isApplyingRemoteRef.current = false;
          return;
        }

        // Skip if same content
        if (text === lastSyncedJsonRef.current) {
          isApplyingRemoteRef.current = false;
          return;
        }

        console.log('[Collab] 📥 Received remote config update');
        const parsed = JSON.parse(text) as PortalConfig;
        lastSyncedJsonRef.current = text;
        
        // Apply remote update to local state immediately
        setConfig(parsed);
      } catch (e) {
        console.warn('[Collab] Failed to parse remote config:', e);
      } finally {
        // Reset flag immediately for faster updates
        isApplyingRemoteRef.current = false;
      }
    };

    yText.observe(observer);
    
    // Check if there's existing remote data to initialize from
    // Only do this once and only if not skipping initial sync
    if (!isInitializedRef.current && !skipInitialSync) {
      const existingText = yText.toString();
      if (existingText) {
        try {
          const parsed = JSON.parse(existingText) as PortalConfig;
          // Only initialize if the remote has meaningful data
          if (parsed.sections && parsed.sections.length > 0) {
            console.log('[Collab] 🔄 Initializing from existing Yjs config');
            lastSyncedJsonRef.current = existingText;
            isApplyingRemoteRef.current = true;
            setConfig(parsed);
            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 50);
          }
        } catch { /* ignore */ }
      }
      isInitializedRef.current = true;
    }

    console.log('[Collab] ✅ Portal config sync observer attached');

    return () => {
      yText.unobserve(observer);
    };
  }, [ydoc, setConfig, skipInitialSync]);

  // Sync local config changes to Yjs (immediate, no debounce for real-time editing)
  useEffect(() => {
    // Skip if we're applying a remote update
    if (isApplyingRemoteRef.current) return;
    
    const yText = yTextRef.current;
    if (!yText || !ydoc) return;
    
    const json = JSON.stringify(config);
    
    // Skip if same content
    if (json === lastSyncedJsonRef.current) return;
    
    lastSyncedJsonRef.current = json;
    
    // Use immediate transaction for real-time sync
    ydoc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, json);
    }, 'local');
    
    console.log('[Collab] 📤 Synced config change to Yjs (real-time)');
  }, [config, ydoc]);

  // This component doesn't render anything - it's just for syncing
  return null;
}
