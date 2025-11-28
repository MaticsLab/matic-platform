"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, Users, UserCheck, TrendingUp, Clock, Smartphone, Settings as SettingsIcon, QrCode, Loader2, ArrowLeft, CheckCircle2, XCircle, X, ChevronRight, UserPlus, Scan, User, AlertTriangle } from "lucide-react";
import { Button } from "@/ui-components/button";
import { Card } from "@/ui-components/card";
import { pulseClient, PulseDashboardStats, PulseEnabledTable, PulseScannerSession } from "@/lib/api/pulse-client";
import { PulseQRPairingModal } from "@/components/Pulse/PulseQRPairingModal";
import { PulseSettingsModal } from "@/components/Pulse/PulseSettingsModal";
import { supabase } from "@/lib/supabase";
import { tablesSupabase } from "@/lib/api/tables-supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function PulseDashboard() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;

  const [config, setConfig] = useState<PulseEnabledTable | null>(null);
  const [stats, setStats] = useState<PulseDashboardStats | null>(null);
  const [sessions, setSessions] = useState<PulseScannerSession[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [checkInPopup, setCheckInPopup] = useState<any | null>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState<any | null>(null);
  const [activeScanners, setActiveScanners] = useState<any[]>([]);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    loadDashboard();
  }, [tableId]);

  // Separate effect for real-time channel setup after config is loaded
  useEffect(() => {
    if (config?.id) {
      setupRealtimeChannel();
      setupPresenceChannel();
    }

    return () => {
      // Cleanup real-time channel on unmount
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [config?.id, tableId]);

  const setupRealtimeChannel = async () => {
    if (!config?.id) return;

    // Remove existing channel if any
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
    }

    try {
      console.log('🔴 Setting up real-time channel for table:', tableId);
      
      const channel = supabase
        .channel(`pulse_${tableId}_${Date.now()}`) // Unique channel name
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'pulse_check_ins',
            filter: `table_id=eq.${tableId}`
          },
          (payload) => {
            console.log('🔴 Real-time check-in received:', payload);
            
            // Reload stats and sessions immediately
            loadStats();
            loadSessions();
            
            // Show popup notification if enabled
            const checkIn = payload.new as any;
            if (config?.settings?.show_popup) {
              setCheckInPopup({
                name: checkIn.row_data?.name || checkIn.scanner_user_name || 'Guest',
                email: checkIn.row_data?.email || '',
                barcode: checkIn.barcode_scanned,
                timestamp: new Date(),
                isWalkIn: checkIn.is_walk_in || false,
              });
              
              // Auto-close after 5 seconds
              setTimeout(() => {
                setCheckInPopup(null);
              }, 5000);
            }
            
            // Show toast notification
            toast.success('New Check-in!', {
              description: `${checkIn.scanner_user_name || 'Guest'} • ${checkIn.barcode_scanned}`,
              duration: 3000,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pulse_check_ins',
            filter: `table_id=eq.${tableId}`
          },
          (payload) => {
            console.log('🔴 Check-in updated:', payload);
            loadStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pulse_scanner_sessions',
            filter: `pulse_table_id=eq.${config.id}`
          },
          (payload) => {
            console.log('📱 Scanner session update:', payload);
            // Reload sessions immediately
            loadSessions();
          }
        )
        .subscribe((status) => {
          console.log('📡 Pulse real-time status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time updates active for table:', tableId);
            toast.success('Real-time updates active', { duration: 2000 });
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Real-time channel error');
            toast.error('Real-time updates failed, using polling', { duration: 3000 });
            // Fallback to polling
            const interval = setInterval(() => {
              loadStats();
              loadSessions();
            }, 3000); // Poll every 3 seconds
            return () => clearInterval(interval);
          }
        });

      channelRef.current = channel;
    } catch (error) {
      console.error('Failed to setup real-time channel:', error);
      toast.error('Real-time updates failed, using polling');
      // Fallback to polling if real-time fails
      const interval = setInterval(() => {
        loadStats();
        loadSessions();
      }, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  };

  const setupPresenceChannel = async () => {
    if (!config?.id) return;

    // Remove existing presence channel if any
    if (presenceChannelRef.current) {
      await supabase.removeChannel(presenceChannelRef.current);
    }

    try {
      const channelName = `pulse_scanners_${config.id}`;
      console.log('👥 Setting up presence channel:', channelName);
      
      const presenceChannel = supabase.channel(channelName, {
        config: {
          presence: {
            key: 'dashboard', // Dashboard is just listening, not participating
          },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          console.log('👥 Presence state synced:', state);
          
          // Extract active scanners from presence state
          const scanners = Object.entries(state).flatMap(([key, presences]: [string, any]) => 
            presences.map((presence: any) => ({
              pairing_code: presence.pairing_code,
              scanner_name: presence.scanner_name,
              scanner_email: presence.scanner_email,
              device_id: presence.device_id,
              total_scans: presence.total_scans || 0,
              joined_at: presence.joined_at,
              is_active: true,
            }))
          );
          
          console.log('📱 Active scanners from presence:', scanners);
          setActiveScanners(scanners);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('👋 Scanner joined:', key, newPresences);
          toast.success('Scanner connected', {
            description: `${newPresences[0]?.scanner_name} is now scanning`,
            duration: 2000,
          });
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('👋 Scanner left:', key, leftPresences);
          toast.info('Scanner disconnected', {
            description: `${leftPresences[0]?.scanner_name} has left`,
            duration: 2000,
          });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Presence channel subscribed');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Presence channel error');
          }
        });

      presenceChannelRef.current = presenceChannel;
    } catch (error) {
      console.error('Failed to setup presence channel:', error);
    }
  };

  const loadDashboard = async () => {
    try {
      await Promise.all([
        loadConfig(),
        loadStats(),
        loadSessions(),
        loadColumns(),
      ]);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      console.log('🔍 Loading Pulse config for table:', tableId);
      const data = await pulseClient.getPulseConfig(tableId);
      console.log('✅ Pulse config loaded:', data);
      setConfig(data);
    } catch (error: any) {
      console.error('❌ Failed to load Pulse config:', error);
      throw error; // Re-throw to trigger error state
    }
  };

  const loadStats = async () => {
    const data = await pulseClient.getDashboardStats(tableId, 10);
    setStats(data);
  };

  const loadSessions = async () => {
    try {
      console.log('📱 Loading scanner sessions for table:', tableId);
      console.log('📱 Requesting active sessions only: true');
      const data = await pulseClient.getScannerSessions(tableId, true);
      console.log('📱 Scanner sessions loaded:', {
        count: data.length,
        sessions: data,
        activeOnly: true
      });
      setSessions(data);
    } catch (error) {
      console.error('❌ Failed to load scanner sessions:', error);
      // Don't throw, just log - this prevents dashboard from breaking
      setSessions([]);
    }
  };

  const loadColumns = async () => {
    try {
      const table = await tablesSupabase.getTableById(tableId);
      if (table?.columns) {
        setColumns(table.columns);
      }
    } catch (error) {
      console.error("Error loading columns:", error);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!config || !stats) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pulse Not Found</h2>
          <p className="text-gray-600 mb-2">This table doesn't have Pulse enabled.</p>
          <p className="text-sm text-gray-500 mb-4">
            Table ID: <code className="bg-gray-100 px-2 py-1 rounded">{tableId}</code>
          </p>
          <p className="text-sm text-gray-500 mb-4">
            If you just enabled Pulse, try refreshing the page or go back to the table and click "Pulse Dashboard" again.
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Table
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Pulse Dashboard</h1>
                  <p className="text-sm text-gray-600">Real-time event check-in</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSettings(!showSettings)}
                className="gap-2"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={() => setShowQRModal(true)}
              >
                <QrCode className="h-4 w-4" />
                Pair Scanner
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Stats Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total RSVPs */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total RSVPs</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stats.total_rsvps}
                    </p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </Card>

              {/* Checked In */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Checked In</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      {stats.checked_in_count}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </Card>

              {/* Check-in Rate */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Check-in Rate</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                      {stats.check_in_rate}%
                    </p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </Card>

              {/* Walk-ins */}
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Walk-ins</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">
                      {stats.walk_in_count}
                    </p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Check-ins */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Check-ins</h3>
                <span className="text-sm text-gray-500">
                  Last updated: {formatTime(stats.last_check_in_at)}
                </span>
              </div>
              
              {stats.recent_check_ins.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No check-ins yet</p>
                  <p className="text-sm text-gray-400 mt-1">Check-ins will appear here in real-time</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recent_check_ins.map((checkIn) => {
                    // Get display name from row data
                    const rowData = checkIn.row_data || {};
                    const displayName = rowData.name || rowData.Name || 
                                       rowData.full_name || rowData['Full Name'] ||
                                       checkIn.barcode_scanned;
                    const displayEmail = rowData.email || rowData.Email || '';
                    const displayRole = rowData.role || rowData.Role || rowData.program || rowData.Program || '';
                    
                    return (
                      <div
                        key={checkIn.id}
                        onClick={() => setSelectedCheckIn(checkIn)}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-2 rounded-full ${checkIn.is_walk_in ? 'bg-orange-100' : 'bg-green-100'}`}>
                            <UserCheck className={`h-4 w-4 ${checkIn.is_walk_in ? 'text-orange-600' : 'text-green-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 truncate">
                                {displayName}
                              </p>
                              {checkIn.is_walk_in && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  Walk-in
                                </span>
                              )}
                            </div>
                            {displayEmail && (
                              <p className="text-sm text-gray-500 truncate">
                                {displayEmail}
                              </p>
                            )}
                            {displayRole && (
                              <p className="text-xs text-gray-400 truncate">
                                {displayRole}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-700">
                              {formatTime(checkIn.check_in_time)}
                            </p>
                            {checkIn.check_in_count > 1 && (
                              <p className="text-xs text-orange-600">
                                {checkIn.check_in_count}x scanned
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Active Scanners & Settings */}
          <div className="space-y-6">
            {/* Active Scanners */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Scanners</h3>
              
              <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Smartphone className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    {activeScanners.length} Active
                  </p>
                  <p className="text-xs text-green-700">Connected now</p>
                </div>
              </div>

              {activeScanners.length === 0 ? (
                <div className="text-center py-6">
                  <Smartphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No active scanners</p>
                  <p className="text-xs text-gray-400 mt-1">Pair a mobile device to start</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeScanners.map((scanner) => {
                    const joinedTime = scanner.joined_at ? new Date(scanner.joined_at) : null;
                    
                    return (
                      <div
                        key={scanner.pairing_code}
                        className="p-4 rounded-lg border-2 bg-green-50 border-green-200 shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 text-sm truncate">
                                {scanner.scanner_name}
                              </p>
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs font-medium text-green-700">Live</span>
                              </div>
                            </div>
                            {scanner.scanner_email && (
                              <p className="text-xs text-gray-600 truncate">{scanner.scanner_email}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-200">
                            <span className="text-gray-600 font-medium">Pairing Code:</span>
                            <span className="font-mono font-semibold text-blue-600">{scanner.pairing_code}</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-gray-600">
                            <span>Total Scans:</span>
                            <span className="font-semibold text-gray-900">{scanner.total_scans || 0}</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-gray-600">
                            <span>Connected:</span>
                            <span className="font-medium text-gray-700">
                              {formatTime(scanner.joined_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Quick Settings */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Settings</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Show Popup</span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    config.settings.show_popup ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {config.settings.show_popup ? 'On' : 'Off'}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Play Sound</span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    config.settings.play_sound ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {config.settings.play_sound ? 'On' : 'Off'}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Duplicate Scans</span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    config.settings.allow_duplicate_scans ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {config.settings.allow_duplicate_scans ? 'Allowed' : 'Blocked'}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Scan Mode</span>
                  <div className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                    {config.settings.scan_mode}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Guest Scanning</span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    config.settings.guest_scanning_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {config.settings.guest_scanning_enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Configure Settings
              </Button>
            </Card>
          </div>
        </div>
      </div>

      {/* QR Pairing Modal */}
      {config && (
        <PulseQRPairingModal
          open={showQRModal}
          onOpenChange={setShowQRModal}
          tableId={tableId}
          pulseTableId={config.id}
        />
      )}

      {/* Settings Modal */}
      {config && (
        <PulseSettingsModal
          open={showSettings}
          onOpenChange={setShowSettings}
          tableId={tableId}
          currentConfig={config}
          columns={columns}
          onSaved={() => {
            loadConfig(); // Reload config to show updated settings
            toast.success("Settings updated successfully!");
          }}
        />
      )}

      {/* Check-in Popup Notification */}
      <AnimatePresence>
        {checkInPopup && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-4 right-4 z-50 max-w-sm w-full"
          >
            <Card className={`p-4 shadow-2xl border-2 ${
              checkInPopup.isWalkIn 
                ? 'border-orange-500 bg-orange-50' 
                : 'border-green-500 bg-green-50'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  checkInPopup.isWalkIn 
                    ? 'bg-orange-100' 
                    : 'bg-green-100'
                }`}>
                  {checkInPopup.isWalkIn ? (
                    <Users className={`h-6 w-6 ${
                      checkInPopup.isWalkIn 
                        ? 'text-orange-600' 
                        : 'text-green-600'
                    }`} />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-bold text-lg ${
                      checkInPopup.isWalkIn 
                        ? 'text-orange-900' 
                        : 'text-green-900'
                    }`}>
                      {checkInPopup.isWalkIn ? 'Walk-in Added!' : 'Checked In!'}
                    </h4>
                    <button
                      onClick={() => setCheckInPopup(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-gray-900 font-medium mb-1">
                    {checkInPopup.name}
                  </p>
                  {checkInPopup.email && (
                    <p className="text-sm text-gray-600 mb-1">
                      {checkInPopup.email}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500 font-mono">
                      ID: {checkInPopup.barcode}
                    </p>
                    <p className="text-xs text-gray-400">
                      {checkInPopup.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Modal for Check-in Details */}
      <AnimatePresence>
        {selectedCheckIn && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCheckIn(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Side Modal */}
            <motion.div
              initial={{ x: 500, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 500, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-2 top-2 bottom-2 w-[500px] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Check-in Details</h2>
                <button
                  onClick={() => setSelectedCheckIn(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Walk-in Badge */}
                {selectedCheckIn.is_walk_in && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-medium">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Walk-in Guest
                  </div>
                )}

                {/* Check-in Metadata */}
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Clock className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Checked in:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {new Date(selectedCheckIn.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-sm">
                    <Scan className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Barcode:</span>
                    <span className="ml-2 font-mono text-gray-900 font-medium">
                      {selectedCheckIn.barcode_scanned}
                    </span>
                  </div>

                  {selectedCheckIn.scanner_user_name && (
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">Scanned by:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedCheckIn.scanner_user_name}
                      </span>
                    </div>
                  )}

                  {selectedCheckIn.duplicate_count > 1 && (
                    <div className="flex items-center text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                      <span className="text-amber-700 font-medium">
                        Scanned {selectedCheckIn.duplicate_count} times
                      </span>
                    </div>
                  )}
                </div>

                {/* Row Data */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                    Attendee Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {selectedCheckIn.row_data && Object.entries(selectedCheckIn.row_data).map(([key, value]) => {
                      // Skip internal fields
                      if (key.startsWith('_') || !value) return null;
                      
                      return (
                        <div key={key} className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-gray-900 break-words">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setSelectedCheckIn(null)}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
