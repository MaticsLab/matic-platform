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
  
  console.log('[Collab Sync] Bridge status:', { 
    hasYdoc: !!ydoc, 
    isConnected,
    sectionsCount: config.sections.length 
  });
  
  // Track if we're applying a remote update to avoid loops
  const isApplyingRemoteRef = useRef(false);
  const yMapRef = useRef<Y.Map<any> | null>(null);
  const lastSyncedJsonRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  // Setup Yjs observer for remote changes
  useEffect(() => {
    if (!ydoc) {
      // Reset initialization when ydoc becomes unavailable
      isInitializedRef.current = false;
      yMapRef.current = null;
      return;
    }

    const yMap = ydoc.getMap('portal-config');
    yMapRef.current = yMap;

    // Observer for remote changes
    const observer = (event: Y.YMapEvent<any>) => {
      // Skip local transactions to avoid loops
      if (event.transaction.local) {
        return;
      }
      
      // Prevent recursive updates
      if (isApplyingRemoteRef.current) {
        return;
      }
      
      isApplyingRemoteRef.current = true;
      
      try {
        const configData = yMap.get('data');
        if (!configData) {
          return;
        }

        // Parse the config data
        let parsed: PortalConfig;
        try {
          if (typeof configData === 'string') {
            parsed = JSON.parse(configData) as PortalConfig;
          } else {
            parsed = configData as PortalConfig;
          }
        } catch (parseError) {
          console.warn('[Collab] Failed to parse remote config - skipping update:', parseError);
          return;
        }

        const json = JSON.stringify(parsed);
        
        // Skip if same content (prevents duplicate applications)
        if (json === lastSyncedJsonRef.current) {
          return;
        }

        console.log('[Collab] 📥 Received remote config update');
        lastSyncedJsonRef.current = json;
        
        // Apply remote update to local state
        setConfig(parsed);
      } catch (e) {
        console.error('[Collab] Unexpected error in observer:', e);
      } finally {
        // Use a small delay to ensure we don't process rapid-fire updates
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 50);
      }
    };

    yMap.observe(observer);
    
    // Check if there's existing remote data to initialize from
    if (!isInitializedRef.current && !skipInitialSync) {
      const existingData = yMap.get('data');
      if (existingData) {
        try {
          const parsed = (typeof existingData === 'string' ? JSON.parse(existingData) : existingData) as PortalConfig;
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
      console.log('[Collab] 🧹 Cleaning up portal config observer');
      yMap.unobserve(observer);
      isInitializedRef.current = false;
      yMapRef.current = null;
    };
  }, [ydoc, setConfig, skipInitialSync]);

  // Sync local config changes to Yjs (immediate for real-time feel)
  useEffect(() => {
    // Skip if we're applying a remote update
    if (isApplyingRemoteRef.current) {
      console.log('[Collab] ⏭️ Skipping local sync (applying remote update)');
      return;
    }
    
    const yMap = yMapRef.current;
    if (!yMap) {
      console.log('[Collab] ⚠️ No yMap available for sync');
      return;
    }
    if (!ydoc) {
      console.log('[Collab] ⚠️ No ydoc available for sync');
      return;
    }
    
    let json: string;
    try {
      json = JSON.stringify(config);
    } catch (e) {
      console.error('[Collab] Failed to stringify config:', e);
      return;
    }
    
    // Skip if same content
    if (json === lastSyncedJsonRef.current) {
      console.log('[Collab] ⏭️ Skipping sync (same content)');
      return;
    }
    
    lastSyncedJsonRef.current = json;
    
    console.log('[Collab] 🔄 Config changed, syncing to Yjs...', {
      sections: config.sections.length,
      fields: config.sections.reduce((acc, s) => acc + s.fields.length, 0)
    });
    
    // Use Y.Map for atomic updates - prevents JSON corruption
    ydoc.transact(() => {
      yMap.set('data', json);
    });
    
    console.log('[Collab] 📤 Synced config change to Yjs');
  }, [config, ydoc]);

  // This component doesn't render anything - it's just for syncing
  return null;
}
