import { useEffect, useRef, useCallback, useState } from 'react'

type TableUpdateCallback = (data: any) => void

interface UseTableRealtimeReturn {
  send: (data: any) => void
  isConnected: () => boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export function useTableRealtime(
  tableId: string, 
  onUpdate: TableUpdateCallback
): UseTableRealtimeReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')

  console.log('useTableRealtime: Hook initialized', { tableId, connectionStatus })

  const connect = useCallback(() => {
    if (!tableId) {
      console.log('useTableRealtime: No tableId provided, skipping WebSocket connection')
      return
    }

    // WebSocket disabled - using Supabase Realtime instead
    // The Go backend doesn't have WebSocket support yet
    console.log('WebSocket disabled - using Supabase Realtime for table:', tableId)
    setConnectionStatus('disconnected')
    return

    /* WebSocket code disabled - uncomment when Go backend supports WebSocket
    // Convert HTTP API URL to WebSocket URL
    const apiUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'https://api.maticsapp.com/api/v1'
    // For local development, construct WebSocket URL properly
    let wsUrl: string
    if (apiUrl.includes('localhost')) {
      // For localhost, construct WebSocket URL directly
      wsUrl = `ws://localhost:8080/api/v1/ws/tables/${tableId}`
    } else {
      // For production, replace https with wss and keep the domain
      const baseUrl = apiUrl.replace('/api/v1', '').replace(/^https?/, 'wss')
      wsUrl = `${baseUrl}/api/v1/ws/tables/${tableId}`
    }
    
    console.log('Connecting to WebSocket:', wsUrl)
    console.log('Original API URL:', apiUrl)
    
    setConnectionStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log(`Connected to table ${tableId} WebSocket`)
        console.log('WebSocket connection status: CONNECTED')
        setConnectionStatus('connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Received update:', data)
          onUpdate(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          onUpdate(event.data)
        }
      }

      ws.onclose = (event) => {
        console.log(`WebSocket closed for table ${tableId}:`, event.code, event.reason)
        wsRef.current = null
        
        // Normal closure or WebSocket not supported - show as disconnected (not error)
        if (event.code === 1000 || event.code === 1006) {
          setConnectionStatus('disconnected')
        } else if (event.code === 403) {
          console.warn('WebSocket connection forbidden (403). Using Supabase Realtime instead.')
          setConnectionStatus('disconnected') // Don't show as error - Supabase Realtime handles updates
        } else {
          // Unexpected closure - mark as error and try to reconnect
          setConnectionStatus('error')
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...')
            connect()
          }, 5000)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error (this is expected on Render free tier):', error)
        // Don't set to error - fall back to Supabase Realtime
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionStatus('error')
    }
    */
  }, [tableId, onUpdate])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000) // Normal closure
      }
    }
  }, [connect])

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending update:', data)
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not connected, cannot send:', data)
    }
  }, [])

  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN
  }, [])

  return { send, isConnected, connectionStatus }
}