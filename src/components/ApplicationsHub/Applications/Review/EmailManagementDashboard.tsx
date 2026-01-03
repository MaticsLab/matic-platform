'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, BarChart3, TrendingUp, AlertCircle, CheckCircle2, 
  Clock, Send, Eye, MousePointerClick, XCircle, Loader2,
  Filter, Search, Calendar, Tag, FileText, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { emailClient, EmailTemplate, SentEmail, EmailAnalytics, EmailServiceHealth, EmailCampaign } from '@/lib/api/email-client';
import { Button } from '@/ui-components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui-components/dialog';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';

interface EmailManagementDashboardProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  formId?: string;
}

type DashboardTab = 'overview' | 'templates' | 'history' | 'campaigns' | 'health';

export function EmailManagementDashboard({
  open,
  onClose,
  workspaceId,
  formId
}: EmailManagementDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [analytics, setAnalytics] = useState<EmailAnalytics | null>(null);
  const [serviceHealth, setServiceHealth] = useState<EmailServiceHealth[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailHistory, setEmailHistory] = useState<SentEmail[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open && workspaceId) {
      loadDashboardData();
    }
  }, [open, workspaceId, formId, dateRange]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Load all data in parallel
      const [analyticsData, healthData, templatesData, historyData, campaignsData] = await Promise.all([
        emailClient.getAnalytics(workspaceId, formId, dateRange).catch(() => null),
        emailClient.listServiceHealth(workspaceId).catch(() => []),
        emailClient.getTemplates(workspaceId, formId).catch(() => []),
        emailClient.getHistory(workspaceId, formId).catch(() => []),
        emailClient.getCampaigns(workspaceId, formId).catch(() => []),
      ]);

      setAnalytics(analyticsData);
      setServiceHealth(healthData || []);
      setTemplates(templatesData || []);
      setEmailHistory(historyData || []);
      setCampaigns(campaignsData || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = emailHistory.filter(email => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(query) ||
      email.recipient_email?.toLowerCase().includes(query) ||
      email.recipient_name?.toLowerCase().includes(query)
    );
  });

  const filteredTemplates = templates.filter(template => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      template.name?.toLowerCase().includes(query) ||
      template.subject?.toLowerCase().includes(query) ||
      template.category?.toLowerCase().includes(query)
    );
  });

  const getHealthStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4" />;
      case 'down':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <DialogTitle>Email Management Dashboard</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-1">
            {(['overview', 'templates', 'history', 'campaigns', 'health'] as DashboardTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading dashboard...</span>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard
                      title="Total Sent"
                      value={analytics?.total_sent || 0}
                      icon={<Send className="w-5 h-5" />}
                      color="blue"
                    />
                    <MetricCard
                      title="Delivery Rate"
                      value={`${((analytics?.delivery_rate || 0) * 100).toFixed(1)}%`}
                      icon={<CheckCircle2 className="w-5 h-5" />}
                      color="green"
                    />
                    <MetricCard
                      title="Open Rate"
                      value={`${((analytics?.open_rate || 0) * 100).toFixed(1)}%`}
                      icon={<Eye className="w-5 h-5" />}
                      color="purple"
                    />
                    <MetricCard
                      title="Click Rate"
                      value={`${((analytics?.click_rate || 0) * 100).toFixed(1)}%`}
                      icon={<MousePointerClick className="w-5 h-5" />}
                      color="orange"
                    />
                  </div>

                  {/* Service Health Summary */}
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Service Health</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {serviceHealth.map((health) => (
                        <div
                          key={health.id}
                          className={cn(
                            "p-4 rounded-lg border",
                            getHealthStatusColor(health.status)
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium capitalize">{health.service_type}</div>
                              <div className="text-sm opacity-75 mt-1">
                                {health.last_checked_at
                                  ? new Date(health.last_checked_at).toLocaleString()
                                  : 'Never checked'}
                              </div>
                            </div>
                            <div className={cn("flex items-center gap-2", getHealthStatusColor(health.status))}>
                              {getStatusIcon(health.status)}
                              <span className="capitalize">{health.status}</span>
                            </div>
                          </div>
                          {health.error_message && (
                            <div className="mt-2 text-xs opacity-75">{health.error_message}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Recent Emails</h3>
                    <div className="space-y-2">
                      {emailHistory.slice(0, 5).map((email) => (
                        <div key={email.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{email.subject}</div>
                            <div className="text-sm text-gray-500">
                              {email.recipient_email} • {new Date(email.sent_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs",
                              email.status === 'sent' ? "bg-green-100 text-green-700" :
                              email.status === 'delivered' ? "bg-blue-100 text-blue-700" :
                              email.status === 'failed' ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-700"
                            )}>
                              {email.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Templates Tab */}
              {activeTab === 'templates' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                      <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold">{template.name}</h4>
                            {template.category && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                                {template.category}
                              </span>
                            )}
                          </div>
                          {template.usage_count > 0 && (
                            <span className="text-xs text-gray-500">
                              {template.usage_count} uses
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">{template.subject}</div>
                        <div className="text-xs text-gray-500">
                          Last used: {template.last_used_at 
                            ? new Date(template.last_used_at).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredTemplates.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      {searchQuery ? 'No templates found matching your search.' : 'No templates available.'}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search email history..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredHistory.map((email) => (
                            <tr key={email.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium">{email.recipient_name || email.recipient_email}</div>
                                <div className="text-xs text-gray-500">{email.recipient_email}</div>
                              </td>
                              <td className="px-4 py-3 text-sm">{email.subject}</td>
                              <td className="px-4 py-3">
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">
                                  {email.service_type || 'gmail'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded capitalize",
                                  email.status === 'sent' || email.status === 'delivered' 
                                    ? "bg-green-100 text-green-700" 
                                    : email.status === 'failed'
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                                )}>
                                  {email.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {new Date(email.sent_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {filteredHistory.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      {searchQuery ? 'No emails found matching your search.' : 'No email history available.'}
                    </div>
                  )}
                </div>
              )}

              {/* Campaigns Tab */}
              {activeTab === 'campaigns' && (
                <div className="space-y-4">
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {campaigns.map((campaign) => (
                            <tr key={campaign.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium">{campaign.name || 'Untitled Campaign'}</div>
                                <div className="text-xs text-gray-500">{campaign.subject}</div>
                              </td>
                              <td className="px-4 py-3 text-sm">{campaign.recipient_count || 0}</td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded capitalize",
                                  campaign.status === 'sent' 
                                    ? "bg-green-100 text-green-700" 
                                    : campaign.status === 'scheduled'
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                                )}>
                                  {campaign.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {new Date(campaign.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {campaigns.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      No campaigns found.
                    </div>
                  )}
                </div>
              )}

              {/* Health Tab */}
              {activeTab === 'health' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {serviceHealth.map((health) => (
                      <div
                        key={health.id}
                        className={cn(
                          "p-6 rounded-lg border-2",
                          health.status === 'healthy' ? "border-green-200 bg-green-50" :
                          health.status === 'degraded' ? "border-yellow-200 bg-yellow-50" :
                          "border-red-200 bg-red-50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold capitalize">{health.service_type}</h3>
                          <div className={cn("flex items-center gap-2 px-3 py-1 rounded", getHealthStatusColor(health.status))}>
                            {getStatusIcon(health.status)}
                            <span className="capitalize font-medium">{health.status}</span>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-600">Last checked:</span>{' '}
                            <span className="font-medium">
                              {health.last_checked_at
                                ? new Date(health.last_checked_at).toLocaleString()
                                : 'Never'}
                            </span>
                          </div>
                          {health.error_message && (
                            <div className="mt-3 p-3 bg-white rounded border">
                              <div className="text-xs font-medium text-red-600 mb-1">Error:</div>
                              <div className="text-xs text-gray-700">{health.error_message}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {serviceHealth.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      No service health data available.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ title, value, icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={cn("p-2 rounded", colorClasses[color])}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

