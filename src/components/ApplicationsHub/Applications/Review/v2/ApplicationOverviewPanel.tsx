'use client';

import React, { useState, useMemo } from 'react';
import {
  Mail, User, Sparkles, Users, Play, KeyRound, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UNKNOWN } from '@/constants/fallbacks';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { Badge } from '@/ui-components/badge';
import { Button } from '@/ui-components/button';
import { ScrollArea } from '@/ui-components/scroll-area';
import { Application, ApplicationDetailProps, ReviewersMap } from './types';
import { ApplicationCustomFieldsSection } from './ApplicationCustomFieldsSection';

type FieldDef = NonNullable<ApplicationDetailProps['fields']>[number];
type SectionDef = NonNullable<ApplicationDetailProps['sections']>[number];

interface ApplicationOverviewPanelProps {
  application: Application;
  reviewersMap: ReviewersMap;
  fields: FieldDef[];
  sections: SectionDef[];
  isExternalReviewer: boolean;
  onResetPasswordClick: () => void;
}

export function ApplicationOverviewPanel({
  application,
  reviewersMap,
  fields,
  sections,
  isExternalReviewer,
  onResetPasswordClick,
}: ApplicationOverviewPanelProps) {
  // Collapsible sections state - first section open by default
  const [openSections, setOpenSections] = useState<{ [sectionName: string]: boolean }>({});

  // Calculate completion percentage for a section
  const calculateSectionCompletion = (sectionFields: any[]) => {
    let totalFields = 0;
    let completedFields = 0;

    sectionFields.forEach(field => {
      // Skip non-required fields from completion calculation
      if (!(field as any).required && (field as any).required !== undefined) {
        return;
      }

      totalFields++;

      // Try field.id first (UUID key), then fallback to field_key/label
      const value = application.raw_data?.[field.id] ||
                   application.raw_data?.[field.field_key] ||
                   application.raw_data?.[field.label?.toLowerCase().replace(/\s+/g, '_')] ||
                   application.raw_data?.[field.label];

      // Check if field is completed
      if (value !== null && value !== undefined && value !== '' && value !== '[]' && value !== '{}') {
        // For arrays, check if they have content
        if (Array.isArray(value) && value.length === 0) {
          return;
        }
        // For objects, check if they have meaningful content
        if (typeof value === 'object' && Object.keys(value).length === 0) {
          return;
        }
        completedFields++;
      }
    });

    const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

    return { completionPercentage, completedFields, totalFields };
  };

  // Toggle section open/closed
  const toggleSection = (sectionName: string, open?: boolean) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: open !== undefined ? open : !prev[sectionName]
    }));
  };

  // Group fields by section using form editor sections
  const fieldSections = useMemo(() => {
    if (!fields || fields.length === 0) return [];

    // If we have sections from the form editor, use those
    if (sections && sections.length > 0) {
      return sections
        .map((section, index) => {
          // Handle different section property names based on source
          const sectionId = section.id;
          const sectionName = section.name;
          const sectionDescription = section.description;
          const sortOrder = section.sort_order !== undefined ? section.sort_order : index;

          // Get fields for this section
          const sectionFields = fields.filter(field => {
            const fieldSectionId = (field as any).section_id;
            return fieldSectionId === sectionId;
          });

          // Filter out layout fields
          const layoutFieldTypes = ['section', 'divider', 'heading', 'paragraph', 'callout'];
          const regularFields = sectionFields.filter(field => {
            if ((field as any).field_type?.category === 'layout') {
              return false;
            }
            if (layoutFieldTypes.includes(field.type)) {
              return false;
            }
            return true;
          });

          // Skip sections with no regular fields
          if (regularFields.length === 0) {
            return null;
          }

          const completionStats = calculateSectionCompletion(regularFields);

          return {
            name: sectionName,
            description: sectionDescription,
            fields: regularFields,
            sortOrder,
            ...completionStats
          };
        })
        .filter(Boolean) // Remove null sections
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder); // Sort by order
    }

    // Fallback to original field-based parsing if no sections available
    const layoutFieldTypes = ['section', 'divider', 'heading', 'paragraph', 'callout'];
    const regularFields = fields.filter(field => {
      if ((field as any).field_type?.category === 'layout') {
        return false;
      }
      if (layoutFieldTypes.includes(field.type)) {
        return false;
      }
      return true;
    });

    const fallbackSections: { name: string; fields: typeof fields; completionPercentage: number; completedFields: number; totalFields: number }[] = [];
    let currentSection = { name: 'General Information', fields: [] as typeof fields };

    regularFields.forEach(field => {
      if (field.type === 'section') {
        if (currentSection.fields.length > 0) {
          const completionStats = calculateSectionCompletion(currentSection.fields);
          fallbackSections.push({ ...currentSection, ...completionStats });
        }
        currentSection = { name: field.label || 'Section', fields: [] };
      } else {
        currentSection.fields.push(field);
      }
    });

    if (currentSection.fields.length > 0) {
      const completionStats = calculateSectionCompletion(currentSection.fields);
      fallbackSections.push({ ...currentSection, ...completionStats });
    }

    return fallbackSections;
  }, [fields, sections, application.raw_data]);

  // Initialize open sections - first section open by default
  React.useEffect(() => {
    const firstSection = fieldSections[0];
    if (fieldSections.length > 0 && firstSection?.name && !openSections.hasOwnProperty(firstSection.name)) {
      setOpenSections(prev => ({ ...prev, [firstSection.name]: true }));
    }
  }, [fieldSections]);

  return (
    <div className="flex overflow-hidden transition-all duration-300 flex-1">
      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
        {/* Name & Status Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">
              {application.name || UNKNOWN}
            </h1>
            {application.email && (
              <div className="flex items-center gap-2 mt-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{application.email}</span>
                {!isExternalReviewer && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onResetPasswordClick}
                    className="h-6 px-2 text-xs hover:bg-blue-50 hover:text-blue-700"
                  >
                    <KeyRound className="h-3 w-3 mr-1" />
                    Reset Password
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status Badge (read-only) */}
            <Badge
              variant="secondary"
              className="bg-green-50 text-green-700 border-green-200 gap-1.5 px-2.5 py-1"
            >
              <Play className="h-3 w-3" />
              {application.status || 'Submitted'}
            </Badge>


          </div>
        </div>

        {/* Quick Info - Compact horizontal layout */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-4">
          {/* Date */}
          {application.submittedDate && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(application.submittedDate).toLocaleDateString()}</span>
            </div>
          )}

          {/* Assignees */}
          {application.assignedTo && application.assignedTo.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{application.assignedTo.length} assigned</span>
            </div>
          )}

          {/* Priority */}
          {application.priority && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-5",
                application.priority === 'high' && 'border-red-200 text-red-600 bg-red-50',
                application.priority === 'medium' && 'border-yellow-200 text-yellow-600 bg-yellow-50',
                application.priority === 'low' && 'border-gray-200 text-gray-600 bg-gray-50'
              )}
            >
              {application.priority}
            </Badge>
          )}

          {/* Tags */}
          {application.tags && application.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {application.tags.slice(0, 2).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-gray-100">
                  {tag}
                </Badge>
              ))}
              {application.tags.length > 2 && (
                <span className="text-muted-foreground">+{application.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {/* Description Section - Compact */}
        {application.comments && (
          <Card className="mb-4 shadow-none border-gray-100">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-sm text-foreground leading-relaxed">{application.comments}</p>
            </CardContent>
          </Card>
        )}

        {/* Reviewers Section - Compact (internal staff only — hides peer reviewers' contact info from external reviewers) */}
        {!isExternalReviewer && Array.isArray(application.assignedTo) && application.assignedTo.length > 0 && reviewersMap && (
          <Card className="mb-4 shadow-none border-gray-100">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Reviewers ({application.assignedTo.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {application.assignedTo
                  .map((reviewerId: string) => ({ reviewer: reviewersMap[reviewerId], reviewerId }))
                  .filter(({ reviewer }) => Boolean(reviewer))
                  .map(({ reviewer, reviewerId }, idx) => (
                    <div key={reviewerId} className="flex items-center gap-2 py-1">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{reviewer.name || 'Reviewer'}</div>
                      </div>
                      {reviewer.email && (
                        <span className="text-xs text-muted-foreground truncate">{reviewer.email}</span>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Fields Section - Form-like layout with collapsible sections */}
        {fields && fields.length > 0 && (
          <ApplicationCustomFieldsSection
            application={application}
            fields={fields}
            fieldSections={fieldSections}
            openSections={openSections}
            toggleSection={toggleSection}
          />
        )}

        {/* Actions Section - Removed (workflow feature deleted) */}

        </div>
      </ScrollArea>
    </div>
  );
}
