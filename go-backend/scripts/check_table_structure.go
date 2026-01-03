package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/lib/pq"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	envPaths := []string{".env", "../.env", "../../.env", "../../../.env"}
	envLoaded := false
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			envLoaded = true
			break
		}
	}
	if !envLoaded {
		log.Println("Warning: .env file not found, trying environment variables")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable not set")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Get ALL tables
	query := `
		SELECT 
			t.table_name,
			c.column_name,
			c.data_type,
			c.is_nullable,
			c.column_default,
			c.character_maximum_length
		FROM information_schema.tables t
		JOIN information_schema.columns c ON t.table_name = c.table_name
		WHERE t.table_schema = 'public'
			AND t.table_type = 'BASE TABLE'
		ORDER BY t.table_name, c.ordinal_position;
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatalf("Failed to query database: %v", err)
	}
	defer rows.Close()

	// Group by table
	tableMap := make(map[string][]map[string]interface{})
	for rows.Next() {
		var tableName, columnName, dataType, isNullable string
		var defaultVal, maxLength sql.NullString
		
		if err := rows.Scan(&tableName, &columnName, &dataType, &isNullable, &defaultVal, &maxLength); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		colInfo := map[string]interface{}{
			"name":     columnName,
			"type":     dataType,
			"nullable": isNullable,
			"default":  defaultVal.String,
			"max_len":  maxLength.String,
		}
		tableMap[tableName] = append(tableMap[tableName], colInfo)
	}

	fmt.Println("=" + strings.Repeat("=", 120))
	fmt.Println("COMPLETE DATABASE STRUCTURE - ALL TABLES")
	fmt.Println("=" + strings.Repeat("=", 120))
	fmt.Printf("\nTotal Tables: %d\n\n", len(tableMap))

	// Focus on tables with user references
	userRefTables := []string{
		"gmail_connections", "email_drafts", "email_signatures", "email_templates",
		"workspaces", "workspace_members", "organization_members",
		"data_tables", "table_rows", "table_views", "sub_modules",
		"automation_workflows", "automation_workflow_executions",
		"change_requests", "change_approvals", "ai_field_suggestions",
		"search_analytics", "batch_operations", "portal_operations",
		"integration_credentials", "wf_api_keys",
		"ba_users", "ba_sessions", "ba_accounts", "ba_members",
	}

	fmt.Println("=" + strings.Repeat("=", 120))
	fmt.Println("TABLES WITH USER REFERENCES")
	fmt.Println("=" + strings.Repeat("=", 120))

	for _, tableName := range userRefTables {
		if cols, exists := tableMap[tableName]; exists {
			fmt.Printf("\n📋 Table: %s\n", tableName)
			fmt.Println(strings.Repeat("-", 120))
			for _, col := range cols {
				colName := col["name"].(string)
				colType := col["type"].(string)
				colNullable := col["nullable"].(string)
				colDefault := col["default"].(string)
				colMaxLen := col["max_len"].(string)

				// Highlight user-related columns
				isUserCol := strings.Contains(colName, "user") || 
					strings.Contains(colName, "created_by") || 
					strings.Contains(colName, "updated_by") ||
					strings.Contains(colName, "reviewed_by") ||
					strings.Contains(colName, "invited_by")

				status := ""
				if strings.HasPrefix(colName, "ba_") {
					status = " [✅ Better Auth]"
				} else if isUserCol && colType == "uuid" {
					status = " [⚠️ UUID - legacy]"
				} else if isUserCol && (colType == "text" || colType == "character varying") {
					status = " [✅ TEXT - compatible]"
				}

				typeStr := colType
				if colMaxLen != "" {
					typeStr += fmt.Sprintf("(%s)", colMaxLen)
				}
				if colDefault != "" {
					typeStr += fmt.Sprintf(" DEFAULT %s", colDefault)
				}

				fmt.Printf("   %-30s %-25s %-8s%s\n", 
					colName, typeStr, colNullable, status)
			}
		}
	}

	// Check for missing tables
	fmt.Println("\n" + strings.Repeat("=", 120))
	fmt.Println("MISSING TABLES CHECK")
	fmt.Println("=" + strings.Repeat("=", 120))
	
	expectedTables := []string{"email_drafts", "gmail_connections", "email_signatures"}
	for _, tableName := range expectedTables {
		if _, exists := tableMap[tableName]; !exists {
			fmt.Printf("⚠️  Table '%s' does NOT exist\n", tableName)
		} else {
			fmt.Printf("✅ Table '%s' exists\n", tableName)
		}
	}
}

