package router

import (
	"net/http"
	"strings"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/handlers"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// CORS configuration with dynamic origin checking for subdomains
	corsConfig := cors.Config{
		AllowOriginFunc: func(origin string) bool {
			// Allow localhost for development
			if strings.HasPrefix(origin, "http://localhost") {
				return true
			}
			// Allow any *.maticsapp.com subdomain (including www)
			if strings.HasSuffix(origin, ".maticsapp.com") || origin == "https://maticsapp.com" || origin == "https://www.maticsapp.com" {
				return true
			}

			// Allow Vercel preview deployments
			if strings.HasSuffix(origin, ".vercel.app") {
				return true
			}
			// Check against explicitly configured origins
			for _, allowed := range cfg.AllowedOrigins {
				if origin == allowed {
					return true
				}
			}
			return false
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Cookie", "X-Portal-Token"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}
	r.Use(cors.New(corsConfig))

	// Load HTML templates
	r.LoadHTMLGlob("templates/*")

	// Serve static files (uploaded documents)
	r.Static("/uploads", "./uploads")

	// Root route - API documentation (HTML)
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "api-docs.html", nil)
	})

	// JSON API info endpoint
	r.GET("/api-info", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service":     "Matic Platform API",
			"version":     "1.0.0",
			"status":      "running",
			"description": "matics",
			"endpoints": gin.H{
				"health":          "/health",
				"api_v1":          "/api/v1",
				"workspaces":      "/api/v1/workspaces",
				"tables":          "/api/v1/tables",
				"forms":           "/api/v1/forms",
				"activities_hubs": "/api/v1/activities-hubs",
			},
			"documentation": gin.H{
				"html":   "/",
				"json":   "/api/v1/docs",
				"health": "/health",
			},
		})
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "matic-platform-go",
			"version": "1.0.0",
		})
	})

	// API v1 routes
	api := r.Group("/api/v1")
	{
		// API v1 root endpoint - same as /docs
		api.GET("", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"api_version": "v1",
				"status":      "running",
				"service":     "Matic Platform API",
				"endpoints": gin.H{
					"workspaces": gin.H{
						"list":   "GET /api/v1/workspaces",
						"create": "POST /api/v1/workspaces",
						"get":    "GET /api/v1/workspaces/:id",
						"update": "PATCH /api/v1/workspaces/:id",
						"delete": "DELETE /api/v1/workspaces/:id",
					},
					"activities_hubs": gin.H{
						"list":         "GET /api/v1/activities-hubs",
						"create":       "POST /api/v1/activities-hubs",
						"get":          "GET /api/v1/activities-hubs/:hub_id",
						"get_by_slug":  "GET /api/v1/activities-hubs/by-slug/:slug",
						"update":       "PATCH /api/v1/activities-hubs/:hub_id",
						"delete":       "DELETE /api/v1/activities-hubs/:hub_id",
						"list_tabs":    "GET /api/v1/activities-hubs/:hub_id/tabs",
						"create_tab":   "POST /api/v1/activities-hubs/:hub_id/tabs",
						"update_tab":   "PATCH /api/v1/activities-hubs/:hub_id/tabs/:tab_id",
						"delete_tab":   "DELETE /api/v1/activities-hubs/:hub_id/tabs/:tab_id",
						"reorder_tabs": "POST /api/v1/activities-hubs/:hub_id/tabs/reorder",
					},
					"tables": gin.H{
						"list":          "GET /api/v1/tables",
						"create":        "POST /api/v1/tables",
						"get":           "GET /api/v1/tables/:id",
						"update":        "PATCH /api/v1/tables/:id",
						"delete":        "DELETE /api/v1/tables/:id",
						"list_rows":     "GET /api/v1/tables/:id/rows",
						"create_row":    "POST /api/v1/tables/:id/rows",
						"update_row":    "PATCH /api/v1/tables/:id/rows/:row_id",
						"delete_row":    "DELETE /api/v1/tables/:id/rows/:row_id",
						"create_column": "POST /api/v1/tables/:id/columns",
						"update_column": "PATCH /api/v1/tables/:id/columns/:column_id",
						"delete_column": "DELETE /api/v1/tables/:id/columns/:column_id",
					},
					"forms": gin.H{
						"list":             "GET /api/v1/forms",
						"create":           "POST /api/v1/forms",
						"get":              "GET /api/v1/forms/:id",
						"update":           "PATCH /api/v1/forms/:id",
						"delete":           "DELETE /api/v1/forms/:id",
						"list_submissions": "GET /api/v1/forms/:id/submissions",
						"submit":           "POST /api/v1/forms/:id/submit",
					},
				},
			})
		})

		// API Documentation - public
		api.GET("/docs", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"api_version": "v1",
				"endpoints": gin.H{
					"workspaces": gin.H{
						"list":   "GET /api/v1/workspaces",
						"create": "POST /api/v1/workspaces",
						"get":    "GET /api/v1/workspaces/:id",
						"update": "PATCH /api/v1/workspaces/:id",
						"delete": "DELETE /api/v1/workspaces/:id",
					},
					"activities_hubs": gin.H{
						"list":         "GET /api/v1/activities-hubs",
						"create":       "POST /api/v1/activities-hubs",
						"get":          "GET /api/v1/activities-hubs/:hub_id",
						"get_by_slug":  "GET /api/v1/activities-hubs/by-slug/:slug",
						"update":       "PATCH /api/v1/activities-hubs/:hub_id",
						"delete":       "DELETE /api/v1/activities-hubs/:hub_id",
						"list_tabs":    "GET /api/v1/activities-hubs/:hub_id/tabs",
						"create_tab":   "POST /api/v1/activities-hubs/:hub_id/tabs",
						"update_tab":   "PATCH /api/v1/activities-hubs/:hub_id/tabs/:tab_id",
						"delete_tab":   "DELETE /api/v1/activities-hubs/:hub_id/tabs/:tab_id",
						"reorder_tabs": "POST /api/v1/activities-hubs/:hub_id/tabs/reorder",
					},
					"tables": gin.H{
						"list":          "GET /api/v1/tables",
						"create":        "POST /api/v1/tables",
						"get":           "GET /api/v1/tables/:id",
						"update":        "PATCH /api/v1/tables/:id",
						"delete":        "DELETE /api/v1/tables/:id",
						"list_rows":     "GET /api/v1/tables/:id/rows",
						"create_row":    "POST /api/v1/tables/:id/rows",
						"update_row":    "PATCH /api/v1/tables/:id/rows/:row_id",
						"delete_row":    "DELETE /api/v1/tables/:id/rows/:row_id",
						"create_column": "POST /api/v1/tables/:id/columns",
						"update_column": "PATCH /api/v1/tables/:id/columns/:column_id",
						"delete_column": "DELETE /api/v1/tables/:id/columns/:column_id",
						"search":        "GET /api/v1/tables/:id/search",
					},
					"forms": gin.H{
						"list":             "GET /api/v1/forms",
						"create":           "POST /api/v1/forms",
						"get":              "GET /api/v1/forms/:id",
						"update":           "PATCH /api/v1/forms/:id",
						"delete":           "DELETE /api/v1/forms/:id",
						"list_submissions": "GET /api/v1/forms/:id/submissions",
						"submit":           "POST /api/v1/forms/:id/submit",
						"search":           "GET /api/v1/forms/:id/search",
					},
					"search": gin.H{
						"workspace":     "GET /api/v1/search?q=query&workspace_id=uuid",
						"suggestions":   "GET /api/v1/search/suggestions?q=query&workspace_id=uuid",
						"recent":        "GET /api/v1/search/recent?workspace_id=uuid&limit=10",
						"save_history":  "POST /api/v1/search/history",
						"popular":       "GET /api/v1/search/popular?workspace_id=uuid&limit=5",
						"clear_history": "DELETE /api/v1/search/history/:workspace_id",
					},
				},
			})
		})

		// Public Form Routes
		api.GET("/forms/by-slug/:slug", handlers.GetFormBySlug)
		api.GET("/forms/by-subdomain/:subdomain/:slug", handlers.GetFormBySubdomainSlug) // Pretty URL resolution
		api.POST("/forms/:id/submit", handlers.SubmitForm)
		api.GET("/forms/:id/submission", handlers.GetFormSubmission)

		// Portal Authentication Routes (Public) - Legacy
		api.POST("/portal/signup", handlers.PortalSignup)
		api.POST("/portal/login", handlers.PortalLogin)
		api.POST("/portal/request-reset", handlers.PortalRequestReset)
		api.POST("/portal/reset-password", handlers.PortalResetPassword)

		// Portal Authentication V2 Routes (Better Auth based)
		api.POST("/portal/v2/signup", handlers.PortalSignupV2)
		api.POST("/portal/v2/login", handlers.PortalLoginV2)
		api.POST("/portal/v2/logout", handlers.PortalLogoutV2)
		api.GET("/portal/v2/me", handlers.PortalAuthMiddlewareV2(), handlers.PortalGetMeV2)
		api.GET("/portal/v2/submissions", handlers.PortalAuthMiddlewareV2(), handlers.GetApplicantSubmissions)

		// Application Submissions Routes (Better Auth protected)
		submissions := api.Group("/submissions")
		submissions.Use(handlers.PortalAuthMiddlewareV2())
		{
			submissions.GET("", handlers.ListUserSubmissions)
			submissions.GET("/:id", handlers.GetSubmission)
			submissions.PUT("/:id", handlers.ManualSaveSubmission)
			submissions.POST("/:id/autosave", handlers.AutosaveSubmission)
			submissions.POST("/:id/submit", handlers.SubmitApplication)
			submissions.GET("/:id/versions", handlers.GetSubmissionVersions)
			submissions.POST("/:id/restore/:version", handlers.RestoreSubmissionVersion)
		}

		// Start submission (also protected)
		api.POST("/forms/:id/start", handlers.PortalAuthMiddlewareV2(), handlers.GetOrStartSubmission)

		// Portal Dashboard Routes (Public with Portal Token)
		// Note: These routes use portal auth (applicant token) not main auth
		portalDashboard := api.Group("/portal")
		// TODO: Add portal auth middleware for proper security
		{
		portalDashboard.PUT("/profile/:applicant_id", handlers.PortalUpdateProfile)
		portalDashboard.PUT("/profile/:applicant_id/password", handlers.PortalChangePassword)
		portalDashboard.POST("/sync-better-auth-applicant", handlers.PortalSyncBetterAuthApplicant)
		portalDashboard.GET("/applications/:id", handlers.GetApplicantDashboard)
		portalDashboard.GET("/applications/:id/activities", handlers.ListPortalActivities)
		portalDashboard.POST("/applications/:id/activities", handlers.CreatePortalActivity)
			portalDashboard.POST("/applications/:id/activities/read", handlers.MarkActivitiesRead)

			// Document routes
			portalDashboard.GET("/documents", handlers.ListPortalDocuments)
			portalDashboard.POST("/documents", handlers.UploadPortalDocument)
			portalDashboard.DELETE("/documents/:id", handlers.DeletePortalDocument)

			// Recommendation routes for portal applicants
			portalDashboard.POST("/recommendations", handlers.CreateRecommendationRequest)
			portalDashboard.GET("/recommendations", handlers.GetRecommendationRequests)
		}

		// Public Email Tracking (must be public for tracking pixel to work)
		api.GET("/email/track/:tracking_id", handlers.TrackEmailOpen)
		api.GET("/email/oauth/callback", handlers.HandleGmailCallback)

		// Google Drive OAuth Callback (must be public for OAuth flow)
		api.GET("/integrations/google-drive/callback", handlers.GoogleDriveCallback)

		// Public Resend Webhook (must be public for Resend to send events)
		api.POST("/email/resend/webhook", handlers.HandleResendWebhook)

		// External Review Routes (Public with Token)
		api.GET("/external-review/:token", handlers.GetExternalReviewData)
		api.POST("/external-review/:token/submit/:submission_id", handlers.SubmitExternalReview)

		// Recommendation Routes (Public with Token - for recommenders)
		api.GET("/recommend/:token", handlers.GetRecommendationByToken)     // Get recommendation request details
		api.POST("/recommend/:token/submit", handlers.SubmitRecommendation) // Submit recommendation

		// Public Ending Pages Routes (for portal form submissions)
		// This endpoint is public because it's called after form submission by applicants
		// who use portal auth (not main auth). It only returns ending page configuration.
		api.POST("/ending-pages/match", handlers.FindMatchingEnding)

		// Public Field Types Registry (needed for portal field rendering)
		// This is metadata about field types, not sensitive data
		api.GET("/field-types", handlers.GetFieldTypes)
		api.GET("/field-types/toolbox", handlers.GetFieldTypesToolbox)
		api.GET("/field-types/:type_id", handlers.GetFieldType)

		// Public Dashboard Layout (for applicant portal to render their dashboard)
		// Dashboard config is not sensitive - just layout metadata
		api.GET("/forms/:id/dashboard", handlers.GetDashboardLayout)

		// Protected routes - require authentication
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
				workspaces.GET("/by-slug/:slug", handlers.GetWorkspaceBySlug) // Get by slug (before :id to avoid conflict)
				workspaces.GET("/:id", handlers.GetWorkspace)
				workspaces.PATCH("/:id", handlers.UpdateWorkspace)
				workspaces.DELETE("/:id", handlers.DeleteWorkspace)

				// Workspace Integrations (Google Drive, etc.)
				workspaces.GET("/:id/integrations", handlers.ListWorkspaceIntegrations)
				workspaces.POST("/:id/integrations", handlers.CreateWorkspaceIntegration)
				workspaces.GET("/:id/integrations/:type", handlers.GetWorkspaceIntegration)
				workspaces.PATCH("/:id/integrations/:type", handlers.UpdateWorkspaceIntegration)
				workspaces.DELETE("/:id/integrations/:type", handlers.DeleteWorkspaceIntegration)

				// Google Drive OAuth
				workspaces.GET("/:id/integrations/google_drive/auth-url", handlers.GetGoogleDriveAuthURL)
				workspaces.POST("/:id/integrations/google_drive/disconnect", handlers.DisconnectGoogleDrive)
			}

			// Workspace Members
			members := protected.Group("/workspace-members")
			{
				members.GET("", handlers.ListWorkspaceMembers) // ?workspace_id=xxx
				members.PATCH("/:id", handlers.UpdateWorkspaceMember)
				members.DELETE("/:id", handlers.RemoveWorkspaceMember)
			}

			// Workspace Invitations
			invitations := protected.Group("/invitations")
			{
				invitations.GET("", handlers.ListInvitations) // ?workspace_id=xxx
				invitations.POST("", handlers.CreateInvitation)
				invitations.DELETE("/:id", handlers.RevokeInvitation)
				invitations.POST("/:id/resend", handlers.ResendInvitation)
				invitations.GET("/by-token/:token", handlers.GetInvitationByToken)
				invitations.POST("/accept/:token", handlers.AcceptInvitation)
				invitations.POST("/decline/:token", handlers.DeclineInvitation)
			}

			// Activities Hubs (separate base path to avoid conflicts with /workspaces/:id)
			activitiesHubs := protected.Group("/activities-hubs")
			{
				activitiesHubs.GET("", handlers.ListActivitiesHubs)                   // ?workspace_id=xxx
				activitiesHubs.POST("", handlers.CreateActivitiesHub)                 // workspace_id in body
				activitiesHubs.GET("/by-slug/:slug", handlers.GetActivitiesHubBySlug) // ?workspace_id=xxx
				activitiesHubs.GET("/:hub_id", handlers.GetActivitiesHub)
				activitiesHubs.PATCH("/:hub_id", handlers.UpdateActivitiesHub)
				activitiesHubs.DELETE("/:hub_id", handlers.DeleteActivitiesHub)
				activitiesHubs.PATCH("/:hub_id/visibility", handlers.ToggleHubVisibility) // Toggle hub visibility (admin only)

				// Activities Hub Tabs
				activitiesHubs.GET("/:hub_id/tabs", handlers.ListActivitiesHubTabs)
				activitiesHubs.POST("/:hub_id/tabs", handlers.CreateActivitiesHubTab)
				activitiesHubs.PATCH("/:hub_id/tabs/:tab_id", handlers.UpdateActivitiesHubTab)
				activitiesHubs.DELETE("/:hub_id/tabs/:tab_id", handlers.DeleteActivitiesHubTab)
				activitiesHubs.POST("/:hub_id/tabs/reorder", handlers.ReorderActivitiesHubTabs)
			}

			// Data Tables
			tables := protected.Group("/tables")
			{
				tables.GET("", handlers.ListDataTables)
				tables.POST("", handlers.CreateDataTable)
				tables.GET("/:id", handlers.GetDataTable)
				tables.PATCH("/:id", handlers.UpdateDataTable)
				tables.DELETE("/:id", handlers.DeleteDataTable)
				tables.PATCH("/:id/visibility", handlers.ToggleHubVisibility) // Toggle visibility (admin only)

				// Table rows
				tables.GET("/:id/rows", handlers.ListTableRows)
				tables.POST("/:id/rows", handlers.CreateTableRow)
				tables.PATCH("/:id/rows/:row_id", handlers.UpdateTableRow)
				tables.DELETE("/:id/rows/:row_id", handlers.DeleteTableRow)

				// Row history & versions
				tables.GET("/:id/rows/:row_id/history", handlers.GetRowHistory)
				tables.GET("/:id/rows/:row_id/history/:version", handlers.GetRowVersion)
				tables.GET("/:id/rows/:row_id/versions/:version", handlers.GetRowVersion)
				tables.GET("/:id/rows/:row_id/diff/:v1/:v2", handlers.CompareVersions)
				tables.GET("/:id/rows/:row_id/compare-versions/:v1/:v2", handlers.CompareVersions)
				tables.POST("/:id/rows/:row_id/restore/:version", handlers.RestoreVersion)

				// Table columns
				tables.POST("/:id/columns", handlers.CreateTableColumn)
				tables.PATCH("/:id/columns/:column_id", handlers.UpdateTableColumn)
				tables.DELETE("/:id/columns/:column_id", handlers.DeleteTableColumn)

				// Table search
				tables.GET("/:id/search", handlers.SearchTableRows)

				// Approvals for table changes
				tables.GET("/:id/approvals", handlers.ListApprovals)
				tables.GET("/:id/approvals/:approval_id", handlers.GetApproval)
				tables.POST("/:id/approvals/:approval_id/review", handlers.ReviewApproval)

				// AI endpoints for tables
				tables.GET("/:id/schema/ai", handlers.GetTableAISchema)
				tables.GET("/:id/ai/suggestions", handlers.GetTableSuggestions)
				tables.POST("/:id/ai/analyze", handlers.AnalyzeTableForSuggestions)
				tables.POST("/:id/ai/rows/:row_id/analyze", handlers.AnalyzeRowForSuggestions)
				tables.POST("/:id/ai/suggestions/:suggestion_id/apply", handlers.ApplySuggestion)
				tables.POST("/:id/ai/suggestions/:suggestion_id/dismiss", handlers.DismissSuggestion)
				// Legacy routes (deprecated - use /ai/ prefix)
				tables.GET("/:id/suggestions", handlers.GetTableSuggestions)
				tables.POST("/:id/suggestions/:suggestion_id/apply", handlers.ApplySuggestion)
				tables.POST("/:id/suggestions/:suggestion_id/dismiss", handlers.DismissSuggestion)

				// Table Views (grid, kanban, calendar, gallery, timeline, form, portal)
				tables.GET("/:id/views", handlers.ListViews)
				tables.POST("/:id/views", handlers.CreateView)
				tables.GET("/:id/views/portal", handlers.GetPortalViews)
			}

			// Views (global endpoints)
			views := protected.Group("/views")
			{
				views.GET("/:id", handlers.GetView)
				views.PATCH("/:id", handlers.UpdateView)
				views.DELETE("/:id", handlers.DeleteView)
				views.PATCH("/:id/config", handlers.UpdateViewConfig)
				views.POST("/:id/duplicate", handlers.DuplicateView)
			}

			// Version management (global)
			versions := protected.Group("/versions")
			{
				versions.POST("/:version_id/archive", handlers.ArchiveVersion)
				versions.DELETE("/:version_id", handlers.DeleteVersion)
			}

			// File management
			files := protected.Group("/files")
			{
				files.GET("", handlers.ListFiles)         // ?table_id=xxx&row_id=xxx&field_id=xxx&workspace_id=xxx
				files.POST("", handlers.CreateFile)       // Create file record
				files.GET("/:id", handlers.GetFile)       // Get single file
				files.PATCH("/:id", handlers.UpdateFile)  // Update file metadata
				files.DELETE("/:id", handlers.DeleteFile) // Soft delete file
				files.GET("/:id/versions", handlers.GetFileVersions)
				files.POST("/:id/versions", handlers.CreateFileVersion)
			}

			// Row files (convenience endpoints)
			protected.GET("/rows/:row_id/files", handlers.GetRowFiles)
			protected.POST("/rows/:row_id/files", handlers.CreateRowFile)
			protected.GET("/rows/:row_id/files/stats", handlers.GetFileStats)

			// Row Google Drive Integration
			protected.POST("/rows/:row_id/integrations/google_drive/folder", handlers.CreateApplicantFolder)
			protected.POST("/rows/:row_id/integrations/google_drive/sync-file", handlers.SyncFileToDrive)
			protected.POST("/rows/:row_id/integrations/google_drive/sync-all", handlers.SyncAllFilesToDrive)
			protected.POST("/rows/:row_id/integrations/google_drive/summary", handlers.CreateApplicationSummary)

			// Table files (convenience endpoint)
			protected.GET("/tables/:id/files", handlers.GetTableFiles)

			// Document PII Analysis (Gemini-powered)
			documents := protected.Group("/documents")
			{
				documents.POST("/analyze-pii", handlers.AnalyzeDocumentPII)
				documents.POST("/analyze-pii/batch", handlers.BatchAnalyzeDocumentsPII)
				documents.POST("/redact", handlers.GetRedactedDocument)
				documents.POST("/redact/base64", handlers.GetRedactedDocumentBase64)
			}

			// NOTE: Field Type Registry is now public (moved to public routes above)

			// Workspace Activity Feed
			protected.GET("/workspaces/:id/activity", handlers.GetWorkspaceActivity)

			// Table Links - for managing table relationships
			tableLinks := protected.Group("/table-links")
			{
				tableLinks.GET("", handlers.ListTableLinks) // ?table_id=xxx
				tableLinks.POST("", handlers.CreateTableLink)
				tableLinks.GET("/:id", handlers.GetTableLink)
				tableLinks.PATCH("/:id", handlers.UpdateTableLink)
				tableLinks.DELETE("/:id", handlers.DeleteTableLink)
			}

			// Table Row Links - for managing row-to-row connections
			rowLinks := protected.Group("/row-links")
			{
				rowLinks.GET("/rows/:row_id/linked", handlers.GetLinkedRows) // ?link_id=xxx
				rowLinks.POST("", handlers.CreateTableRowLink)
				rowLinks.PATCH("/:id", handlers.UpdateTableRowLink)
				rowLinks.DELETE("/:id", handlers.DeleteTableRowLink)
			}

			// Forms
			forms := protected.Group("/forms")
			{
				forms.GET("", handlers.ListForms)
				forms.GET("/list", handlers.ListFormsOptimized) // Optimized endpoint for Applications Hub (must be before /:id)
				forms.POST("", handlers.CreateForm)
				forms.GET("/:id", handlers.GetForm) // This must come after /list to avoid route conflicts
				forms.GET("/:id/full", handlers.GetFormWithSubmissionsAndWorkflow) // Combined endpoint for Review Workspace
				forms.PATCH("/:id", handlers.UpdateForm)
				forms.PUT("/:id/structure", handlers.UpdateFormStructure)    // Add this line
				forms.PUT("/:id/custom-slug", handlers.UpdateFormCustomSlug) // Update custom URL slug
				// NOTE: GET /forms/:id/dashboard is now public (moved above)
				forms.PUT("/:id/dashboard", handlers.UpdateDashboardLayout) // Update applicant dashboard config (protected)
				forms.DELETE("/:id", handlers.DeleteForm)

				// Form submissions
				forms.GET("/:id/submissions", handlers.ListFormSubmissions)
				forms.DELETE("/:id/submissions/:submission_id", handlers.DeleteFormSubmission)

				// Form search
				forms.GET("/:id/search", handlers.SearchFormSubmissions)

				// Form Google Drive Integration
				forms.GET("/:id/integrations/google_drive", handlers.GetFormIntegrationSettings)
				forms.PATCH("/:id/integrations/google_drive", handlers.UpdateFormIntegrationSettings)
				forms.POST("/:id/integrations/google_drive/folder", handlers.CreateFormFolder)

				// Reviewer Assignment
				forms.POST("/:id/reviewers/:reviewer_id/assign", handlers.AssignReviewerApplications)

				// Workflow Assignment & Stage Management
				forms.POST("/:id/submissions/:submission_id/assign-workflow", handlers.AssignSubmissionWorkflow)
				forms.POST("/:id/submissions/:submission_id/move-stage", handlers.MoveSubmissionToStage)
				forms.PATCH("/:id/submissions/:submission_id/review-data", handlers.UpdateSubmissionReviewData)
				forms.PATCH("/:id/submissions/:submission_id", handlers.UpdateSubmissionMetadata)
				forms.POST("/:id/submissions/bulk-assign-workflow", handlers.BulkAssignWorkflow)
			}

			// Ending Pages
			endingPages := protected.Group("/ending-pages")
			{
				endingPages.GET("", handlers.ListEndingPages) // ?form_id=xxx
				endingPages.POST("", handlers.CreateEndingPage)
				endingPages.GET("/:id", handlers.GetEndingPage)
				endingPages.PUT("/:id", handlers.UpdateEndingPage)
				endingPages.DELETE("/:id", handlers.DeleteEndingPage)
				endingPages.PUT("/:id/default", handlers.SetDefaultEnding) // Set as primary ending
				endingPages.PUT("/reorder", handlers.ReorderEndings)       // Reorder priorities
			}

			// Search
			search := protected.Group("/search")
			{
				// AI-powered smart search (uses full-text + fuzzy)
				search.GET("/smart", handlers.SmartSearch)

				// Hybrid search with semantic embeddings
				search.POST("/hybrid", handlers.HybridSearch)
				search.GET("/hybrid", handlers.HybridSearch)

				// Find similar items
				search.GET("/similar/:entity_id", handlers.FindSimilar)

				// Embedding management
				search.POST("/embeddings/generate", handlers.GenerateEmbeddings)
				search.GET("/embeddings/stats", handlers.GetEmbeddingStats)
				search.POST("/embeddings/queue", handlers.QueueForEmbedding)

				// Search index management
				search.POST("/rebuild-index", handlers.RebuildSearchIndex)

				// AI context for prompts
				search.GET("/ai/table/:id", handlers.GetTableSchemaForAI)
				search.GET("/ai/workspace/:id", handlers.GetWorkspaceSummaryForAI)

				// Legacy universal workspace search
				search.GET("", handlers.SearchWorkspace)

				// Search utilities
				search.GET("/suggestions", handlers.GetSearchSuggestions)
				search.GET("/recent", handlers.GetRecentSearches)
				search.POST("/history", handlers.SaveSearchHistory)
				search.GET("/popular", handlers.GetPopularSearches)
				search.DELETE("/history/:workspace_id", handlers.ClearSearchHistory)
			}

			// Workflows
			workflows := protected.Group("/workflows")
			{
				workflows.GET("", handlers.ListReviewWorkflows)
				workflows.POST("", handlers.CreateReviewWorkflow)
				workflows.GET("/:id", handlers.GetReviewWorkflow)
				workflows.PATCH("/:id", handlers.UpdateReviewWorkflow)
				workflows.DELETE("/:id", handlers.DeleteReviewWorkflow)
			}

			// Workflow Webhooks (for workflow builder integration)
			webhooks := protected.Group("/workflow-webhooks")
			{
				webhooks.GET("", handlers.ListWorkflowWebhooks)
				webhooks.POST("", handlers.CreateWorkflowWebhook)
				webhooks.PATCH("/:id", handlers.UpdateWorkflowWebhook)
				webhooks.DELETE("/:id", handlers.DeleteWorkflowWebhook)
			}

			// Review Workspace - Combined data endpoint for fast loading
			protected.GET("/review-workspace-data", handlers.GetReviewWorkspaceData)

			// Application Stages
			stages := protected.Group("/stages")
			{
				stages.GET("", handlers.ListApplicationStages)
				stages.POST("", handlers.CreateApplicationStage)
				stages.GET("/:id", handlers.GetApplicationStage)
				stages.PATCH("/:id", handlers.UpdateApplicationStage)
				stages.DELETE("/:id", handlers.DeleteApplicationStage)
			}

			// Reviewer Types
			reviewerTypes := protected.Group("/reviewer-types")
			{
				reviewerTypes.GET("", handlers.ListReviewerTypes)
				reviewerTypes.POST("", handlers.CreateReviewerType)
				reviewerTypes.GET("/:id", handlers.GetReviewerType)
				reviewerTypes.PATCH("/:id", handlers.UpdateReviewerType)
				reviewerTypes.DELETE("/:id", handlers.DeleteReviewerType)
			}

			// Rubrics
			rubrics := protected.Group("/rubrics")
			{
				rubrics.GET("", handlers.ListRubrics)
				rubrics.POST("", handlers.CreateRubric)
				rubrics.GET("/:id", handlers.GetRubric)
				rubrics.PATCH("/:id", handlers.UpdateRubric)
				rubrics.DELETE("/:id", handlers.DeleteRubric)
			}

			// Stage Reviewer Configs
			stageConfigs := protected.Group("/stage-reviewer-configs")
			{
				stageConfigs.GET("", handlers.ListStageReviewerConfigs)
				stageConfigs.POST("", handlers.CreateStageReviewerConfig)
				stageConfigs.PATCH("/:id", handlers.UpdateStageReviewerConfig)
				stageConfigs.DELETE("/:id", handlers.DeleteStageReviewerConfig)
			}

			// Application Groups (Rejected, Waitlist, etc.)
			groups := protected.Group("/application-groups")
			{
				groups.GET("", handlers.ListApplicationGroups)
				groups.POST("", handlers.CreateApplicationGroup)
				groups.GET("/:id", handlers.GetApplicationGroup)
				groups.PATCH("/:id", handlers.UpdateApplicationGroup)
				groups.DELETE("/:id", handlers.DeleteApplicationGroup)
				groups.GET("/:id/applications", handlers.GetGroupApplications)
			}

			// Workflow Actions (global actions like Reject)
			workflowActions := protected.Group("/workflow-actions")
			{
				workflowActions.GET("", handlers.ListWorkflowActions)
				workflowActions.POST("", handlers.CreateWorkflowAction)
				workflowActions.GET("/:id", handlers.GetWorkflowAction)
				workflowActions.PATCH("/:id", handlers.UpdateWorkflowAction)
				workflowActions.DELETE("/:id", handlers.DeleteWorkflowAction)
			}

			// Stage Actions (stage-specific actions)
			stageActions := protected.Group("/stage-actions")
			{
				stageActions.GET("", handlers.ListStageActions)
				stageActions.POST("", handlers.CreateStageAction)
				stageActions.PATCH("/:id", handlers.UpdateStageAction)
				stageActions.DELETE("/:id", handlers.DeleteStageAction)
			}

			// Stage Groups (sub-groups within a stage, visible only in that stage)
			stageGroups := protected.Group("/stage-groups")
			{
				stageGroups.GET("", handlers.ListStageGroups)
				stageGroups.POST("", handlers.CreateStageGroup)
				stageGroups.GET("/:id", handlers.GetStageGroup)
				stageGroups.PATCH("/:id", handlers.UpdateStageGroup)
				stageGroups.DELETE("/:id", handlers.DeleteStageGroup)
			}

			// Custom Statuses (action buttons in review interface)
			customStatuses := protected.Group("/custom-statuses")
			{
				customStatuses.GET("", handlers.ListCustomStatuses)
				customStatuses.POST("", handlers.CreateCustomStatus)
				customStatuses.GET("/:id", handlers.GetCustomStatus)
				customStatuses.PATCH("/:id", handlers.UpdateCustomStatus)
				customStatuses.DELETE("/:id", handlers.DeleteCustomStatus)
			}

			// Action Execution
			actions := protected.Group("/actions")
			{
				actions.POST("/execute", handlers.ExecuteAction)
				actions.POST("/execute-status", handlers.ExecuteStatusAction)
				actions.POST("/move-to-group", handlers.MoveToGroup)
				actions.POST("/move-to-stage-group", handlers.MoveToStageGroup)
				actions.POST("/restore-from-group", handlers.RestoreFromGroup)
			}

			// Email / Gmail Integration
			email := protected.Group("/email")
			{
				// OAuth
				email.GET("/oauth/url", handlers.GetGmailAuthURL)
				email.GET("/connection", handlers.GetGmailConnection)
				email.DELETE("/connection", handlers.DisconnectGmail)

				// Email Accounts
				email.GET("/accounts", handlers.ListEmailAccounts)
				email.PATCH("/accounts/:id", handlers.UpdateEmailAccount)
				email.DELETE("/accounts/:id", handlers.DeleteEmailAccount)

				// Signatures
				email.GET("/signatures", handlers.ListSignatures)
				email.POST("/signatures", handlers.CreateSignature)
				email.PATCH("/signatures/:id", handlers.UpdateSignature)
				email.DELETE("/signatures/:id", handlers.DeleteSignature)

				// Sending
				email.POST("/send", handlers.SendEmail)

				// History & Campaigns
				email.GET("/history", handlers.GetEmailHistory)
				email.GET("/campaigns", handlers.GetEmailCampaigns)

				// Templates
				email.GET("/templates", handlers.GetEmailTemplates)
				email.POST("/templates", handlers.CreateEmailTemplate)
				email.PATCH("/templates/:id", handlers.UpdateEmailTemplate)
				email.DELETE("/templates/:id", handlers.DeleteEmailTemplate)

				// Submission-specific email history
				email.GET("/submission/:id/history", handlers.GetSubmissionEmailHistory)
				email.GET("/submission/:id/activity", handlers.GetSubmissionActivity)

				// Analytics
				email.GET("/analytics", handlers.GetEmailAnalytics)
				email.GET("/service-health", handlers.GetEmailServiceHealth)
				email.GET("/campaigns/:id/analytics", handlers.GetEmailCampaignAnalytics)

				// Email Drafts
				email.GET("/drafts", handlers.ListEmailDrafts)
				email.GET("/drafts/:id", handlers.GetEmailDraft)
				email.POST("/drafts", handlers.CreateEmailDraft)
				email.PATCH("/drafts/:id", handlers.UpdateEmailDraft)
				email.DELETE("/drafts/:id", handlers.DeleteEmailDraft)
				email.POST("/drafts/cleanup", handlers.CleanupOldDrafts)

				// Resend Integration
				email.GET("/resend/integration", handlers.GetResendIntegration)
				email.POST("/resend/integration", handlers.CreateResendIntegration)
				email.PATCH("/resend/integration", handlers.UpdateResendIntegration)
				email.DELETE("/resend/integration", handlers.DeleteResendIntegration)
				email.POST("/resend/integration/test", handlers.TestResendIntegration)

				// Email Queue
				email.GET("/queue", handlers.ListEmailQueueItems)
				email.GET("/queue/:id", handlers.GetEmailQueueItem)
				email.POST("/queue/:id/retry", handlers.RetryEmailQueueItem)
				email.POST("/queue/:id/cancel", handlers.CancelEmailQueueItem)
				email.GET("/queue/stats", handlers.GetEmailQueueStats)
			}

			// Change Requests (Approval Workflow)
			changeRequests := protected.Group("/change-requests")
			{
				changeRequests.GET("", handlers.ListChangeRequests)
				changeRequests.POST("", handlers.CreateChangeRequest)
				changeRequests.GET("/:id", handlers.GetChangeRequest)
				changeRequests.POST("/:id/review", handlers.ReviewChangeRequest)
				changeRequests.POST("/:id/cancel", handlers.CancelChangeRequest)
				changeRequests.GET("/row/:row_id", handlers.GetPendingChangesForRow)
			}

			// AI Reports
			reports := protected.Group("/reports")
			{
				reports.POST("/generate", handlers.GenerateReport)
				reports.GET("/stats", handlers.GetWorkspaceStats)
				reports.GET("/is-report-query", handlers.IsReportQuery)
			}

			// ============================================================
			// ADMIN ENDPOINTS
			// ============================================================
			admin := protected.Group("/admin")
			{
				admin.GET("/users", handlers.ListAuthUsers)
				admin.DELETE("/users", handlers.DeleteUser)
			}

			// ============================================================
			// HUB & MODULE MANAGEMENT
			// ============================================================

			// Hub modules with fields
			hubs := protected.Group("/hubs")
			{
				// Get hub modules with full field info
				hubs.GET("/:hub_id/modules", handlers.GetHubModulesWithFields)

				// Enable module with fields
				hubs.POST("/:hub_id/modules/enable", handlers.EnableModuleWithFields)

				// Sub-modules
				hubs.GET("/:hub_id/sub-modules", handlers.ListSubModules)
				hubs.POST("/:hub_id/sub-modules", handlers.CreateSubModule)
				hubs.POST("/:hub_id/sub-modules/reorder", handlers.ReorderSubModules)
			}

			// Sub-module operations
			subModules := protected.Group("/sub-modules")
			{
				subModules.GET("/:sub_module_id", handlers.GetSubModule)
				subModules.PATCH("/:sub_module_id", handlers.UpdateSubModule)
				subModules.DELETE("/:sub_module_id", handlers.DeleteSubModule)
				subModules.GET("/:sub_module_id/rows", handlers.GetSubModuleRows)
			}

			// Module field definitions
			moduleFields := protected.Group("/modules")
			{
				moduleFields.GET("/:module_id/fields", handlers.GetModuleFields)
			}

			// Module history settings
			moduleSettings := protected.Group("/module-configs")
			{
				moduleSettings.GET("/:config_id/history-settings", handlers.GetModuleHistorySettings)
				moduleSettings.PUT("/:config_id/history-settings", handlers.UpdateModuleHistorySettings)
			}

			// AI Services
			ai := protected.Group("/ai")
			{
				ai.POST("/translate", handlers.TranslateContent)
			}

			// ============================================================
			// RECOMMENDATION REQUESTS
			// ============================================================
			recommendations := protected.Group("/recommendations")
			{
				recommendations.GET("", handlers.GetRecommendationRequests)                            // ?submission_id=xxx
				recommendations.POST("", handlers.CreateRecommendationRequest)                         // Create & send email
				recommendations.GET("/:id", handlers.GetRecommendationRequest)                         // Get single request
				recommendations.POST("/:id/remind", handlers.SendRecommendationReminder)               // Send reminder
				recommendations.DELETE("/:id", handlers.CancelRecommendationRequest)                   // Cancel request
				recommendations.GET("/submission/:submissionId", handlers.GetRecommendationsForReview) // For reviewers
			}

			// ============================================================
			// AUTOMATION WORKFLOWS
			// ============================================================
			automationWorkflows := protected.Group("/automation-workflows")
			{
				automationWorkflows.GET("", handlers.GetAutomationWorkflows)    // ?workspace_id=xxx
				automationWorkflows.POST("", handlers.CreateAutomationWorkflow) // ?workspace_id=xxx
				automationWorkflows.GET("/:id", handlers.GetAutomationWorkflow)
				automationWorkflows.PATCH("/:id", handlers.UpdateAutomationWorkflow)
				automationWorkflows.DELETE("/:id", handlers.DeleteAutomationWorkflow)
				automationWorkflows.POST("/:id/duplicate", handlers.DuplicateAutomationWorkflow)
				automationWorkflows.GET("/:id/executions", handlers.GetAutomationWorkflowExecutions)
				automationWorkflows.GET("/:id/executions/:executionId/logs", handlers.GetAutomationWorkflowExecutionLogs)
			}
		}
	}

	return r
}
