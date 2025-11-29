"use client";

import { useState, useEffect } from "react";
import { historyClient } from "@/lib/api/history-client";
import { RowVersion, FieldChange } from "@/types/field-registry";
import { cn } from "@/lib/utils";
import { Button } from "@/ui-components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui-components/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui-components/alert-dialog";
import { Badge } from "@/ui-components/badge";
import { ScrollArea } from "@/ui-components/scroll-area";
import { Separator } from "@/ui-components/separator";
import { Loader2, History, RotateCcw, Eye, Bot, User, GitCompare } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { VersionDiff } from "./VersionDiff";

interface HistoryPanelProps {
  tableId: string;
  rowId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore?: (versionNumber: number) => void;
}

export function HistoryPanel({
  tableId,
  rowId,
  isOpen,
  onClose,
  onRestore,
}: HistoryPanelProps) {
  const [versions, setVersions] = useState<RowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<RowVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [compareVersion, setCompareVersion] = useState<{v1: number, v2: number} | null>(null);

  useEffect(() => {
    if (isOpen && rowId) {
      loadHistory();
    }
  }, [isOpen, rowId, tableId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await historyClient.getRowHistory(tableId, rowId, {
        redactPII: true,
        limit: 50,
      });
      setVersions(response.versions || []);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    setRestoring(true);
    try {
      await historyClient.restoreVersion(tableId, rowId, versionNumber, "Manual restore from history panel");
      onRestore?.(versionNumber);
      await loadHistory();
    } catch (error) {
      console.error("Failed to restore version:", error);
    } finally {
      setRestoring(false);
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case "create":
        return "bg-green-100 text-green-800";
      case "update":
        return "bg-blue-100 text-blue-800";
      case "restore":
        return "bg-purple-100 text-purple-800";
      case "ai_edit":
        return "bg-yellow-100 text-yellow-800";
      case "approval":
        return "bg-cyan-100 text-cyan-800";
      case "bulk":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case "create":
        return "Created";
      case "update":
        return "Updated";
      case "restore":
        return "Restored";
      case "ai_edit":
        return "AI Edit";
      case "approval":
        return "Approved";
      case "bulk":
        return "Bulk Update";
      default:
        return type;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
          <SheetDescription>
            View all changes made to this row and restore previous versions.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No version history available
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={cn(
                    "relative border rounded-lg p-4 hover:bg-accent/50 transition-colors",
                    selectedVersion?.id === version.id && "border-primary bg-accent"
                  )}
                >
                  {/* Version timeline connector */}
                  {index < versions.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border -mb-4 h-8" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {version.ai_assisted ? (
                        <Bot className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">v{version.version_number}</span>
                        <Badge className={cn("text-xs", getChangeTypeColor(version.change_type))}>
                          {getChangeTypeLabel(version.change_type)}
                        </Badge>
                        {version.ai_assisted && (
                          <Badge variant="outline" className="text-xs">
                            AI Assisted
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">
                        {version.change_summary || version.change_reason || "No description"}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span title={format(new Date(version.changed_at), "PPpp")}>
                          {formatDistanceToNow(new Date(version.changed_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedVersion(version)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>

                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCompareVersion({
                              v1: version.version_number,
                              v2: versions[0].version_number // Compare with latest
                            })}
                          >
                            <GitCompare className="h-3.5 w-3.5 mr-1" />
                            Compare
                          </Button>
                        )}

                        {index > 0 && ( // Can't restore to current version
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={restoring}>
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Restore
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Restore to Version {version.version_number}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will create a new version with the data from version{" "}
                                  {version.version_number}. The current data will be preserved in
                                  history.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRestore(version.version_number)}
                                  disabled={restoring}
                                >
                                  {restoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  Restore
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Version Detail Panel */}
        {selectedVersion && (
          <VersionDetailPanel
            version={selectedVersion}
            onClose={() => setSelectedVersion(null)}
          />
        )}

        {/* Version Comparison Panel */}
        {compareVersion && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
            <div className="fixed inset-4 bg-background border rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <GitCompare className="h-5 w-5" />
                  Comparing Version {compareVersion.v1} → {compareVersion.v2}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setCompareVersion(null)}>
                  Close
                </Button>
              </div>
              <div className="p-4 h-[calc(100%-60px)] overflow-auto">
                <VersionDiff
                  tableId={tableId}
                  rowId={rowId}
                  version1={compareVersion.v1}
                  version2={compareVersion.v2}
                />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface VersionDetailPanelProps {
  version: RowVersion;
  onClose: () => void;
}

function VersionDetailPanel({ version, onClose }: VersionDetailPanelProps) {
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, fetch detailed changes
    // For now, just show the snapshot
    setLoading(false);
  }, [version]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed right-0 top-0 h-full w-[500px] bg-background border-l shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Version {version.version_number} Details</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Snapshot Data</h4>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[300px]">
                {JSON.stringify(version.data, null, 2)}
              </pre>
            </div>

            {version.change_reason && (
              <div>
                <h4 className="text-sm font-medium mb-2">Change Reason</h4>
                <p className="text-sm text-muted-foreground">{version.change_reason}</p>
              </div>
            )}

            {version.ai_confidence !== undefined && version.ai_confidence !== null && (
              <div>
                <h4 className="text-sm font-medium mb-2">AI Confidence</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${(version.ai_confidence || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {((version.ai_confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export a button trigger for easy integration
export function HistoryButton({
  tableId,
  rowId,
  onRestore,
}: {
  tableId: string;
  rowId: string;
  onRestore?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        title="View version history"
      >
        <History className="h-4 w-4" />
      </Button>
      <HistoryPanel
        tableId={tableId}
        rowId={rowId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onRestore={(version) => {
          onRestore?.();
          setIsOpen(false);
        }}
      />
    </>
  );
}
