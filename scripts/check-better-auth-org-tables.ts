#!/usr/bin/env tsx

/**
 * Script to check and create Better Auth organization plugin tables
 * Run with: npx tsx scripts/check-better-auth-org-tables.ts
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ORGANIZATION_TABLES = {
  ba_organizations: `
    CREATE TABLE IF NOT EXISTS ba_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      logo TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,
  ba_members: `
    CREATE TABLE IF NOT EXISTS ba_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES ba_organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, user_id)
    );
  `,
  ba_invitations: `
    CREATE TABLE IF NOT EXISTS ba_invitations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES ba_organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      invited_by TEXT REFERENCES ba_users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
};

async function checkAndCreateTables() {
  console.log('🔍 Checking Better Auth organization tables...');
  
  try {
    for (const [tableName, createSQL] of Object.entries(ORGANIZATION_TABLES)) {
      // Check if table exists
      const checkResult = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )`,
        [tableName]
      );
      
      const tableExists = checkResult.rows[0].exists;
      
      if (tableExists) {
        console.log(`✅ Table ${tableName} exists`);
        
        // Show row count
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`   └─ Contains ${countResult.rows[0].count} rows`);
      } else {
        console.log(`❌ Table ${tableName} does not exist - creating...`);
        
        await pool.query(createSQL);
        console.log(`✅ Created table ${tableName}`);
      }
    }
    
    console.log('\n📊 Better Auth tables summary:');
    const allTables = await pool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_name LIKE 'ba_%'
      ORDER BY table_name
    `);
    
    allTables.rows.forEach(row => {
      console.log(`   ${row.table_name} (${row.column_count} columns)`);
    });
    
  } catch (error) {
    console.error('❌ Error checking/creating tables:', error);
  } finally {
    await pool.end();
  }
}

checkAndCreateTables();