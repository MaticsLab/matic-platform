/**
 * TypeScript types for Module Registry and Hub Type System
 * Controls which features/modules are available per hub type
 */

// ============================================================
// HUB TYPES
// ============================================================

/**
 * Hub types determine what kind of functionality a data table supports
 * - activities: Event/activity management (supports Pulse scanning)
 * - applications: Application review workflows (supports Review Workflows)
 * - data: General data management (basic tables)
 */
export type HubType = 'activities' | 'applications' | 'data';

export const HUB_TYPE_LABELS: Record<HubType, string> = {
  activities: 'Activities Hub',
  applications: 'Applications Hub',
  data: 'Data Hub',
};

export const HUB_TYPE_DESCRIPTIONS: Record<HubType, string> = {
  activities: 'For events, activities, and attendance tracking with Pulse scanning support',
  applications: 'For application review workflows with multi-stage review and rubrics',
  data: 'For general data management with Airtable-like tables',
};

export const HUB_TYPE_ICONS: Record<HubType, string> = {
  activities: 'calendar-check',
  applications: 'file-text',
  data: 'table',
};

export const HUB_TYPE_COLORS: Record<HubType, string> = {
  activities: '#10B981', // Emerald
  applications: '#6366F1', // Indigo
  data: '#3B82F6', // Blue
};

// ============================================================
// MODULE DEFINITIONS
// ============================================================

export type ModuleCategory = 'core' | 'productivity' | 'communication' | 'integration';

/**
 * Module Definition - describes a feature that can be enabled on a hub
 */
export interface ModuleDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category: ModuleCategory;
  is_premium: boolean;
  is_beta: boolean;
  is_deprecated: boolean;
  available_for_hub_types: HubType[];
  dependencies: string[];
  settings_schema?: Record<string, any>;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Known module IDs for type safety
 */
export type KnownModuleId =
  | 'tables'
  | 'views'
  | 'forms'
  | 'pulse'
  | 'attendance'
  | 'calendar'
  | 'review_workflow'
  | 'rubrics'
  | 'reviewer_portal'
  | 'decision_logic'
  | 'analytics'
  | 'export'
  | 'notifications'
  | 'email_templates';

// ============================================================
// HUB MODULE CONFIGURATION
// ============================================================

/**
 * Hub Module Config - per-table module enablement and settings
 */
export interface HubModuleConfig {
  id: string;
  table_id: string;
  module_id: string;
  is_enabled: boolean;
  settings?: Record<string, any>;
  enabled_by?: string;
  enabled_at?: string;
  updated_at?: string;
}

/**
 * Module with its enabled status for a specific hub
 */
export interface ModuleWithStatus extends ModuleDefinition {
  is_enabled: boolean;
  settings?: Record<string, any>;
}

/**
 * API response for hub modules
 */
