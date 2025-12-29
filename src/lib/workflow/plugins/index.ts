/**
 * Plugins Index
 *
 * Matic Platform Workflow Plugins
 * Only includes Matic internal plugins and Resend for email delivery.
 */

import "./matic-email";
import "./matic-review";
import "./resend";

export type {
  ActionConfigField,
  ActionConfigFieldBase,
  ActionConfigFieldGroup,
  ActionWithFullId,
  IntegrationPlugin,
  PluginAction,
} from "./registry";

// Export the registry utilities
export {
  computeActionId,
  findActionById,
  flattenConfigFields,
  generateAIActionPrompts,
  getActionsByCategory,
  getAllActions,
  getAllDependencies,
  getAllEnvVars,
  getAllIntegrations,
  getCredentialMapping,
  getDependenciesForActions,
  getIntegration,
  getIntegrationLabels,
  getIntegrationTypes,
  getPluginEnvVars,
  getSortedIntegrationTypes,
  isFieldGroup,
  parseActionId,
  registerIntegration,
} from "./registry";
