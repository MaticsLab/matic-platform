/**
 * Enterprise Portal Block System
 * 
 * This module defines a composable block-based architecture for building
 * customizable application portals with:
 * - Multiple pages (login, signup, dashboard, forms, completion)
 * - Conditional visibility based on auth state and application status
 * - Post-submission flows (request more info, status updates)
 * - Enterprise-ready theming and localization
 */

// ============================================================================
// BLOCK CATEGORIES
// ============================================================================

/**
 * Block categories determine rendering behavior and data collection
 */
export type BlockCategory = 
  | 'layout'      // Visual elements: headings, dividers, callouts, spacers
  | 'field'       // Data collection: text, email, file, etc.
  | 'container'   // Grouping: sections, repeaters, groups
  | 'navigation'  // Flow control: buttons, links, tabs
  | 'display'     // Read-only data: status cards, progress bars, data summaries
  | 'auth'        // Authentication: login form, signup form, password reset
  | 'action';     // Triggers: submit button, save draft, cancel

// ============================================================================
// BASE BLOCK DEFINITION
// ============================================================================

/**
 * Base interface for all blocks
 */
export interface BaseBlock<TConfig = Record<string, unknown>> {
  /** Unique block identifier */
  id: string;
  
  /** Block type (e.g., 'text-field', 'callout', 'status-card') */
  type: BlockType;
  
  /** Block category (derived from type, but can be explicit) */
  category: BlockCategory;
  
  /** Display order within parent */
  position: number;
  
  /** Visibility rules - when should this block be shown? */
  visibility?: VisibilityRule[];
  
  /** Translation key for i18n */
  translationKey?: string;
  
  /** Custom CSS classes */
  className?: string;
  
  /** Block-specific configuration */
  config: TConfig;
}

// ============================================================================
// VISIBILITY RULES (Enterprise Feature)
// ============================================================================

/**
 * Visibility rules determine when blocks/pages are shown
 */
export interface VisibilityRule {
  /** Rule type */
  type: 'auth' | 'status' | 'field' | 'date' | 'custom';
  
  /** Condition operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'before' | 'after' | 'between';
  
  /** Target to evaluate */
  target: string;
  
  /** Value(s) to compare against */
  value: unknown;
  
  /** Combine with other rules: 'and' | 'or' */
  combineWith?: 'and' | 'or';
}

/**
 * Pre-defined visibility conditions for common scenarios
 */
export const VISIBILITY_PRESETS = {
  // Auth-based
  AUTHENTICATED: { type: 'auth', operator: 'equals', target: 'isAuthenticated', value: true },
  NOT_AUTHENTICATED: { type: 'auth', operator: 'equals', target: 'isAuthenticated', value: false },
  
  // Status-based
  NOT_STARTED: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'not_started' },
  IN_PROGRESS: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'in_progress' },
  SUBMITTED: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'submitted' },
  UNDER_REVIEW: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'under_review' },
  NEEDS_INFO: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'needs_info' },
  APPROVED: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'approved' },
  REJECTED: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'rejected' },
  WAITLISTED: { type: 'status', operator: 'equals', target: 'applicationStatus', value: 'waitlisted' },
} as const;

// ============================================================================
// BLOCK TYPES
// ============================================================================

/**
 * All available block types
 */
export type BlockType = 
  // Layout blocks (no data collection)
  | 'heading'
  | 'paragraph'
  | 'divider'
  | 'spacer'
  | 'callout'
  | 'image'
  | 'video'
  | 'hero'
  
  // Field blocks (data collection)
  | 'text-field'
  | 'textarea-field'
  | 'email-field'
  | 'phone-field'
  | 'number-field'
  | 'url-field'
  | 'address-field'
  | 'date-field'
  | 'datetime-field'
  | 'time-field'
  | 'select-field'
  | 'multiselect-field'
  | 'radio-field'
  | 'checkbox-field'
  | 'file-field'
  | 'image-field'
  | 'signature-field'
  | 'rating-field'
  | 'rank-field'
  
  // Container blocks
  | 'section'
  | 'group'
  | 'repeater'
  | 'columns'
  | 'card'
  | 'accordion'
  | 'tabs'
  
  // Navigation blocks
  | 'nav-button'
  | 'nav-link'
  | 'progress-steps'
  | 'breadcrumbs'
  
  // Display blocks (read-only data presentation)
  | 'status-card'
  | 'progress-bar'
  | 'data-summary'
  | 'timeline'
  | 'message-list'
  | 'document-list'
  
  // Auth blocks
  | 'login-form'
  | 'signup-form'
  | 'password-reset'
  | 'logout-button'
  
  // Action blocks
  | 'submit-button'
  | 'save-draft-button'
  | 'cancel-button';

