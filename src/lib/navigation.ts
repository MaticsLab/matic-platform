// Navigation Configuration System
// This is the single source of truth for all navigation-related settings
// Change values here to update navigation across the entire application

import { 
  LayoutDashboard, 
  Building2, 
  Compass, 
  User,
  FileText, 
  Mail, 
  MessageCircle, 
  List, 
  BarChart3, 
  FolderKanban,
  FileCheck,
  MessageSquare,
  Calendar,
  GraduationCap,
  Database,
  TrendingUp,
  Zap,
  Settings,
  Users,
  Bell,
  Search,
  Plus,
  Grid3x3,
  Home,
  Layout,
  Table,
  Activity as ActivityIcon
} from "lucide-react"

// =============================================================================
// NAVIGATION SYSTEM CONFIGURATION
// =============================================================================

export const NAV_CONFIG = {
  // Layout Settings
  LAYOUT: {
    HEADER_HEIGHT: 48, // pixels
    SIDEBAR_WIDTH_EXPANDED: 264, // pixels
    SIDEBAR_WIDTH_COLLAPSED: 64, // pixels
    WORKSPACE_DROPDOWN_WIDTH: 200, // pixels
    Z_INDEX: {
      HEADER: 50,
      DROPDOWN: 60,
      MODAL: 100,
      COMMAND_PALETTE: 200,
      TOOLTIP: 300
    }
  },

  // Keyboard Shortcuts
  SHORTCUTS: {
    COMMAND_PALETTE: 'cmd+k', // or 'ctrl+k'
    SWITCH_WORKSPACE: 'cmd+shift+w',
    TOGGLE_SIDEBAR: 'cmd+b',
    CREATE_WORKSPACE: 'cmd+shift+n'
  },

  // Route Configuration
  ROUTES: {
    // Routes that should NOT use the navigation layout
    EXCLUDE_LAYOUT: [
      '/',
      '/login', 
      '/signup', 
      '/verify-email', 
      '/resend-verification',
      '/forgot-password',
      '/reset-password'
    ],
    
    // Default redirects
    DEFAULT_AFTER_LOGIN: '/w/:workspaceSlug', // Redirect to current workspace after login
    DEFAULT_AFTER_LOGOUT: '/login',
    DEFAULT_WORKSPACE_PAGE: '/activities-hubs'
  },

  // Global Navigation Items (always visible in header)
  GLOBAL_NAVIGATION: [
   
    {
      id: 'profile',
      label: 'Profile',
      href: '/profile',
      icon: User,
      description: 'Manage your account settings'
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/profile', // Redirect to profile for now since settings page doesn't exist
      icon: Settings,
      description: 'Account and application settings'
    }
  ],

  // Workspace-specific sidebar navigation (visible when inside a workspace)
  WORKSPACE_NAVIGATION: [
    {
      id: 'activities-hubs',
      label: 'Activities Hub',
      href: '/activities-hubs',
      icon: ActivityIcon,
      description: 'Manage programs and activities'
    },
    {
      id: 'forms',
      label: 'Forms',
      href: '/forms',
      icon: FileText,
      description: 'Create and manage forms'
    },
    {
      id: 'tables',
      label: 'Tables',
      href: '/tables',
      icon: Table,
      description: 'Organize data in tables'
    },
    {
      id: 'request-hubs',
      label: 'Request Hubs',
      href: '/request-hubs',
      icon: Layout,
      description: 'Manage request workflows'
    },
    {
      id: 'projects',
      label: 'Projects',
      href: '/projects',
      icon: FolderKanban,
      description: 'Track projects and tasks'
    },
    {
      id: 'documents',
      label: 'Documents',
      href: '/documents',
      icon: FileCheck,
      description: 'Organize and share documents'
    },
    {
      id: 'discussions',
      label: 'Discussions',
      href: '/discussions',
      icon: MessageSquare,
      description: 'Team discussions and forums'
    },
    {
      id: 'members',
      label: 'Members',
      href: '/members',
      icon: Users,
      description: 'Manage workspace members'
    }
  ],

  // Module Types Available in Workspaces
  MODULE_TYPES: [
    {
      id: 'forms',
      name: 'Forms',
      description: 'Create and manage forms with responses',
      icon: FileText,
      category: 'core',
      premium: false,
      color: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600'
      }
    },
    {
      id: 'tables',
      name: 'Tables',
      description: 'Organize data in Airtable-like tables',
      icon: Table,
      category: 'core',
      premium: false,
      color: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-600'
      }
    },
    {
      id: 'request-hubs',
      name: 'Request Hubs',
      description: 'Manage request workflows with custom tabs',
      icon: Layout,
      category: 'core',
      premium: false,
      color: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: 'text-purple-600'
      }
    },
    {
      id: 'projects',
      name: 'Projects',
      description: 'Track projects and tasks',
      icon: FolderKanban,
      category: 'productivity',
      premium: false,
      color: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600'
      }
    },
    {
      id: 'documents',
      name: 'Documents',
      description: 'Organize and share documents',
      icon: FileCheck,
      category: 'productivity',
      premium: false,
      color: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-600'
      }
    },
    {
      id: 'discussions',
      name: 'Discussions',
      description: 'Team discussions and forums',
      icon: MessageSquare,
      category: 'communication',
      premium: false,
      color: {
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        icon: 'text-pink-600'
      }
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Email integration and management',
      icon: Mail,
      category: 'communication',
      premium: true,
      color: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600'
      }
    },
    {
      id: 'chat',
      name: 'Chat',
      description: 'Real-time team chat',
      icon: MessageCircle,
      category: 'communication',
      premium: true,
      color: {
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        icon: 'text-cyan-600'
      }
    },
    {
      id: 'lists',
      name: 'Lists',
      description: 'Create and manage lists',
      icon: List,
      category: 'productivity',
      premium: false,
      color: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        icon: 'text-orange-600'
      }
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'Charts and data visualization',
      icon: BarChart3,
      category: 'analytics',
      premium: true,
      color: {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        icon: 'text-indigo-600'
      }
    }
  ],

  // Module Categories
  MODULE_CATEGORIES: {
    core: 'Core Modules',
    communication: 'Communication',
    productivity: 'Productivity',
    analytics: 'Analytics'
  },

  // Command Palette Categories
  COMMAND_CATEGORIES: {
    workspace: 'Workspaces',
    dashboard: 'Dashboards',
    module: 'Modules',
    action: 'Actions',
    search: 'Search',
    navigation: 'Navigation'
  },

  // UI Text and Labels
  TEXT: {
    HEADER: {
      SEARCH_PLACEHOLDER: 'Search or jump to...',
      USER_MENU_TITLE: 'Account Menu',
      WORKSPACE_SWITCHER_TITLE: 'Switch Workspace',
      CREATE_WORKSPACE: 'Create Workspace'
    },
    WORKSPACE: {
      DROPDOWN_TITLE: 'Switch Workspace',
      CREATE_NEW: 'Create new workspace',
      NO_WORKSPACES: 'No workspaces found',
      LOADING_WORKSPACES: 'Loading workspaces...'
    },
    SIDEBAR: {
      WORKSPACE_NAVIGATION: 'Workspace Navigation',
      TOGGLE_SIDEBAR: 'Toggle Sidebar'
    },
    CANVAS: {
      EMPTY_STATE_TITLE: 'Empty Dashboard',
      EMPTY_STATE_DESCRIPTION: 'Start building your dashboard by adding modules. You can drag and drop modules anywhere on the canvas and connect them together.',
      ADD_FIRST_MODULE: 'Add Your First Module',
      ADD_MODULE: 'Add Module',
      LOADING: 'Loading...'
    },
    COMMAND_PALETTE: {
      PLACEHOLDER: 'Search or jump to...',
      NO_RESULTS: 'No results found',
      NAVIGATE_HINT: '↑↓ Navigate',
      SELECT_HINT: '↵ Select',
      CLOSE_HINT: 'Esc Close'
    },
    MODULE_PALETTE: {
      TITLE: 'Add Module',
      DESCRIPTION: 'Choose a module to add to your dashboard. You can configure it after adding.',
      ADD_BUTTON: 'Add Module'
    }
  },

  // Feature Flags - Enable/disable features easily
  FEATURES: {
    COMMAND_PALETTE: true,
    MODULE_CONNECTIONS: false, // Coming soon
    DRAG_AND_DROP: true,
    REAL_TIME_COLLABORATION: false, // Coming soon
    MODULE_RESIZE: true,
    TAB_REORDERING: false, // Coming soon
    WORKSPACE_TEMPLATES: false, // Coming soon
    MOBILE_RESPONSIVE: true
  },

  // Theme and Styling
  THEME: {
    PRIMARY_COLOR: 'blue',
    ACCENT_COLOR: 'indigo',
    SUCCESS_COLOR: 'green',
    WARNING_COLOR: 'yellow',
    ERROR_COLOR: 'red',
    BORDER_RADIUS: '8px',
    ANIMATION_DURATION: '200ms'
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Get module configuration by type
export const getModuleConfig = (moduleType: string) => {
  return NAV_CONFIG.MODULE_TYPES.find(module => module.id === moduleType)
}

// Get navigation items for workspace
export const getWorkspaceNavigation = (workspaceSlug: string) => {
  return NAV_CONFIG.WORKSPACE_NAVIGATION.map(item => ({
    ...item,
    href: item.href === '' ? `/w/${workspaceSlug}` : `/w/${workspaceSlug}${item.href}`
  }))
}

// Check if route should exclude navigation layout
export const shouldExcludeLayout = (pathname: string) => {
  return NAV_CONFIG.ROUTES.EXCLUDE_LAYOUT.includes(pathname)
}

// Get modules by category
export const getModulesByCategory = () => {
  return NAV_CONFIG.MODULE_TYPES.reduce((groups, module) => {
    if (!groups[module.category]) {
      groups[module.category] = []
    }
    groups[module.category].push(module)
    return groups
  }, {} as Record<string, typeof NAV_CONFIG.MODULE_TYPES>)
}

// Get keyboard shortcut display text
export const getShortcutText = (shortcut: string) => {
  const isMac = typeof navigator !== 'undefined' && 
    navigator.platform.toUpperCase().indexOf('MAC') >= 0
  
  return shortcut
    .replace('cmd', isMac ? '⌘' : 'Ctrl')
    .replace('+', isMac ? '' : '+')
    .toUpperCase()
}