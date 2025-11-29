'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat, IScannerControls } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'
import { Exception, NotFoundException, Result } from '@zxing/library'
import { ArrowLeft, Wifi, WifiOff, ScanLine, Camera, CheckCircle2, XCircle, Trash2, ChevronUp, AlertCircle, Shield, User, Mail, Activity, Settings, Flashlight, Search, TrendingUp, UserPlus } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card } from '@/ui-components/card'
import { Badge } from '@/ui-components/badge'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/ui-components/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ui-components/dialog'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from '@/ui-components/sonner'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { tablesSupabase } from '@/lib/api/tables-supabase'
import { scanHistoryAPI } from '@/lib/api/scan-history-client'
import { pulseClient } from '@/lib/api/pulse-client'
import type { DataTable, TableColumn } from '@/types/data-tables'
import type { ScanHistoryRecord } from '@/types/scan-history'

interface ScannedItem {
  id: string
  barcode: string
  timestamp: Date
  foundRows: Array<{ id?: string; data: Record<string, any> }>
  success: boolean
  status: 'success' | 'failure'
  historyId?: string
}

function ScanPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isScanning, setIsScanning] = useState(false)
  const [scanHistory, setScanHistory] = useState<ScannedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null)
  const [lastScanTime, setLastScanTime] = useState<number>(0)
  const [selectedCamera, setSelectedCamera] = useState('environment')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied' | 'requesting'>('unknown')
  const [tableInfo, setTableInfo] = useState<DataTable | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [resolvedColumnId, setResolvedColumnId] = useState<string | null>(null)
  const [columnLabel, setColumnLabel] = useState<string | null>(null)
  const [pulseConfig, setPulseConfig] = useState<any>(null)
  const [showUserInfoDialog, setShowUserInfoDialog] = useState(false)
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  
  // New state for modern UI
  const [showFlash, setShowFlash] = useState<'green' | 'red' | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState({
    flashEnabled: false,
    continuousScan: false,
    scanCooldown: true,
    manualEntry: false,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [manualIdInput, setManualIdInput] = useState('')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [scanResult, setScanResult] = useState<{
    found: boolean;
    barcode: string;
    row?: any;
  } | null>(null)
  const [showWalkInForm, setShowWalkInForm] = useState(false)
  const [walkInForm, setWalkInForm] = useState<Record<string, any>>({})
  
  // Scanner session management
  const [scannerSessionId, setScannerSessionId] = useState<string | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const lastScanRef = useRef<{ barcode: string; timestamp: number } | null>(null)
  const isProcessingScanRef = useRef<boolean>(false)
  
  // Check for user info in localStorage (guest scanner mode)
  useEffect(() => {
    const savedName = localStorage.getItem('scanner_user_name')
    const savedEmail = localStorage.getItem('scanner_user_email')
    
    if (savedName && savedEmail) {
      setUserName(savedName)
      setUserEmail(savedEmail)
      console.log('📱 Loaded guest scanner info:', { name: savedName, email: savedEmail })
    }
  }, [])
  
  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const channelRef = useRef<any>(null)
  
  // Calculate statistics
  const statistics = {
    total: scanHistory.length,
    successful: scanHistory.filter(item => item.success).length,
    walkIns: 0, // TODO: Track walk-ins separately
    get rsvps() { return this.successful - this.walkIns; }
  };
  
  // Filtered history with search
  const filteredHistory = searchQuery.trim() 
    ? scanHistory.filter(item => 
        item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        new Date(item.timestamp).toLocaleString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    : scanHistory;

  const ensureCodeReader = () => {
    if (!scannerRef.current) {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)
      // Ultra-fast scan speed - 100ms delay for instant response
      scannerRef.current = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 })
    }
    return scannerRef.current
  }

  const refreshCameraList = async () => {
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      setAvailableCameras(devices)
    } catch (err) {
      console.error('Failed to list cameras:', err)
    }
  }

  // Get pairing parameters from URL
  const tableId = searchParams.get('table')
  const columnName = searchParams.get('column')
  const pairingCode = searchParams.get('code')
  const pulseTableId = searchParams.get('pulse') // Pulse mode detection
  const scanMode = searchParams.get('mode') // 'pulse' or undefined (regular mode)
  
  const isPulseMode = scanMode === 'pulse' && pulseTableId

  useEffect(() => {
    if (!tableId) {
      setTableInfo(null)
      setWorkspaceId(null)
      return
    }

    const loadMetadata = async () => {
      try {
        const table = await tablesSupabase.getTableById(tableId)
        setTableInfo(table)
        setWorkspaceId(table.workspace_id)

        // Load Pulse config if in Pulse mode
        if (isPulseMode && pulseTableId) {
          try {
            const { pulseSupabase } = await import('@/lib/api/pulse-supabase')
            const config = await pulseSupabase.getPulseConfig(tableId)
            setPulseConfig(config)
            
            // Use barcode_column_id from Pulse config
            if (config && config.barcode_column_id) {
              setResolvedColumnId(config.barcode_column_id)
              const barcodeColumn = table.columns.find((col: any) => col.id === config.barcode_column_id)
              if (barcodeColumn) {
                setColumnLabel(barcodeColumn.label || barcodeColumn.name)
              }
              console.log('🟢 Pulse mode: Using barcode column', config.barcode_column_id)
            } else {
              console.warn('⚠️ Pulse config has no barcode_column_id set')
            }
          } catch (pulseError) {
            console.error('Failed to load Pulse config:', pulseError)
          }
        }

        // Regular mode column resolution
        if (!isPulseMode) {
          const columnIdParam = searchParams.get('columnId') ?? searchParams.get('column_id')
          let resolved: TableColumn | undefined

          if (columnIdParam) {
            resolved = table.columns.find((col: any) => col.id === columnIdParam)
          }

          if (!resolved && columnName) {
            resolved = table.columns.find((col: any) => col.name === columnName || col.id === columnName)
          }

          if (resolved?.id) {
            setResolvedColumnId(resolved.id)
          } else if (columnIdParam) {
            setResolvedColumnId(columnIdParam)
          }

          if (resolved?.label) {
            setColumnLabel(resolved.label)
          } else if (resolved?.name) {
            setColumnLabel(resolved.name)
          } else if (columnName) {
            setColumnLabel(columnName)
          }
        }
      } catch (metadataError) {
        console.error('Failed to load table metadata:', metadataError)
      }
    }

    loadMetadata()
  }, [tableId, columnName, searchParams, isPulseMode, pulseTableId])

  useEffect(() => {
    // Pulse mode only needs tableId, pulseTableId, and pairingCode
    if (isPulseMode) {
      if (!tableId || !pulseTableId || !pairingCode) {
        setError('Invalid Pulse pairing parameters. Please scan the QR code again.')
        return
      }
    } else {
      // Regular mode needs tableId, columnName, and pairingCode
      if (!tableId || !columnName || !pairingCode) {
        setError('Invalid pairing parameters. Please scan the QR code again.')
        return
      }
    }

    // Check if user info is stored
    const storedUserInfo = localStorage.getItem('scanner_user_info')
    if (storedUserInfo) {
      try {
        const { name, email } = JSON.parse(storedUserInfo)
        setUserName(name)
        setUserEmail(email)
      } catch (err) {
        console.error('Failed to parse stored user info:', err)
      }
    } else {
      // Show dialog to collect user info on first use
      setShowUserInfoDialog(true)
    }

    // Connect to Supabase real-time channel for this pairing session
    const connectToDesktop = async () => {
      const channelName = `barcode_scanner_${tableId}_${pairingCode}`
      console.log('📱 Connecting to channel:', channelName)
      
      const channel = supabase.channel(channelName)
      
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        console.log('👥 Presence sync:', state)
        
        // Check if desktop is present
        const hasDesktop = Object.values(state).some((presences: any) => 
          presences.some((p: any) => p.deviceInfo?.type === 'desktop')
        )
        
        if (hasDesktop) {
          console.log('🖥️ Desktop found in presence')
          setConnectionStatus('connected')
          // Don't auto-start scanning - wait for user to enter info
        }
      })

      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('🖥️ Device joined:', key, newPresences)
        const isDesktop = newPresences.some((p: any) => p.deviceInfo?.type === 'desktop')
        if (isDesktop) {
          setConnectionStatus('connected')
          // Don't auto-start scanning - wait for user to enter info
        }
      })

      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('🖥️ Device left:', key, leftPresences)
        const wasDesktop = leftPresences.some((p: any) => p.deviceInfo?.type === 'desktop')
        if (wasDesktop) {
          setConnectionStatus('disconnected')
        }
      })

      // Listen for scan result acknowledgments
      channel.on('broadcast', { event: 'scan_result_ack' }, ({ payload }) => {
        console.log('✅ Desktop received scan result:', payload)
      })

      channel.subscribe(async (status) => {
        console.log('📱 Channel subscription status:', status)
        if (status === 'SUBSCRIBED') {
          // Track mobile device presence
          await channel.track({
            deviceType: 'mobile',
            userAgent: navigator.userAgent,
            pairingCode,
            timestamp: new Date().toISOString()
          })
          console.log('📱 Mobile device connected to channel')
          
          // Set timeout to start scanning even if no desktop found (for testing)
          setTimeout(() => {
            if (connectionStatus === 'connecting') {
              console.log('⏰ Connection timeout - allowing standalone scanning')
              setConnectionStatus('connected')
              setIsScanning(true)
            }
          }, 10000) // 10 second timeout
        } else if (status === 'CLOSED') {
          console.log('❌ Channel connection closed')
          setConnectionStatus('disconnected')
        }
      })

      channelRef.current = channel
    }

    connectToDesktop()

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [tableId, columnName, pairingCode])

  // Scanner session management for Pulse mode
  useEffect(() => {
    console.log('🔵 Scanner presence tracking triggered', {
      isPulseMode,
      hasPulseConfig: !!pulseConfig,
      pulseTableId,
      pairingCode,
      userName
    });
    
    if (!isPulseMode || !pulseConfig || !pulseTableId || !pairingCode || !userName) {
      console.log('⚠️ Scanner presence not tracked - missing requirements');
      return
    }

    // Use Supabase Realtime presence for active scanner tracking
    const channelName = `pulse_scanners_${pulseTableId}`;
    console.log('� Joining presence channel:', channelName);
    
    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: pairingCode, // Use pairing code as unique key
        },
      },
    });

    // Track this scanner's presence
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        console.log('👥 Presence synced:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 Scanner joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 Scanner left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Presence channel subscribed');
          
          // Track this scanner
          const presenceData = {
            scanner_name: userName,
            scanner_email: userEmail || '',
            pairing_code: pairingCode,
            device_id: `scanner_${Date.now()}`,
            total_scans: scanHistory.filter(s => s.success).length,
            joined_at: new Date().toISOString(),
          };
          
          await presenceChannel.track(presenceData);
          console.log('📍 Scanner presence tracked:', presenceData);
          
          toast.success('Scanner online!', {
            description: 'You are now visible on the dashboard',
            duration: 2000,
          });
        }
      });

    return () => {
      console.log('🔴 Unsubscribing from presence channel');
      presenceChannel.unsubscribe();
      supabase.removeChannel(presenceChannel);
    };
  }, [isPulseMode, pulseConfig, pulseTableId, pairingCode, userName, userEmail, scanHistory])

  // Check camera permissions on mount
  const checkCameraPermissions = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
      if (permission.state === 'granted') {
        setCameraPermission('granted')
        await refreshCameraList()
      } else if (permission.state === 'denied') {
        setCameraPermission('denied')
      } else {
        setCameraPermission('unknown')
      }
      
      // Listen for permission changes
      permission.onchange = () => {
        const state = permission.state
        if (state === 'granted') {
          setCameraPermission('granted')
          refreshCameraList()
        } else if (state === 'denied') {
          setCameraPermission('denied')
        } else {
          setCameraPermission('unknown')
        }
      }
    } catch (error) {
      console.log('Permission API not supported, will check on camera access')
      setCameraPermission('unknown')
    }
  }

  // Request camera permissions explicitly
  const requestCameraPermissions = async () => {
    setCameraPermission('requesting')
    
    // Show toast prompting user to grant permission
    toast.info('Camera Permission Required', {
      description: 'Please allow camera access in your browser to start scanning.',
      duration: 5000,
    })
    
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: selectedCamera } })
      
      // If successful, stop the stream and update permission
      stream.getTracks().forEach(track => track.stop())
      setCameraPermission('granted')
      
      toast.success('Camera access granted!', {
        description: 'You can now start scanning barcodes.',
      })
      
      // Load available cameras after permission granted
      await refreshCameraList()
    } catch (error) {
      console.error('Camera permission denied:', error)
      setCameraPermission('denied')
      
      toast.error('Camera access denied', {
        description: 'Please enable camera permissions in your browser settings.',
        duration: 7000,
      })
    }
  }

  useEffect(() => {
    // Check permissions and load cameras
    checkCameraPermissions()
    
    // If permission is already granted or unknown, try to list cameras
    if (cameraPermission === 'granted' || cameraPermission === 'unknown') {
      refreshCameraList().then(() => {
        if (cameraPermission === 'unknown') {
          setCameraPermission('granted')
        }
      }).catch(() => {
        if (cameraPermission === 'unknown') {
          setCameraPermission('denied')
        }
      })
    }
  }, [cameraPermission])

  useEffect(() => {
    if (isScanning && videoRef.current && connectionStatus === 'connected' && cameraPermission === 'granted') {
      initializeScanner()
    }

    return () => {
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop()
        scannerControlsRef.current = null
      }
      // scannerRef.current?.reset() // No reset method in BrowserMultiFormatReader
    }
  }, [isScanning, connectionStatus, selectedCamera, cameraPermission])

  const initializeScanner = async () => {
    if (!videoRef.current) return

    // Check camera permissions before initializing
    if (cameraPermission === 'denied') {
      toast.error('Camera access is denied. Please allow camera permissions to scan barcodes.')
      return
    }
    
    if (cameraPermission === 'requesting') {
      console.log('Camera permission is being requested, waiting...')
      return
    }

    try {
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop()
        scannerControlsRef.current = null
      }

      const reader = ensureCodeReader()

      const constraints: MediaStreamConstraints = {
        video: selectedCamera === 'environment' || selectedCamera === 'user'
          ? {
              facingMode: { ideal: selectedCamera },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      }

      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result?: Result, error?: Exception) => {
          if (result) {
            const text = result.getText()
            if (text) {
              onScanSuccess(text)
            }
          } else if (error && !(error instanceof NotFoundException)) {
            console.warn('Decode error:', error)
          }
        }
      )

      scannerControlsRef.current = controls
      console.log('Scanner initialized successfully')
    } catch (err) {
      console.error('Failed to initialize scanner:', err)
      setError('Camera access denied or not available. Please allow camera permissions and try again.')
      setIsScanning(false)
    }
  }

  const onScanSuccess = async (decodedText: string) => {
      console.log('📱 Mobile scan callback fired:', decodedText)
      
      const now = Date.now()
      const cooldownTime = settings.scanCooldown ? 1000 : 0 // 1 second cooldown if enabled (faster than before)
      const oneMinuteInMs = 60000 // 60 seconds
      
      // Check if we're already processing a scan
      if (isProcessingScanRef.current) {
        console.log('🚫 Already processing a scan, skipping...')
        return
      }
      
      // Smart duplicate prevention using ref (synchronous check)
      if (lastScanRef.current) {
        const { barcode: lastBarcode, timestamp: lastTime } = lastScanRef.current
        const timeSinceLastScan = now - lastTime
        
        // Apply cooldown if enabled
        if (cooldownTime > 0 && timeSinceLastScan < cooldownTime) {
          console.log(`🚫 Cooldown active (${Math.ceil((cooldownTime - timeSinceLastScan) / 1000)}s remaining)`)
          toast.info(`Please wait ${Math.ceil((cooldownTime - timeSinceLastScan) / 1000)}s`)
          return
        }
        
        if (lastBarcode === decodedText && timeSinceLastScan < oneMinuteInMs) {
          console.log(`🚫 Skipping duplicate scan (${Math.floor(timeSinceLastScan / 1000)}s ago):`, decodedText)
          toast.info(`Already scanned! Wait ${Math.ceil((oneMinuteInMs - timeSinceLastScan) / 1000)}s`)
          return
        }
      }
      
      // Mark as processing to prevent concurrent executions
      isProcessingScanRef.current = true
      
      // Update tracking (both ref and state)
      lastScanRef.current = { barcode: decodedText, timestamp: now }
      setLastScannedBarcode(decodedText)
      setLastScanTime(now)
      
      console.log('✅ Processing new scan:', decodedText)
      
      try {
        // Trigger haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200])
        }
        
        // Play success sound
        playSuccessSound()
        
        // Perform lookup to find matching records
        console.log('🔍 Starting lookup for barcode:', decodedText)
        let foundRows: any[] = []
      
      if (tableId) {
        try {
          // Import Supabase Direct client for instant lookup
          const { rowsSupabase } = await import('@/lib/api/rows-supabase')
          
          // Use Supabase Direct for barcode matching (instant!)
          if (resolvedColumnId && columnName) {
            try {
              console.log('🚀 Using Supabase Direct search...')
              const searchResults = await rowsSupabase.searchRows(tableId, columnName, decodedText)
              foundRows = searchResults
              console.log(`✅ Supabase search found ${foundRows.length} matching records`)
            } catch (searchError) {
              console.warn('⚠️ Supabase search failed, falling back:', searchError)
            }
          }

          if (!resolvedColumnId || foundRows.length === 0) {
            if (columnName) {
              const allRows = await rowsSupabase.getRowsByTable(tableId)
              console.log(`📊 Fetched ${allRows.length} total rows for fallback search`)
              console.log('🔍 Looking in column:', columnName)

              const matchingRows = allRows.filter((row: any) => {
                const value = row.data?.[columnName]
                const matches = value && value.toString().toLowerCase() === decodedText.toLowerCase()
                return matches
              })

              if (matchingRows.length > 0) {
                console.log(`🎯 Fallback search found ${matchingRows.length} matching records`)
                foundRows = matchingRows
              }
            }
          }
          
        } catch (error) {
          console.error('❌ Lookup failed:', error)
        }
      }
      
      // Save scan result
      const condensedRows = foundRows.map(row => ({
        id: row.id,
        data: row.data,
      }))

      // Try to get authenticated user, fallback to guest system user
      const { getCurrentUser } = await import('@/lib/supabase')
      const { GUEST_SCANNER_SYSTEM_USER_ID, getGuestScannerInfo } = await import('@/lib/activities/guest-scanner')
      const user = await getCurrentUser()
      const guestInfo = getGuestScannerInfo()
      
      // Use authenticated user ID if available, otherwise use system guest user ID
      const userId = user?.id || GUEST_SCANNER_SYSTEM_USER_ID
      
      console.log('👤 Scanner user context:', {
        authenticated: !!user,
        userId,
        guestInfo: guestInfo ? { name: guestInfo.name, email: guestInfo.email } : null
      })
      
      // Update matched rows with scan count and timestamp
      if (condensedRows.length > 0 && tableId) {
        try {
          const { rowsSupabase } = await import('@/lib/api/rows-supabase')
          
          for (const row of condensedRows) {
            if (row.id) {
              const currentScanCount = parseInt(row.data?.scan_count || '0', 10)
              const updatedData = {
                ...row.data,
                scan_count: currentScanCount + 1,
                last_scanned_at: new Date().toISOString(),
              }
              
              try {
                await rowsSupabase.updateRow(row.id, { 
                  data: updatedData,
                })
                console.log(`✅ Updated row ${row.id} scan count to ${currentScanCount + 1}`)
              } catch (updateError) {
                console.error(`Failed to update row ${row.id}:`, updateError)
              }
            }
          }
        } catch (error) {
          console.error('Error updating scan counts:', error)
        }
      }

      let persistedRecord: ScanHistoryRecord | null = null
      if (workspaceId && tableId) {
        try {
          
          const matchedRowIds = condensedRows
            .map(row => row.id)
            .filter((id): id is string => Boolean(id))

          console.log('📝 Creating scan history record...', {
            workspace_id: workspaceId,
            table_id: tableId,
            column_id: resolvedColumnId,
            column_name: columnName,
            barcode: decodedText,
            user_id: userId,
            guest_info: guestInfo
          })

          persistedRecord = await scanHistoryAPI.create({
            workspace_id: workspaceId,
            table_id: tableId,
            column_id: resolvedColumnId,
            column_name: columnName ?? columnLabel ?? undefined,
            barcode: decodedText,
            status: condensedRows.length > 0 ? 'success' : 'failure',
            matched_row_ids: matchedRowIds,
            matched_rows: condensedRows,
            source: 'mobile',
            metadata: {
              pairingCode,
              columnLabel,
              scannedBy: guestInfo?.name || userName || 'Unknown',
              scannedByEmail: guestInfo?.email || userEmail || undefined,
              deviceType: 'mobile',
              isGuest: !user // Flag to indicate guest vs authenticated scan
            },
            created_by: userId // Use authenticated user or guest system user
          })
          console.log('✅ Scan persisted to database:', persistedRecord.id)
        } catch (persistError) {
          console.error('❌ Failed to persist scan history to database:', persistError)
          console.error('❌ Error details:', {
            message: persistError instanceof Error ? persistError.message : String(persistError),
            workspaceId,
            tableId,
            barcode: decodedText
          })
          toast.error('Database save failed', {
            description: persistError instanceof Error ? persistError.message : 'Scan saved locally only',
            duration: 3000,
          })
        }
      }

      const scanResult: ScannedItem = {
        id: persistedRecord?.id ?? Date.now().toString(),
        historyId: persistedRecord?.id,
        barcode: decodedText,
        timestamp: persistedRecord ? new Date(persistedRecord.created_at) : new Date(),
        success: condensedRows.length > 0,
        status: condensedRows.length > 0 ? 'success' : 'failure',
        foundRows: condensedRows,
      }
      
      // Add to local scan history for real-time display
      setScanHistory(prev => [scanResult, ...prev.slice(0, 9)]) // Keep last 10 scans
      
      // Modern UI feedback
      const success = condensedRows.length > 0;
      
      // Trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(success ? 200 : [100, 50, 100]);
      }
      
      // Show flash overlay
      setShowFlash(success ? 'green' : 'red');
      setTimeout(() => setShowFlash(null), 500);
      
      // Set scan result for modal - this will show the check-in popup
      console.log('🎯 Setting scan result for modal:', { success, barcode: decodedText, hasRow: !!condensedRows[0] });
      setScanResult({
        found: success,
        barcode: decodedText,
        row: condensedRows[0],
      });
      
      // Auto-continue only if continuous scan is enabled AND successful
      if (settings.continuousScan && success) {
        console.log('⏱️ Continuous scan enabled - modal will auto-close in 2s');
        // Auto-close modal after 2 seconds in continuous mode
        setTimeout(() => setScanResult(null), 2000);
      }
      // Otherwise, modal stays open until user closes it manually
      
      // ============================================================================
      // PULSE MODE: Create check-in event
      // ============================================================================
      if (isPulseMode && pulseTableId && condensedRows.length > 0) {
        try {
          const matchedRow = condensedRows[0] // Use first matched row
          console.log('🟢 PULSE MODE: Creating check-in for row:', matchedRow.id)
          
          const checkInData = {
            pulse_table_id: pulseTableId,
            table_id: tableId!,
            row_id: matchedRow.id!,
            barcode_scanned: decodedText,
            scanner_user_name: guestInfo?.name || userName || 'Mobile Scanner',
            scanner_user_email: guestInfo?.email || userEmail || undefined,
            scanner_device_id: navigator.userAgent || undefined,
            row_data: matchedRow.data,
            is_walk_in: false, // Can add logic to detect walk-ins
            notes: undefined
          }
          
          const checkIn = await pulseClient.createCheckIn(checkInData)
          console.log('✅ Pulse check-in created:', checkIn.id)
          
          // Update scanner session scan count
          if (scannerSessionId) {
            try {
              await pulseClient.updateScannerSession(scannerSessionId, {
                total_scans: (scanHistory.filter(s => s.success).length + 1),
                last_scan_at: new Date().toISOString(),
              })
              console.log('📊 Scanner session updated with scan count')
            } catch (sessionError) {
              console.warn('Failed to update scanner session:', sessionError)
            }
          }
          
          // Don't show toast - the modal is the primary feedback
          
        } catch (pulseError) {
          console.error('❌ Pulse check-in failed:', pulseError)
          toast.error('Check-in failed', {
            description: pulseError instanceof Error ? pulseError.message : 'Please try again',
            duration: 3000,
          })
        }
      }
      // Note: Modal handles all visual feedback now, no need for extra toasts

      // Broadcast to desktop via Supabase real-time (non-blocking)
      if (channelRef.current) {
        // Use non-blocking fire-and-forget pattern
        channelRef.current.send({
          type: 'broadcast',
          event: 'barcode_scanned',
          payload: {
            barcode: decodedText,
            foundRows: condensedRows,
            status: scanResult.status,
            historyId: scanResult.historyId,
            timestamp: scanResult.timestamp.toISOString(),
            deviceType: 'mobile',
            tableId,
            columnName,
            columnLabel,
          }
        }).catch((err: any) => console.warn('Broadcast failed:', err));
      }
      } catch (error) {
        console.error('Error processing scan:', error)
        toast.error('Scan processing failed', {
          description: error instanceof Error ? error.message : 'Unknown error'
        })
      } finally {
        // Always reset processing flag
        isProcessingScanRef.current = false
      }
    }

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.warn('Could not play success sound:', error)
    }
  }

  const handleToggleScanning = () => {
    // Check if user has provided their info first
    if (!userName.trim()) {
      setShowUserInfoDialog(true)
      toast.info('Please enter your name to start scanning')
      return
    }
    
    if (!isScanning && cameraPermission === 'denied') {
      toast.error('Camera access is denied. Please click "Grant Access" to allow camera permissions.')
      return
    }
    
    if (!isScanning && cameraPermission === 'unknown') {
      toast.info('Checking camera permissions...')
      requestCameraPermissions()
      return
    }
    
    setIsScanning(!isScanning)
    if (!isScanning) {
      toast.info('Camera started')
    } else {
      toast.info('Camera stopped')
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop()
        scannerControlsRef.current = null
      }
      // scannerRef.current?.reset() // No reset method in BrowserMultiFormatReader
    }
  }

  const handleTestScan = () => {
    // Simulate a scan for testing
    const mockBarcodes = [
      'PROD001',
      'USER123',
      'ITEM456',
      'INVALID',
    ]
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)]
    const isValid = randomBarcode !== 'INVALID'
    
    const newItem: ScannedItem = {
      id: Date.now().toString(),
      barcode: randomBarcode,
      timestamp: new Date(),
      success: isValid,
      status: isValid ? 'success' : 'failure',
      foundRows: isValid ? [{ id: '1', data: { name: 'Sample Item', category: 'Test' } }] : []
    }
    
    setScanHistory(prev => [newItem, ...prev])
    
    if (isValid) {
      toast.success('Scan successful!', {
        description: randomBarcode,
      })
    } else {
      toast.error('Invalid format', {
        description: 'Please scan a valid barcode',
      })
    }
  }

  const handleClearHistory = () => {
    setScanHistory([])
    toast.success('History cleared')
  }
  
  const handleSaveUserInfo = () => {
    if (!userName.trim()) {
      toast.error('Please enter your name')
      return
    }
    
    // Save to localStorage for guest scanner mode
    localStorage.setItem('scanner_user_name', userName.trim())
    localStorage.setItem('scanner_user_email', userEmail.trim() || 'anonymous@guest.scanner')
    
    setShowUserInfoDialog(false)
    
    toast.success('Profile saved!', {
      description: `Scanning as ${userName}`
    })
    
    console.log('💾 Saved guest scanner info:', { name: userName.trim(), email: userEmail.trim() || 'anonymous@guest.scanner' })
    
    // Start scanning after user info is saved
    if (connectionStatus === 'connected') {
      // Request camera permission and start scanning
      if (cameraPermission === 'unknown') {
        requestCameraPermissions().then(() => {
          setIsScanning(true)
        })
      } else if (cameraPermission === 'granted') {
        setIsScanning(true)
      } else {
        // Permission denied, prompt user
        toast.error('Camera permission required', {
          description: 'Please allow camera access to start scanning',
          action: {
            label: 'Grant Access',
            onClick: () => requestCameraPermissions().then(() => setIsScanning(true))
          }
        })
      }
    }
  }

  const successCount = scanHistory.filter(item => item.success).length
  const failureCount = scanHistory.filter(item => !item.success).length

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500" />
      case 'connected':
        return <Wifi className="w-3 h-3 text-green-500" />
      case 'disconnected':
        return <WifiOff className="w-3 h-3 text-red-500" />
    }
  }

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting'
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="p-6 text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="scan-page min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <Toaster />
      
      {/* User Info Dialog */}
      <Dialog open={showUserInfoDialog} onOpenChange={setShowUserInfoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guest Scanner Access</DialogTitle>
            <DialogDescription>
              No account needed! Just enter your name so we can track who scanned each item. 
              Your info will be saved on this device.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Your Name <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mt-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveUserInfo()
                  }
                }}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Email (optional)
              </label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveUserInfo()
                  }
                }}
              />
            </div>
            
            <Button 
              onClick={handleSaveUserInfo} 
              className="w-full"
              disabled={!userName.trim()}
            >
              Start Scanning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={isOnline 
                ? "bg-green-50 text-green-700 border-green-200" 
                : "bg-gray-50 text-gray-700 border-gray-200"
              }
            >
              {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {isOnline ? 'Connected' : 'Offline'}
            </Badge>
            {pairingCode && (
              <Badge variant="secondary" className="text-xs">
                {pairingCode}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="h-8 w-8 p-0"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-600">Success</span>
              <span className="font-semibold text-green-700">{statistics.successful}</span>
            </div>
          </div>
          <div className="flex-1 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-600">Failed</span>
              <span className="font-semibold text-red-700">{statistics.total - statistics.successful}</span>
            </div>
          </div>
          <div className="flex-1 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-600">Total</span>
              <span className="font-semibold text-purple-700">{statistics.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Camera Preview Area */}
        <div className="relative mb-4 rounded-2xl overflow-hidden bg-gray-900 aspect-square shadow-lg">
          {/* Video Element for QR Scanner */}
          <video 
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ 
              display: isScanning ? 'block' : 'none'
            }}
            playsInline
            muted
          />              
          
          {/* Placeholder when not scanning */}
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-center">
                <Camera className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">Camera View</p>
              </div>
            </div>
          )}
          
          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute top-8 left-8 w-12 h-12 border-t-[3px] border-l-[3px] border-white"></div>
              <div className="absolute top-8 right-8 w-12 h-12 border-t-[3px] border-r-[3px] border-white"></div>
              <div className="absolute bottom-8 left-8 w-12 h-12 border-b-[3px] border-l-[3px] border-white"></div>
              <div className="absolute bottom-8 right-8 w-12 h-12 border-b-[3px] border-r-[3px] border-white"></div>
              
              {/* Scanning line animation */}
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-green-400 shadow-lg shadow-green-400/50 animate-pulse"></div>
            </div>
          )}
          
          {/* Status badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            {isScanning ? (
              <Badge className="bg-green-500 text-white border-0 shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                Scanning...
              </Badge>
            ) : (
              <Badge variant="secondary" className="shadow-lg">
                Camera Paused
              </Badge>
            )}
          </div>
        </div>

        {/* Camera Controls */}
        <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">Front Camera</option>
                  <option value="environment">Back Camera</option>
                  {availableCameras.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScanHistory([]);
                    toast.success('History cleared');
                  }}
                  className="shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Manual ID Entry */}
              {settings.manualEntry && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (manualIdInput.trim()) {
                    onScanSuccess(manualIdInput.trim());
                    setManualIdInput('');
                  }
                }} className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Enter Student ID manually..."
                    value={manualIdInput}
                    onChange={(e) => setManualIdInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" className="px-6">
                    Enter
                  </Button>
                </form>
              )}
              
              <Button
                onClick={handleToggleScanning}
                className="w-full"
                variant={isScanning ? "destructive" : "default"}
                size="lg"
              >
                <Camera className="w-4 h-4 mr-2" />
                {isScanning ? 'Stop Camera' : 'Start Camera'}
              </Button>
              
              {/* Scanner Options */}
              <div className="text-sm text-gray-600">Scanner options:</div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // Add walk-in handler
                  toast.info('Walk-in feature coming soon!');
                }}
              >
                Add Walk-in
              </Button>
            </div>

        {/* Most Recent Scan */}
        {scanHistory.length > 0 && (
          <Card className="mb-4">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm text-gray-600">Most Recent Scan</h2>
                <Button
                  onClick={() => setIsHistoryOpen(true)}
                  variant="ghost"
                  size="sm"
                >
                  <ChevronUp className="w-4 h-4 mr-1" />
                  View All ({scanHistory.length})
                </Button>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="shrink-0 mt-0.5">
                  {scanHistory[0].success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm break-all ${scanHistory[0].success ? 'text-gray-900' : 'text-red-600'}`}>
                    {scanHistory[0].barcode}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatTimestamp(scanHistory[0].timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Scan History Drawer */}
      <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerTitle>All Scans</DrawerTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `/scan-results?table=${tableId}&column=${columnName}`
                    window.open(url, '_blank')
                  }}
                >
                  View All Results
                </Button>
                {scanHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>
            <DrawerDescription>
              {scanHistory.length === 0 
                ? 'No scans yet' 
                : `${statistics.successful} successful, ${statistics.total - statistics.successful} failed`}
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 pb-4 overflow-hidden">
            {/* Search Input */}
            {scanHistory.length > 0 && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search scans..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}
            
            {scanHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ScanLine className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No scans yet</p>
                <p className="text-xs mt-1">Scanned items will appear here automatically</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No results found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(85vh-240px)]">
                <div className="space-y-1 pr-4">
                  {filteredHistory.map((item, index) => (
                    <div key={item.id}>
                      <div className="flex items-start gap-3 py-3">
                        <div className="shrink-0 mt-0.5">
                          {item.success ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm break-all ${item.success ? 'text-gray-900' : 'text-red-600'}`}>
                            {item.barcode}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatTimestamp(item.timestamp)}
                          </p>
                        </div>
                      </div>
                      {index < scanHistory.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Scanner Settings</DialogTitle>
            <DialogDescription>
              Configure your scanner preferences and view statistics
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="settings" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-6 mt-4">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto px-6">
              <TabsContent value="settings" className="space-y-4 mt-4 pb-6">
                {/* Flash Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Flashlight className="w-4 h-4 text-gray-600" />
                      <Label htmlFor="flash-toggle" className="cursor-pointer font-medium">Flash/Torch</Label>
                    </div>
                    <p className="text-xs text-gray-500">Enable camera flash for low-light scanning</p>
                  </div>
                  <Switch
                    id="flash-toggle"
                    checked={settings.flashEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, flashEnabled: checked }))}
                  />
                </div>

                {/* Continuous Scan Mode */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ScanLine className="w-4 h-4 text-gray-600" />
                      <Label htmlFor="continuous-toggle" className="cursor-pointer font-medium">Continuous Scan Mode</Label>
                    </div>
                    <p className="text-xs text-gray-500">Automatically scan multiple IDs without closing results</p>
                  </div>
                  <Switch
                    id="continuous-toggle"
                    checked={settings.continuousScan}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, continuousScan: checked }))}
                  />
                </div>

                {/* Scan Cooldown */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-gray-600" />
                      <Label htmlFor="cooldown-toggle" className="cursor-pointer font-medium">Scan Cooldown (2s)</Label>
                    </div>
                    <p className="text-xs text-gray-500">Prevent accidental duplicate scans</p>
                  </div>
                  <Switch
                    id="cooldown-toggle"
                    checked={settings.scanCooldown}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, scanCooldown: checked }))}
                  />
                </div>

                {/* Manual Entry */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus className="w-4 h-4 text-gray-600" />
                      <Label htmlFor="manual-toggle" className="cursor-pointer font-medium">Manual ID Entry</Label>
                    </div>
                    <p className="text-xs text-gray-500">Allow keyboard input if barcode won't scan</p>
                  </div>
                  <Switch
                    id="manual-toggle"
                    checked={settings.manualEntry}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, manualEntry: checked }))}
                  />
                </div>

                {/* Network Status */}
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-green-600" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-gray-600" />
                    )}
                    <Label className="font-medium">Network Status</Label>
                  </div>
                  <p className="text-xs text-gray-600">
                    {isOnline 
                      ? 'Connected - Data will sync automatically' 
                      : 'Offline - Scans saved locally and will sync when connection is restored'}
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="statistics" className="space-y-4 mt-4 pb-6">
                {/* Statistics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Total Scans</span>
                    </div>
                    <p className="text-2xl font-bold">{statistics.total}</p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-gray-600">Successful</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{statistics.successful}</p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-gray-600">RSVP Check-ins</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{statistics.rsvps}</p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="w-4 h-4 text-orange-600" />
                      <span className="text-xs text-gray-600">Walk-ins</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{statistics.walkIns}</p>
                  </Card>
                </div>

                {/* Recent Activity */}
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">Recent Activity</h4>
                  {scanHistory.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No activity yet</p>
                  ) : (
                    <div className="space-y-2">
                      {scanHistory.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-start gap-2 text-xs">
                          {item.success ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{item.barcode}</p>
                            <p className="text-gray-500">{formatTimestamp(item.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Success Rate */}
                {statistics.total > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Success Rate</h4>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${(statistics.successful / statistics.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {Math.round((statistics.successful / statistics.total) * 100)}% successful ({statistics.successful}/{statistics.total})
                    </p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* Scan Result Modal */}
      <Dialog open={scanResult !== null} onOpenChange={(open) => {
        if (!open) {
          setScanResult(null);
          setShowWalkInForm(false);
        }
      }}>
        <DialogContent className="p-0 max-w-sm border-0 bg-transparent shadow-none overflow-visible">
          <AnimatePresence mode="wait">
            {scanResult && (
              <motion.div
                key="scan-result"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {scanResult.found ? (
                  /* RSVP Confirmed - Green */
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-green-500 text-white px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6" />
                        <span className="font-semibold">RSVP CONFIRMED</span>
                      </div>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        
                        {/* Display main name/title */}
                        {(() => {
                          const displayColumns = pulseConfig?.display_columns || [];
                          const rowData = scanResult.row?.data || {};
                          
                          // Get first field as main title
                          if (displayColumns.length > 0) {
                            const firstColumn = tableInfo?.columns?.find((c: any) => c.id === displayColumns[0]);
                            const firstValue = firstColumn ? rowData[firstColumn.name] : null;
                            if (firstValue) {
                              return <h3 className="text-xl font-semibold mb-1">{firstValue}</h3>;
                            }
                          }
                          
                          // Fallback to name field
                          return <h3 className="text-xl font-semibold mb-1">{rowData.name || rowData.Name || 'Student'}</h3>;
                        })()}
                        
                        {/* Barcode/ID */}
                        <p className="text-gray-500 text-sm font-mono">{scanResult.barcode}</p>
                      </div>
                      
                      {/* Attendee Information Card */}
                      {(() => {
                        const displayColumns = pulseConfig?.display_columns || [];
                        const walkinFields = pulseConfig?.settings?.walkin_fields || [];
                        const rowData = scanResult.row?.data || {};
                        
                        // Use display_columns or walkin_fields, whichever is configured
                        const fieldsToShow = displayColumns.length > 0 ? displayColumns : walkinFields;
                        
                        if (fieldsToShow.length === 0) {
                          // Fallback to default fields if nothing configured
                          return (
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2.5 text-left">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Attendee Information
                              </h4>
                              {rowData.role && (
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 font-medium">Role:</div>
                                  <div className="text-sm font-medium text-gray-900 break-words">{rowData.role}</div>
                                </div>
                              )}
                              {rowData.email && (
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 font-medium">Email:</div>
                                  <div className="text-sm font-medium text-gray-900 break-words">{rowData.email}</div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        return (
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2.5 text-left">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Attendee Information
                            </h4>
                            {fieldsToShow.map((columnId: string) => {
                              const column = tableInfo?.columns?.find((c: any) => c.id === columnId);
                              if (!column) return null;
                              
                              const value = rowData[column.name];
                              if (!value) return null;
                              
                              return (
                                <div key={columnId} className="space-y-1">
                                  <div className="text-xs text-gray-500 font-medium">
                                    {column.label || column.name}:
                                  </div>
                                  <div className="text-sm font-medium text-gray-900 break-words whitespace-normal">
                                    {typeof value === 'object' ? JSON.stringify(value) : value}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      
                      <div className="bg-green-50 rounded-lg px-4 py-3 border border-green-200">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">
                            Checked in at {new Date().toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => setScanResult(null)}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Continue Scanning
                      </Button>
                    </div>
                  </div>
                ) : showWalkInForm ? (
                  /* Walk-In Form - Blue */
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-6 h-6" />
                        <span className="font-semibold">ADD WALK-IN</span>
                      </div>
                      <button onClick={() => { setShowWalkInForm(false); setScanResult(null); }}>
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      
                      if (!isPulseMode || !pulseTableId || !tableId) {
                        toast.error('Walk-ins are only available in Pulse mode');
                        return;
                      }
                      
                      try {
                        // 1. Create new row in data table with walk-in data
                        console.log('📝 Creating walk-in row in table:', tableId);
                        const { rowsSupabase } = await import('@/lib/api/rows-supabase');
                        
                        // Build row data based on table columns
                        const rowData: Record<string, any> = {};
                        
                        // Use selected walk-in fields from Pulse config
                        const selectedFields = pulseConfig?.settings?.walkin_fields || [];
                        
                        if (selectedFields.length > 0 && tableInfo?.columns) {
                          // Use configured fields
                          selectedFields.forEach((fieldId: string) => {
                            const column = tableInfo.columns.find(c => c.id === fieldId);
                            if (column && walkInForm[fieldId]) {
                              rowData[column.name] = walkInForm[fieldId];
                            }
                          });
                        } else if (tableInfo?.columns) {
                          // Fallback to automatic mapping
                          const nameCol = tableInfo.columns.find(c => 
                            c.name.toLowerCase().includes('name') || c.label?.toLowerCase().includes('name')
                          );
                          const emailCol = tableInfo.columns.find(c => 
                            c.name.toLowerCase().includes('email') || c.label?.toLowerCase().includes('email')
                          );
                          const idCol = tableInfo.columns.find(c => 
                            c.id === resolvedColumnId || 
                            c.name.toLowerCase().includes('id') || 
                            c.label?.toLowerCase().includes('id')
                          );
                          
                          if (nameCol?.id && walkInForm[nameCol.id]) rowData[nameCol.name] = walkInForm[nameCol.id];
                          if (emailCol?.id && walkInForm[emailCol.id]) rowData[emailCol.name] = walkInForm[emailCol.id];
                          if (idCol?.id && walkInForm[idCol.id]) rowData[idCol.name] = walkInForm[idCol.id];
                        }
                        
                        console.log('📝 Creating row with data:', {
                          tableId,
                          rowData,
                          created_by: userName || 'Walk-in Scanner'
                        });
                        
                        // Get current user ID from Supabase auth
                        const { data: { user } } = await supabase.auth.getUser();
                        let userId = user?.id;
                        
                        // For guest scanners without auth, use the table's created_by as fallback
                        if (!userId && tableInfo) {
                          userId = tableInfo.created_by;
                          console.log('📱 Guest scanner: Using table creator as created_by:', userId);
                        }
                        
                        if (!userId) {
                          throw new Error('Unable to determine creator. Please ensure the scanner is properly configured.');
                        }
                        
                        const newRow = await rowsSupabase.createRow({
                          table_id: tableId,
                          data: rowData,
                        });
                        
                        console.log('✅ Walk-in row created:', newRow.id);
                        
                        // 2. Create check-in record
                        if (!newRow.id) {
                          throw new Error('Failed to create walk-in row: no ID returned');
                        }
                        
                        // Find the barcode/ID field value for check-in
                        let barcodeValue = 'WALK-IN';
                        const walkinFields = pulseConfig?.settings?.walkin_fields || [];
                        
                        if (walkinFields.length > 0 && tableInfo?.columns) {
                          // Try to find an ID-like field in the selected fields
                          const idField = walkinFields.find((fieldId: string) => {
                            const column = tableInfo.columns.find(c => c.id === fieldId);
                            return column && (
                              column.id === resolvedColumnId ||
                              column.name.toLowerCase().includes('id') ||
                              column.label?.toLowerCase().includes('id') ||
                              column.name.toLowerCase().includes('barcode') ||
                              column.label?.toLowerCase().includes('barcode')
                            );
                          });
                          
                          if (idField && walkInForm[idField]) {
                            barcodeValue = walkInForm[idField];
                          }
                        } else if (resolvedColumnId && walkInForm[resolvedColumnId]) {
                          // Use the configured barcode column if available
                          barcodeValue = walkInForm[resolvedColumnId];
                        }
                        
                        // Fallback: use timestamp-based ID if no valid barcode field found
                        if (barcodeValue === 'WALK-IN' || !barcodeValue) {
                          barcodeValue = `WALK-IN-${Date.now()}`;
                        }
                        
                        const checkInData = {
                          pulse_table_id: pulseTableId,
                          table_id: tableId,
                          row_id: newRow.id,
                          barcode_scanned: barcodeValue,
                          scanner_user_name: userName || 'Mobile Scanner',
                          scanner_user_email: userEmail || undefined,
                          scanner_device_id: navigator.userAgent || undefined,
                          row_data: rowData,
                          is_walk_in: true,
                          notes: 'Walk-in guest',
                        };
                        
                        const checkIn = await pulseClient.createCheckIn(checkInData);
                        console.log('✅ Walk-in check-in created:', checkIn.id);
                        
                        // 3. Update scanner session (non-blocking, don't fail if this errors)
                        if (scannerSessionId) {
                          try {
                            await pulseClient.updateScannerSession(scannerSessionId, {
                              total_scans: (scanHistory.filter(s => s.success).length + 1),
                              last_scan_at: new Date().toISOString(),
                            });
                          } catch (sessionError) {
                            console.warn('⚠️ Failed to update scanner session (non-critical):', sessionError);
                          }
                        }
                        
                        // 4. Close walk-in form and show success result
                        setShowWalkInForm(false);
                        setWalkInForm({});
                        
                        // Show success modal with walk-in data
                        setScanResult({
                          found: true,
                          barcode: barcodeValue,
                          row: { id: newRow.id, data: rowData },
                        });
                        
                        // Show flash
                        setShowFlash('green');
                        setTimeout(() => setShowFlash(null), 500);
                        
                        // Trigger haptic feedback
                        if ('vibrate' in navigator) {
                          navigator.vibrate(200);
                        }
                        
                        // Auto-close after 3 seconds if continuous scan enabled
                        if (settings.continuousScan) {
                          setTimeout(() => setScanResult(null), 3000);
                        }
                        
                      } catch (error) {
                        console.error('❌ Failed to add walk-in:', error);
                        toast.error('Failed to add walk-in', {
                          description: error instanceof Error ? error.message : 'Please try again',
                        });
                      }
                    }} className="p-6 space-y-4">
                      {/* Dynamic form fields based on Pulse config */}
                      {(() => {
                        const selectedFields = pulseConfig?.settings?.walkin_fields || [];
                        
                        // If no fields configured, show default fields
                        if (selectedFields.length === 0 || !tableInfo?.columns) {
                          const nameCol = tableInfo?.columns.find(c => 
                            c.name.toLowerCase().includes('name') || c.label?.toLowerCase().includes('name')
                          );
                          const emailCol = tableInfo?.columns.find(c => 
                            c.name.toLowerCase().includes('email') || c.label?.toLowerCase().includes('email')
                          );
                          const idCol = tableInfo?.columns.find(c => 
                            c.id === resolvedColumnId || 
                            c.name.toLowerCase().includes('id') || 
                            c.label?.toLowerCase().includes('id')
                          );
                          
                          const defaultFields = [nameCol, emailCol, idCol].filter(Boolean);
                          
                          return defaultFields.map((col: any) => (
                            <div key={col.id} className="space-y-2">
                              <Label htmlFor={col.id}>{col.label || col.name}</Label>
                              <Input
                                id={col.id}
                                type={col.column_type === 'email' ? 'email' : 'text'}
                                placeholder={`Enter ${(col.label || col.name).toLowerCase()}`}
                                value={walkInForm[col.id] || ''}
                                onChange={(e) => setWalkInForm(prev => ({ ...prev, [col.id]: e.target.value }))}
                                required
                              />
                            </div>
                          ));
                        }
                        
                        // Render configured fields
                        return selectedFields.map((fieldId: string) => {
                          const column = tableInfo?.columns.find(c => c.id === fieldId);
                          if (!column || !column.id) return null;
                          
                          const inputType = 
                            column.column_type === 'email' ? 'email' :
                            column.column_type === 'phone' ? 'tel' :
                            column.column_type === 'url' ? 'url' :
                            column.column_type === 'number' ? 'number' :
                            'text';
                          
                          const colId = column.id;
                          
                          return (
                            <div key={colId} className="space-y-2">
                              <Label htmlFor={colId}>{column.label || column.name}</Label>
                              <Input
                                id={colId}
                                type={inputType}
                                placeholder={`Enter ${(column.label || column.name).toLowerCase()}`}
                                value={walkInForm[colId] || ''}
                                onChange={(e) => setWalkInForm(prev => ({ ...prev, [colId]: e.target.value }))}
                                required
                              />
                            </div>
                          );
                        });
                      })()}
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          type="submit"
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          Add Walk-In
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setShowWalkInForm(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  /* Not on RSVP List - Red */
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-red-500 text-white px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-6 h-6" />
                        <span className="font-semibold">NOT ON RSVP LIST</span>
                      </div>
                      <button onClick={() => setScanResult(null)}>
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <XCircle className="w-10 h-10 text-red-600" />
                        </div>
                        
                        <h3 className="text-xl font-semibold mb-2">ID: {scanResult.barcode}</h3>
                        <p className="text-gray-500 text-sm">No matching record</p>
                      </div>
                      
                      <Button
                        onClick={() => {
                          // Pre-populate the barcode/ID field with the scanned value
                          const selectedFields = pulseConfig?.settings?.walkin_fields || [];
                          let barcodeFieldId: string | null = null;
                          
                          if (selectedFields.length > 0 && tableInfo?.columns) {
                            // Find the ID/barcode field in selected fields
                            barcodeFieldId = selectedFields.find((fieldId: string) => {
                              const column = tableInfo.columns.find(c => c.id === fieldId);
                              return column && (
                                column.id === resolvedColumnId ||
                                column.name.toLowerCase().includes('id') ||
                                column.label?.toLowerCase().includes('id') ||
                                column.name.toLowerCase().includes('barcode') ||
                                column.label?.toLowerCase().includes('barcode')
                              );
                            }) || null;
                          } else if (resolvedColumnId) {
                            // Use the configured barcode column
                            barcodeFieldId = resolvedColumnId;
                          }
                          
                          // Pre-fill the form with the scanned barcode
                          if (barcodeFieldId) {
                            setWalkInForm({ [barcodeFieldId]: scanResult.barcode });
                          } else {
                            setWalkInForm({});
                          }
                          
                          setShowWalkInForm(true);
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add as Walk-In
                      </Button>
                      
                      <Button
                        onClick={() => setScanResult(null)}
                        variant="outline"
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Flash Overlay */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-50 pointer-events-none ${
              showFlash === 'green' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading scanner...</p>
        </div>
      </div>
    }>
      <ScanPageContent />
    </Suspense>
  )
}