// ============================================================================
// SPECIFIC BLOCK INTERFACES
// ============================================================================

// Layout Blocks
export interface HeadingBlockConfig {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
  align?: 'left' | 'center' | 'right';
}

export interface HeadingBlock extends BaseBlock<HeadingBlockConfig> {
  type: 'heading';
  category: 'layout';
}

export interface ParagraphBlockConfig {
  content: string; // HTML allowed for rich text
  align?: 'left' | 'center' | 'right';
}

export interface ParagraphBlock extends BaseBlock<ParagraphBlockConfig> {
  type: 'paragraph';
  category: 'layout';
}

export interface CalloutBlockConfig {
  title?: string;
  content: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  icon: 'info' | 'warning' | 'error' | 'success' | 'lightbulb' | 'help';
}

export interface CalloutBlock extends BaseBlock<CalloutBlockConfig> {
  type: 'callout';
  category: 'layout';
}

export interface HeroBlockConfig {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  height?: 'small' | 'medium' | 'large' | 'full';
  overlay?: boolean;
  overlayOpacity?: number;
}

export interface HeroBlock extends BaseBlock<HeroBlockConfig> {
  type: 'hero';
  category: 'layout';
}

// Field Blocks (inherit validation, required, etc.)
export interface FieldBlockConfig {
  label: string;
  name: string; // Field name for data storage
  description?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  validation?: Record<string, unknown>;
  conditionalLogic?: VisibilityRule[];
}

export interface TextFieldBlockConfig extends FieldBlockConfig {
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

export interface TextFieldBlock extends BaseBlock<TextFieldBlockConfig> {
  type: 'text-field';
  category: 'field';
}

export interface SelectFieldBlockConfig extends FieldBlockConfig {
  options: Array<{ value: string; label: string; color?: string }>;
  allowCustom?: boolean;
  searchable?: boolean;
}

export interface SelectFieldBlock extends BaseBlock<SelectFieldBlockConfig> {
  type: 'select-field';
  category: 'field';
}

// Container Blocks
export interface SectionBlockConfig {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface SectionBlock extends BaseBlock<SectionBlockConfig> {
  type: 'section';
  category: 'container';
  children: Block[];
}

export interface RepeaterBlockConfig extends FieldBlockConfig {
  minItems?: number;
  maxItems?: number;
  itemLabel?: string; // e.g., "Education #{index}"
  allowReorder?: boolean;
}

export interface RepeaterBlock extends BaseBlock<RepeaterBlockConfig> {
  type: 'repeater';
  category: 'container';
  children: Block[]; // Template for each item
}

// Display Blocks (Post-Submission)
export interface StatusCardBlockConfig {
  showProgress?: boolean;
  showTimeline?: boolean;
  showNextSteps?: boolean;
  compactMode?: boolean;
}

export interface StatusCardBlock extends BaseBlock<StatusCardBlockConfig> {
  type: 'status-card';
  category: 'display';
}

export interface ProgressBarBlockConfig {
  showPercentage?: boolean;
  showSteps?: boolean;
  animated?: boolean;
}

export interface ProgressBarBlock extends BaseBlock<ProgressBarBlockConfig> {
  type: 'progress-bar';
  category: 'display';
}

export interface MessageListBlockConfig {
  allowReply?: boolean;
  showTimestamps?: boolean;
  maxMessages?: number;
}

export interface MessageListBlock extends BaseBlock<MessageListBlockConfig> {
  type: 'message-list';
  category: 'display';
}

// Auth Blocks
export interface LoginFormBlockConfig {
  fields: Block[]; // Customizable login fields
  showForgotPassword?: boolean;
  showSignupLink?: boolean;
  showSocialLogin?: boolean;
  redirectTo?: string; // Page ID to redirect after login
}

export interface LoginFormBlock extends BaseBlock<LoginFormBlockConfig> {
  type: 'login-form';
  category: 'auth';
}

export interface SignupFormBlockConfig {
  fields: Block[]; // Customizable signup fields
  showLoginLink?: boolean;
  showSocialLogin?: boolean;
  showTermsCheckbox?: boolean;
  termsUrl?: string;
  privacyUrl?: string;
  redirectTo?: string; // Page ID to redirect after signup
}

export interface SignupFormBlock extends BaseBlock<SignupFormBlockConfig> {
  type: 'signup-form';
  category: 'auth';
}

// Action Blocks
export interface SubmitButtonBlockConfig {
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  confirmMessage?: string; // Show confirmation before submit
  redirectTo?: string; // Page ID to show after submission
}

export interface SubmitButtonBlock extends BaseBlock<SubmitButtonBlockConfig> {
  type: 'submit-button';
  category: 'action';
}

// Union type for all blocks
export type Block = 
  | HeadingBlock
  | ParagraphBlock
  | CalloutBlock
  | HeroBlock
  | TextFieldBlock
  | SelectFieldBlock
  | SectionBlock
  | RepeaterBlock
  | StatusCardBlock
  | ProgressBarBlock
  | MessageListBlock
  | LoginFormBlock
  | SignupFormBlock
  | SubmitButtonBlock
  | BaseBlock<Record<string, unknown>>; // Fallback for other types

// ============================================================================
// PORTAL PAGE DEFINITION
// ============================================================================

/**
 * Page types in the portal
 */
export type PageType = 
  | 'auth'        // Login/Signup pages
  | 'form'        // Application form sections
  | 'dashboard'   // Applicant dashboard (post-submission)
  | 'status'      // Status/confirmation pages
  | 'info'        // Information collection (request more info)
  | 'custom';     // Custom pages

/**
 * A page in the portal document
 */
export interface PortalPage {
  /** Unique page identifier */
  id: string;
  
