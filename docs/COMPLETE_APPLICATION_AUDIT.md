# Matic Platform - Complete Application Audit & Documentation

**Date:** January 25, 2026  
**Platform:** Matic Platform - Full-Stack Airtable-Like Platform  
**Architecture:** Next.js 14 + Go Backend + PostgreSQL (Supabase)

---

## 📋 Executive Summary

Matic Platform is a comprehensive, full-stack Airtable-like platform designed for forms, data tables, review workflows, and multi-tenant workspace management. The application follows a hybrid architecture where a Go backend handles all CRUD operations while utilizing Supabase for authentication and real-time updates.

**Key Statistics:**
- **Frontend Files:** ~800+ TypeScript/React files
- **Backend Files:** ~40 Go handler files, 13 core models
- **API Endpoints:** 100+ REST endpoints
- **Database Tables:** 18+ core tables with Better Auth integration
- **Authentication:** Better Auth with PostgreSQL backend
- **Real-time:** Supabase postgres_changes integration

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                        │
│                 Next.js 14 App Router                       │
│                    (localhost:3000)                         │
│  Routes:                                                    │
│  - /workspace/[slug]         - /signup-v2                   │
│  - /login                    - /dashboard                   │
│  - /forms/[id]               - /api/auth/[...all]          │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ API Calls (goFetch)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND API (Render)                       │
│                Go + Gin Framework                           │
│                (localhost:8080)                             │
│  Routes:                                                    │
│  - /api/v1/workspaces        - /api/v1/forms               │
│  - /api/v1/tables            - /api/v1/organizations       │
│  - /api/v1/workflows         - /api/v1/search              │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ GORM ORM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                  │
│                PostgreSQL (Supabase)                        │
│  Core Tables:                                               │
│  - ba_users, ba_sessions     - workspaces                   │
│  - data_tables, table_rows   - forms, form_submissions      │
│  - automation_workflows      - organizations                │
│  Real-time: postgres_changes triggers                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Pattern

**Critical Pattern (from copilot instructions):**
```
Frontend Component → API Client (src/lib/api/*-client.ts)
  → Go Backend (go-backend/handlers/*.go)
  → GORM Model → PostgreSQL

Realtime: PostgreSQL → Supabase postgres_changes → Client useEffect
```

**Rule**: Frontend NEVER queries Supabase directly for data (except auth). All CRUD goes through Go backend.

---

## 📁 Detailed File Structure Analysis

### Frontend Structure (`src/`)

