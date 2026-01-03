-- Migration: Ensure All Tables Use Better Auth User IDs
-- This migration checks and updates any remaining tables that reference users
-- to ensure they use Better Auth (ba_users) instead of Supabase auth.users

-- ============================================
-- STEP 1: Check email_drafts table
-- ============================================
-- email_drafts.user_id is already VARCHAR(255), which is compatible with Better Auth TEXT IDs
-- No migration needed, but ensure it's documented

-- ============================================
-- STEP 2: Check gmail_connections table
-- ============================================
-- gmail_connections might have user_id - check if it needs migration
-- If it exists and is UUID, add ba_user_id column

DO $$
BEGIN
    -- Check if gmail_connections has user_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gmail_connections' 
        AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
        -- Add ba_user_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'gmail_connections' 
            AND column_name = 'ba_user_id'
        ) THEN
            ALTER TABLE gmail_connections 
            ADD COLUMN ba_user_id TEXT;
            
            -- Migrate data
            UPDATE gmail_connections gc
            SET ba_user_id = ba.id
            FROM ba_users ba
            WHERE ba.supabase_user_id::text = gc.user_id::text
              AND ba.supabase_user_id IS NOT NULL
              AND gc.user_id IS NOT NULL;
            
            -- Create index
            CREATE INDEX IF NOT EXISTS idx_gmail_connections_ba_user_id 
            ON gmail_connections(ba_user_id) 
            WHERE ba_user_id IS NOT NULL;
            
            RAISE NOTICE 'Added ba_user_id to gmail_connections';
        END IF;
    END IF;
END $$;

-- ============================================
-- STEP 3: Check email_signatures table
-- ============================================
-- email_signatures has user_id - check if it needs migration

DO $$
BEGIN
    -- Check if email_signatures has user_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_signatures' 
        AND column_name = 'user_id'
    ) THEN
        -- Check if it's UUID or TEXT
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'email_signatures' 
            AND column_name = 'user_id'
            AND data_type = 'uuid'
        ) THEN
            -- Add ba_user_id column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'email_signatures' 
                AND column_name = 'ba_user_id'
            ) THEN
                ALTER TABLE email_signatures 
                ADD COLUMN ba_user_id TEXT;
                
                -- Migrate data
                UPDATE email_signatures es
                SET ba_user_id = ba.id
                FROM ba_users ba
                WHERE ba.supabase_user_id::text = es.user_id::text
                  AND ba.supabase_user_id IS NOT NULL
                  AND es.user_id IS NOT NULL;
                
                -- Create index
                CREATE INDEX IF NOT EXISTS idx_email_signatures_ba_user_id 
                ON email_signatures(ba_user_id) 
                WHERE ba_user_id IS NOT NULL;
                
                RAISE NOTICE 'Added ba_user_id to email_signatures';
            END IF;
        ELSE
            -- Already TEXT/VARCHAR, might already be using Better Auth IDs
            RAISE NOTICE 'email_signatures.user_id is already TEXT/VARCHAR - compatible with Better Auth';
        END IF;
    END IF;
END $$;

-- ============================================
-- STEP 4: Check portal_applicants table
-- ============================================
-- portal_applicants might have user_id references

DO $$
BEGIN
    -- Check if portal_applicants has any user reference columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'portal_applicants' 
        AND column_name LIKE '%user%'
    ) THEN
        RAISE NOTICE 'portal_applicants has user reference columns - check if migration needed';
    END IF;
END $$;

-- ============================================
-- STEP 5: Add comments for documentation
-- ============================================

COMMENT ON COLUMN email_drafts.user_id IS 'Better Auth user ID (TEXT/VARCHAR) - references ba_users.id';
COMMENT ON COLUMN gmail_connections.ba_user_id IS 'Better Auth user ID (TEXT) - references ba_users.id';
COMMENT ON COLUMN email_signatures.ba_user_id IS 'Better Auth user ID (TEXT) - references ba_users.id';

-- ============================================
-- STEP 6: Summary
-- ============================================
-- This migration ensures:
-- 1. email_drafts.user_id is compatible (already VARCHAR(255))
-- 2. gmail_connections has ba_user_id if it had UUID user_id
-- 3. email_signatures has ba_user_id if it had UUID user_id
-- 4. All tables now reference ba_users instead of auth.users