  /** Page type */
  type: PageType;
  
  /** Page title (shown in nav, browser tab) */
  title: string;
  
  /** URL slug for this page */
  slug: string;
  
  /** Page description */
  description?: string;
  
  /** Page icon */
  icon?: string;
  
  /** Display order */
  position: number;
  
  /** Visibility rules - when is this page accessible? */
  visibility: VisibilityRule[];
  
  /** Blocks that make up this page */
  blocks: Block[];
  
  /** Page-level settings */
  settings?: {
    showNavigation?: boolean;
    showProgress?: boolean;
    showLanguageSelector?: boolean;
    requireAuth?: boolean;
    allowSaveDraft?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
  };
  
  /** Translation key */
  translationKey?: string;
}

// ============================================================================
// PORTAL DOCUMENT (Top-Level)
// ============================================================================

/**
 * Application status values
 */
export type ApplicationStatus = 
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'needs_info'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn';

/**
 * Theme configuration
 */
export interface PortalTheme {
  /** Primary brand color */
  primaryColor: string;
  
  /** Secondary color */
  secondaryColor?: string;
  
  /** Background color */
  backgroundColor?: string;
  
  /** Text color */
  textColor?: string;
  
  /** Font family */
  fontFamily: 'inter' | 'roboto' | 'open-sans' | 'poppins' | 'system';
  
  /** Button style */
  buttonStyle: 'rounded' | 'pill' | 'sharp';
  
  /** Border radius */
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  
  /** Logo URL */
  logoUrl?: string;
  
  /** Favicon URL */
  faviconUrl?: string;
  
  /** Background image */
  backgroundImage?: string;
  
  /** Custom CSS */
  customCss?: string;
}

/**
 * Language configuration
 */
export interface PortalLanguageConfig {
  /** Default language */
  default: string;
  
  /** Is multi-language enabled? */
  enabled: boolean;
  
  /** Supported language codes */
  supported: string[];
  
  /** Right-to-left languages */
  rtlLanguages?: string[];
  
  /** Auto-translate enabled? */
  autoTranslate?: boolean;
}

/**
 * The complete portal document
 */
export interface PortalDocument {
  /** Document version for migrations */
  version: '3.0';
  
  /** Portal metadata */
  metadata: {
    id: string;
    name: string;
    description?: string;
    workspaceId: string;
    tableId: string;
    viewId: string;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    isPublished: boolean;
  };
  
  /** Portal pages */
  pages: PortalPage[];
  
  /** Theme configuration */
  theme: PortalTheme;
  
  /** Language configuration */
  language: PortalLanguageConfig;
  
  /** Translations */
  translations: Record<string, Record<string, unknown>>;
  
  /** Workflow integration */
  workflow?: {
    workflowId: string;
    initialStageId?: string;
    statusMappings?: Record<string, ApplicationStatus>;
  };
  
  /** Email notifications */
  notifications?: {
    onSubmit?: { templateId: string; enabled: boolean };
    onStatusChange?: { templateId: string; enabled: boolean };
    onApproval?: { templateId: string; enabled: boolean };
    onRejection?: { templateId: string; enabled: boolean };
  };
  