```
src/
├── 📂 app/                          # Next.js 14 App Router
│   ├── 📂 api/                      # Next.js API routes
│   │   ├── auth/[...all]/route.ts   # Better Auth handler
│   │   ├── user/route.ts            # User profile endpoints
│   │   ├── workflows/               # Workflow API endpoints
│   │   └── api-keys/route.ts        # API key management
│   ├── 📂 workspace/[slug]/         # Dynamic workspace routes
│   │   └── page.tsx                 # Main workspace interface
│   ├── 📂 signup-v2/                # Authentication pages
│   │   └── page.tsx                 # Login/signup form
│   ├── 📂 forms/[id]/               # Public form routes
│   │   └── page.tsx                 # Form rendering
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Landing page
├── 📂 components/                   # React components
│   ├── 📂 auth/                     # Authentication components
│   │   ├── ProtectedRoute.tsx       # Route protection
│   │   └── AuthForm.tsx             # Login/signup forms
│   ├── 📂 forms/                    # Form-related components
│   │   ├── FormRenderer.tsx         # Dynamic form rendering
│   │   ├── FieldComponents/         # Field type components
│   │   └── FormBuilder.tsx          # Form creation interface
│   ├── 📂 tables/                   # Table management
│   │   ├── DataTable.tsx            # Main table component
│   │   ├── TableBuilder.tsx         # Table creation
│   │   └── RowEditor.tsx            # Row editing interface
│   ├── 📂 workflows/                # Review workflow components
│   │   ├── WorkflowBuilder.tsx      # Workflow configuration
│   │   ├── ReviewInterface.tsx      # Review UI
│   │   └── StageManager.tsx         # Application stages
│   ├── NavigationLayout.tsx         # Main app shell
│   ├── WorkspaceTabProvider.tsx     # Tab management
│   └── TabContentRouter.tsx         # Tab routing logic
├── 📂 lib/                          # Core utilities & APIs
│   ├── 📂 api/                      # API client modules
│   │   ├── go-client.ts             # Base Go API client
│   │   ├── workspaces-client.ts     # Workspace operations
│   │   ├── forms-client.ts          # Form operations
│   │   ├── tables-client.ts         # Table operations
│   │   ├── workflows-client.ts      # Workflow operations
│   │   ├── organizations-client.ts  # Organization management
│   │   ├── search-client.ts         # Search functionality
│   │   └── [30+ other clients]      # Specialized API clients
│   ├── 📂 workflow/                 # Workflow automation
│   │   ├── workflow-executor.ts     # Workflow execution engine
│   │   ├── condition-evaluator.ts   # Business logic evaluation
│   │   ├── plugins/                 # Workflow plugins
│   │   │   ├── resend/              # Email automation
│   │   │   ├── matic-review/        # Review automation
│   │   │   └── registry.ts          # Plugin registry
│   │   └── steps/                   # Workflow step types
│   ├── better-auth.ts               # Authentication configuration
│   ├── better-auth-client.ts        # Client-side auth
│   ├── tab-manager.ts               # Workspace tab system
│   ├── supabase.ts                  # Supabase client (auth only)
│   └── utils.ts                     # Shared utilities
├── 📂 types/                        # TypeScript type definitions
│   ├── workspaces.ts               # Workspace types
│   ├── data-tables.ts              # Table types
│   ├── forms.ts                    # Form types
│   ├── workflows.ts                # Workflow types
│   └── activities-hubs.ts          # Hub types
├── 📂 hooks/                       # Custom React hooks
│   ├── useAuth.ts                  # Authentication hooks
│   ├── useWorkspace.ts             # Workspace state
│   └── useRealtime.ts              # Real-time updates
└── 📂 ui-components/               # shadcn/ui components
    ├── button.tsx                  # Button component
    ├── dialog.tsx                  # Modal dialogs
    ├── table.tsx                   # Table primitives
    └── [20+ UI components]         # Complete UI library
```

### Backend Structure (`go-backend/`)

```
go-backend/
├── main.go                         # Application entry point
├── 📂 config/                      # Configuration management
│   └── config.go                   # Environment & settings
├── 📂 database/                    # Database layer
│   └── database.go                 # GORM connection & migrations
├── 📂 models/                      # Data models
│   └── models.go                   # 13+ GORM models
├── 📂 handlers/                    # HTTP request handlers
│   ├── workspaces.go              # Workspace CRUD operations
│   ├── organizations.go           # Organization management
│   ├── data_tables.go             # Table & row CRUD
│   ├── forms.go                   # Form & submission handling
│   ├── workflows.go               # Review workflow management
│   ├── submissions.go             # Form submission processing
│   ├── search.go                  # Search functionality
│   ├── email.go                   # Email operations
│   ├── portal_auth.go             # Portal authentication
│   ├── automation_workflows.go    # Workflow automation
│   ├── invitations.go             # Organization invitations
│   ├── activities_hubs.go         # Activity hub management
│   ├── admin.go                   # Admin operations
│   ├── ai.go                      # AI integrations
│   ├── files.go                   # File upload/management
│   ├── integrations.go            # Third-party integrations
│   ├── reports.go                 # Analytics & reporting
│   └── [20+ other handlers]       # Specialized endpoints
├── 📂 router/                     # HTTP routing
│   └── router.go                  # API routes & middleware setup
├── 📂 middleware/                 # HTTP middleware
│   ├── auth.go                    # Authentication middleware
│   ├── cors.go                    # CORS configuration
│   └── logging.go                 # Request logging
├── 📂 services/                   # Business logic services
│   ├── email_service.go           # Email delivery
│   ├── workflow_service.go        # Workflow execution
│   └── search_service.go          # Search indexing
├── 📂 scripts/                    # Utility scripts
│   ├── migrate.go                 # Database migrations
│   └── seed.go                    # Test data seeding
├── .env.example                   # Environment template
├── go.mod                         # Go dependencies
└── README.md                      # Backend documentation
```

---

## 🗄️ Database Schema Analysis

### Core Tables (PostgreSQL via Supabase)

