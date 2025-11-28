"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Settings, Plus, LayoutDashboard, User, ClipboardList, CheckSquare, BarChart3 } from "lucide-react";
import { Button } from "@/ui-components/button";
import { Badge } from "@/ui-components/badge";
import { 
  getRequestHub, 
  getRequestHubBySlug,
  type RequestHubWithTabs,
  type RequestHubTab 
} from "@/lib/api/request-hubs-client";
import { DashboardMetrics } from "./DashboardMetrics";
import { RequestList } from "./RequestList";
import { DynamicForm } from "./DynamicForm";
import { ApprovalQueue } from "./ApprovalQueue";
import { RequestsByTypeChart, StatusDistributionChart, RequestTrendsChart } from "./RequestsChart";
import { SettingsPage } from "./SettingsPage";
import { useTabContext } from "@/components/WorkspaceTabProvider";
import type { Request, RequestUser, RequestDetail, FormTemplate, WorkflowTemplate, ApprovalAction } from "@/types/request";

interface RequestHubViewerProps {
  hub?: RequestHubWithTabs;
  hubId?: string;
  hubSlug?: string;
  workspaceId: string;
  onBack?: () => void;
  onHubUpdate?: () => void;
}

// Tab icon mapping
const getTabIcon = (type: string) => {
  switch (type) {
    case 'dashboard': return LayoutDashboard;
    case 'my-requests': return User;
    case 'new-request': return Plus;
    case 'approvals': return CheckSquare;
    case 'all-requests': return ClipboardList;
    case 'analytics': return BarChart3;
    default: return ClipboardList;
  }
};

