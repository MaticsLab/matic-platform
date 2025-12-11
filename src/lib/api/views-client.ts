/**
 * Views API Client
 * 
 * Handles CRUD operations for table views (grid, kanban, calendar, gallery, timeline, form, portal)
 * All views are stored in table_views table, including portal views (migrated from data_tables.settings)
 */
import { goFetch } from './go-client';
import { TableView, ViewType } from '@/types/data-tables';

// Extended view type for API responses
export interface ViewWithConfig extends TableView {
  config?: {
    sections?: Array<{
      id: string;
      title: string;
      description?: string;
      field_ids: string[];
    }>;
    theme?: Record<string, unknown>;
    translations?: Record<string, Record<string, string>>;
    submission_settings?: Record<string, unknown>;
  };
  settings?: Record<string, unknown>;
  filters?: Array<{
    field_id: string;
    operator: string;
    value: unknown;
  }>;
  sorts?: Array<{
    field_id: string;
    direction: 'asc' | 'desc';
  }>;
}

// Input types for create/update
export interface CreateViewInput {
  name: string;
  description?: string;
  type: ViewType;
  settings?: Record<string, unknown>;
  config?: Record<string, unknown>;
  filters?: Array<unknown>;
  sorts?: Array<unknown>;
  is_shared?: boolean;
  is_locked?: boolean;
}

export interface UpdateViewInput {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
  config?: Record<string, unknown>;
  filters?: Array<unknown>;
  sorts?: Array<unknown>;
  is_shared?: boolean;
  is_locked?: boolean;
}

export const viewsClient = {
  /**
   * List all views for a table
   */
  listForTable: (tableId: string) => 
    goFetch<ViewWithConfig[]>(`/tables/${tableId}/views`),

  /**
   * Get a specific view by ID
   */
  get: (viewId: string) => 
    goFetch<ViewWithConfig>(`/views/${viewId}`),

  /**
   * Create a new view for a table
   */
  create: (tableId: string, data: CreateViewInput) => 
    goFetch<ViewWithConfig>(`/tables/${tableId}/views`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update a view
   */
  update: (viewId: string, data: UpdateViewInput) => 
    goFetch<ViewWithConfig>(`/views/${viewId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Update only the config of a view (for portal sections, theme, etc.)
   */
  updateConfig: (viewId: string, config: Record<string, unknown>) => 
    goFetch<ViewWithConfig>(`/views/${viewId}/config`, {
      method: 'PATCH',
      body: JSON.stringify({ config }),
    }),

  /**
   * Delete a view
   */
  delete: (viewId: string) => 
    goFetch<void>(`/views/${viewId}`, {
      method: 'DELETE',
    }),

  /**
   * Duplicate a view
   */
  duplicate: (viewId: string) => 
    goFetch<ViewWithConfig>(`/views/${viewId}/duplicate`, {
      method: 'POST',
    }),

  /**
   * Get all portal views for a table
   */
  getPortalViews: (tableId: string) => 
    goFetch<ViewWithConfig[]>(`/tables/${tableId}/views/portal`),
};

// Convenience functions for portal-specific operations
export const portalViewsClient = {
  /**
   * Get the primary portal view for a table
   */
  getForTable: async (tableId: string): Promise<ViewWithConfig | null> => {
    const views = await viewsClient.getPortalViews(tableId);
    return views.length > 0 ? views[0] : null;
  },

  /**
   * Create a portal view for a table
   */
  create: (tableId: string, name: string = 'Portal') => 
    viewsClient.create(tableId, {
      name,
      type: 'portal',
      settings: {
        is_public: true,
        requires_auth: false,
      },
      config: {
        sections: [{
          id: 'main',
          title: 'Application',
          description: '',
          field_ids: [],
        }],
        theme: {},
        translations: {},
        submission_settings: {},
      },
    }),

  /**
   * Update portal sections
   */
  updateSections: async (
    viewId: string, 
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      field_ids: string[];
    }>
  ) => {
    const view = await viewsClient.get(viewId);
    return viewsClient.updateConfig(viewId, {
      ...view.config,
      sections,
    });
  },

  /**
   * Update portal theme
   */
  updateTheme: async (viewId: string, theme: Record<string, unknown>) => {
    const view = await viewsClient.get(viewId);
    return viewsClient.updateConfig(viewId, {
      ...view.config,
      theme,
    });
  },

  /**
   * Update portal translations
   */
  updateTranslations: async (
    viewId: string, 
    translations: Record<string, Record<string, string>>
  ) => {
    const view = await viewsClient.get(viewId);
    return viewsClient.updateConfig(viewId, {
      ...view.config,
      translations,
    });
  },
};
