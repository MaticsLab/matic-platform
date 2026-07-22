package main

// Portal submission routes updated - force rebuild 2026-02-12

// @title Matic Platform API
// @version 1.0
// @description Go/Gin backend for the Matic Platform. This spec is generated incrementally via swaggo/swag —
// @description only the Tables (data_tables.go) and Forms (forms.go) handler domains are annotated so far.
// @description See docs/API_CLIENT_CODEGEN.md for how to extend this to other handler domains.
// @contact.name Matic Platform Engineering
// @host localhost:8080
// @BasePath /api/v1
// @schemes http https
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Better Auth session token, sent as "Authorization: Bearer <token>" or via session cookie.
import (
	"context"
	"log"
	"os"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/handlers"
	"github.com/Jsanchez767/matic-platform/router"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.LoadConfig()

	// Set Gin mode
	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize primary app database (core app data)
	if err := database.InitDB(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to connect to app database: %v", err)
	}

	// Initialize Better Auth database connection for session validation
	if err := database.InitAuthDB(cfg.BetterAuthDatabaseURL); err != nil {
		log.Printf("⚠️  Better Auth DB warning: %v", err)
	}

	// Run AutoMigrate on primary app DB only
	if err := database.AutoMigrate(); err != nil {
		log.Printf("⚠️  AutoMigrate warning: %v", err)
	}

	// Initialize AI services with Cohere API key
	cohereAPIKey := os.Getenv("COHERE_API_KEY")
	if cohereAPIKey != "" {
		handlers.InitEmbeddingService(cohereAPIKey)
		services.InitAIReports(cohereAPIKey)
		log.Println("🧠 AI services initialized (embeddings + reports)")
	} else {
		log.Println("⚠️  COHERE_API_KEY not set - AI features disabled")
	}

	// Initialize Google Drive service
	handlers.InitGoogleDriveService()

	// Initialize email queue worker
	emailRouter := services.NewEmailRouter()
	emailQueueWorker := services.NewEmailQueueWorker(emailRouter)
	ctx := context.Background()
	emailQueueWorker.Start(ctx)
	log.Println("📧 Email queue worker started")

	// Setup router
	r := router.SetupRouter(cfg)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	log.Printf("� API: http://localhost:%s/api/v1", port)
	log.Printf("❤️  Health: http://localhost:%s/health", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