#### Authentication Tables (Better Auth)
```sql
-- User management (Better Auth tables with ba_ prefix)
ba_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Custom fields for migration
  supabase_user_id TEXT,
  migrated_from_supabase BOOLEAN DEFAULT FALSE,
  full_name TEXT,
  avatar_url TEXT
)

ba_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES ba_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  active_organization_id TEXT, -- Organization context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

ba_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES ba_users(id),
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### Core Business Tables
```sql
-- Organizations (Multi-tenant containers)
organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'free',
  ba_created_by TEXT REFERENCES ba_users(id), -- Better Auth user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Organization membership
organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ba_user_id TEXT REFERENCES ba_users(id), -- Better Auth user
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Workspaces (Project containers within organizations)
workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  ba_created_by TEXT REFERENCES ba_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
)

-- Workspace members
workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  ba_user_id TEXT REFERENCES ba_users(id),
  ba_invited_by TEXT REFERENCES ba_users(id),
  role TEXT NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### Data Tables & Forms
```sql
-- Data tables (Airtable-like tables)
data_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  ba_created_by TEXT REFERENCES ba_users(id),
  settings JSONB DEFAULT '{}', -- Table configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Table rows (Dynamic data storage)
table_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES data_tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}', -- Dynamic field data
  ba_created_by TEXT REFERENCES ba_users(id),
  ba_updated_by TEXT REFERENCES ba_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Forms (Application forms)
forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  view_id UUID, -- Optional table view reference
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  custom_slug TEXT, -- User-defined slug
  description TEXT,
  structure JSONB NOT NULL DEFAULT '[]', -- Form field definitions
  settings JSONB DEFAULT '{}', -- Form configuration
  ba_created_by TEXT REFERENCES ba_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
)

-- Form submissions
form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}', -- Submission data
  status TEXT DEFAULT 'draft', -- draft, submitted, approved, rejected
  applicant_email TEXT,
  applicant_name TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### Review Workflows
```sql
-- Review workflows (Application review processes)
review_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  ba_user_id TEXT REFERENCES ba_users(id), -- Creator
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Application stages (Review pipeline stages)
application_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_workflow_id UUID REFERENCES review_workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Application groups (Organized review groups)
application_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_workflow_id UUID REFERENCES review_workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_system_group BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### Search & Analytics
```sql
-- Search analytics
search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  ba_user_id TEXT REFERENCES ba_users(id),
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  clicked_result_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Email tracking
sent_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  recipient_email TEXT NOT NULL,
  subject TEXT,
  template_id UUID,
  status TEXT DEFAULT 'sent', -- sent, delivered, opened, failed
  tracking_id TEXT UNIQUE,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 🔗 API Architecture Analysis

### API Client Pattern (Frontend → Backend)

The application follows a consistent API client pattern:

#### Base Client (`src/lib/api/go-client.ts`)
```typescript
// Base API client with authentication
export async function goFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  // Auto-inject Better Auth token
  const token = await getSessionToken()
  
  const response = await fetch(`${GO_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    throw new GoAPIError(message, response.status, errorData)
  }
  
  return response.json()
}
```

#### Feature-Specific Clients
Each major feature has its own client module following this pattern:

**Workspaces Client (`src/lib/api/workspaces-client.ts`)**
```typescript
export const workspacesClient = {
  list: () => goFetch<Workspace[]>('/workspaces'),
  create: (data: CreateWorkspaceRequest) => 
    goFetch<Workspace>('/workspaces', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
  get: (id: string) => goFetch<Workspace>(`/workspaces/${id}`),
  update: (id: string, data: UpdateWorkspaceRequest) => 
    goFetch<Workspace>(`/workspaces/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
  delete: (id: string) => 
    goFetch<void>(`/workspaces/${id}`, { method: 'DELETE' }),
}
```

**Forms Client (`src/lib/api/forms-client.ts`)**
```typescript
export const formsClient = {
  list: (workspaceId: string) => 
    goFetch<Form[]>(`/forms?workspace_id=${workspaceId}`),
  create: (data: CreateFormRequest) => 
    goFetch<Form>('/forms', { method: 'POST', body: JSON.stringify(data) }),
  getBySlug: (slug: string) => goFetch<Form>(`/forms/by-slug/${slug}`),
  submit: (id: string, data: FormSubmissionData) => 
    goFetch<FormSubmission>(`/forms/${id}/submit`, { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
  // ... 20+ other form operations
}
```

### Backend Handler Pattern (Go)

Each handler follows a consistent CRUD pattern:

#### Handler Structure (`go-backend/handlers/workspaces.go`)
```go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/Jsanchez767/matic-platform/database"
    "github.com/Jsanchez767/matic-platform/models"
    "github.com/Jsanchez767/matic-platform/middleware"
)

// List workspaces for authenticated user
func ListWorkspaces(c *gin.Context) {
    // Get user from Better Auth token
    userID := middleware.GetUserID(c)
    
    var workspaces []models.Workspace
    err := database.DB.
        Joins("LEFT JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
        Where("workspace_members.ba_user_id = ? OR workspaces.ba_created_by = ?", userID, userID).
        Find(&workspaces).Error
        
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, workspaces)
}

// Create new workspace
func CreateWorkspace(c *gin.Context) {
    userID := middleware.GetUserID(c)
    
    var input models.Workspace
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    input.BACreatedBy = userID
    
    if err := database.DB.Create(&input).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusCreated, input)
}
```

### Route Registration (`go-backend/router/router.go`)
```go
func SetupRouter(cfg *config.Config) *gin.Engine {
    router := gin.Default()
    
    // CORS middleware
    router.Use(cors.New(cors.Config{
        AllowOrigins: []string{
            "http://localhost:3000",
            "https://www.maticsapp.com",
            "https://*.vercel.app",
        },
        AllowCredentials: true,
        AllowHeaders: []string{"Authorization", "Content-Type"},
    }))
    
    api := router.Group("/api/v1")
    
    // Public routes
    api.GET("/health", handlers.HealthCheck)
    api.GET("/forms/by-slug/:slug", handlers.GetFormBySlug)
    api.POST("/forms/:id/submit", handlers.SubmitForm)
    
    // Protected routes
    protected := api.Group("")
    protected.Use(middleware.AuthMiddleware(cfg))
    {
        // Organizations
        organizations := protected.Group("/organizations")
        {
            organizations.GET("", handlers.ListOrganizations)
            organizations.POST("", handlers.CreateOrganization)
            organizations.GET("/:id", handlers.GetOrganization)
            organizations.PATCH("/:id", handlers.UpdateOrganization)
            organizations.DELETE("/:id", handlers.DeleteOrganization)
        }
        
        // Workspaces
        workspaces := protected.Group("/workspaces")
        {
            workspaces.GET("", handlers.ListWorkspaces)
            workspaces.POST("", handlers.CreateWorkspace)
            workspaces.GET("/:id", handlers.GetWorkspace)
            workspaces.PATCH("/:id", handlers.UpdateWorkspace)
            workspaces.DELETE("/:id", handlers.DeleteWorkspace)
        }
        
        // ... 15+ other resource groups
    }
    
    return router
}
```

---

## 🔐 Authentication System Deep Dive

### Better Auth Configuration (`src/lib/better-auth.ts`)

```typescript
export const auth = betterAuth({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  
  // PostgreSQL adapter with custom table names
  database: pool,
  
  // Email configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      // Resend integration for password reset emails
      await resend.emails.send({
        from: "Matics <noreply@notifications.maticsapp.com>",
        to: user.email,
        subject: "Reset your password - Matics",
        html: `<!-- Reset email template -->`,
      })
    },
  },
  
  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },
  
  // Plugins for advanced features
  plugins: [
    // Organization plugin for multi-tenant support
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      // TODO: Add sendInvitationEmail handler
    }),
    
    // Multi-session support
    multiSession({
      maximumSessions: 5,
    }),
    
    // Magic Link authentication
    magicLink({
      sendMagicLink: async ({ email, url, token }, ctx) => {
        // Complex portal branding logic
        // Fetches form configuration for custom branding
        // Sends branded magic link emails
      },
      expiresIn: 300, // 5 minutes
    }),
  ],
  
  // Custom table mappings for ba_* tables
  user: {
    modelName: "ba_users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      supabaseUserId: { type: "string", fieldName: "supabase_user_id" },
      migratedFromSupabase: { type: "boolean", fieldName: "migrated_from_supabase" },
      fullName: { type: "string", fieldName: "full_name" },
      avatarUrl: { type: "string", fieldName: "avatar_url" },
    },
  },
  
  session: {
    modelName: "ba_sessions",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      // ... other field mappings
    },
  },
  
  // Production cookie configuration
  advanced: {
    cookies: {
      sessionToken: {
        attributes: {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
        },
      },
    },
  },
})
```

### Authentication Middleware (Go Backend)

```go
// middleware/auth.go
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Extract token from Authorization header or cookies
        token := extractBearerToken(c)
        if token == "" {
            token = extractCookieToken(c)
        }
        
        if token == "" {
            c.JSON(401, gin.H{"error": "Authentication required"})
            c.Abort()
            return
        }
        
        // Validate token against ba_sessions table
        var session models.Session
        err := database.DB.
            Where("token = ? AND expires_at > NOW()", token).
            First(&session).Error
            
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid or expired token"})
            c.Abort()
            return
        }
        
        // Store user ID in context
        c.Set("user_id", session.UserID)
        c.Next()
    }
}

