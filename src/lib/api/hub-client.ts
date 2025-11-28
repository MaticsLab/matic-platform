/**
 * Hub & Sub-Module API Client
 * Handles hub modules, sub-modules, and module field operations
 */

import { goFetch } from './go-client';
import type {
  SubModule,
  SubModuleWithData,
  ModuleFieldConfig,
  ModuleHistorySettings,
  ModuleWithFields,
  HubModulesWithFieldsResponse,
  ModuleFieldsResponse,
  CreateSubModuleInput,
  UpdateSubModuleInput,
  EnableModuleWithFieldsInput,
  UpdateModuleHistorySettingsInput,
  ReorderSubModulesInput,
  SubModuleRowsResponse,
} from '@/types/sub-modules';
import type { KnownModuleId } from '@/types/modules';

// ============================================================
// HUB MODULES
// ============================================================

export const hubModulesClient = {
  /**
   * Get all modules for a hub with field configurations
   */
  getModulesWithFields: async (hubId: string): Promise<HubModulesWithFieldsResponse> => {
    return goFetch<HubModulesWithFieldsResponse>(`/hubs/${hubId}/modules`);
  },

  /**
   * Enable a module on a hub with optional field creation
   */
  enableModule: async (
    hubId: string,
    input: EnableModuleWithFieldsInput
  ): Promise<ModuleWithFields> => {
    return goFetch<ModuleWithFields>(`/hubs/${hubId}/modules/enable`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get field configurations for a specific module
   */
  getModuleFields: async (moduleId: KnownModuleId): Promise<ModuleFieldsResponse> => {
    return goFetch<ModuleFieldsResponse>(`/modules/${moduleId}/fields`);
  },
};

// ============================================================
// SUB-MODULES
// ============================================================

export const subModulesClient = {
  /**
   * List all sub-modules for a hub
   */
  list: async (hubId: string, moduleId?: KnownModuleId): Promise<SubModule[]> => {
    const params = moduleId ? `?module_id=${moduleId}` : '';
    return goFetch<SubModule[]>(`/hubs/${hubId}/sub-modules${params}`);
  },

  /**
   * Get a specific sub-module
   */
  get: async (subModuleId: string): Promise<SubModule> => {
    return goFetch<SubModule>(`/sub-modules/${subModuleId}`);
  },

  /**
   * Create a new sub-module
   */
  create: async (hubId: string, input: CreateSubModuleInput): Promise<SubModule> => {
    return goFetch<SubModule>(`/hubs/${hubId}/sub-modules`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a sub-module
   */
  update: async (subModuleId: string, input: UpdateSubModuleInput): Promise<SubModule> => {
    return goFetch<SubModule>(`/sub-modules/${subModuleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a sub-module
   */
  delete: async (subModuleId: string): Promise<void> => {
    await goFetch(`/sub-modules/${subModuleId}`, { method: 'DELETE' });
  },

  /**
   * Reorder sub-modules
   */
  reorder: async (hubId: string, input: ReorderSubModulesInput): Promise<SubModule[]> => {
    return goFetch<SubModule[]>(`/hubs/${hubId}/sub-modules/reorder`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get rows for a sub-module (filtered or from dedicated table)
   */
  getRows: async (
    subModuleId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<SubModuleRowsResponse> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.pageSize) params.set('page_size', options.pageSize.toString());
    
    const query = params.toString();
    return goFetch<SubModuleRowsResponse>(
      `/sub-modules/${subModuleId}/rows${query ? `?${query}` : ''}`
    );
  },
};

// ============================================================
// MODULE HISTORY SETTINGS
// ============================================================

export const moduleSettingsClient = {
  /**
   * Get history settings for a module config
   */
  getHistorySettings: async (configId: string): Promise<ModuleHistorySettings | { using_table_defaults: true }> => {
    return goFetch<ModuleHistorySettings | { using_table_defaults: true }>(
      `/module-configs/${configId}/history-settings`
    );
  },

  /**
   * Update history settings for a module config
   */
  updateHistorySettings: async (
    configId: string,
    input: UpdateModuleHistorySettingsInput
  ): Promise<ModuleHistorySettings> => {
    return goFetch<ModuleHistorySettings>(`/module-configs/${configId}/history-settings`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
};

// ============================================================
// COMBINED CLIENT
// ============================================================

export const hubClient = {
  modules: hubModulesClient,
  subModules: subModulesClient,
  settings: moduleSettingsClient,
};

export default hubClient;
