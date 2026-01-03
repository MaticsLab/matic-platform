#!/usr/bin/env npx tsx

/**
 * Comprehensive audit of all tables and code that reference user IDs
 * This helps identify what needs to be migrated to Better Auth
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Comprehensive Better Auth Migration Audit                ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Find all columns that reference users
    const userColumns = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          column_name LIKE '%user_id%' 
          OR column_name LIKE '%created_by%' 
          OR column_name LIKE '%updated_by%'
          OR column_name LIKE '%owner_id%'
          OR column_name LIKE '%invited_by%'
          OR column_name LIKE '%submitted_by%'
          OR column_name LIKE '%reviewed_by%'
          OR column_name LIKE '%assigned_to%'
        )
        AND table_name NOT LIKE 'ba_%'
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT LIKE 'information_%'
        AND table_name NOT LIKE 'storage%'
      ORDER BY table_name, column_name
    `);

    console.log(`📊 Found ${userColumns.rows.length} columns referencing users:\n`);

    const tablesByColumn: Record<string, any[]> = {};
    for (const col of userColumns.rows) {
      if (!tablesByColumn[col.table_name]) {
        tablesByColumn[col.table_name] = [];
      }
      tablesByColumn[col.table_name].push(col);
    }

    for (const [table, columns] of Object.entries(tablesByColumn)) {
      console.log(`📋 Table: ${table}`);
      for (const col of columns) {
        const nullable = col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL';
        console.log(`   - ${col.column_name}: ${col.data_type} (${nullable})`);
      }
      console.log('');
    }

    // Check for foreign key constraints
    console.log("\n🔗 Foreign Key Constraints:\n");
    const fkConstraints = await pool.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND (
          kcu.column_name LIKE '%user_id%'
          OR kcu.column_name LIKE '%created_by%'
          OR kcu.column_name LIKE '%invited_by%'
        )
        AND tc.table_schema = 'public'
        AND tc.table_name NOT LIKE 'ba_%'
      ORDER BY tc.table_name, kcu.column_name
    `);

    if (fkConstraints.rows.length > 0) {
      for (const fk of fkConstraints.rows) {
        console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      }
    } else {
      console.log("   No foreign key constraints found");
    }

    // Check organization references
    console.log("\n🏢 Organization References:\n");
    const orgColumns = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name LIKE '%organization%'
        AND table_name NOT LIKE 'ba_%'
        AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name
    `);

    if (orgColumns.rows.length > 0) {
      for (const col of orgColumns.rows) {
        console.log(`   ${col.table_name}.${col.column_name} (${col.data_type})`);
      }
    } else {
      console.log("   No organization columns found");
    }

    // Check workspace references (should map to ba_organizations)
    console.log("\n🏢 Workspace References (should map to ba_organizations):\n");
    const workspaceColumns = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name LIKE '%workspace%'
        AND table_name NOT LIKE 'ba_%'
        AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name
    `);

    if (workspaceColumns.rows.length > 0) {
      for (const col of workspaceColumns.rows) {
        console.log(`   ${col.table_name}.${col.column_name} (${col.data_type})`);
      }
    }

    // Summary
    console.log("\n📊 Migration Summary:\n");
    console.log(`   Tables with user references: ${Object.keys(tablesByColumn).length}`);
    console.log(`   Total user-related columns: ${userColumns.rows.length}`);
    console.log(`   Foreign key constraints: ${fkConstraints.rows.length}`);
    console.log(`   Organization columns: ${orgColumns.rows.length}`);
    console.log(`   Workspace columns: ${workspaceColumns.rows.length}`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();