func GetUserID(c *gin.Context) string {
    userID, exists := c.Get("user_id")
    if !exists {
        return ""
    }
    return userID.(string)
}
```

---

## 📊 Key Features Analysis

### 1. Workspace Management System

**Frontend Components:**
- `WorkspaceTabProvider.tsx` - Tab state management with localStorage persistence
- `TabContentRouter.tsx` - Dynamic content routing based on active tab
- `NavigationLayout.tsx` - Workspace navigation shell

**Backend Handlers:**
- `workspaces.go` - Full CRUD operations
- Organization-based access control
- Member invitation system

**Key Features:**
- Multi-tenant workspace isolation
- Tab-based navigation system
- Real-time collaboration
- Member role management

### 2. Dynamic Data Tables (Airtable-like)

**Frontend Components:**
- `DataTable.tsx` - Main table rendering with virtualization
- `TableBuilder.tsx` - Table schema creation
- `RowEditor.tsx` - Row editing interface
- `FieldComponents/` - Dynamic field type renderers

**Backend Handlers:**
- `data_tables.go` - Table CRUD
- Dynamic schema management via JSONB
- Row-level security
- Search and filtering

**Key Features:**
- Dynamic field types (text, number, date, dropdown, etc.)
- Table relationships and linking
- Bulk operations
- Import/export functionality

### 3. Form Builder & Submission System

**Frontend Components:**
- `FormBuilder.tsx` - Drag-and-drop form creation
- `FormRenderer.tsx` - Public form rendering
- `SubmissionReview.tsx` - Admin review interface

**Backend Handlers:**
- `forms.go` - Form management (2,659 lines - largest handler)
- `submissions.go` - Submission processing
- Multi-step form support
- File upload handling

**Key Features:**
- Visual form builder
- Conditional logic
- Multi-step forms
- File attachments
- Custom URL slugs
- Applicant portal

### 4. Review Workflow System

**Frontend Components:**
- `WorkflowBuilder.tsx` - Workflow configuration
- `ReviewInterface.tsx` - Review dashboard
- `ApplicationStages.tsx` - Stage management

**Backend Handlers:**
- `workflows.go` - Workflow CRUD
- `groups.go` - Application grouping
- Review assignment logic
- Stage progression tracking

**Key Features:**
- Multi-stage review processes
- Reviewer assignment
- Scoring and rubrics
- Application grouping
- Progress tracking

### 5. Automation System

**Frontend Components:**
- `workflow/` - Complete automation framework
- Visual workflow builder
- Plugin system architecture

**Backend Integration:**
- Webhook triggers
- Email automation via Resend
- Conditional logic execution
- External API integrations

**Key Features:**
- Visual workflow builder
- Plugin architecture (Resend, custom plugins)
- Trigger-based automation
- Template system
- Error handling and logging

### 6. Search & Analytics

**Frontend Components:**
- Global search interface
- Analytics dashboard
- Search suggestions

**Backend Handlers:**
- `search.go` - Search functionality
- `semantic_search.go` - AI-powered search
- `reports.go` - Analytics and reporting

**Key Features:**
- Global workspace search
- Semantic search capabilities
- Search analytics
- Popular/recent queries
- Usage reporting

---

## 🚀 Development Workflow

### Local Development Setup

**Terminal 1 - Backend:**
```bash
cd go-backend
go run main.go
# Serves API on localhost:8080
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Serves Next.js on localhost:3000
```

### Environment Configuration

**Frontend (`.env.local`):**
```bash
# Better Auth
BETTER_AUTH_SECRET=your-secure-secret-minimum-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Backend API
NEXT_PUBLIC_GO_API_URL=http://localhost:8080/api/v1

