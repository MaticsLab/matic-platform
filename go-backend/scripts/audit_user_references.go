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

type TableColumn struct {
	TableName  string
	ColumnName string
	DataType   string
	IsNullable string
}

func main() {
	// Load .env file - try multiple locations
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

	fmt.Println("=" + strings.Repeat("=", 80))
	fmt.Println("AUDIT: User References in Database Tables")
	fmt.Println("=" + strings.Repeat("=", 80))
	fmt.Println()

	// Query all columns that might reference users
	query := `
		SELECT 
			t.table_name,
			c.column_name,
			c.data_type,
			c.is_nullable
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
			AND c.column_name NOT LIKE '%ba_%'  -- Exclude Better Auth columns for now
		ORDER BY t.table_name, c.column_name;
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Fatalf("Failed to query database: %v", err)
	}
	defer rows.Close()

	var columns []TableColumn
	for rows.Next() {
		var col TableColumn
		if err := rows.Scan(&col.TableName, &col.ColumnName, &col.DataType, &col.IsNullable); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		columns = append(columns, col)
	}

	// Group by table
	tableMap := make(map[string][]TableColumn)
	for _, col := range columns {
		tableMap[col.TableName] = append(tableMap[col.TableName], col)
	}

	fmt.Println("Tables with User References (UUID columns - need Better Auth migration):")
	fmt.Println(strings.Repeat("-", 80))
	
	needsMigration := []string{}
	for tableName, cols := range tableMap {
		fmt.Printf("\n📋 Table: %s\n", tableName)
		for _, col := range cols {
			status := "⚠️  NEEDS MIGRATION"
			if col.DataType == "uuid" {
				needsMigration = append(needsMigration, fmt.Sprintf("%s.%s", tableName, col.ColumnName))
			}
			fmt.Printf("   - %s: %s (%s, nullable: %s) %s\n", 
				col.ColumnName, col.DataType, col.IsNullable, status)
		}
	}

	// Check for Better Auth columns
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("Better Auth Columns (ba_*):")
	fmt.Println(strings.Repeat("-", 80))

	baQuery := `
		SELECT 
			t.table_name,
			c.column_name,
			c.data_type,
			c.is_nullable
		FROM information_schema.tables t
		JOIN information_schema.columns c ON t.table_name = c.table_name
		WHERE t.table_schema = 'public'
			AND t.table_type = 'BASE TABLE'
			AND c.column_name LIKE 'ba_%'
		ORDER BY t.table_name, c.column_name;
	`

	baRows, err := db.Query(baQuery)
	if err != nil {
		log.Printf("Failed to query Better Auth columns: %v", err)
	} else {
		defer baRows.Close()

		baTableMap := make(map[string][]TableColumn)
		for baRows.Next() {
			var col TableColumn
			if err := baRows.Scan(&col.TableName, &col.ColumnName, &col.DataType, &col.IsNullable); err != nil {
				log.Printf("Error scanning row: %v", err)
				continue
			}
			baTableMap[col.TableName] = append(baTableMap[col.TableName], col)
		}

		for tableName, cols := range baTableMap {
			fmt.Printf("\n✅ Table: %s\n", tableName)
			for _, col := range cols {
				fmt.Printf("   - %s: %s (%s)\n", col.ColumnName, col.DataType, col.IsNullable)
			}
		}
	}

	// Summary
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("SUMMARY")
	fmt.Println(strings.Repeat("-", 80))
	fmt.Printf("Total tables with user references: %d\n", len(tableMap))
	fmt.Printf("Columns needing migration: %d\n", len(needsMigration))
	
	if len(needsMigration) > 0 {
		fmt.Println("\n⚠️  Columns that need Better Auth migration:")
		for _, col := range needsMigration {
			fmt.Printf("   - %s\n", col)
		}
	} else {
		fmt.Println("\n✅ All user references appear to be migrated to Better Auth!")
	}
}

