"use client";

import { useState, useEffect } from "react";
import { activityClient, ActivityItem } from "@/lib/api/history-client";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui-components/badge";
import { Button } from "@/ui-components/button";
import { ScrollArea } from "@/ui-components/scroll-area";
import { Skeleton } from "@/ui-components/skeleton";
import {
  Loader2,
  Activity,
  Plus,
  Edit,
  Bot,
  RotateCcw,
  FileText,
  User,
  Clock,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ActivityFeedProps {
  workspaceId: string;
  limit?: number;
  compact?: boolean;
  onRowClick?: (tableId: string, rowId: string) => void;
  className?: string;
}

export function ActivityFeed({
  workspaceId,
  limit = 50,
  compact = false,
  onRowClick,
  className,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [workspaceId, limit]);

  const loadActivities = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await activityClient.getWorkspaceActivity(workspaceId, limit);
      setActivities(response.activities || []);
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getActivityIcon = (type: string, aiAssisted?: boolean) => {
    if (aiAssisted) {
      return <Bot className="w-4 h-4 text-yellow-600" />;
    }
    switch (type) {
      case "row_created":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "row_updated":
        return <Edit className="w-4 h-4 text-blue-600" />;
      case "row_restored":
        return <RotateCcw className="w-4 h-4 text-purple-600" />;
      case "ai_suggestion":
        return <Bot className="w-4 h-4 text-yellow-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBadge = (type: string, aiAssisted?: boolean) => {
    if (aiAssisted) {
      return (
        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
          AI Assisted
        </Badge>
      );
    }
    switch (type) {
      case "row_created":
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            Created
          </Badge>
        );
      case "row_updated":
        return (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            Updated
          </Badge>
        );
      case "row_restored":
        return (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            Restored
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <Activity className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-muted-foreground">No activity yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Activity will appear here when changes are made
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Recent Activity</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadActivities(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Activity List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                "flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => {
                if (onRowClick && activity.entity_type === "row") {
                  // We'd need table_id in the activity - for now just log
                  console.log("Row clicked:", activity.entity_id);
                }
              }}
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                {getActivityIcon(activity.type, activity.details?.ai_assisted)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActivityBadge(activity.type, activity.details?.ai_assisted)}
                  {activity.details?.version_number && (
                    <span className="text-xs text-muted-foreground">
                      v{activity.details.version_number}
                    </span>
                  )}
                </div>

                <p className={cn(
                  "mt-1 text-sm",
                  compact ? "line-clamp-1" : "line-clamp-2"
                )}>
                  {activity.summary || "No description"}
                </p>

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1" title={format(new Date(activity.timestamp), "PPpp")}>
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                  {activity.changed_by && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {activity.changed_by.name || "User"}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              {onRowClick && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Compact widget version for sidebar/dashboard
export function ActivityWidget({
  workspaceId,
  limit = 5,
  onViewAll,
}: {
  workspaceId: string;
  limit?: number;
  onViewAll?: () => void;
}) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [workspaceId]);

  const loadActivities = async () => {
    try {
      const response = await activityClient.getWorkspaceActivity(workspaceId, limit);
      setActivities(response.activities || []);
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Activity
        </h3>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all
          </Button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No recent activity
        </div>
      ) : (
        <div className="divide-y">
          {activities.map((activity) => (
            <div key={activity.id} className="p-3 flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                {activity.details?.ai_assisted ? (
                  <Bot className="w-3 h-3 text-yellow-600" />
                ) : activity.type === "row_created" ? (
                  <Plus className="w-3 h-3 text-green-600" />
                ) : (
                  <Edit className="w-3 h-3 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {activity.summary || activity.type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