# Database & Auth
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Email
RESEND_API_KEY=re_your-resend-key
EMAIL_FROM="Matics <noreply@notifications.maticsapp.com>"

# Social Auth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Backend (`go-backend/.env`):**
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Server
PORT=8080
GIN_MODE=debug
ALLOWED_ORIGINS=http://localhost:3000,https://www.maticsapp.com

# Better Auth (for token validation)
BETTER_AUTH_SECRET=same-as-frontend-secret
```

### Build Process

**Frontend:**
```bash
npm run build    # Next.js production build
npm run start    # Production server
```

**Backend:**
```bash
go build -o matic-platform main.go    # Compile binary
./matic-platform                      # Run production
```

---

## 🔧 Technical Implementation Details

### Tab Management System

The application uses a sophisticated tab system for workspace navigation:

**Tab Manager (`src/lib/tab-manager.ts`):**
```typescript
export class TabManager {
  private static instance: TabManager
  private storage: TabStorage
  
  // localStorage-based tab persistence
  private getStorageKey(workspaceId: string): string {
    return `workspace-tabs-${workspaceId}`
  }
  
  // Auto-create Overview tab if all tabs closed
  ensureOverviewTab(workspaceId: string): WorkspaceTab {
    const tabs = this.getTabs(workspaceId)
    if (tabs.length === 0) {
      return this.createTab(workspaceId, {
        id: 'overview',
        title: 'Overview',
        type: 'overview',
        isCloseable: false,
      })
    }
    return tabs[0]
  }
  