export function RequestHubViewer({
  hub: initialHub,
  hubId,
  hubSlug,
  workspaceId,
  onBack,
  onHubUpdate,
}: RequestHubViewerProps) {
  const { setTabActions, setTabHeaderContent } = useTabContext();
  const [hub, setHub] = useState<RequestHubWithTabs | null>(initialHub || null);
  const [loading, setLoading] = useState(!initialHub);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditingTabs, setIsEditingTabs] = useState(false);

  useEffect(() => {
    if (!initialHub && (hubId || hubSlug)) {
      loadHub();
    } else if (initialHub) {
      setHub(initialHub);
      if (initialHub.tabs && initialHub.tabs.length > 0) {
        setActiveTabId(initialHub.tabs[0].id);
      }
    }
  }, [hubId, hubSlug, workspaceId, initialHub]);

  // Register tab header content
  useEffect(() => {
    if (hub) {
      const activeTab = hub.tabs?.find((tab) => tab.id === activeTabId);
      setTabHeaderContent({
        title: hub.name,
        subModule: activeTab?.name,
      });
    }
    return () => setTabHeaderContent(null);
  }, [hub, activeTabId, setTabHeaderContent]);

  // Register tab actions
  useEffect(() => {
    if (hub) {
      setTabActions([
        {
          label: 'Configure',
          icon: Settings,
          onClick: () => setShowSettings(true),
          variant: 'outline' as const
        }
      ]);
    }
    return () => setTabActions([]);
  }, [hub, setTabActions]);

  const loadHub = async () => {
    try {
      setLoading(true);
      let data: RequestHubWithTabs;

      if (hubId) {
        data = await getRequestHub(workspaceId, hubId);
      } else if (hubSlug) {
        data = await getRequestHubBySlug(workspaceId, hubSlug);
      } else {
        throw new Error("Either hubId or hubSlug is required");
      }

      setHub(data);
      // Set first tab as active
      if (data.tabs && data.tabs.length > 0) {
        setActiveTabId(data.tabs[0].id);
      }
    } catch (error) {
      console.error("Failed to load request hub:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeTab = hub?.tabs?.find((tab) => tab.id === activeTabId);

  const handleSaveSettings = async (settings: any) => {
    console.log("Saving settings:", settings);
    // TODO: Implement API call to save settings
    alert("Settings saved!");
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading hub...</p>
        </div>
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Hub Not Found
          </h3>
          <p className="text-gray-600 mb-4">
            The requested hub could not be found.
          </p>
          {onBack && (
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hubs
            </Button>
          )}
        </div>
      </div>
    );
  }

  // If showing settings, render settings view instead
  if (showSettings) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gray-50">
        <SettingsView
          hub={hub!}
          onBack={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Tab Navigation */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Hub Status */}
        <div className="p-4 border-b border-gray-100">
          <Badge variant={hub.is_active ? "default" : "secondary"} className="w-full justify-center">
            {hub.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Tab Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">Navigation</div>
          <div className="space-y-1">
            {hub.tabs
              ?.sort((a, b) => a.position - b.position)
              .filter((tab) => tab.is_visible)
              .map((tab) => {
                const IconComponent = getTabIcon(tab.type);
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      activeTabId === tab.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{tab.name}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Bottom Actions */}
        {isEditingTabs && (
          <div className="p-3 border-t border-gray-100">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
              onClick={() => console.log('Add new tab')}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Tab
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white border-l border-gray-200">
        {activeTab ? (
          <TabContent tab={activeTab} hub={hub} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p>No tab selected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// New Settings View Component (Full Page)
function SettingsView({
  hub,
  onBack,
  onSave,
}: {
  hub: RequestHubWithTabs;
  onBack: () => void;
  onSave: (settings: any) => Promise<void>;
}) {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Settings Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Hub
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Configure {hub.name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage settings, request types, workflows, and permissions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <SettingsPage
            onClose={onBack}
            onSave={onSave}
            initialSettings={hub.settings}
          />
        </div>
      </div>
    </div>
  );
}

// Tab Content Renderer
function TabContent({ tab, hub }: { tab: RequestHubTab; hub: RequestHubWithTabs }) {
  switch (tab.type) {
    case "dashboard":
      return <DashboardTabContent tab={tab} hub={hub} />;
    case "my-requests":
      return <MyRequestsTabContent tab={tab} hub={hub} />;
    case "new-request":
      return <NewRequestTabContent tab={tab} hub={hub} />;
    case "approvals":
      return <ApprovalsTabContent tab={tab} hub={hub} />;
    case "all-requests":
      return <AllRequestsTabContent tab={tab} hub={hub} />;
    case "analytics":
      return <AnalyticsTabContent tab={tab} hub={hub} />;
    case "custom":
      return <CustomTabContent tab={tab} hub={hub} />;
    default:
      return (
        <div className="p-6">
          <div className="text-center text-gray-500">
            <p>Unknown tab type: {tab.type}</p>
          </div>
        </div>
      );
  }
}

// Tab Content Components
function DashboardTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  // Mock data - will be replaced with real API calls
  const mockMetrics = {
    totalRequests: 0,
    pendingApprovals: 0,
    averageApprovalTime: 0,
    approvalRate: 0,
  };

  const mockRequests: Request[] = [];
  const mockUsers: RequestUser[] = [];
  const mockRequestDetails: RequestDetail[] = [];

  return (
    <div className="p-6 space-y-6">
      {/* Metrics */}
      <DashboardMetrics {...mockMetrics} />

      {/* Recent Requests */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Requests
          </h3>
        </div>
        <div className="p-6">
          {mockRequests.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No recent requests</p>
              <p className="text-sm mt-2">
                Requests will appear here once they're submitted
              </p>
            </div>
          ) : (
            <RequestList
              requests={mockRequests.slice(0, 5)}
              users={mockUsers}
              requestDetails={mockRequestDetails}
              currentUserId="current-user-id"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MyRequestsTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  // Mock data - will be replaced with real API calls filtered by current user
  const mockRequests: Request[] = [];
  const mockUsers: RequestUser[] = [];
  const mockRequestDetails: RequestDetail[] = [];

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">My Requests</h3>
          <p className="text-sm text-gray-600 mt-1">
            View and track your submitted requests
          </p>
        </div>
        <div className="p-6">
          <RequestList
            requests={mockRequests}
            users={mockUsers}
            requestDetails={mockRequestDetails}
            currentUserId="current-user-id"
          />
        </div>
      </div>
    </div>
  );
}

function NewRequestTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  // Mock form template - will be loaded from tab.config.form_table_id
  const mockFormTemplate: FormTemplate = {
    id: "form-1",
    hub_id: hub.id,
    request_type: "general_request",
    name: "General Request Form",
    description: "Submit a general request",
    fields: [
      {
        id: "f1",
        name: "title",
        label: "Request Title",
        type: "text",
        required: true,
        placeholder: "Enter a brief title",
      },
      {
        id: "f2",
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
        placeholder: "Provide detailed information",
      },
      {
        id: "f3",
        name: "priority",
        label: "Priority",
        type: "select",
        required: true,
        options: ["low", "medium", "high"],
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleSubmit = async (data: Record<string, any>, isDraft: boolean) => {
    console.log("Form submitted:", { data, isDraft });
    alert(`Form ${isDraft ? "saved as draft" : "submitted"}!`);
    // TODO: Implement actual API call to create request
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <DynamicForm formTemplate={mockFormTemplate} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}

function ApprovalsTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  // Mock data - will be replaced with real API calls
  const mockCurrentUser: RequestUser = {
    id: "user-1",
    name: "Current User",
    email: "user@example.com",
    role: "supervisor",
    department: "Operations",
  };

  const mockRequests: Request[] = [];
  const mockUsers: RequestUser[] = [mockCurrentUser];
  const mockRequestDetails: RequestDetail[] = [];
  const mockFormTemplates: FormTemplate[] = [];
  const mockWorkflowTemplates: WorkflowTemplate[] = [];

  const handleApprovalAction = async (
    requestId: string,
    action: ApprovalAction,
    comments?: string
  ) => {
    console.log("Approval action:", { requestId, action, comments });
    alert(`Request ${action}d successfully!`);
    // TODO: Implement actual API call
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Approval Queue
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Review and approve pending requests
          </p>
        </div>
        <div className="p-6">
          <ApprovalQueue
            requests={mockRequests}
            currentUser={mockCurrentUser}
            users={mockUsers}
            requestDetails={mockRequestDetails}
            formTemplates={mockFormTemplates}
            workflowTemplates={mockWorkflowTemplates}
            onApprovalAction={handleApprovalAction}
          />
        </div>
      </div>
    </div>
  );
}

function AllRequestsTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  // Mock data - will be replaced with real API calls
  const mockRequests: Request[] = [];
  const mockUsers: RequestUser[] = [];
  const mockRequestDetails: RequestDetail[] = [];

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              All Requests
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              View all requests across the organization
            </p>
          </div>
          <div className="flex gap-2">
            {/* TODO: Add filter and sort options */}
          </div>
        </div>
        <div className="p-6">
          <RequestList
            requests={mockRequests}
            users={mockUsers}
            requestDetails={mockRequestDetails}
            currentUserId="current-user-id"
          />
        </div>
      </div>
    </div>
  );
}

function AnalyticsTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  // Mock data - will be replaced with real API calls
  const mockByType = [
    { request_type: "budget_request", count: 0 },
    { request_type: "supply_request", count: 0 },
    { request_type: "time_off", count: 0 },
  ];

  const mockByStatus = [
    { status: "Draft", count: 0 },
    { status: "Submitted", count: 0 },
    { status: "Under Review", count: 0 },
    { status: "Approved", count: 0 },
    { status: "Denied", count: 0 },
    { status: "Completed", count: 0 },
  ];

  const mockTrends = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    count: 0,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
          <p className="text-sm text-gray-600 mt-1">
            View charts and insights for your requests
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RequestsByTypeChart data={mockByType} />
        <StatusDistributionChart data={mockByStatus} />
      </div>

      <RequestTrendsChart data={mockTrends} />

      {/* Empty state when no data */}
      {mockByType.every((d) => d.count === 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            No data available yet. Charts will appear once requests are
            submitted.
          </p>
        </div>
      )}
    </div>
  );
}

function CustomTabContent({
  tab,
  hub,
}: {
  tab: RequestHubTab;
  hub: RequestHubWithTabs;
}) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {tab.name}
        </h3>
        <p className="text-gray-600 mb-4">Custom tab content</p>
        <p className="text-sm text-gray-500">Coming soon</p>
      </div>
    </div>
  );
}