  /** Integration settings */
  integrations?: {
    googleAnalytics?: string;
    facebookPixel?: string;
    customScripts?: string[];
  };
}

// ============================================================================
// BLOCK REGISTRY (For Dynamic Rendering)
// ============================================================================

/**
 * Block type metadata for the editor and renderer
 */
export interface BlockTypeDefinition {
  /** Block type ID */
  type: BlockType;
  
  /** Display name */
  displayName: string;
  
  /** Description */
  description: string;
  
  /** Category */
  category: BlockCategory;
  
  /** Icon name */
  icon: string;
  
  /** Default configuration */
  defaultConfig: Record<string, unknown>;
  
  /** Is this a container that can hold children? */
  isContainer: boolean;
  
  /** Allowed child block types (if container) */
  allowedChildren?: BlockType[];
  
  /** Config schema for the settings panel */
  configSchema: Record<string, unknown>;
  
  /** Does this block collect data? */
  collectsData: boolean;
  
  /** AI embedding strategy */
  aiSchema?: {
    embeddingStrategy: 'value_only' | 'with_label' | 'skip';
    privacyLevel: 'pii' | 'sensitive' | 'public';
  };
}

// ============================================================================
// RUNTIME CONTEXT (For Visibility Evaluation)
// ============================================================================

/**
 * Context available for evaluating visibility rules
 */
export interface PortalRuntimeContext {
  /** Is user authenticated? */
  isAuthenticated: boolean;
  
  /** Current user info */
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };
  
  /** Application status */
  applicationStatus: ApplicationStatus;
  
  /** Submission data */
  submissionData: Record<string, unknown>;
  
  /** Current page */
  currentPage: string;
  
  /** Current date/time */
  now: Date;
  
  /** Device info */
  device: 'mobile' | 'tablet' | 'desktop';
  
  /** Current language */
  language: string;
  
  /** Progress percentage (0-100) for progress bar blocks */
  progress?: number;
  
  /** Status history for timeline display */
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
  
