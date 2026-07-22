'use client';

import React from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui-components/collapsible';
import { Progress } from '@/ui-components/progress';
import { Application, ApplicationDetailProps } from './types';
import { formatFieldLabel, renderFieldValue } from './ApplicationFieldValueDisplay';

type FieldDef = NonNullable<ApplicationDetailProps['fields']>[number];

interface FieldSection {
  name: string;
  description?: string;
  fields: FieldDef[];
  completionPercentage: number;
  completedFields: number;
  totalFields: number;
}

interface ApplicationCustomFieldsSectionProps {
  application: Application;
  fields: FieldDef[];
  fieldSections: (FieldSection | null)[];
  openSections: { [sectionName: string]: boolean };
  toggleSection: (sectionName: string, open?: boolean) => void;
}

/** The "Application Details" block of collapsible form-field sections — extracted
 *  out of ApplicationOverviewPanel purely to keep that file under the line-count
 *  target; it owns its own (per-render, unmemoized — matches original behavior)
 *  field map used to resolve labels for repeater/group subfields. */
export function ApplicationCustomFieldsSection({
  application,
  fields,
  fieldSections,
  openSections,
  toggleSection,
}: ApplicationCustomFieldsSectionProps) {
  if (!fields || fields.length === 0) return null;

  // Create field map for nested field lookup (includes all subfields recursively)
  const fieldMap = new Map<string, any>();

  function addFieldToMap(field: any) {
    const fieldId = field.id || field.field_id;
    const fieldLabel = field.label || field.name;
    const fieldName = field.name;

    // Map by ID
    if (fieldId) {
      fieldMap.set(fieldId, field);
      if (!fieldId.startsWith('Field-')) fieldMap.set(`Field-${fieldId}`, field);
      if (fieldId.startsWith('Field-')) fieldMap.set(fieldId.replace(/^Field-/, ''), field);
    }

    // Map by name (for repeater subfields)
    if (fieldName) {
      fieldMap.set(fieldName, field);
      fieldMap.set(fieldName.toLowerCase().replace(/\s+/g, '_'), field);
      fieldMap.set(fieldName.replace(/\s+/g, '_'), field);
    }

    // Map by label
    if (fieldLabel) {
      fieldMap.set(fieldLabel, field);
      fieldMap.set(fieldLabel.toLowerCase().replace(/\s+/g, '_'), field);
      fieldMap.set(fieldLabel.replace(/\s+/g, '_'), field);
    }

    // Recursively add children from config.children (for repeaters/groups)
    const configChildren = (field.config as any)?.children || [];
    const directChildren = field.children || field.child_fields || [];
    const allChildren = [...configChildren, ...directChildren];

    if (Array.isArray(allChildren) && allChildren.length > 0) {
      allChildren.forEach((child: any) => {
        // If child is a field definition object from config.children, create a proper field object
        if (child && typeof child === 'object') {
          const childField = {
            id: child.id || child.name || `child-${Math.random()}`,
            name: child.name,
            label: child.label || child.name || 'Unnamed Field',
            type: child.type || 'text',
            config: child.config || child
          };
          addFieldToMap(childField);
        } else if (child && typeof child === 'string') {
          // If child is an ID, try to find it in the fields array
          const foundField = fields.find((f: any) => f.id === child || f.name === child);
          if (foundField) {
            addFieldToMap(foundField);
          }
        }
      });
    }
  }

  // Add all top-level fields
  fields.forEach(addFieldToMap);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-4">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Application Details</span>
      </div>
      <div className="space-y-3">
        {fieldSections
          .filter((section): section is NonNullable<typeof section> => section !== null)
          .map((section, sectionIdx) => {
            const isOpen = openSections[section.name] || false;

            return (
              <Card key={sectionIdx} className="shadow-none border-gray-100">
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) => toggleSection(section.name, open)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 pb-3 cursor-pointer hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex flex-col">
                              <CardTitle className="text-sm font-medium text-foreground">
                                {section.name}
                              </CardTitle>
                              {(section as any).description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {(section as any).description}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Completion indicator */}
                          <div className="flex items-center gap-2">
                            <Progress
                              value={section.completionPercentage}
                              className="w-16 h-1.5"
                            />
                            <span className="text-xs text-muted-foreground font-mono">
                              {section.completionPercentage}%
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {section.completedFields}/{section.totalFields} fields completed
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-4">
                        {section.fields.map((field) => {
                          const value = application.raw_data?.[field.id] ||
                                       application.raw_data?.[(field as any).name] ||
                                       application.raw_data?.[(field as any).field_key] ||
                                       application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                                       application.raw_data?.[field.label];

                          // Strip HTML from rich-text labels
                          const displayLabel = (field.label || formatFieldLabel(field.id, fieldMap)).replace(/<[^>]+>/g, '').trim();
                          const isRequired = (field as any).required;
                          const isEmpty = value === null || value === undefined || value === '';

                          return (
                            <div key={field.id} className="space-y-2">
                              {/* Form field label styling */}
                              <div className="flex items-center gap-1">
                                <label className="text-sm font-medium text-foreground">
                                  {displayLabel}
                                </label>
                                {isRequired && (
                                  <span className="text-red-500 text-sm">*</span>
                                )}
                              </div>

                              {/* Form field value styling - looks like a disabled input */}
                              <div className="relative">
                                <div className={cn(
                                  "min-h-[36px] w-full rounded-md border px-3 py-2 text-sm ring-offset-background",
                                  isEmpty
                                    ? "border-input bg-muted/20 text-muted-foreground"
                                    : "border-input bg-muted/30"
                                )}>
                                  <div className={isEmpty ? "text-muted-foreground italic" : "text-foreground"}>
                                    {isEmpty
                                      ? "Not filled out"
                                      : renderFieldValue(value, 0, field.id, fieldMap)
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
