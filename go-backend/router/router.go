package router

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/handlers"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// CORS configuration
	corsConfig := cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}
	r.Use(cors.New(corsConfig))

	// Load HTML templates
	r.LoadHTMLGlob("templates/*")

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
			"description": "Full-stack Airtable-like platform with forms and data tables",
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
		api.POST("/forms/:id/submit", handlers.SubmitForm)
		api.GET("/forms/:id/submission", handlers.GetFormSubmission)

		// Protected routes - require authentication
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			// Workspaces
			workspaces := protected.Group("/workspaces")
			{
				workspaces.GET("", handlers.ListWorkspaces)
				workspaces.POST("", handlers.CreateWorkspace)
				workspaces.GET("/:id", handlers.GetWorkspace)
				workspaces.PATCH("/:id", handlers.UpdateWorkspace)
				workspaces.DELETE("/:id", handlers.DeleteWorkspace)
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

				// Table rows
				tables.GET("/:id/rows", handlers.ListTableRows)
				tables.POST("/:id/rows", handlers.CreateTableRow)
				tables.PATCH("/:id/rows/:row_id", handlers.UpdateTableRow)
				tables.DELETE("/:id/rows/:row_id", handlers.DeleteTableRow)

				// Table columns
				tables.POST("/:id/columns", handlers.CreateTableColumn)
				tables.PATCH("/:id/columns/:column_id", handlers.UpdateTableColumn)
				tables.DELETE("/:id/columns/:column_id", handlers.DeleteTableColumn)

				// Table search
				tables.GET("/:id/search", handlers.SearchTableRows)
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
				forms.POST("", handlers.CreateForm)
				forms.GET("/:id", handlers.GetForm)
				forms.PATCH("/:id", handlers.UpdateForm)
				forms.PUT("/:id/structure", handlers.UpdateFormStructure) // Add this line
				forms.DELETE("/:id", handlers.DeleteForm)

				// Form submissions
				forms.GET("/:id/submissions", handlers.ListFormSubmissions)

				// Form search
				forms.GET("/:id/search", handlers.SearchFormSubmissions)
			}

			// Search
			search := protected.Group("/search")
			{
				// Universal workspace search
				search.GET("", handlers.SearchWorkspace)

				// Search utilities
				search.GET("/suggestions", handlers.GetSearchSuggestions)
				search.GET("/recent", handlers.GetRecentSearches)
				search.POST("/history", handlers.SaveSearchHistory)
				search.GET("/popular", handlers.GetPopularSearches)
				search.DELETE("/history/:workspace_id", handlers.ClearSearchHistory)
			}
		}
	}

	return r
}
