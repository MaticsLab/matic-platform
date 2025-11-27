package database

import (
	"fmt"
	"log"

	"github.com/Jsanchez767/matic-platform/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(databaseURL string) error {
	var err error

	// Configure GORM
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// Connect to PostgreSQL
	DB, err = gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(3)
	sqlDB.SetMaxOpenConns(10)

	log.Println("✅ Database connected successfully")
	return nil
}

func AutoMigrate() error {
	log.Println("🔄 Running database migrations...")

	err := DB.AutoMigrate(
		&models.Organization{},
		&models.OrganizationMember{},
		&models.Workspace{},
		&models.WorkspaceMember{},
		&models.Table{},
		&models.Field{},
		&models.Row{},
		&models.View{},
		&models.TableLink{},
		&models.TableRowLink{},
		&models.ActivitiesHub{},
		&models.ActivitiesHubTab{},
		&models.SearchHistory{},
		&models.ReviewWorkflow{},
		&models.ApplicationStage{},
		&models.ReviewerType{},
		&models.Rubric{},
		&models.StageReviewerConfig{},
	)

	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Println("✅ Database migrations completed")
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
