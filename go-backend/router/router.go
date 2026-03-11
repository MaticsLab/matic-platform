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
		ExposeHeaders:    []string{"Content-Length", "X-Response-Time", "X-Response-Time-Ms"},
		AllowCredentials: true,
	}
	r.Use(cors.New(corsConfig))

	// PERFORMANCE MONITORING: Log slow requests (>500ms)
	r.Use(middleware.PerformanceLoggingMiddleware(500))
	r.Use(middleware.RequestTimingMiddleware())

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
				"health":     "/health",
				"api_v1":     "/api/v1",
				"workspaces": "/api/v1/workspaces",
				"tables":     "/api/v1/tables",
				"forms":      "/api/v1/forms",
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

		// Portal Authentication V2 Routes (DEPRECATED - matic folder only)
		// Main platform uses Better Auth SDK + /portal/sync-better-auth-applicant
		api.POST("/portal/v2/signup", handlers.PortalSignupV2) // DEPRECATED
		api.POST("/portal/v2/login", handlers.PortalLoginV2)   // DEPRECATED
		api.POST("/portal/v2/logout", handlers.PortalLogoutV2)
		api.GET("/portal/v2/me", handlers.PortalAuthMiddlewareV2(), handlers.PortalGetMeV2)
		api.GET("/portal/v2/submissions", handlers.PortalAuthMiddlewareV2(), handlers.GetApplicantSubmissions)

		// NEW: Unified Forms Schema Portal Routes
		api.POST("/portal/v2/forms/:form_id/submissions", handlers.PortalAuthMiddlewareV2(), handlers.GetOrCreatePortalSubmission)
		api.GET("/portal/v2/submissions/:id", handlers.PortalAuthMiddlewareV2(), handlers.GetPortalSubmission)
		api.PUT("/portal/v2/submissions/:id", handlers.PortalAuthMiddlewareV2(), handlers.UpdatePortalSubmission)

		// Autosave endpoint for portal submissions
		api.POST("/submissions/:id/autosave", handlers.PortalAuthMiddlewareV2(), handlers.AutosavePortalSubmission)

		// Portal Submission Routes (Authenticated - for public portal applicants)
		api.GET("/portal/forms/:form_id/my-submission", handlers.PortalAuthMiddlewareV2(), handlers.GetMyPortalSubmission)
		api.POST("/portal/forms/:form_id/my-submission", handlers.PortalAuthMiddlewareV2(), handlers.SaveMyPortalSubmission)

		// Legacy Portal Login (alias for v2 - backwards compatibility)
		api.POST("/portal/login", handlers.PortalLoginV2) // DEPRECATED

		// Portal Dashboard Routes (Public with Portal Token)
		// Note: These routes use portal auth (applicant token) not main auth
		portalDashboard := api.Group("/portal/dashboard")
		// TODO: Add portal auth middleware for proper security
		{
			// TODO: Implement these handlers
			// portalDashboard.PUT("/profile/:applicant_id", handlers.PortalUpdateProfile)
			// portalDashboard.PUT("/profile/:applicant_id/password", handlers.PortalChangePassword)
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

		// Auth Email Generation (public - used by better-auth for professional email templates)
		api.POST("/auth/generate-email", handlers.GenerateAuthEmail)
		api.GET("/auth/preview-email", handlers.PreviewAuthEmail) // Preview emails in browser

		// Google Drive OAuth Callback (must be public for OAuth flow)
		api.GET("/integrations/google-drive/callback", handlers.GoogleDriveCallback)

		// Public Resend Webhook (must be public for Resend to send events)
		api.POST("/email/resend/webhook", handlers.HandleResendWebhook)

		// Recommendation Routes (Public with Token - for recommenders)
		api.GET("/recommend/:token", handlers.GetRecommendationByToken)               // Get recommendation request details
		api.POST("/recommend/:token/submit", handlers.SubmitRecommendation)           // Submit recommendation
		api.POST("/recommendations/test-email", handlers.SendTestRecommendationEmail) // Send test email

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

		// Public Invitation Routes (for viewing invitation details)
		api.GET("/invitations/by-token/:token", handlers.GetInvitationByToken)

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
				workspaces.GET("/init", handlers.GetWorkspacesInit) // Optimized endpoint for workspace page load
				workspaces.POST("", handlers.CreateWorkspace)
				workspaces.GET("/by-slug/:slug", handlers.GetWorkspaceBySlug) // Get by slug (before :id to avoid conflict)
				workspaces.GET("/:id", handlers.GetWorkspace)
				workspaces.PATCH("/:id", handlers.UpdateWorkspace)
				workspaces.DELETE("/:id", handlers.DeleteWorkspace)

				// Workspace Members
				workspaces.GET("/:id/members-with-auth", handlers.GetWorkspaceMembersWithAuth)

				// Workspace Invitations
				workspaces.GET("/:id/invitations", handlers.GetWorkspaceInvitations)
				workspaces.POST("/:id/invitations", handlers.CreateWorkspaceInvitation)

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
				// Note: GetInvitationByToken is public (above) so users can see details before logging in
				invitations.POST("/accept/:token", handlers.AcceptInvitation)
				invitations.POST("/decline/:token", handlers.DeclineInvitation)
			}

			// Data Tables
			tables := protected.Group("/tables")
			{
				tables.GET("", handlers.ListDataTables)
				tables.POST("", handlers.CreateDataTable)
				tables.GET("/:id", handlers.GetDataTable)
				tables.PATCH("/:id", handlers.UpdateDataTable)
				tables.DELETE("/:id", handlers.DeleteDataTable)

				// Table rows
				tables.GET("/:id/rows", handlers.ListTableRows)
				tables.GET("/:id/rows/:row_id", handlers.GetTableRow)
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
				forms.PATCH("/:id", handlers.UpdateForm)
				forms.PUT("/:id/structure", handlers.UpdateFormStructure)    // Add this line
				forms.PUT("/:id/custom-slug", handlers.UpdateFormCustomSlug) // Update custom URL slug
				// NOTE: GET /forms/:id/dashboard is now public (moved above)
				forms.PUT("/:id/dashboard", handlers.UpdateDashboardLayout) // Update applicant dashboard config (protected)
				forms.DELETE("/:id", handlers.DeleteForm)

				// Form submissions
				forms.GET("/:id/submissions", handlers.ListFormSubmissions)
				forms.GET("/:id/fields", handlers.ListFormFieldsV2)
				forms.DELETE("/:id/submissions/:submission_id", handlers.DeleteFormSubmission)
				forms.POST("/:id/submissions/bulk-delete", handlers.BulkDeleteFormSubmissions)

				// Form analytics
				forms.GET("/:id/analytics", handlers.GetFormAnalytics)

				// Form search
				forms.GET("/:id/search", handlers.SearchFormSubmissions)

				// Form Google Drive Integration
				forms.GET("/:id/integrations/google_drive", handlers.GetFormIntegrationSettings)
				forms.PATCH("/:id/integrations/google_drive", handlers.UpdateFormIntegrationSettings)
				forms.POST("/:id/integrations/google_drive/folder", handlers.CreateFormFolder)

				// Submission Management
				forms.PATCH("/:id/submissions/:submission_id", handlers.UpdateSubmissionMetadata)
			}

			// Unified schema endpoints
			protected.GET("/form-submissions/:id", handlers.GetFormSubmissionByID)
			protected.GET("/form-fields", handlers.ListFormFields)

			// Review & Export (for review workspace)
			reviewExport := protected.Group("/review-export")
			{
				reviewExport.GET("", handlers.GetReviewExportData)    // Get comprehensive submission data
				reviewExport.GET("/csv", handlers.GetReviewExportCSV) // CSV format (placeholder for future server-side generation)
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

			// CRM - Applicant Management
			crm := protected.Group("/crm")
			{
				crm.GET("/applicants", handlers.GetApplicantsCRM)
				crm.GET("/applicants/:id", handlers.GetApplicantDetail)
				crm.PATCH("/applicants/:id", handlers.UpdateApplicant)
				crm.POST("/applicants/reset-password", handlers.ResetApplicantPassword)
				crm.POST("/applicants/set-password", handlers.SetApplicantPassword)
				crm.POST("/import-users", handlers.ImportBAUsersToWorkspace)
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
			// ROLES & PERMISSIONS (TODO: Implement handlers)
			// ============================================================
			// roles := protected.Group("/roles")
			// {
			// 	roles.GET("", handlers.ListRoles)
			// 	roles.POST("", handlers.CreateRole)
			// 	roles.GET("/:id", handlers.GetRole)
			// 	roles.PATCH("/:id", handlers.UpdateRole)
			// 	roles.DELETE("/:id", handlers.DeleteRole)
			// }

			// permissions := protected.Group("/permissions")
			// {
			// 	permissions.GET("", handlers.ListPermissions)
			// }

			// userRoles := protected.Group("/user-roles")
			// {
			// 	userRoles.GET("", handlers.ListUserRoles)
			// 	userRoles.POST("", handlers.AssignUserRole)
			// 	userRoles.DELETE("/:id", handlers.RemoveUserRole)
			// }

			// portalUsers := protected.Group("/portal-users")
			// {
			// 	portalUsers.GET("", handlers.ListPortalUsers)
			// 	portalUsers.POST("", handlers.CreatePortalUser)
			// 	portalUsers.GET("/:id", handlers.GetPortalUser)
			// 	portalUsers.PATCH("/:id", handlers.UpdatePortalUser)
			// }

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

		}
	}

	// ============================================================
	// API V2 ROUTES - New Unified Form Schema
	// ============================================================
	apiV2 := r.Group("/api/v2")
	apiV2.Use(middleware.AuthMiddleware(cfg)) // Require auth for all v2 routes
	{
		// Forms (admin)
		apiV2.GET("/forms", handlers.ListFormsV2)
		apiV2.POST("/forms", handlers.CreateFormV2)
		apiV2.GET("/forms/:id", handlers.GetFormV2)
		apiV2.PATCH("/forms/:id", handlers.UpdateFormV2)
		apiV2.GET("/submissions/:id", handlers.GetSubmissionV2)
		apiV2.PUT("/submissions/:id/responses", handlers.SaveResponsesV2)
		apiV2.POST("/submissions/:id/submit", handlers.SubmitSubmissionV2)
	}

	// Public V2 routes (no auth required for form viewing)
	apiV2Public := r.Group("/api/v2")
	{
		apiV2Public.GET("/forms/by-slug/:workspace_slug/:form_slug", handlers.GetFormBySlugV2)
	}

	return r
}
