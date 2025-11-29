"use client";

import { useState, useEffect } from "react";
import { aiSuggestionsClient } from "@/lib/api/history-client";
import { AIFieldSuggestion } from "@/types/field-registry";
import { cn } from "@/lib/utils";
import { Button } from "@/ui-components/button";
import { Badge } from "@/ui-components/badge";
import { ScrollArea } from "@/ui-components/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui-components/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/popover";
import {
  Loader2,
  Lightbulb,
  Check,
  X,
  AlertCircle,
  SpellCheck,
  Type,
  Shield,
  Bot,
} from "lucide-react";

interface AISuggestionsPanelProps {
  tableId: string;
  minConfidence?: number;
  onApply?: (suggestion: AIFieldSuggestion) => void;
}

export function AISuggestionsPanel({
  tableId,
  minConfidence = 0.7,
  onApply,
}: AISuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<AIFieldSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, [tableId, minConfidence]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await aiSuggestionsClient.getTableSuggestions(tableId, {
        minConfidence,
        status: "pending",
        limit: 20,
      });
      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error("Failed to load suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (suggestion: AIFieldSuggestion) => {
    setApplying(suggestion.id);
    try {
      await aiSuggestionsClient.applySuggestion(suggestion.id, true, "Applied from suggestions panel");
      onApply?.(suggestion);
      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (error) {
      console.error("Failed to apply suggestion:", error);
    } finally {
      setApplying(null);
    }
  };

  const handleDismiss = async (suggestionId: string) => {
    try {
      await aiSuggestionsClient.dismissSuggestion(suggestionId);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    } catch (error) {
      console.error("Failed to dismiss suggestion:", error);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "typo_correction":
        return <SpellCheck className="h-4 w-4 text-blue-500" />;
      case "format_fix":
        return <Type className="h-4 w-4 text-purple-500" />;
      case "value_completion":
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case "validation_warning":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "pii_detected":
        return <Shield className="h-4 w-4 text-red-500" />;
      default:
        return <Bot className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSuggestionLabel = (type: string) => {
    switch (type) {
      case "typo_correction":
        return "Typo Fix";
      case "format_fix":
        return "Format Fix";
      case "value_completion":
        return "Auto-Complete";
      case "validation_warning":
        return "Warning";
      case "pii_detected":
        return "PII Detected";
      default:
        return "Suggestion";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No AI suggestions at this time</p>
        <p className="text-sm mt-1">AI is continuously analyzing your data</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">
          {suggestions.length} suggestion{suggestions.length !== 1 && "s"}
        </span>
        <Button variant="ghost" size="sm" onClick={loadSuggestions}>
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="overflow-hidden">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSuggestionIcon(suggestion.suggestion_type)}
                    <CardTitle className="text-sm">
                      {getSuggestionLabel(suggestion.suggestion_type)}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(suggestion.confidence * 100).toFixed(0)}% confident
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4 pt-0">
                <div className="space-y-2">
                  {/* Show current vs suggested */}
                  {suggestion.current_value !== undefined && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {JSON.stringify(suggestion.current_value)}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-green-600">
                        {JSON.stringify(suggestion.suggested_value)}
                      </span>
                    </div>
                  )}

                  {suggestion.reasoning && (
                    <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleApply(suggestion)}
                      disabled={applying === suggestion.id}
                    >
                      {applying === suggestion.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(suggestion.id)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Compact inline suggestion for individual cells
export function InlineSuggestion({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: AIFieldSuggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded",
            "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors",
            "border border-yellow-200"
          )}
        >
          <Lightbulb className="h-3 w-3" />
          AI Suggestion
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-yellow-600" />
            <span className="font-medium text-sm">
              {suggestion.suggestion_type === "typo_correction"
                ? "Possible Typo"
                : "Suggestion"}
            </span>
            <Badge variant="outline" className="ml-auto text-xs">
              {(suggestion.confidence * 100).toFixed(0)}%
            </Badge>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Suggested: </span>
            <span className="font-medium text-green-600">
              {JSON.stringify(suggestion.suggested_value)}
            </span>
          </div>

          {suggestion.reasoning && (
            <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApply} disabled={applying}>
              {applying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Ignore
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Badge showing pending suggestions count for a table
export function SuggestionsBadge({
  tableId,
  onClick,
}: {
  tableId: string;
  onClick?: () => void;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const response = await aiSuggestionsClient.getTableSuggestions(tableId, {
          status: "pending",
          limit: 100,
        });
        setCount(response.total || 0);
      } catch (error) {
        console.error("Failed to load suggestions count:", error);
      }
    };
    loadCount();
  }, [tableId]);

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full",
        "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
      )}
    >
      <Lightbulb className="h-3.5 w-3.5" />
      {count} AI suggestion{count !== 1 && "s"}
    </button>
  );
}
