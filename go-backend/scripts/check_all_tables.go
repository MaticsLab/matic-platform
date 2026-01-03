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

type TableInfo struct {
	TableName  string
	ColumnName string
	DataType   string
	IsNullable string
	DefaultVal *string
}

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

	fmt.Println("=" + strings.Repeat("=", 100))
	fmt.Println("COMPLETE DATABASE AUDIT - ALL TABLES AND USER REFERENCES")
	fmt.Println("=" + strings.Repeat("=", 100))
	fmt.Println()

	// Get ALL tables first
	allTablesQuery := `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_type = 'BASE TABLE'
		ORDER BY table_name;
	`

	allTablesRows, err := db.Query(allTablesQuery)
	if err != nil {
		log.Fatalf("Failed to query tables: %v", err)
	}
	defer allTablesRows.Close()

	var allTables []string
	for allTablesRows.Next() {
		var tableName string
		if err := allTablesRows.Scan(&tableName); err != nil {
			log.Printf("Error scanning table: %v", err)
			continue
		}
		allTables = append(allTables, tableName)
	}

	fmt.Printf("📊 Total Tables in Database: %d\n\n", len(allTables))

	// Now get all columns with user references
	query := `
		SELECT 
			t.table_name,
			c.column_name,
			c.data_type,
			c.is_nullable,
			c.column_default
		FROM information_schema.tables t
		JOIN information_schema.columns c ON t.table_name = c.table_name
		WHERE t.table_schema = 'public'
			AND t.table_type = 'BASE TABLE'
			AND (
				c.column_name LIKE '%user_id%' OR
				c.column_name LIKE '%user%' OR
				c.column_name LIKE '%created_by%' OR
				c.column_name LIKE '%updated_by%' OR
				c.column_name LIKE '%reviewed_by%' OR
				c.column_name LIKE '%invited_by%'
			)
		ORDER BY t.table_name, c.column_name;
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatalf("Failed to query database: %v", err)
	}
	defer rows.Close()

	var columns []TableInfo
	for rows.Next() {
		var col TableInfo
		var defaultVal sql.NullString
		if err := rows.Scan(&col.TableName, &col.ColumnName, &col.DataType, &col.IsNullable, &defaultVal); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		if defaultVal.Valid {
			col.DefaultVal = &defaultVal.String
		}
		columns = append(columns, col)
	}

	// Group by table
	tableMap := make(map[string][]TableInfo)
	for _, col := range columns {
		tableMap[col.TableName] = append(tableMap[col.TableName], col)
	}

	fmt.Println("=" + strings.Repeat("=", 100))
	fmt.Println("TABLES WITH USER REFERENCES")
	fmt.Println("=" + strings.Repeat("=", 100))

	uuidColumns := []string{}
	textColumns := []string{}
	baColumns := []string{}

	for tableName, cols := range tableMap {
		fmt.Printf("\n📋 Table: %s\n", tableName)
		for _, col := range cols {
			status := ""
			if strings.HasPrefix(col.ColumnName, "ba_") {
				status = "✅ Better Auth"
				baColumns = append(baColumns, fmt.Sprintf("%s.%s", tableName, col.ColumnName))
			} else if col.DataType == "uuid" {
				status = "⚠️  UUID (needs migration)"
				uuidColumns = append(uuidColumns, fmt.Sprintf("%s.%s", tableName, col.ColumnName))
			} else if col.DataType == "text" || col.DataType == "character varying" {
				status = "✅ TEXT (compatible)"
				textColumns = append(textColumns, fmt.Sprintf("%s.%s", tableName, col.ColumnName))
			} else {
				status = "ℹ️  " + col.DataType
			}

			defaultStr := ""
			if col.DefaultVal != nil {
				defaultStr = fmt.Sprintf(" (default: %s)", *col.DefaultVal)
			}

			fmt.Printf("   - %s: %s (%s, nullable: %s)%s %s\n",
				col.ColumnName, col.DataType, col.IsNullable, defaultStr, status)
		}
	}

	// Summary
	fmt.Println("\n" + strings.Repeat("=", 100))
	fmt.Println("SUMMARY")
	fmt.Println("=" + strings.Repeat("=", 100))
	fmt.Printf("Total tables: %d\n", len(allTables))
	fmt.Printf("Tables with user references: %d\n", len(tableMap))
	fmt.Printf("Better Auth columns (ba_*): %d\n", len(baColumns))
	fmt.Printf("UUID columns (need migration): %d\n", len(uuidColumns))
	fmt.Printf("TEXT columns (compatible): %d\n", len(textColumns))

	if len(uuidColumns) > 0 {
		fmt.Println("\n⚠️  UUID Columns That May Need Migration:")
		for _, col := range uuidColumns {
			fmt.Printf("   - %s\n", col)
		}
	}

	fmt.Println("\n✅ Better Auth Columns (Already Migrated):")
	for _, col := range baColumns {
		fmt.Printf("   - %s\n", col)
	}

	fmt.Println("\n✅ TEXT Columns (Compatible with Better Auth):")
	for _, col := range textColumns {
		fmt.Printf("   - %s\n", col)
	}
}

