"use client";

import { useState, useEffect } from "react";
import { historyClient } from "@/lib/api/history-client";
import { FieldChange } from "@/types/field-registry";
import { cn } from "@/lib/utils";
import { Button } from "@/ui-components/button";
import { Badge } from "@/ui-components/badge";
import { ScrollArea } from "@/ui-components/scroll-area";
import { Loader2, Plus, Minus, RefreshCw, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

interface VersionDiffProps {
  tableId: string;
  rowId: string;
  version1: number;
  version2: number;
  onClose?: () => void;
}

export function VersionDiff({
  tableId,
  rowId,
  version1,
  version2,
  onClose,
}: VersionDiffProps) {
  const [loading, setLoading] = useState(true);
  const [diffs, setDiffs] = useState<FieldChange[]>([]);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDiff();
  }, [tableId, rowId, version1, version2]);

  const loadDiff = async () => {
    setLoading(true);
    try {
      const response = await historyClient.compareVersions(tableId, rowId, version1, version2);
      setDiffs(response.field_diffs || []);
    } catch (error) {
      console.error("Failed to load diff:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (fieldName: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldName)) {
      newExpanded.delete(fieldName);
    } else {
      newExpanded.add(fieldName);
    }
    setExpandedFields(newExpanded);
  };

  const getChangeIcon = (action: string) => {
    switch (action) {
      case "add":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "remove":
        return <Minus className="w-4 h-4 text-red-600" />;
      case "update":
        return <RefreshCw className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getChangeBadge = (action: string) => {
    switch (action) {
      case "add":
        return <Badge className="bg-green-100 text-green-800 text-xs">Added</Badge>;
      case "remove":
        return <Badge className="bg-red-100 text-red-800 text-xs">Removed</Badge>;
      case "update":
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Changed</Badge>;
      default:
        return null;
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const isComplexValue = (value: any): boolean => {
    return typeof value === "object" && value !== null;
  };

  const renderValue = (value: any, type: "old" | "new") => {
    const formatted = formatValue(value);
    const isComplex = isComplexValue(value);
    const colorClass = type === "old" 
      ? "bg-red-50 text-red-800 border-red-200" 
      : "bg-green-50 text-green-800 border-green-200";

    if (isComplex && typeof value === "object") {
      return (
        <pre className={cn(
          "p-2 rounded-md text-xs font-mono border overflow-x-auto max-w-full",
          colorClass
        )}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return (
      <span className={cn(
        "px-2 py-1 rounded text-sm",
        colorClass
      )}>
        {type === "old" ? "- " : "+ "}{formatted}
      </span>
    );
  };

  const renderArrayDiff = (oldVal: any[], newVal: any[], fieldName: string) => {
    const oldSet = new Set(oldVal?.map(v => JSON.stringify(v)) || []);
    const newSet = new Set(newVal?.map(v => JSON.stringify(v)) || []);
    
    const removed = oldVal?.filter(v => !newSet.has(JSON.stringify(v))) || [];
    const added = newVal?.filter(v => !oldSet.has(JSON.stringify(v))) || [];
    
    return (
      <div className="space-y-1 mt-2">
        {removed.map((item, idx) => (
          <div key={`removed-${idx}`} className="flex items-start gap-2 text-sm">
            <Minus className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">
              {typeof item === "object" ? JSON.stringify(item) : item}
            </span>
          </div>
        ))}
        {added.map((item, idx) => (
          <div key={`added-${idx}`} className="flex items-start gap-2 text-sm">
            <Plus className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded">
              {typeof item === "object" ? JSON.stringify(item) : item}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No changes between these versions
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">Changes</span>
            <span className="text-gray-400">
              v{version1}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">
              v{version2}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {diffs.length} field{diffs.length !== 1 ? "s" : ""} changed
          </Badge>
        </div>
      </div>

      {/* Diff List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {diffs.map((diff, idx) => {
            const isExpanded = expandedFields.has(diff.field_name);
            const hasComplexValues = isComplexValue(diff.old_value) || isComplexValue(diff.new_value);
            const isArrayChange = Array.isArray(diff.old_value) || Array.isArray(diff.new_value);

            return (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Field Header */}
                <div
                  className={cn(
                    "px-4 py-3 bg-gray-50 flex items-center justify-between",
                    hasComplexValues && "cursor-pointer hover:bg-gray-100"
                  )}
                  onClick={() => hasComplexValues && toggleExpand(diff.field_name)}
                >
                  <div className="flex items-center gap-3">
                    {getChangeIcon(diff.change_action)}
                    <div>
                      <span className="font-medium text-gray-900">
                        {diff.field_label || diff.field_name}
                      </span>
                      {diff.nested_path && diff.nested_path.length > 0 && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({diff.nested_path.join(" → ")})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getChangeBadge(diff.change_action)}
                    {hasComplexValues && (
                      isExpanded 
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Value Changes */}
                <div className="px-4 py-3 space-y-2">
                  {diff.change_action === "add" && (
                    <div className="flex items-start gap-2">
                      <Plus className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      {renderValue(diff.new_value, "new")}
                    </div>
                  )}

                  {diff.change_action === "remove" && (
                    <div className="flex items-start gap-2">
                      <Minus className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
                      {renderValue(diff.old_value, "old")}
                    </div>
                  )}

                  {diff.change_action === "update" && (
                    <>
                      {isArrayChange ? (
                        renderArrayDiff(
                          diff.old_value as any[],
                          diff.new_value as any[],
                          diff.field_name
                        )
                      ) : hasComplexValues && !isExpanded ? (
                        <div className="text-sm text-gray-500">
                          Click to expand changes
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <Minus className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
                            {renderValue(diff.old_value, "old")}
                          </div>
                          <div className="flex items-start gap-2">
                            <Plus className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            {renderValue(diff.new_value, "new")}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Inline diff for simple text changes
export function InlineTextDiff({ oldText, newText }: { oldText: string; newText: string }) {
  // Simple word-level diff
  const oldWords = (oldText || "").split(/\s+/);
  const newWords = (newText || "").split(/\s+/);
  
  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);
  
  return (
    <div className="font-mono text-sm">
      {newWords.map((word, idx) => {
        const isAdded = !oldSet.has(word);
        return (
          <span
            key={idx}
            className={cn(
              "mr-1",
              isAdded && "bg-green-100 text-green-800 px-0.5 rounded"
            )}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