  /** Messages for message list blocks */
  messages?: Array<{
    id: string;
    content: string;
    sender: {
      name: string;
      avatar?: string;
      isStaff: boolean;
    };
    timestamp: string;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a block should be visible given the current context
 */
export function evaluateVisibility(
  rules: VisibilityRule[] | undefined,
  context: PortalRuntimeContext
): boolean {
  if (!rules || rules.length === 0) return true;
  
  let result = true;
  let combineMode: 'and' | 'or' = 'and';
  
  for (const rule of rules) {
    const ruleResult = evaluateRule(rule, context);
    
    if (combineMode === 'and') {
      result = result && ruleResult;
    } else {
      result = result || ruleResult;
    }
    
    combineMode = rule.combineWith || 'and';
  }
  
  return result;
}

function evaluateRule(rule: VisibilityRule, context: PortalRuntimeContext): boolean {
  let targetValue: unknown;
  
  // Get target value from context
  switch (rule.type) {
    case 'auth':
      targetValue = rule.target === 'isAuthenticated' ? context.isAuthenticated : undefined;
      break;
    case 'status':
      targetValue = context.applicationStatus;
      break;
    case 'field':
      targetValue = context.submissionData[rule.target];
      break;
    case 'date':
      targetValue = context.now;
      break;
    default:
      targetValue = context.submissionData[rule.target];
  }
  
  // Evaluate operator
  switch (rule.operator) {
    case 'equals':
      return targetValue === rule.value;
    case 'not_equals':
      return targetValue !== rule.value;
    case 'contains':
      return String(targetValue).includes(String(rule.value));
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(targetValue);
    case 'not_in':
      return Array.isArray(rule.value) && !rule.value.includes(targetValue);
    default:
      return true;
  }
}

/**
 * Get all field blocks from a page (for form submission)
 */
export function getFieldBlocks(page: PortalPage): Block[] {
  const fields: Block[] = [];
  
  function collectFields(blocks: Block[]) {
    for (const block of blocks) {
      if (block.category === 'field') {
        fields.push(block);
      }
      if ('children' in block && Array.isArray(block.children)) {
        collectFields(block.children as Block[]);
      }
    }
  }
  
  collectFields(page.blocks);
  return fields;
}

/**
 * Create a default portal document
 */
export function createDefaultPortalDocument(
  workspaceId: string,
  tableId: string,
  name: string
): PortalDocument {
  return {
    version: '3.0',
    metadata: {
      id: crypto.randomUUID(),
      name,
      workspaceId,
      tableId,
      viewId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublished: false,
    },
    pages: [
      // Auth Page
      {
        id: 'auth',
        type: 'auth',
        title: 'Welcome',
        slug: 'auth',
        position: 0,
        visibility: [VISIBILITY_PRESETS.NOT_AUTHENTICATED as VisibilityRule],
        blocks: [
          {
            id: 'hero-1',
            type: 'hero',
            category: 'layout',
            position: 0,
            config: {
              title: name,
              subtitle: 'Sign in to continue your application',
              align: 'center',
              height: 'small',
            },
          },
          {
            id: 'login-1',
            type: 'login-form',
            category: 'auth',
            position: 1,
            config: {
              fields: [],
              showForgotPassword: true,
              showSignupLink: true,
              redirectTo: 'dashboard',
            },
          },
        ],
      },
      // Dashboard Page (Post-Login)
      {
        id: 'dashboard',
        type: 'dashboard',
        title: 'Dashboard',
        slug: 'dashboard',
        position: 1,
        visibility: [VISIBILITY_PRESETS.AUTHENTICATED as VisibilityRule],
        blocks: [
          {
            id: 'status-1',
            type: 'status-card',
            category: 'display',
            position: 0,
            config: {
              showProgress: true,
              showTimeline: true,
              showNextSteps: true,
            },
          },
        ],
        settings: {
          showNavigation: true,
          requireAuth: true,
        },
      },
      // Application Form Page
      {
        id: 'application',
        type: 'form',
        title: 'Application',
        slug: 'apply',
        position: 2,
        visibility: [
          VISIBILITY_PRESETS.AUTHENTICATED as VisibilityRule,
          { 
            type: 'status', 
            operator: 'in', 
            target: 'applicationStatus', 
            value: ['not_started', 'in_progress'],
            combineWith: 'and' 
          },
        ],
        blocks: [
          {
            id: 'section-1',
            type: 'section',
            category: 'container',
            position: 0,
            config: {
              title: 'Personal Information',
              description: 'Please provide your basic information',
            },
            children: [
              {
                id: 'field-1',
                type: 'text-field',
                category: 'field',
                position: 0,
                config: {
                  label: 'Full Name',
                  name: 'full_name',
                  required: true,
                  width: 'full',
                },
              },
              {
                id: 'field-2',
                type: 'email-field',
                category: 'field',
                position: 1,
                config: {
                  label: 'Email Address',
                  name: 'email',
                  required: true,
                  width: 'half',
                },
              },
            ],
          } as SectionBlock,
        ],
        settings: {
          showProgress: true,
          allowSaveDraft: true,
          autoSave: true,
          autoSaveInterval: 30000,
        },
      },
      // Submitted Page
      {
        id: 'submitted',
        type: 'status',
        title: 'Application Submitted',
        slug: 'submitted',
        position: 3,
        visibility: [
          VISIBILITY_PRESETS.AUTHENTICATED as VisibilityRule,
          VISIBILITY_PRESETS.SUBMITTED as VisibilityRule,
        ],
        blocks: [
          {
            id: 'hero-2',
            type: 'hero',
            category: 'layout',
            position: 0,
            config: {
              title: 'Application Submitted!',
              subtitle: 'Thank you for your application. We will review it and get back to you soon.',
              align: 'center',
            },
          },
          {
            id: 'status-2',
            type: 'status-card',
            category: 'display',
            position: 1,
            config: {
              showTimeline: true,
              showNextSteps: true,
            },
          },
        ],
      },
      // Request More Info Page
      {
        id: 'more-info',
        type: 'info',
        title: 'Additional Information Required',
        slug: 'more-info',
        position: 4,
        visibility: [
          VISIBILITY_PRESETS.AUTHENTICATED as VisibilityRule,
          VISIBILITY_PRESETS.NEEDS_INFO as VisibilityRule,
        ],
        blocks: [
          {
            id: 'callout-1',
            type: 'callout',
            category: 'layout',
            position: 0,
            config: {
              title: 'Action Required',
              content: 'We need some additional information to process your application.',
              color: 'yellow',
              icon: 'warning',
            },
          },
          {
            id: 'messages-1',
            type: 'message-list',
            category: 'display',
            position: 1,
            config: {
              allowReply: true,
              showTimestamps: true,
            },
          },
        ],
      },
    ],
    theme: {
      primaryColor: '#3B82F6',
      fontFamily: 'inter',
      buttonStyle: 'rounded',
      borderRadius: 'medium',
    },
    language: {
      default: 'en',
      enabled: false,
      supported: [],
    },
    translations: {},
  };
}
