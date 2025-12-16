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
 * Uses Y.Map instead of Y.Text to prevent JSON corruption during concurrent edits.
 * This provides atomic updates for the config structure.
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
  const yMapRef = useRef<Y.Map<any> | null>(null);
  const lastSyncedJsonRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  // Setup Yjs observer for remote changes
  useEffect(() => {
    if (!ydoc) return;

    const yMap = ydoc.getMap('portal-config');
    yMapRef.current = yMap;

    // Observer for remote changes
    const observer = (event: Y.YMapEvent<any>) => {
      // Skip local transactions
      if (event.transaction.local) return;
      
      isApplyingRemoteRef.current = true;
      
      try {
        const configData = yMap.get('data');
        if (!configData) {
          isApplyingRemoteRef.current = false;
          return;
        }

        // Parse the config data
        let parsed: PortalConfig;
        try {
          if (typeof configData === 'string') {
            parsed = JSON.parse(configData);
          } else {
            parsed = configData;
          }
        } catch (parseError) {
          console.warn('[Collab] Failed to parse remote config - skipping update:', parseError);
          isApplyingRemoteRef.current = false;
          return;
        }

        const json = JSON.stringify(parsed);
        
        // Skip if same content
        if (json === lastSyncedJsonRef.current) {
          isApplyingRemoteRef.current = false;
          return;
        }

        console.log('[Collab] 📥 Received remote config update');
        lastSyncedJsonRef.current = json;
        
        // Apply remote update to local state immediately
        setConfig(parsed);
      } catch (e) {
        console.error('[Collab] Unexpected error in observer:', e);
      } finally {
        // Reset flag immediately for faster updates
        isApplyingRemoteRef.current = false;
      }
    };

    yMap.observe(observer);
    
    // Check if there's existing remote data to initialize from
    if (!isInitializedRef.current && !skipInitialSync) {
      const existingData = yMap.get('data');
      if (existingData) {
        try {
          const parsed = typeof existingData === 'string' ? JSON.parse(existingData) : existingData;
          // Only initialize if the remote has meaningful data
          if (parsed.sections && parsed.sections.length > 0) {
            console.log('[Collab] 🔄 Initializing from existing Yjs config');
            lastSyncedJsonRef.current = JSON.stringify(parsed);
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
      yMap.unobserve(observer);
    };
  }, [ydoc, setConfig, skipInitialSync]);

  // Sync local config changes to Yjs (immediate, no debounce for real-time editing)
  useEffect(() => {
    // Skip if we're applying a remote update
    if (isApplyingRemoteRef.current) return;
    
    const yMap = yMapRef.current;
    if (!yMap || !ydoc) return;
    
    let json: string;
    try {
      json = JSON.stringify(config);
    } catch (e) {
      console.error('[Collab] Failed to stringify config:', e);
      return;
    }
    
    // Skip if same content
    if (json === lastSyncedJsonRef.current) return;
    
    lastSyncedJsonRef.current = json;
    
    // Use Y.Map for atomic updates - prevents JSON corruption
    ydoc.transact(() => {
      yMap.set('data', json);
    }, 'local');
    
    console.log('[Collab] 📤 Synced config change to Yjs (real-time)');
  }, [config, ydoc]);

  // This component doesn't render anything - it's just for syncing
  return null;
}