  // Navigation through tab system (not direct Next.js routing)
  navigateToTab(workspaceId: string, tabId: string): void {
    // Always navigate through tab system
    this.setActiveTab(workspaceId, tabId)
    // Update URL without full navigation
    window.history.replaceState(null, '', `/workspace/${workspaceSlug}`)
  }
}
```

### Real-time Updates Pattern

**Supabase Realtime Integration:**
```typescript
// Only for specific real-time features
// Most data flows through Go backend
useEffect(() => {
  const channel = supabase
    .channel(`table_rows_${tableId}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'table_rows',
        filter: `table_id=eq.${tableId}`
      },
      (payload) => {
        // Update local state when row changes
        handleRowUpdate(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [tableId])
```

### Dynamic Field System

**Field Type Registry:**
```typescript
// Dynamic field types for forms and tables
export const FIELD_TYPES = {
  text: {
    component: TextFieldComponent,
    validation: (value: string) => ({ isValid: true }),
    defaultValue: '',
  },
  number: {
    component: NumberFieldComponent,
    validation: (value: number) => ({ isValid: !isNaN(value) }),
    defaultValue: 0,
  },
  dropdown: {
    component: DropdownFieldComponent,
    validation: (value: string, options: string[]) => ({ 
      isValid: options.includes(value) 
    }),
    defaultValue: null,
  },
  // ... 20+ field types
}

// Dynamic rendering
const FieldRenderer: React.FC<{field: Field, value: any}> = ({field, value}) => {
  const fieldType = FIELD_TYPES[field.type]
  const Component = fieldType.component
  return <Component field={field} value={value} />
}
```

---

## 📈 Performance & Optimization

### Frontend Optimizations

1. **Code Splitting:**
   - Route-based splitting via Next.js App Router
   - Dynamic imports for heavy components
   - Lazy loading for tab content

2. **State Management:**
   - Minimal useState for local state
   - React Query for server state (where used)
   - Context providers for workspace/tab state

3. **Bundle Optimization:**
   - Tree shaking for unused code
   - Dynamic imports for optional features
   - Image optimization via Next.js Image

### Backend Optimizations

1. **Database Queries:**
   - GORM query optimization
   - Proper indexing on frequently queried columns
   - Connection pooling for PostgreSQL

2. **Caching Strategy:**
   - No application-level caching (relies on database performance)
   - Static file caching via CDN

3. **API Design:**
   - RESTful endpoints with consistent patterns
   - Bulk operations where appropriate
   - Pagination for large datasets

---

## 🚨 Security Implementation

### Authentication Security

1. **Better Auth Features:**
   - HTTP-only cookies for session tokens
   - CSRF protection built-in
   - Secure cookie settings for production
   - Session expiration and refresh

2. **Authorization Patterns:**
   - Middleware-based route protection
   - Role-based access control (RBAC)
   - Resource-level permissions
   - Organization isolation

### Data Security

1. **Input Validation:**
   - Server-side validation for all inputs
   - GORM SQL injection protection
   - File upload restrictions

2. **Database Security:**
   - Row Level Security where applicable
   - Encrypted connections (SSL)
   - Environment variable protection

---

## 📋 Testing Strategy

### Current Testing Status

**Frontend Testing:**
- Limited test coverage currently
- Uses Vitest for unit testing
- Component testing capabilities available

**Backend Testing:**
- Go testing framework available
- Handler testing patterns established
- Database testing with test fixtures

### Testing Opportunities

1. **Unit Tests:**
   - API client functions
   - Utility functions
   - Component logic

2. **Integration Tests:**
   - API endpoint testing
   - Authentication flows
   - Database operations

3. **E2E Tests:**
   - User workflows
   - Form submission flows
   - Multi-user collaboration

---

## 🔄 Deployment Architecture

### Production Setup

**Frontend (Vercel):**
- Automatic deployments from main branch
- Environment variables configured
- Edge caching enabled
- Custom domain: www.maticsapp.com

**Backend (Render/Similar):**
- Go binary deployment
- Environment variables secured
- Health check endpoint: `/health`
- Database connection via connection string

**Database (Supabase):**
- Managed PostgreSQL instance
- Row Level Security enabled
- Real-time subscriptions configured
- Backup and recovery automated

---

## 📊 Application Metrics

### Codebase Statistics

- **Total Files:** ~1,200+ files
- **Frontend TypeScript/React:** ~800 files
- **Backend Go:** ~50 files
- **Database Models:** 18+ tables
- **API Endpoints:** 100+ endpoints
- **UI Components:** 25+ reusable components
- **API Clients:** 35+ specialized clients

### Feature Coverage

- ✅ **Authentication:** Complete with Better Auth
- ✅ **Multi-tenancy:** Organizations + Workspaces
- ✅ **Data Tables:** Full CRUD with dynamic fields
- ✅ **Form Builder:** Visual builder with submissions
- ✅ **Review Workflows:** Multi-stage review process
- ✅ **Search:** Global search with analytics
- ✅ **Email:** Automated email workflows
- ✅ **File Management:** Upload and storage
- ✅ **Real-time:** Collaborative updates
- ✅ **Automation:** Workflow automation system
- ⚠️ **Testing:** Limited coverage
- ⚠️ **Documentation:** Partial API docs
- ⚠️ **Monitoring:** Basic health checks

---

## 🚀 Future Development Opportunities

### Immediate Improvements (High Priority)

1. **Better Auth Enhancement:**
   - Complete organization invitation system
   - Advanced role-based permissions
   - Teams feature within organizations

2. **Testing Coverage:**
   - Unit tests for critical functions
   - Integration tests for API endpoints
   - E2E tests for user flows

3. **Performance Monitoring:**
   - Application performance monitoring (APM)
   - Error tracking and alerting
   - Usage analytics

### Medium-term Enhancements

1. **Advanced Features:**
   - Advanced reporting and analytics
   - Third-party integrations (Slack, etc.)
   - Mobile-responsive improvements

2. **Developer Experience:**
   - API documentation generation
   - Development tooling improvements
   - Automated deployment pipelines

3. **Scalability:**
   - Database query optimization
   - Caching layer implementation
   - CDN integration for files

### Long-term Vision

1. **Enterprise Features:**
   - Single Sign-On (SSO)
   - Advanced audit logging
   - Compliance features (GDPR, etc.)

2. **Platform Extensions:**
   - Plugin marketplace
   - Third-party developer APIs
   - Webhook ecosystem

---

## 📝 Conclusion

Matic Platform represents a sophisticated, production-ready full-stack application with a clean architecture and comprehensive feature set. The hybrid Go backend + Next.js frontend approach provides excellent performance and developer experience while maintaining type safety throughout the stack.

**Key Strengths:**
- Well-architected separation of concerns
- Comprehensive authentication system
- Flexible data modeling with JSONB
- Real-time collaboration capabilities
- Extensive feature coverage

**Areas for Growth:**
- Enhanced testing coverage
- Advanced monitoring and observability
- Complete Better Auth feature utilization
- Performance optimization opportunities

The application demonstrates excellent technical decision-making and follows modern development best practices, positioning it well for continued growth and scaling.