export interface HubModulesResponse {
  table_id: string;
  hub_type: HubType;
  enabled_modules: ModuleWithStatus[];
  available_modules: ModuleWithStatus[];
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

export interface EnableModuleRequest {
  module_id: string;
  settings?: Record<string, any>;
}

export interface UpdateHubTypeRequest {
  hub_type: HubType;
}

export interface CreateHubRequest {
  workspace_id: string;
  name: string;
  slug?: string;
  description?: string;
  hub_type: HubType;
  icon?: string;
  color?: string;
}

// ============================================================
// STATIC MODULE REGISTRY (Frontend Mirror)
// ============================================================

/**
 * Static registry of all modules - mirrors database module_definitions
 * Use this for UI rendering when database isn't available
 */
export const MODULE_REGISTRY: Record<KnownModuleId, Omit<ModuleDefinition, 'created_at' | 'updated_at'>> = {
  tables: {
    id: 'tables',
    name: 'Tables',
    description: 'Airtable-like data tables with columns and rows',
    icon: 'table',
    category: 'core',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities', 'applications', 'data'],
    dependencies: [],
    display_order: 1,
  },
  views: {
    id: 'views',
    name: 'Views',
    description: 'Grid, Kanban, Calendar, and Gallery views',
    icon: 'layout',
    category: 'core',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities', 'applications', 'data'],
    dependencies: ['tables'],
    display_order: 2,
  },
  forms: {
    id: 'forms',
    name: 'Forms',
    description: 'Create intake forms that populate tables',
    icon: 'file-text',
    category: 'core',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities', 'applications', 'data'],
    dependencies: ['tables'],
    display_order: 3,
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse Scanning',
    description: 'Barcode/QR code check-in and attendance tracking',
    icon: 'scan-line',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities'],
    dependencies: ['tables'],
    display_order: 10,
  },
  attendance: {
    id: 'attendance',
    name: 'Attendance Tracking',
    description: 'Track attendance for activities and events',
    icon: 'user-check',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities'],
    dependencies: ['tables', 'pulse'],
    display_order: 11,
  },
  calendar: {
    id: 'calendar',
    name: 'Calendar Integration',
    description: 'Sync activities with calendar apps',
    icon: 'calendar',
    category: 'integration',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities'],
    dependencies: ['tables'],
    display_order: 12,
  },
  review_workflow: {
    id: 'review_workflow',
    name: 'Review Workflows',
    description: 'Multi-stage application review with stages and reviewers',
    icon: 'workflow',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['applications'],
    dependencies: ['tables', 'forms'],
    display_order: 20,
  },
  rubrics: {
    id: 'rubrics',
    name: 'Scoring Rubrics',
    description: 'Create rubrics for consistent scoring',
    icon: 'list-checks',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['applications'],
    dependencies: ['review_workflow'],
    display_order: 21,
  },
  reviewer_portal: {
    id: 'reviewer_portal',
    name: 'External Reviewer Portal',
    description: 'Allow external reviewers to score applications',
    icon: 'external-link',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['applications'],
    dependencies: ['review_workflow', 'rubrics'],
    display_order: 22,
  },
  decision_logic: {
    id: 'decision_logic',
    name: 'Decision Logic',
    description: 'Automate advancement and rejection based on scores',
    icon: 'git-branch',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['applications'],
    dependencies: ['review_workflow'],
    display_order: 23,
  },
  analytics: {
    id: 'analytics',
    name: 'Advanced Analytics',
    description: 'Charts, reports, and dashboards',
    icon: 'chart-bar',
    category: 'productivity',
    is_premium: true,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities', 'applications', 'data'],
    dependencies: ['tables'],
    display_order: 30,
  },
  export: {
    id: 'export',
    name: 'Advanced Export',
    description: 'Export to Excel, PDF, and custom formats',
    icon: 'download',
    category: 'productivity',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities', 'applications', 'data'],
    dependencies: ['tables'],
    display_order: 31,
  },
  notifications: {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email and in-app notifications',
    icon: 'bell',
    category: 'communication',
    is_premium: false,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['activities', 'applications', 'data'],
    dependencies: [],
    display_order: 40,
  },
  email_templates: {
    id: 'email_templates',
    name: 'Email Templates',
    description: 'Create reusable email templates',
    icon: 'mail',
    category: 'communication',
    is_premium: true,
    is_beta: false,
    is_deprecated: false,
    available_for_hub_types: ['applications'],
    dependencies: ['notifications'],
    display_order: 41,
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get all modules available for a specific hub type
 */
export function getModulesForHubType(hubType: HubType): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY)
    .filter(module => module.available_for_hub_types.includes(hubType))
    .sort((a, b) => a.display_order - b.display_order) as ModuleDefinition[];
}

/**
 * Check if a module can be enabled (all dependencies are met)
 */
export function canEnableModule(
  moduleId: KnownModuleId,
  enabledModuleIds: string[]
): boolean {
  const module = MODULE_REGISTRY[moduleId];
  if (!module) return false;
  
  return module.dependencies.every(dep => enabledModuleIds.includes(dep));
}

/**
 * Get missing dependencies for a module
 */
export function getMissingDependencies(
  moduleId: KnownModuleId,
  enabledModuleIds: string[]
): string[] {
  const module = MODULE_REGISTRY[moduleId];
  if (!module) return [];
  
  return module.dependencies.filter(dep => !enabledModuleIds.includes(dep));
}

/**
 * Get default modules for a hub type (auto-enabled on creation)
 */
export function getDefaultModulesForHubType(hubType: HubType): KnownModuleId[] {
  const defaults: Record<HubType, KnownModuleId[]> = {
    activities: ['tables', 'views', 'pulse', 'attendance'],
    applications: ['tables', 'views', 'forms', 'review_workflow', 'rubrics'],
    data: ['tables', 'views'],
  };
  return defaults[hubType];
}
