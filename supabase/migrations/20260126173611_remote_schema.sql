


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "drizzle";


ALTER SCHEMA "drizzle" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."archive_row_version"("p_version_id" "uuid", "p_archived_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE row_versions
  SET 
    is_archived = true,
    archived_at = NOW(),
    archived_by = p_archived_by,
    archive_expires_at = NOW() + INTERVAL '30 days'
  WHERE id = p_version_id
    AND is_archived = false;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."archive_row_version"("p_version_id" "uuid", "p_archived_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_create_module_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  field_config RECORD;
  new_field_id UUID;
BEGIN
  -- Only run when module is being enabled
  IF NEW.is_enabled = true AND (OLD IS NULL OR OLD.is_enabled = false) THEN
    -- Get auto-create fields for this module
    FOR field_config IN 
      SELECT mfc.*, ftr.label, ftr.input_schema, ftr.config_schema
      FROM module_field_configs mfc
      JOIN field_type_registry ftr ON ftr.id = mfc.field_type_id
      WHERE mfc.module_id = NEW.module_id
      AND mfc.is_auto_created = true
    LOOP
      -- Check if field already exists
      IF NOT EXISTS (
        SELECT 1 FROM table_fields 
        WHERE table_id = NEW.table_id 
        AND field_type_id = field_config.field_type_id
      ) THEN
        -- Create the field
        INSERT INTO table_fields (table_id, name, label, field_type_id, config, position, is_required)
        VALUES (
          NEW.table_id,
          LOWER(REPLACE(field_config.label, ' ', '_')),
          field_config.label,
          field_config.field_type_id,
          COALESCE(field_config.default_config, '{}'),
          (SELECT COALESCE(MAX(position), 0) + 1 FROM table_fields WHERE table_id = NEW.table_id),
          field_config.is_required
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_create_module_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_detect_semantic_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.semantic_type IS NULL THEN
        NEW.semantic_type := detect_semantic_type(NEW.name);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_detect_semantic_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_enable_default_modules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Enable 'tables' module by default for all new hubs
    INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
    VALUES (NEW.id, 'tables', TRUE, NEW.created_by)
    ON CONFLICT DO NOTHING;
    
    -- Enable 'views' module by default
    INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
    VALUES (NEW.id, 'views', TRUE, NEW.created_by)
    ON CONFLICT DO NOTHING;
    
    -- For activities hubs, auto-enable pulse
    IF NEW.hub_type = 'activities' THEN
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'pulse', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'attendance', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- For applications hubs, auto-enable review workflow
    IF NEW.hub_type = 'applications' THEN
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'forms', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'review_workflow', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'rubrics', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_enable_default_modules"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_enable_default_modules"() IS 'Automatically enables default modules when a new hub is created';



CREATE OR REPLACE FUNCTION "public"."auto_queue_row_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Queue for search index
    INSERT INTO search_index (
        entity_id, entity_type, table_id, workspace_id,
        title, subtitle, content, last_indexed_at
    )
    SELECT 
        NEW.id,
        'row',
        NEW.table_id,
        dt.workspace_id,
        COALESCE(
            (SELECT NEW.data->>tf.name 
             FROM table_fields tf 
             WHERE tf.table_id = NEW.table_id AND tf.is_display_field = true 
             LIMIT 1),
            'Row ' || NEW.id::TEXT
        ),
        dt.name,
        LEFT(NEW.data::TEXT, 1000),
        NOW()
    FROM data_tables dt
    WHERE dt.id = NEW.table_id
    ON CONFLICT (entity_id, entity_type) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        last_indexed_at = NOW();
    
    -- Queue for embedding generation
    PERFORM queue_for_embedding(NEW.id, 'row', 5);
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_queue_row_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_enable_module"("p_table_id" "uuid", "p_module_id" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_hub_type TEXT;
    v_module_hub_types TEXT[];
    v_dependencies TEXT[];
    v_dep TEXT;
    v_enabled_count INTEGER;
BEGIN
    -- Get the table's hub type
    SELECT hub_type INTO v_hub_type
    FROM data_tables
    WHERE id = p_table_id;
    
    IF v_hub_type IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get the module's allowed hub types and dependencies
    SELECT available_for_hub_types, dependencies 
    INTO v_module_hub_types, v_dependencies
    FROM module_definitions
    WHERE id = p_module_id;
    
    IF v_module_hub_types IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if hub type is allowed
    IF NOT v_hub_type = ANY(v_module_hub_types) THEN
        RETURN FALSE;
    END IF;
    
    -- Check all dependencies are enabled
    FOREACH v_dep IN ARRAY v_dependencies
    LOOP
        SELECT COUNT(*) INTO v_enabled_count
        FROM hub_module_configs
        WHERE table_id = p_table_id
          AND module_id = v_dep
          AND is_enabled = TRUE;
        
        IF v_enabled_count = 0 THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."can_enable_module"("p_table_id" "uuid", "p_module_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_enable_module"("p_table_id" "uuid", "p_module_id" "text") IS 'Checks if a module can be enabled for a table (validates hub type and dependencies)';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_sessions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM active_sessions 
    WHERE last_activity < NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_file_version"("p_parent_file_id" "uuid", "p_filename" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_storage_path" "text", "p_public_url" "text", "p_uploaded_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_new_id UUID;
    v_table_id UUID;
    v_row_id UUID;
    v_field_id UUID;
    v_workspace_id UUID;
    v_bucket TEXT;
    v_version INTEGER;
BEGIN
    -- Get parent file info
    SELECT table_id, row_id, field_id, workspace_id, storage_bucket, version
    INTO v_table_id, v_row_id, v_field_id, v_workspace_id, v_bucket, v_version
    FROM table_files
    WHERE id = p_parent_file_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent file not found';
    END IF;
    
    -- Mark old version as not current
    UPDATE table_files
    SET is_current = false
    WHERE id = p_parent_file_id;
    
    -- Create new version
    INSERT INTO table_files (
        table_id, row_id, field_id, workspace_id,
        filename, original_filename, mime_type, size_bytes,
        storage_bucket, storage_path, public_url,
        version, parent_file_id, is_current, uploaded_by
    ) VALUES (
        v_table_id, v_row_id, v_field_id, v_workspace_id,
        p_filename, p_original_filename, p_mime_type, p_size_bytes,
        v_bucket, p_storage_path, p_public_url,
        v_version + 1, p_parent_file_id, true, p_uploaded_by
    )
    RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$;


ALTER FUNCTION "public"."create_file_version"("p_parent_file_id" "uuid", "p_filename" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_storage_path" "text", "p_public_url" "text", "p_uploaded_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_row_version"("p_row_id" "uuid", "p_table_id" "uuid", "p_data" "jsonb", "p_metadata" "jsonb", "p_change_type" "text", "p_change_reason" "text", "p_changed_by" "uuid", "p_batch_operation_id" "uuid" DEFAULT NULL::"uuid", "p_ai_assisted" boolean DEFAULT false, "p_ai_confidence" double precision DEFAULT NULL::double precision) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_version_number INT;
  v_version_id UUID;
  v_change_summary TEXT;
BEGIN
  -- Get next version number
  v_version_number := get_row_version_number(p_row_id) + 1;
  
  -- Auto-generate change summary (simplified - can be enhanced)
  IF p_change_type = 'create' THEN
    v_change_summary := 'Initial creation';
  ELSIF p_change_reason IS NOT NULL THEN
    v_change_summary := p_change_reason;
  ELSE
    v_change_summary := 'Updated';
  END IF;
  
  -- Insert version
  INSERT INTO row_versions (
    row_id, table_id, version_number, data, metadata,
    change_type, change_reason, change_summary,
    batch_operation_id, changed_by, ai_assisted, ai_confidence
  ) VALUES (
    p_row_id, p_table_id, v_version_number, p_data, p_metadata,
    p_change_type, p_change_reason, v_change_summary,
    p_batch_operation_id, p_changed_by, p_ai_assisted, p_ai_confidence
  )
  RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
END;
$$;


ALTER FUNCTION "public"."create_row_version"("p_row_id" "uuid", "p_table_id" "uuid", "p_data" "jsonb", "p_metadata" "jsonb", "p_change_type" "text", "p_change_reason" "text", "p_changed_by" "uuid", "p_batch_operation_id" "uuid", "p_ai_assisted" boolean, "p_ai_confidence" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_cascade"("target_user_id" "uuid", "reassign_to_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- If reassign_to_user_id is provided, reassign data instead of deleting
    IF reassign_to_user_id IS NOT NULL THEN
        -- Reassign workspaces
        UPDATE workspaces SET created_by = reassign_to_user_id WHERE created_by = target_user_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Reassigned % workspaces', deleted_count;
        
        -- Reassign data_tables
        UPDATE data_tables SET created_by = reassign_to_user_id WHERE created_by = target_user_id;
        
        -- Reassign table_rows
        UPDATE table_rows SET created_by = reassign_to_user_id WHERE created_by = target_user_id;
        UPDATE table_rows SET updated_by = reassign_to_user_id WHERE updated_by = target_user_id;
        
        -- Reassign table_views
        UPDATE table_views SET created_by = reassign_to_user_id WHERE created_by = target_user_id;
        
        -- Reassign row_versions
        UPDATE row_versions SET changed_by = reassign_to_user_id WHERE changed_by = target_user_id;
        UPDATE row_versions SET archived_by = reassign_to_user_id WHERE archived_by = target_user_id;
        
        -- Reassign change_requests
        UPDATE change_requests SET requested_by = reassign_to_user_id WHERE requested_by = target_user_id;
        UPDATE change_requests SET reviewed_by = reassign_to_user_id WHERE reviewed_by = target_user_id;
    ELSE
        -- Delete data (will cascade or fail if not handled)
        DELETE FROM row_versions WHERE changed_by = target_user_id;
        DELETE FROM row_versions WHERE archived_by = target_user_id;
        DELETE FROM table_views WHERE created_by = target_user_id;
        DELETE FROM change_requests WHERE requested_by = target_user_id;
    END IF;
    
    -- Always delete workspace memberships for this user
    DELETE FROM workspace_members WHERE user_id = target_user_id;
    DELETE FROM workspace_members WHERE invited_by = target_user_id;
    
    -- Delete organization memberships
    DELETE FROM organization_members WHERE user_id = target_user_id;
    
    -- Finally delete the auth user
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RETURN 'User ' || target_user_id || ' deleted successfully';
    ELSE
        RETURN 'User ' || target_user_id || ' not found';
    END IF;
END;
$$;


ALTER FUNCTION "public"."delete_user_cascade"("target_user_id" "uuid", "reassign_to_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_cascade"("target_user_id" "uuid", "reassign_to_user_id" "uuid") IS 'Safely deletes a user and all associated data. If reassign_to_user_id is provided, data is reassigned instead of deleted.';



CREATE OR REPLACE FUNCTION "public"."detect_semantic_type"("p_field_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_type RECORD;
    v_pattern TEXT;
BEGIN
    FOR v_type IN SELECT * FROM semantic_field_types
    LOOP
        FOREACH v_pattern IN ARRAY v_type.patterns
        LOOP
            IF LOWER(p_field_name) ~ v_pattern THEN
                RETURN v_type.id;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN 'text';  -- Default type
END;
$$;


ALTER FUNCTION "public"."detect_semantic_type"("p_field_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_semantic_type"("p_field_name" "text") IS 'Auto-detect semantic type from field name patterns';



CREATE OR REPLACE FUNCTION "public"."extract_row_searchable_text"("p_row_data" "jsonb", "p_fields" "jsonb") RETURNS TABLE("title" "text", "subtitle" "text", "content" "text", "tags" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_title TEXT := '';
    v_subtitle TEXT := '';
    v_content TEXT := '';
    v_tags TEXT[] := ARRAY[]::TEXT[];
    v_field RECORD;
    v_value TEXT;
BEGIN
    -- Build content from all fields
    FOR v_field IN 
        SELECT * FROM jsonb_to_recordset(p_fields) AS x(
            id TEXT, name TEXT, label TEXT, semantic_type TEXT, 
            is_display_field BOOLEAN, search_weight REAL
        )
    LOOP
        v_value := p_row_data->>v_field.id;
        
        IF v_value IS NOT NULL AND v_value != '' THEN
            -- Build title from display fields
            IF v_field.is_display_field THEN
                IF v_title = '' THEN
                    v_title := v_value;
                ELSE
                    v_title := v_title || ' ' || v_value;
                END IF;
            END IF;
            
            -- Build subtitle from name/email fields
            IF v_field.semantic_type IN ('email', 'phone', 'status') THEN
                IF v_subtitle = '' THEN
                    v_subtitle := v_value;
                ELSE
                    v_subtitle := v_subtitle || ' • ' || v_value;
                END IF;
            END IF;
            
            -- Add to searchable content
            v_content := v_content || ' ' || v_value;
            
            -- Extract tags from status/type fields
            IF v_field.semantic_type IN ('status', 'type', 'category', 'tag') THEN
                v_tags := array_append(v_tags, LOWER(v_value));
            END IF;
        END IF;
    END LOOP;
    
    -- Default title if none found
    IF v_title = '' THEN
        v_title := 'Untitled';
    END IF;
    
    RETURN QUERY SELECT v_title, v_subtitle, TRIM(v_content), v_tags;
END;
$$;


ALTER FUNCTION "public"."extract_row_searchable_text"("p_row_data" "jsonb", "p_fields" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_similar"("p_entity_id" "uuid", "p_entity_type" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "table_id" "uuid", "title" "text", "subtitle" "text", "similarity" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_source_embedding vector(1536);
    v_workspace_id UUID;
BEGIN
    -- Get the source item's embedding
    SELECT si.embedding, si.workspace_id 
    INTO v_source_embedding, v_workspace_id
    FROM search_index si
    WHERE si.entity_id = p_entity_id AND si.entity_type = p_entity_type;
    
    IF v_source_embedding IS NULL THEN
        RETURN; -- No embedding found for source item
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        -- Cosine similarity (1 - distance)
        1 - (si.embedding <=> v_source_embedding) AS similarity,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = v_workspace_id
        AND si.embedding IS NOT NULL
        AND si.entity_id != p_entity_id  -- Exclude source item
    ORDER BY si.embedding <=> v_source_embedding ASC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."find_similar"("p_entity_id" "uuid", "p_entity_type" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_similar"("p_entity_id" "uuid", "p_entity_type" "text", "p_limit" integer) IS 'Find similar items using vector embeddings';



CREATE OR REPLACE FUNCTION "public"."get_available_modules"("p_hub_type" "text") RETURNS TABLE("id" "text", "name" "text", "description" "text", "icon" "text", "category" "text", "is_premium" boolean, "dependencies" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md.id,
        md.name,
        md.description,
        md.icon,
        md.category,
        md.is_premium,
        md.dependencies
    FROM module_definitions md
    WHERE p_hub_type = ANY(md.available_for_hub_types)
      AND md.is_deprecated = FALSE
    ORDER BY md.display_order;
END;
$$;


ALTER FUNCTION "public"."get_available_modules"("p_hub_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_modules"("p_hub_type" "text") IS 'Returns all modules available for a given hub type';



CREATE OR REPLACE FUNCTION "public"."get_effective_field_config"("p_field_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_field_type_id TEXT;
    v_instance_config JSONB;
    v_default_config JSONB;
BEGIN
    -- Get field data
    SELECT field_type_id, config INTO v_field_type_id, v_instance_config
    FROM table_fields WHERE id = p_field_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Get registry defaults
    SELECT default_config INTO v_default_config
    FROM field_type_registry WHERE id = v_field_type_id;
    
    -- Merge: defaults || instance (instance wins)
    RETURN COALESCE(v_default_config, '{}') || COALESCE(v_instance_config, '{}');
END;
$$;


ALTER FUNCTION "public"."get_effective_field_config"("p_field_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hub_module_fields"("p_hub_id" "uuid") RETURNS TABLE("module_id" "text", "module_name" "text", "field_type_id" "text", "field_label" "text", "is_required" boolean, "is_auto_created" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id as module_id,
    md.name as module_name,
    mfc.field_type_id,
    ftr.label as field_label,
    mfc.is_required,
    mfc.is_auto_created
  FROM hub_module_configs hmc
  JOIN module_definitions md ON md.id = hmc.module_id
  LEFT JOIN module_field_configs mfc ON mfc.module_id = md.id
  LEFT JOIN field_type_registry ftr ON ftr.id = mfc.field_type_id
  WHERE hmc.table_id = p_hub_id
  AND hmc.is_enabled = true
  ORDER BY md.display_order, mfc.display_order;
END;
$$;


ALTER FUNCTION "public"."get_hub_module_fields"("p_hub_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_module_row_history"("p_row_id" "uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "version_number" integer, "change_type" "text", "change_summary" "text", "changed_by" "uuid", "changed_at" timestamp with time zone, "module_id" "text", "sub_module_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rv.id,
    rv.version_number,
    rv.change_type,
    rv.change_summary,
    rv.changed_by,
    rv.changed_at,
    rv.module_id,
    rv.sub_module_id
  FROM row_versions rv
  WHERE rv.row_id = p_row_id
  AND (p_module_id IS NULL OR rv.module_id = p_module_id)
  AND rv.is_archived = false
  ORDER BY rv.version_number DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_module_row_history"("p_row_id" "uuid", "p_module_id" "text", "p_limit" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."application_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "form_id" "uuid" NOT NULL,
    "status" character varying(30) DEFAULT 'draft'::character varying,
    "stage_id" "uuid",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "version" integer DEFAULT 1 NOT NULL,
    "submitted_at" timestamp with time zone,
    "last_autosave_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."application_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_submissions" IS 'Stores application form submissions with optimistic locking for autosave';



COMMENT ON COLUMN "public"."application_submissions"."user_id" IS 'References ba_users.id (Better Auth user)';



COMMENT ON COLUMN "public"."application_submissions"."version" IS 'Optimistic locking version - incremented on each save';



CREATE OR REPLACE FUNCTION "public"."get_or_create_submission"("p_user_id" "text", "p_form_id" "uuid") RETURNS "public"."application_submissions"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_submission application_submissions;
BEGIN
    -- Try to get existing
    SELECT * INTO v_submission
    FROM application_submissions
    WHERE user_id = p_user_id AND form_id = p_form_id;
    
    IF v_submission.id IS NOT NULL THEN
        RETURN v_submission;
    END IF;
    
    -- Create new
    INSERT INTO application_submissions (user_id, form_id, status, version)
    VALUES (p_user_id, p_form_id, 'draft', 1)
    RETURNING * INTO v_submission;
    
    RETURN v_submission;
END;
$$;


ALTER FUNCTION "public"."get_or_create_submission"("p_user_id" "text", "p_form_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_result_boost"("p_entity_id" "uuid", "p_workspace_id" "uuid") RETURNS real
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_click_rate REAL;
    v_view_count INTEGER;
    v_click_count INTEGER;
BEGIN
    -- Get click statistics
    SELECT 
        COALESCE(si.view_count, 0),
        COALESCE(si.search_click_count, 0)
    INTO v_view_count, v_click_count
    FROM search_index si
    WHERE si.entity_id = p_entity_id;
    
    -- Calculate boost (log scale to prevent runaway scores)
    IF v_view_count > 0 THEN
        v_click_rate := v_click_count::REAL / v_view_count;
        RETURN 1.0 + (LN(v_click_count + 1) * 0.1) + (v_click_rate * 0.5);
    END IF;
    
    RETURN 1.0;
END;
$$;


ALTER FUNCTION "public"."get_result_boost"("p_entity_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_row_file_stats"("p_row_id" "uuid") RETURNS TABLE("file_count" bigint, "total_size_bytes" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(f.size_bytes), 0)::BIGINT
    FROM table_files f
    WHERE f.row_id = p_row_id
      AND f.is_current = true
      AND f.deleted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."get_row_file_stats"("p_row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_row_files"("p_row_id" "uuid") RETURNS TABLE("id" "uuid", "field_id" "uuid", "filename" "text", "original_filename" "text", "mime_type" "text", "size_bytes" bigint, "public_url" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.field_id,
        f.filename,
        f.original_filename,
        f.mime_type,
        f.size_bytes,
        f.public_url,
        f.metadata,
        f.created_at
    FROM table_files f
    WHERE f.row_id = p_row_id
      AND f.is_current = true
      AND f.deleted_at IS NULL
    ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_row_files"("p_row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_row_history"("p_row_id" "uuid", "p_redact_pii" boolean DEFAULT false, "p_include_archived" boolean DEFAULT false, "p_limit" integer DEFAULT 50) RETURNS TABLE("version_id" "uuid", "version_number" integer, "data" "jsonb", "change_type" "text", "change_reason" "text", "change_summary" "text", "changed_by" "uuid", "changed_at" timestamp with time zone, "ai_assisted" boolean, "is_archived" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rv.id,
    rv.version_number,
    CASE 
      WHEN p_redact_pii THEN 
        -- Redact PII fields (simplified - should use field_type_registry)
        rv.data - ARRAY(
          SELECT tf.name 
          FROM table_fields tf
          JOIN field_type_registry ftr ON tf.field_type_id = ftr.id
          WHERE tf.table_id = rv.table_id
            AND ftr.supports_pii = true
            AND (tf.config->>'is_pii')::boolean = true
        )
      ELSE rv.data
    END,
    rv.change_type,
    rv.change_reason,
    rv.change_summary,
    rv.changed_by,
    rv.changed_at,
    rv.ai_assisted,
    rv.is_archived
  FROM row_versions rv
  WHERE rv.row_id = p_row_id
    AND (p_include_archived OR rv.is_archived = false)
  ORDER BY rv.version_number DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_row_history"("p_row_id" "uuid", "p_redact_pii" boolean, "p_include_archived" boolean, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_row_version_number"("p_row_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(MAX(version_number), 0)
  FROM row_versions
  WHERE row_id = p_row_id;
$$;


ALTER FUNCTION "public"."get_row_version_number"("p_row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_fields_with_registry"("p_table_id" "uuid") RETURNS TABLE("field_id" "uuid", "field_name" "text", "field_label" "text", "field_type_id" "text", "category" "text", "field_position" integer, "field_width" integer, "is_visible" boolean, "is_primary" boolean, "is_container" boolean, "is_searchable" boolean, "is_sortable" boolean, "is_filterable" boolean, "effective_config" "jsonb", "parent_field_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tf.id,
        tf.name,
        tf.label,
        tf.field_type_id,
        ftr.category,
        tf.position,
        tf.width,
        tf.is_visible,
        tf.is_primary,
        ftr.is_container,
        COALESCE(tf.is_searchable, ftr.is_searchable),
        ftr.is_sortable,
        ftr.is_filterable,
        COALESCE(ftr.default_config, '{}') || COALESCE(tf.config, '{}'),
        tf.parent_field_id
    FROM table_fields tf
    LEFT JOIN field_type_registry ftr ON tf.field_type_id = ftr.id
    WHERE tf.table_id = p_table_id
    ORDER BY tf.position;
END;
$$;


ALTER FUNCTION "public"."get_table_fields_with_registry"("p_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_schema_for_ai"("p_table_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'table_id', dt.id,
        'table_name', dt.name,
        'entity_type', dt.entity_type,
        'description', dt.description,
        'fields', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'name', tf.name,
                    'label', tf.label,
                    'type', tf.type,
                    'semantic_type', tf.semantic_type,
                    'is_searchable', tf.is_searchable,
                    'is_display_field', tf.is_display_field,
                    'search_weight', tf.search_weight,
                    'sample_values', tf.sample_values
                ) ORDER BY tf.position
            )
            FROM table_fields tf
            WHERE tf.table_id = dt.id),
            '[]'::JSONB
        ),
        'row_count', (SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = dt.id)
    )
    INTO v_result
    FROM data_tables dt
    WHERE dt.id = p_table_id;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_table_schema_for_ai"("p_table_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_table_schema_for_ai"("p_table_id" "uuid") IS 'Returns table structure in AI-friendly JSON format';



CREATE OR REPLACE FUNCTION "public"."get_workspace_summary_for_ai"("p_workspace_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'workspace_id', w.id,
        'workspace_name', w.name,
        'ai_description', w.ai_description,
        'tables', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', dt.id,
                    'name', dt.name,
                    'entity_type', dt.entity_type,
                    'row_count', (SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = dt.id)
                )
            )
            FROM data_tables dt
            WHERE dt.workspace_id = w.id),
            '[]'::JSONB
        ),
        'statistics', jsonb_build_object(
            'table_count', (SELECT COUNT(*) FROM data_tables dt WHERE dt.workspace_id = w.id),
            'total_rows', (SELECT SUM(cnt) FROM (SELECT COUNT(*) as cnt FROM table_rows tr JOIN data_tables dt ON tr.table_id = dt.id WHERE dt.workspace_id = w.id) sub),
            'total_forms', (SELECT COUNT(*) FROM forms f WHERE f.workspace_id = w.id)
        )
    )
    INTO v_result
    FROM workspaces w
    WHERE w.id = p_workspace_id;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_workspace_summary_for_ai"("p_workspace_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_workspace_summary_for_ai"("p_workspace_id" "uuid") IS 'Returns workspace context for AI prompts';



CREATE OR REPLACE FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_embedding" "public"."vector" DEFAULT NULL::"public"."vector", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_limit" integer DEFAULT 50, "p_keyword_weight" real DEFAULT 0.4, "p_semantic_weight" real DEFAULT 0.6) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "table_id" "uuid", "title" "text", "subtitle" "text", "content_snippet" "text", "hub_type" "text", "data_entity_type" "text", "tags" "text"[], "keyword_score" real, "semantic_score" real, "combined_score" real, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_query_tsquery tsquery;
    v_hub_type_filter TEXT;
BEGIN
    v_query_tsquery := plainto_tsquery('english', p_query);
    v_hub_type_filter := p_filters->>'hub_type';
    
    RETURN QUERY
    WITH all_results AS (
        -- Get keyword matches
        SELECT 
            si.entity_id,
            si.entity_type,
            si.table_id,
            si.title,
            si.subtitle,
            si.content,
            si.search_vector,
            si.embedding,
            si.hub_type,
            si.data_entity_type,
            si.tags,
            si.metadata,
            CASE WHEN si.search_vector @@ v_query_tsquery 
                 THEN ts_rank_cd(si.search_vector, v_query_tsquery, 32) 
                 ELSE 0 END AS kw_score,
            CASE WHEN p_embedding IS NOT NULL AND si.embedding IS NOT NULL 
                 THEN (1 - (si.embedding <=> p_embedding))::REAL 
                 ELSE 0 END AS sem_score
        FROM search_index si
        WHERE 
            si.workspace_id = p_workspace_id
            AND (v_hub_type_filter IS NULL OR si.hub_type = v_hub_type_filter)
            AND (
                si.search_vector @@ v_query_tsquery
                OR (p_embedding IS NOT NULL AND si.embedding IS NOT NULL AND (1 - (si.embedding <=> p_embedding)) > 0.3)
            )
    ),
    scored_results AS (
        SELECT 
            ar.*,
            (ar.kw_score / GREATEST(MAX(ar.kw_score) OVER(), 0.001))::REAL AS norm_keyword_score
        FROM all_results ar
    )
    SELECT 
        sr.entity_id,
        sr.entity_type,
        sr.table_id,
        sr.title,
        sr.subtitle,
        CASE WHEN sr.kw_score > 0 
             THEN ts_headline('english', sr.content, v_query_tsquery, 'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>')::TEXT
             ELSE LEFT(sr.content, 150) END AS content_snippet,
        sr.hub_type,
        sr.data_entity_type,
        sr.tags,
        sr.norm_keyword_score AS keyword_score,
        sr.sem_score AS semantic_score,
        (
            (sr.norm_keyword_score * p_keyword_weight) + 
            (sr.sem_score * p_semantic_weight)
        )::REAL AS combined_score,
        sr.metadata
    FROM scored_results sr
    WHERE sr.norm_keyword_score > 0 OR sr.sem_score > 0.3
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" real, "p_semantic_weight" real) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" real, "p_semantic_weight" real) IS 'Combined keyword + semantic search with configurable weights';



CREATE OR REPLACE FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_query_embedding" "public"."vector", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_limit" integer DEFAULT 50, "p_keyword_weight" double precision DEFAULT 0.4, "p_semantic_weight" double precision DEFAULT 0.6) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "table_id" "uuid", "title" "text", "subtitle" "text", "content_snippet" "text", "hub_type" "text", "data_entity_type" "text", "tags" "text"[], "keyword_score" double precision, "semantic_score" double precision, "score" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tsquery tsquery;
    v_hub_type TEXT;
    v_entity_type TEXT;
    v_table_id UUID;
    v_exclude_pii BOOLEAN;
BEGIN
    -- Build tsquery from search terms
    v_tsquery := plainto_tsquery('english', p_query);
    
    -- Extract filters
    v_hub_type := p_filters->>'hub_type';
    v_entity_type := p_filters->>'entity_type';
    v_exclude_pii := COALESCE((p_filters->>'exclude_pii')::BOOLEAN, false);
    IF p_filters->>'table_id' IS NOT NULL THEN
        v_table_id := (p_filters->>'table_id')::UUID;
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        -- Generate content snippet with highlights
        CASE 
            WHEN si.content IS NOT NULL AND si.content != '' THEN
                ts_headline('english', si.content, v_tsquery, 
                    'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>')
            ELSE si.subtitle
        END AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        -- Keyword score (normalized to 0-1)
        COALESCE(ts_rank_cd(si.search_vector, v_tsquery, 32), 0) AS keyword_score,
        -- Semantic score (cosine similarity, already 0-1)
        CASE 
            WHEN si.embedding IS NOT NULL THEN
                1 - (si.embedding <=> p_query_embedding)
            ELSE 0
        END AS semantic_score,
        -- Combined score
        (
            (COALESCE(ts_rank_cd(si.search_vector, v_tsquery, 32), 0) * p_keyword_weight) +
            (CASE 
                WHEN si.embedding IS NOT NULL THEN
                    (1 - (si.embedding <=> p_query_embedding)) * p_semantic_weight
                ELSE 0
            END) +
            (COALESCE(si.importance_score, 1.0) * 0.1) +
            (COALESCE(si.search_click_count, 0)::FLOAT / 1000)
        ) AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND (
            si.search_vector @@ v_tsquery
            OR (si.embedding IS NOT NULL AND (1 - (si.embedding <=> p_query_embedding)) > 0.5)
        )
        AND (v_hub_type IS NULL OR si.hub_type = v_hub_type)
        AND (v_entity_type IS NULL OR si.entity_type = v_entity_type)
        AND (v_table_id IS NULL OR si.table_id = v_table_id)
        -- Exclude PII fields if requested (filter based on indexed_fields metadata)
        AND (
            NOT v_exclude_pii 
            OR NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(si.indexed_fields) AS f
                WHERE f->>'semantic_type' IN ('email', 'phone', 'ssn', 'address')
            )
        )
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_query_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" double precision, "p_semantic_weight" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."index_table_row"("p_row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_row RECORD;
    v_table RECORD;
    v_fields JSONB;
    v_extracted RECORD;
BEGIN
    -- Get row data
    SELECT * INTO v_row FROM table_rows WHERE id = p_row_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get table metadata
    SELECT * INTO v_table FROM data_tables WHERE id = v_row.table_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get field configurations as JSONB array
    SELECT jsonb_agg(jsonb_build_object(
        'id', id::TEXT,
        'name', name,
        'label', label,
        'semantic_type', COALESCE(semantic_type, 'text'),
        'is_display_field', COALESCE(is_display_field, FALSE),
        'search_weight', COALESCE(search_weight, 1.0)
    )) INTO v_fields
    FROM table_fields 
    WHERE table_id = v_row.table_id AND is_searchable = TRUE;
    
    -- Extract searchable content
    SELECT * INTO v_extracted 
    FROM extract_row_searchable_text(v_row.data, COALESCE(v_fields, '[]'::JSONB));
    
    -- Upsert into search index
    INSERT INTO search_index (
        entity_id, entity_type, table_id, workspace_id,
        title, subtitle, content, search_vector,
        hub_type, data_entity_type, tags,
        status, created_at, updated_at, metadata
    ) VALUES (
        v_row.id, 'row', v_row.table_id, v_table.workspace_id,
        v_extracted.title, v_extracted.subtitle, v_extracted.content,
        setweight(to_tsvector('english', COALESCE(v_extracted.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(v_extracted.subtitle, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(v_extracted.content, '')), 'C'),
        v_table.hub_type, v_table.entity_type, v_extracted.tags,
        COALESCE(v_row.metadata->>'status', 'active'),
        v_row.created_at, v_row.updated_at,
        jsonb_build_object(
            'table_name', v_table.name,
            'table_slug', v_table.slug,
            'row_position', v_row.position
        )
    )
    ON CONFLICT (entity_id, entity_type) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        content = EXCLUDED.content,
        search_vector = EXCLUDED.search_vector,
        tags = EXCLUDED.tags,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        last_indexed_at = NOW(),
        metadata = EXCLUDED.metadata;
END;
$$;


ALTER FUNCTION "public"."index_table_row"("p_row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_workspace_to_organization"("p_workspace_id" "uuid", "p_owner_user_id" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_workspace RECORD;
    v_org_id TEXT;
BEGIN
    -- Get the workspace
    SELECT * INTO v_workspace 
    FROM workspaces 
    WHERE id = p_workspace_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
    END IF;
    
    -- Check if already linked
    IF v_workspace.ba_organization_id IS NOT NULL THEN
        RETURN v_workspace.ba_organization_id;
    END IF;
    
    -- Generate organization ID
    v_org_id := gen_random_uuid()::TEXT;
    
    -- Create organization
    INSERT INTO ba_organizations (
        id,
        name,
        slug,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        v_org_id,
        v_workspace.name,
        v_workspace.slug,
        jsonb_build_object('workspace_id', p_workspace_id::TEXT),
        v_workspace.created_at,
        NOW()
    );
    
    -- Add owner as organization member
    INSERT INTO ba_members (
        id,
        organization_id,
        user_id,
        role,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid()::TEXT,
        v_org_id,
        p_owner_user_id,
        'owner',
        NOW(),
        NOW()
    );
    
    -- Link workspace to organization
    UPDATE workspaces 
    SET ba_organization_id = v_org_id 
    WHERE id = p_workspace_id;
    
    RETURN v_org_id;
END;
$$;


ALTER FUNCTION "public"."link_workspace_to_organization"("p_workspace_id" "uuid", "p_owner_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (workspace_id, form_id, user_id, action, entity_type, entity_id, details)
        VALUES (
            COALESCE(NEW.workspace_id, (SELECT workspace_id FROM forms WHERE id = NEW.form_id)),
            CASE WHEN TG_TABLE_NAME = 'forms' THEN NEW.id ELSE NEW.form_id END,
            auth.uid(),
            'created',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(NEW)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO activity_logs (workspace_id, form_id, user_id, action, entity_type, entity_id, details)
        VALUES (
            COALESCE(NEW.workspace_id, (SELECT workspace_id FROM forms WHERE id = NEW.form_id)),
            CASE WHEN TG_TABLE_NAME = 'forms' THEN NEW.id ELSE NEW.form_id END,
            auth.uid(),
            'updated',
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO activity_logs (workspace_id, form_id, user_id, action, entity_type, entity_id, details)
        VALUES (
            COALESCE(OLD.workspace_id, (SELECT workspace_id FROM forms WHERE id = OLD.form_id)),
            CASE WHEN TG_TABLE_NAME = 'forms' THEN OLD.id ELSE OLD.form_id END,
            auth.uid(),
            'deleted',
            TG_TABLE_NAME,
            OLD.id,
            row_to_json(OLD)
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_existing_hub_types"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id, name, icon FROM data_tables WHERE hub_type = 'data' OR hub_type IS NULL
    LOOP
        -- Check if table has pulse enabled -> activities
        IF EXISTS (SELECT 1 FROM pulse_enabled_tables WHERE table_id = t.id AND enabled = TRUE) THEN
            UPDATE data_tables SET hub_type = 'activities' WHERE id = t.id;
        -- Check if table is a form (icon='form') with submissions -> applications
        ELSIF t.icon = 'form' THEN
            -- Forms that have rows are likely application forms
            IF EXISTS (SELECT 1 FROM table_rows WHERE table_id = t.id LIMIT 1) THEN
                UPDATE data_tables SET hub_type = 'applications' WHERE id = t.id;
            END IF;
        -- Check if table name suggests activities
        ELSIF LOWER(t.name) LIKE '%activit%' OR LOWER(t.name) LIKE '%event%' THEN
            UPDATE data_tables SET hub_type = 'activities' WHERE id = t.id;
        -- Check if table name suggests applications
        ELSIF LOWER(t.name) LIKE '%application%' OR LOWER(t.name) LIKE '%scholarship%' OR LOWER(t.name) LIKE '%grant%' THEN
            UPDATE data_tables SET hub_type = 'applications' WHERE id = t.id;
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."migrate_existing_hub_types"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_existing_hub_types"() IS 'Infers and sets hub_type for existing tables based on their usage patterns';



CREATE OR REPLACE FUNCTION "public"."migrate_portal_applicants_to_ba_users"() RETURNS TABLE("migrated_count" integer, "skipped_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_migrated INT := 0;
    v_skipped INT := 0;
    v_applicant RECORD;
    v_user_id TEXT;
    v_existing_user_id TEXT;
BEGIN
    FOR v_applicant IN 
        SELECT DISTINCT ON (email) *
        FROM portal_applicants
        ORDER BY email, created_at DESC
    LOOP
        -- Check if user already exists in ba_users
        SELECT id INTO v_existing_user_id
        FROM ba_users
        WHERE email = v_applicant.email;
        
        IF v_existing_user_id IS NOT NULL THEN
            -- User exists, update their metadata to include this form
            UPDATE ba_users
            SET 
                user_type = CASE WHEN user_type = 'staff' THEN user_type ELSE 'applicant' END,
                metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{forms_applied}',
                    COALESCE(metadata->'forms_applied', '[]'::jsonb) || 
                    to_jsonb(v_applicant.form_id::text)
                ),
                updated_at = NOW()
            WHERE id = v_existing_user_id;
            
            v_user_id := v_existing_user_id;
            v_skipped := v_skipped + 1;
        ELSE
            -- Create new ba_user
            v_user_id := gen_random_uuid()::TEXT;
            
            INSERT INTO ba_users (id, email, name, user_type, metadata, created_at, updated_at)
            VALUES (
                v_user_id,
                v_applicant.email,
                v_applicant.full_name,
                'applicant',
                jsonb_build_object(
                    'forms_applied', jsonb_build_array(v_applicant.form_id::text),
                    'legacy_portal_applicant_id', v_applicant.id::text
                ),
                v_applicant.created_at,
                NOW()
            );
            
            -- Create ba_account for password auth (credential provider)
            INSERT INTO ba_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES (
                gen_random_uuid()::TEXT,
                v_applicant.email,
                'credential',
                v_user_id,
                v_applicant.password_hash,
                v_applicant.created_at,
                NOW()
            );
            
            v_migrated := v_migrated + 1;
        END IF;
        
        -- Migrate their submission if exists
        IF v_applicant.id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM data_tables WHERE id = v_applicant.form_id) THEN
                INSERT INTO application_submissions (
                    id, user_id, form_id, status, data, version, submitted_at, created_at, updated_at
                )
                VALUES (
                    v_applicant.id,
                    v_user_id,
                    v_applicant.form_id,
                    'submitted',
                    v_applicant.submission_data,
                    1,
                    NULL,
                    v_applicant.created_at,
                    v_applicant.updated_at
                )
                ON CONFLICT (user_id, form_id) DO NOTHING;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_migrated, v_skipped;
END;
$$;


ALTER FUNCTION "public"."migrate_portal_applicants_to_ba_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_portal_to_view"("p_table_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_settings JSONB;
    v_view_id UUID;
    v_table_name TEXT;
    v_created_by UUID;
BEGIN
    -- Get the table settings
    SELECT settings, name, created_by 
    INTO v_settings, v_table_name, v_created_by
    FROM data_tables 
    WHERE id = p_table_id;
    
    -- Check if there are portal sections to migrate
    IF v_settings IS NOT NULL AND v_settings ? 'sections' THEN
        -- Check if a portal view already exists for this table
        SELECT id INTO v_view_id
        FROM table_views
        WHERE table_id = p_table_id AND type = 'portal'
        LIMIT 1;
        
        IF v_view_id IS NULL THEN
            -- Create a new portal view
            INSERT INTO table_views (
                table_id,
                name,
                type,
                config,
                settings,
                is_shared,
                is_locked,
                created_by
            ) VALUES (
                p_table_id,
                COALESCE(v_table_name, 'Application Portal') || ' Portal',
                'portal',
                jsonb_build_object(
                    'sections', v_settings->'sections',
                    'translations', COALESCE(v_settings->'translations', '{}'),
                    'theme', COALESCE(v_settings->'theme', '{}'),
                    'submission_settings', COALESCE(v_settings->'submission_settings', '{}')
                ),
                jsonb_build_object(
                    'is_public', COALESCE((v_settings->>'is_public')::boolean, true),
                    'requires_auth', COALESCE((v_settings->>'requires_auth')::boolean, false)
                ),
                true, -- is_shared (portals are typically public)
                false,
                v_created_by
            )
            RETURNING id INTO v_view_id;
            
            RAISE NOTICE 'Created portal view % for table %', v_view_id, p_table_id;
        ELSE
            -- Update existing portal view
            UPDATE table_views
            SET config = jsonb_build_object(
                'sections', v_settings->'sections',
                'translations', COALESCE(v_settings->'translations', '{}'),
                'theme', COALESCE(v_settings->'theme', '{}'),
                'submission_settings', COALESCE(v_settings->'submission_settings', '{}')
            )
            WHERE id = v_view_id;
            
            RAISE NOTICE 'Updated portal view % for table %', v_view_id, p_table_id;
        END IF;
        
        RETURN v_view_id;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."migrate_portal_to_view"("p_table_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_supabase_user_to_better_auth"("p_supabase_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_supabase_user RECORD;
    v_better_auth_user_id TEXT;
BEGIN
    -- Get the Supabase user
    SELECT * INTO v_supabase_user 
    FROM auth.users 
    WHERE id = p_supabase_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supabase user not found: %', p_supabase_user_id;
    END IF;
    
    -- Check if already migrated
    SELECT id INTO v_better_auth_user_id
    FROM ba_users
    WHERE supabase_user_id = p_supabase_user_id;
    
    IF FOUND THEN
        RETURN v_better_auth_user_id; -- Already migrated
    END IF;
    
    -- Generate a new Better Auth user ID
    v_better_auth_user_id := gen_random_uuid()::TEXT;
    
    -- Create Better Auth user
    INSERT INTO ba_users (
        id,
        email,
        email_verified,
        name,
        full_name,
        avatar_url,
        supabase_user_id,
        migrated_from_supabase,
        created_at,
        updated_at
    ) VALUES (
        v_better_auth_user_id,
        v_supabase_user.email,
        v_supabase_user.email_confirmed_at IS NOT NULL,
        COALESCE(v_supabase_user.raw_user_meta_data->>'full_name', v_supabase_user.email),
        v_supabase_user.raw_user_meta_data->>'full_name',
        v_supabase_user.raw_user_meta_data->>'avatar_url',
        p_supabase_user_id,
        TRUE,
        COALESCE(v_supabase_user.created_at, NOW()),
        NOW()
    );
    
    RETURN v_better_auth_user_id;
END;
$$;


ALTER FUNCTION "public"."migrate_supabase_user_to_better_auth"("p_supabase_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_for_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only queue if content changed or no embedding exists
    IF TG_OP = 'INSERT' OR 
       OLD.content IS DISTINCT FROM NEW.content OR 
       NEW.embedding IS NULL THEN
        
        INSERT INTO embedding_queue (entity_id, entity_type, content_hash, priority)
        VALUES (
            NEW.entity_id,
            NEW.entity_type,
            encode(sha256(COALESCE(NEW.content, '')::bytea), 'hex'),
            CASE 
                WHEN NEW.entity_type = 'table' THEN 10  -- Tables are higher priority
                WHEN NEW.entity_type = 'form' THEN 8
                ELSE 5
            END
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            content_hash = EXCLUDED.content_hash,
            status = 'pending',
            attempts = 0,
            error_message = NULL,
            created_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_for_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_for_embedding"("p_entity_id" "uuid", "p_entity_type" "text", "p_priority" integer DEFAULT 5) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
    VALUES (p_entity_id, p_entity_type, p_priority, 'pending')
    ON CONFLICT (entity_id, entity_type) DO UPDATE SET
        priority = GREATEST(embedding_queue.priority, EXCLUDED.priority),
        status = 'pending',
        created_at = NOW();
END;
$$;


ALTER FUNCTION "public"."queue_for_embedding"("p_entity_id" "uuid", "p_entity_type" "text", "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_search_index"("p_workspace_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INT := 0;
    v_row RECORD;
BEGIN
    -- Index all table rows
    FOR v_row IN 
        SELECT 
            tr.id AS entity_id,
            'row' AS entity_type,
            tr.table_id,
            dt.workspace_id,
            COALESCE(
                (SELECT tr.data->>tf.name 
                 FROM table_fields tf 
                 WHERE tf.table_id = tr.table_id AND tf.is_display_field = true 
                 LIMIT 1),
                'Row ' || tr.id::TEXT
            ) AS title,
            dt.name AS subtitle,
            LEFT(tr.data::TEXT, 1000) AS content,
            COALESCE(dt.hub_type, 'data') AS hub_type,
            dt.entity_type AS data_entity_type,
            ARRAY[]::TEXT[] AS tags,
            tr.data AS metadata
        FROM table_rows tr
        JOIN data_tables dt ON tr.table_id = dt.id
        WHERE p_workspace_id IS NULL OR dt.workspace_id = p_workspace_id
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id, 
            title, subtitle, content, hub_type, data_entity_type, 
            tags, metadata, last_indexed_at
        )
        VALUES (
            v_row.entity_id, v_row.entity_type, v_row.table_id, v_row.workspace_id,
            v_row.title, v_row.subtitle, v_row.content, v_row.hub_type, v_row.data_entity_type,
            v_row.tags, v_row.metadata, NOW()
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            hub_type = EXCLUDED.hub_type,
            data_entity_type = EXCLUDED.data_entity_type,
            metadata = EXCLUDED.metadata,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Index all tables
    FOR v_row IN
        SELECT 
            dt.id AS entity_id,
            'table' AS entity_type,
            dt.id AS table_id,
            dt.workspace_id,
            dt.name AS title,
            dt.description AS subtitle,
            '' AS content,
            COALESCE(dt.hub_type, 'data') AS hub_type,
            dt.entity_type AS data_entity_type,
            ARRAY[]::TEXT[] AS tags,
            '{}'::JSONB AS metadata
        FROM data_tables dt
        WHERE p_workspace_id IS NULL OR dt.workspace_id = p_workspace_id
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id,
            title, subtitle, content, hub_type, data_entity_type,
            tags, metadata, last_indexed_at
        )
        VALUES (
            v_row.entity_id, v_row.entity_type, v_row.table_id, v_row.workspace_id,
            v_row.title, v_row.subtitle, v_row.content, v_row.hub_type, v_row.data_entity_type,
            v_row.tags, v_row.metadata, NOW()
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Index all forms
    FOR v_row IN
        SELECT 
            f.id AS entity_id,
            'form' AS entity_type,
            f.table_id,
            f.workspace_id,
            f.name AS title,
            f.description AS subtitle,
            '' AS content,
            'forms' AS hub_type,
            'form' AS data_entity_type,
            ARRAY[]::TEXT[] AS tags,
            '{}'::JSONB AS metadata
        FROM forms f
        WHERE p_workspace_id IS NULL OR f.workspace_id = p_workspace_id
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id,
            title, subtitle, content, hub_type, data_entity_type,
            tags, metadata, last_indexed_at
        )
        VALUES (
            v_row.entity_id, v_row.entity_type, v_row.table_id, v_row.workspace_id,
            v_row.title, v_row.subtitle, v_row.content, v_row.hub_type, v_row.data_entity_type,
            v_row.tags, v_row.metadata, NOW()
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."rebuild_search_index"("p_workspace_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rebuild_search_index"("p_workspace_id" "uuid") IS 'Rebuilds the search index for a workspace or all workspaces';



CREATE OR REPLACE FUNCTION "public"."semantic_search"("p_workspace_id" "uuid", "p_embedding" "public"."vector", "p_limit" integer DEFAULT 20, "p_similarity_threshold" real DEFAULT 0.5) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "table_id" "uuid", "title" "text", "subtitle" "text", "hub_type" "text", "data_entity_type" "text", "similarity" real, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        si.hub_type,
        si.data_entity_type,
        (1 - (si.embedding <=> p_embedding))::REAL AS similarity,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND si.embedding IS NOT NULL
        AND (1 - (si.embedding <=> p_embedding)) >= p_similarity_threshold
    ORDER BY si.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."semantic_search"("p_workspace_id" "uuid", "p_embedding" "public"."vector", "p_limit" integer, "p_similarity_threshold" real) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."semantic_search"("p_workspace_id" "uuid", "p_embedding" "public"."vector", "p_limit" integer, "p_similarity_threshold" real) IS 'Pure vector similarity search using embeddings';



CREATE OR REPLACE FUNCTION "public"."smart_search"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_limit" integer DEFAULT 50) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "table_id" "uuid", "title" "text", "subtitle" "text", "content_snippet" "text", "hub_type" "text", "data_entity_type" "text", "tags" "text"[], "score" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tsquery tsquery;
    v_hub_type TEXT;
    v_entity_type TEXT;
    v_table_id UUID;
BEGIN
    -- Build tsquery from search terms
    v_tsquery := plainto_tsquery('english', p_query);
    
    -- Extract filters
    v_hub_type := p_filters->>'hub_type';
    v_entity_type := p_filters->>'entity_type';
    IF p_filters->>'table_id' IS NOT NULL THEN
        v_table_id := (p_filters->>'table_id')::UUID;
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        -- Generate content snippet with highlights
        CASE 
            WHEN si.content IS NOT NULL AND si.content != '' THEN
                ts_headline('english', si.content, v_tsquery, 
                    'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>')
            ELSE si.subtitle
        END AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        -- Calculate score with multiple factors
        (
            ts_rank_cd(si.search_vector, v_tsquery, 32) * 10 +          -- Base relevance
            COALESCE(si.importance_score, 1.0) +                        -- Importance score
            (COALESCE(si.search_click_count, 0)::FLOAT / 100) +        -- Click rate boost
            CASE si.data_entity_type
                WHEN 'person' THEN 0.2
                WHEN 'application' THEN 0.1
                ELSE 0
            END +                                                        -- Entity type boost
            CASE 
                WHEN si.title ILIKE '%' || p_query || '%' THEN 2.0     -- Exact title match
                WHEN si.subtitle ILIKE '%' || p_query || '%' THEN 1.0  -- Exact subtitle match
                ELSE 0
            END
        ) AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND si.search_vector @@ v_tsquery
        AND (v_hub_type IS NULL OR si.hub_type = v_hub_type)
        AND (v_entity_type IS NULL OR si.entity_type = v_entity_type)
        AND (v_table_id IS NULL OR si.table_id = v_table_id)
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."smart_search"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."smart_search"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) IS 'AI-optimized full-text search with ranking, click-boosting, and entity weights';



CREATE OR REPLACE FUNCTION "public"."smart_search_fuzzy"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_limit" integer DEFAULT 50) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "table_id" "uuid", "title" "text", "subtitle" "text", "content_snippet" "text", "hub_type" "text", "data_entity_type" "text", "tags" "text"[], "score" double precision, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_hub_type TEXT;
    v_entity_type TEXT;
    v_table_id UUID;
BEGIN
    -- Extract filters
    v_hub_type := p_filters->>'hub_type';
    v_entity_type := p_filters->>'entity_type';
    IF p_filters->>'table_id' IS NOT NULL THEN
        v_table_id := (p_filters->>'table_id')::UUID;
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        LEFT(COALESCE(si.content, si.subtitle), 200) AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        -- Trigram similarity score
        (
            GREATEST(
                similarity(si.title, p_query),
                similarity(COALESCE(si.subtitle, ''), p_query) * 0.8,
                similarity(COALESCE(si.content, ''), p_query) * 0.6
            ) * 10 +
            COALESCE(si.importance_score, 1.0)
        ) AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND (
            si.title % p_query OR
            si.subtitle % p_query OR
            si.content % p_query
        )
        AND (v_hub_type IS NULL OR si.hub_type = v_hub_type)
        AND (v_entity_type IS NULL OR si.entity_type = v_entity_type)
        AND (v_table_id IS NULL OR si.table_id = v_table_id)
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."smart_search_fuzzy"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."smart_search_fuzzy"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) IS 'Fallback fuzzy search using trigram similarity for typos';



CREATE OR REPLACE FUNCTION "public"."soft_delete_file"("p_file_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE table_files
    SET deleted_at = now(),
        is_current = false
    WHERE id = p_file_id
      AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."soft_delete_file"("p_file_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_field_type_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If field_type_id not set, copy from type
    IF NEW.field_type_id IS NULL OR NEW.field_type_id = '' THEN
        NEW.field_type_id := NEW.type;
    END IF;
    
    -- Validate field_type_id exists in registry
    IF NOT EXISTS (SELECT 1 FROM field_type_registry WHERE id = NEW.field_type_id) THEN
        RAISE WARNING 'Unknown field type: %. Using as-is.', NEW.field_type_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_field_type_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_search_click"("p_entity_id" "uuid", "p_entity_type" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_query" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Increment click count in search_index
    UPDATE search_index
    SET search_click_count = search_click_count + 1,
        view_count = view_count + 1
    WHERE entity_id = p_entity_id AND entity_type = p_entity_type;
    
    -- Log to analytics
    INSERT INTO search_analytics (workspace_id, user_id, query, clicked_result_id, clicked_result_type, click_at)
    SELECT workspace_id, p_user_id, p_query, p_entity_id, p_entity_type, NOW()
    FROM search_index WHERE entity_id = p_entity_id AND entity_type = p_entity_type;
END;
$$;


ALTER FUNCTION "public"."track_search_click"("p_entity_id" "uuid", "p_entity_type" "text", "p_user_id" "uuid", "p_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."track_search_click"("p_entity_id" "uuid", "p_entity_type" "text", "p_user_id" "uuid", "p_query" "text") IS 'Track when a user clicks a search result for relevance learning';



CREATE OR REPLACE FUNCTION "public"."trigger_index_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM index_table_row(NEW.id);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_index_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_remove_row_index"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'row';
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trigger_remove_row_index"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_data_tables_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.hub_type, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.entity_type, '')), 'C');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_data_tables_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_embeddings"("p_updates" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_update RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(
        entity_id UUID, 
        entity_type TEXT, 
        embedding REAL[], 
        model TEXT
    )
    LOOP
        UPDATE search_index
        SET 
            embedding = v_update.embedding::vector,
            embedding_model = v_update.model,
            embedding_created_at = NOW()
        WHERE entity_id = v_update.entity_id 
          AND entity_type = v_update.entity_type;
        
        -- Mark as completed in queue
        UPDATE embedding_queue
        SET status = 'completed', processed_at = NOW()
        WHERE entity_id = v_update.entity_id 
          AND entity_type = v_update.entity_type;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."update_embeddings"("p_updates" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_embeddings"("p_updates" "jsonb") IS 'Batch update embeddings from external service';



CREATE OR REPLACE FUNCTION "public"."update_integration_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_integration_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pulse_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE pulse_enabled_tables
  SET 
    checked_in_count = (
      SELECT COUNT(DISTINCT row_id) 
      FROM pulse_check_ins 
      WHERE pulse_table_id = NEW.pulse_table_id
    ),
    walk_in_count = (
      SELECT COUNT(DISTINCT row_id) 
      FROM pulse_check_ins 
      WHERE pulse_table_id = NEW.pulse_table_id AND is_walk_in = true
    ),
    last_check_in_at = NEW.check_in_time,
    updated_at = NOW()
  WHERE id = NEW.pulse_table_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pulse_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_recommendation_request_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_recommendation_request_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_activity"("session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE active_sessions 
    SET last_activity = NOW()
    WHERE id = session_id AND user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."update_session_activity"("session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_submission_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_submission_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_table_files_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_table_files_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_table_row_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE data_tables 
        SET row_count = row_count + 1 
        WHERE id = NEW.table_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE data_tables 
        SET row_count = row_count - 1 
        WHERE id = OLD.table_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_table_row_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_custom_slug"("slug" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    IF LENGTH(slug) < 3 OR LENGTH(slug) > 50 THEN
        RETURN FALSE;
    END IF;
    IF slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND slug !~ '^[a-z0-9]$' THEN
        RETURN FALSE;
    END IF;
    IF slug ~ '--' THEN
        RETURN FALSE;
    END IF;
    IF slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$_$;


ALTER FUNCTION "public"."validate_custom_slug"("slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_custom_subdomain"("subdomain" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    -- Must be 3-50 characters
    IF LENGTH(subdomain) < 3 OR LENGTH(subdomain) > 50 THEN
        RETURN FALSE;
    END IF;
    
    -- Must only contain lowercase letters, numbers, and hyphens
    IF subdomain !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND subdomain !~ '^[a-z0-9]$' THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot have consecutive hyphens
    IF subdomain ~ '--' THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot be a reserved word that looks like UUID
    IF subdomain ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$_$;


ALTER FUNCTION "public"."validate_custom_subdomain"("subdomain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_field_config"("p_field_type_id" "text", "p_config" "jsonb") RETURNS TABLE("is_valid" boolean, "errors" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_config_schema JSONB;
    v_errors TEXT[] := '{}';
BEGIN
    -- Get config schema from registry
    SELECT config_schema INTO v_config_schema
    FROM field_type_registry WHERE id = p_field_type_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, ARRAY['Unknown field type: ' || p_field_type_id];
        RETURN;
    END IF;
    
    -- Basic validation - check required properties
    IF v_config_schema ? 'required' THEN
        FOR i IN 0..jsonb_array_length(v_config_schema->'required')-1 LOOP
            IF NOT p_config ? (v_config_schema->'required'->>i) THEN
                v_errors := array_append(v_errors, 
                    'Missing required property: ' || (v_config_schema->'required'->>i));
            END IF;
        END LOOP;
    END IF;
    
    IF array_length(v_errors, 1) > 0 THEN
        RETURN QUERY SELECT FALSE, v_errors;
    ELSE
        RETURN QUERY SELECT TRUE, v_errors;
    END IF;
END;
$$;


ALTER FUNCTION "public"."validate_field_config"("p_field_type_id" "text", "p_config" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    "id" integer NOT NULL,
    "hash" "text" NOT NULL,
    "created_at" bigint
);


ALTER TABLE "drizzle"."__drizzle_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "drizzle"."__drizzle_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNED BY "drizzle"."__drizzle_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_field_suggestions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "row_id" "uuid",
    "field_id" "uuid",
    "suggestion_type" "text" NOT NULL,
    "current_value" "jsonb",
    "suggested_value" "jsonb" NOT NULL,
    "confidence" double precision NOT NULL,
    "reasoning" "text",
    "sample_data" "jsonb",
    "pattern_matches" integer,
    "total_values" integer,
    "related_suggestion_ids" "uuid"[],
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "applied_version_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "module_id" "text",
    "sub_module_id" "uuid",
    "ba_reviewed_by" "text",
    CONSTRAINT "ai_field_suggestions_confidence_check" CHECK ((("confidence" >= (0)::double precision) AND ("confidence" <= (1)::double precision))),
    CONSTRAINT "ai_field_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'dismissed'::"text", 'auto_applied'::"text"]))),
    CONSTRAINT "ai_field_suggestions_suggestion_type_check" CHECK (("suggestion_type" = ANY (ARRAY['typo_correction'::"text", 'format_correction'::"text", 'semantic_type_change'::"text", 'validation_rule'::"text", 'field_type_change'::"text", 'merge_fields'::"text", 'split_field'::"text", 'normalize_values'::"text", 'missing_value'::"text", 'duplicate_detection'::"text"])))
);


ALTER TABLE "public"."ai_field_suggestions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_field_suggestions"."ba_reviewed_by" IS 'Better Auth user ID (TEXT) - replaces reviewed_by UUID';



CREATE TABLE IF NOT EXISTS "public"."applicant_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_integration_id" "uuid" NOT NULL,
    "row_id" "uuid" NOT NULL,
    "applicant_identifier" "text" NOT NULL,
    "external_folder_id" "text" NOT NULL,
    "external_folder_url" "text",
    "last_sync_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'pending'::"text",
    "sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."applicant_folders" OWNER TO "postgres";


COMMENT ON TABLE "public"."applicant_folders" IS 'Tracks folders created for each applicant in external storage';



CREATE TABLE IF NOT EXISTS "public"."application_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "review_workflow_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(50) DEFAULT 'gray'::character varying,
    "icon" character varying(50) DEFAULT 'folder'::character varying,
    "order_index" integer DEFAULT 0,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."application_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_stages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "review_workflow_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "order_index" integer DEFAULT 0,
    "stage_type" "text" DEFAULT 'review'::"text",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "relative_deadline" "text",
    "custom_statuses" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "logic_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hide_pii" boolean DEFAULT false,
    "hidden_pii_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "color" character varying(20),
    "status_actions" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."application_stages" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_stages" IS 'Stages in review workflows (e.g., Initial Review, Committee Review)';



CREATE TABLE IF NOT EXISTS "public"."automation_workflow_execution_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "node_id" character varying(100) NOT NULL,
    "node_type" character varying(50),
    "node_label" character varying(255),
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "input" "jsonb",
    "output" "jsonb",
    "error" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "duration" bigint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automation_workflow_execution_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."automation_workflow_execution_logs" IS 'Step-by-step logs for workflow executions';



COMMENT ON COLUMN "public"."automation_workflow_execution_logs"."status" IS 'pending, running, completed, failed, skipped';



CREATE TABLE IF NOT EXISTS "public"."automation_workflow_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "trigger_type" character varying(50),
    "trigger_data" "jsonb",
    "output" "jsonb",
    "error" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "duration" bigint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ba_user_id" "text"
);


ALTER TABLE "public"."automation_workflow_executions" OWNER TO "postgres";


COMMENT ON TABLE "public"."automation_workflow_executions" IS 'Execution history for automation workflows';



COMMENT ON COLUMN "public"."automation_workflow_executions"."status" IS 'pending, running, completed, failed, cancelled';



COMMENT ON COLUMN "public"."automation_workflow_executions"."ba_user_id" IS 'Better Auth user ID (TEXT) - replaces user_id UUID';



CREATE TABLE IF NOT EXISTS "public"."automation_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nodes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "edges" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "visibility" character varying(20) DEFAULT 'private'::character varying NOT NULL,
    "trigger_type" character varying(50) DEFAULT 'manual'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ba_user_id" "text"
);


ALTER TABLE "public"."automation_workflows" OWNER TO "postgres";


COMMENT ON TABLE "public"."automation_workflows" IS 'Visual automation workflows (like Zapier/Make) for the workflow builder';



COMMENT ON COLUMN "public"."automation_workflows"."nodes" IS 'React Flow nodes configuration (JSON array)';



COMMENT ON COLUMN "public"."automation_workflows"."edges" IS 'React Flow edges configuration (JSON array)';



COMMENT ON COLUMN "public"."automation_workflows"."visibility" IS 'private, public, or workspace';



COMMENT ON COLUMN "public"."automation_workflows"."trigger_type" IS 'manual, webhook, schedule, form_submission, row_created, row_updated';



COMMENT ON COLUMN "public"."automation_workflows"."ba_user_id" IS 'Better Auth user ID (TEXT) - replaces user_id UUID';



CREATE TABLE IF NOT EXISTS "public"."ba_accounts" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "provider_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "id_token" "text",
    "access_token_expires_at" timestamp with time zone,
    "refresh_token_expires_at" timestamp with time zone,
    "scope" "text",
    "password" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ba_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."ba_accounts" IS 'Better Auth accounts for OAuth and password authentication';



CREATE TABLE IF NOT EXISTS "public"."ba_invitations" (
    "id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "inviter_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ba_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ba_invitations" IS 'Pending invitations to join organizations';



CREATE TABLE IF NOT EXISTS "public"."ba_members" (
    "id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ba_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."ba_members" IS 'Organization membership with role-based access';



CREATE TABLE IF NOT EXISTS "public"."ba_organizations" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "logo" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ba_organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ba_organizations" IS 'Organizations for multi-tenant support (maps to workspaces)';



CREATE TABLE IF NOT EXISTS "public"."ba_sessions" (
    "id" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "user_id" "text" NOT NULL,
    "active_organization_id" "text"
);


ALTER TABLE "public"."ba_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ba_sessions" IS 'Better Auth sessions for authenticated users';



CREATE TABLE IF NOT EXISTS "public"."ba_users" (
    "id" "text" NOT NULL,
    "name" "text",
    "email" "text" NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supabase_user_id" "uuid",
    "migrated_from_supabase" boolean DEFAULT false,
    "full_name" "text",
    "avatar_url" "text",
    "user_type" character varying(20) DEFAULT 'staff'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."ba_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."ba_users" IS 'Better Auth users - separate from Supabase auth.users to allow gradual migration';



COMMENT ON COLUMN "public"."ba_users"."supabase_user_id" IS 'Links to existing Supabase auth.users for migration';



COMMENT ON COLUMN "public"."ba_users"."user_type" IS 'User type: staff (internal), applicant (portal), reviewer (external)';



COMMENT ON COLUMN "public"."ba_users"."metadata" IS 'JSONB metadata. For migrated portal applicants, contains: migrated_from_portal_applicants, portal_applicant_ids, form_ids, portal_applicant_forms';



CREATE TABLE IF NOT EXISTS "public"."ba_verifications" (
    "id" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "value" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'email'::"text" NOT NULL,
    "token" "text",
    "consumed" boolean DEFAULT false NOT NULL,
    "consumed_at" timestamp with time zone
);


ALTER TABLE "public"."ba_verifications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ba_verifications"."type" IS 'Type of verification: email, password_reset, magic_link, etc.';



COMMENT ON COLUMN "public"."ba_verifications"."token" IS 'Token for magic link or similar flows (unique)';



COMMENT ON COLUMN "public"."ba_verifications"."consumed" IS 'Whether the token has been used/consumed';



COMMENT ON COLUMN "public"."ba_verifications"."consumed_at" IS 'Timestamp when the token was consumed';



CREATE TABLE IF NOT EXISTS "public"."batch_operations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "table_id" "uuid",
    "operation_type" "text" NOT NULL,
    "description" "text",
    "affected_row_count" integer DEFAULT 0 NOT NULL,
    "affected_field_names" "text"[],
    "status" "text" DEFAULT 'completed'::"text",
    "error_message" "text",
    "can_rollback" boolean DEFAULT true,
    "rolled_back_at" timestamp with time zone,
    "rolled_back_by" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "batch_operations_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['bulk_update'::"text", 'bulk_delete'::"text", 'bulk_create'::"text", 'import'::"text", 'ai_correction'::"text", 'restore'::"text"]))),
    CONSTRAINT "batch_operations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text", 'rolled_back'::"text"])))
);


ALTER TABLE "public"."batch_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."change_approvals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "row_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "pending_data" "jsonb" NOT NULL,
    "pending_changes" "jsonb" NOT NULL,
    "change_reason" "text",
    "requires_approval_from" "text",
    "specific_approver_id" "uuid",
    "stage_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "requested_by" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ba_reviewed_by" "text",
    CONSTRAINT "change_approvals_requires_approval_from_check" CHECK (("requires_approval_from" = ANY (ARRAY['table_owner'::"text", 'workspace_admin'::"text", 'specific_user'::"text", 'any_reviewer'::"text"]))),
    CONSTRAINT "change_approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."change_approvals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."change_approvals"."ba_reviewed_by" IS 'Better Auth user ID (TEXT) - replaces reviewed_by UUID';



CREATE TABLE IF NOT EXISTS "public"."change_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "row_id" "uuid" NOT NULL,
    "current_data" "jsonb" NOT NULL,
    "proposed_data" "jsonb" NOT NULL,
    "changed_fields" "text"[] NOT NULL,
    "change_reason" "text",
    "change_summary" "text",
    "requested_by" "uuid",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "applied_version_id" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ba_reviewed_by" "text",
    CONSTRAINT "change_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."change_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."change_requests"."ba_reviewed_by" IS 'Better Auth user ID (TEXT) - replaces reviewed_by UUID';



CREATE TABLE IF NOT EXISTS "public"."custom_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(50) DEFAULT 'blue'::character varying,
    "icon" character varying(50) DEFAULT 'circle'::character varying,
    "is_primary" boolean DEFAULT false,
    "order_index" integer DEFAULT 0,
    "requires_comment" boolean DEFAULT false,
    "requires_score" boolean DEFAULT false,
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_statuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_statuses" IS 'Action buttons in review interface that trigger configurable actions';



CREATE TABLE IF NOT EXISTS "public"."custom_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "review_workflow_id" "uuid" NOT NULL,
    "stage_id" "uuid",
    "name" character varying(255) NOT NULL,
    "color" character varying(50) DEFAULT 'gray'::character varying,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_tags" IS 'Tags that can be applied to applications for organization and automation';



CREATE TABLE IF NOT EXISTS "public"."data_tables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "description" "text",
    "icon" "text" DEFAULT 'table'::"text",
    "color" "text" DEFAULT '#10B981'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "import_source" "text",
    "import_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "row_count" integer DEFAULT 0,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hub_type" "text" DEFAULT 'data'::"text",
    "entity_type" "text" DEFAULT 'generic'::"text",
    "search_vector" "tsvector",
    "history_settings" "jsonb" DEFAULT '{"track_changes": true, "require_change_reason": false, "version_retention_days": null, "admin_only_full_history": false, "allow_user_delete_history": true}'::"jsonb",
    "approval_settings" "jsonb" DEFAULT '{"approval_type": "table_owner", "auto_expire_days": 7, "require_approval": false, "notify_on_pending": true, "specific_approvers": []}'::"jsonb",
    "ai_settings" "jsonb" DEFAULT '{"suggestion_types": ["typo_correction", "format_correction"], "enable_suggestions": true, "auto_apply_threshold": 0.95, "auto_apply_high_confidence": false}'::"jsonb",
    "custom_slug" character varying(255),
    "is_hidden" boolean DEFAULT false,
    "preview_title" "text",
    "preview_description" "text",
    "preview_image_url" "text",
    "dashboard_layout" "jsonb" DEFAULT '{}'::"jsonb",
    "dashboard_enabled" boolean DEFAULT false,
    "ba_created_by" "text",
    "custom_subdomain" character varying(255),
    CONSTRAINT "check_custom_slug_valid" CHECK ((("custom_slug" IS NULL) OR "public"."validate_custom_slug"(("custom_slug")::"text"))),
    CONSTRAINT "check_custom_subdomain_valid" CHECK ((("custom_subdomain" IS NULL) OR "public"."validate_custom_subdomain"(("custom_subdomain")::"text"))),
    CONSTRAINT "data_tables_hub_type_check" CHECK (("hub_type" = ANY (ARRAY['activities'::"text", 'applications'::"text", 'data'::"text"])))
);


ALTER TABLE "public"."data_tables" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_tables" IS 'User-created data tables (Airtable-like sheets)';



COMMENT ON COLUMN "public"."data_tables"."hub_type" IS 'Hub type determines available modules: activities (events/attendance), applications (review workflows), data (general tables)';



COMMENT ON COLUMN "public"."data_tables"."entity_type" IS 'The type of entity stored in this table (person, event, application, etc.). Helps AI understand semantic meaning.';



COMMENT ON COLUMN "public"."data_tables"."custom_slug" IS 'Optional custom URL slug for public portals. If NULL, the form ID (UUID) is used. Must be 3-50 chars, lowercase alphanumeric with hyphens.';



COMMENT ON COLUMN "public"."data_tables"."preview_title" IS 'Custom title for share previews (Open Graph, social media cards)';



COMMENT ON COLUMN "public"."data_tables"."preview_description" IS 'Custom description for share previews';



COMMENT ON COLUMN "public"."data_tables"."preview_image_url" IS 'URL to thumbnail image for share previews';



COMMENT ON COLUMN "public"."data_tables"."ba_created_by" IS 'Better Auth user ID (TEXT) - replaces created_by UUID';



COMMENT ON COLUMN "public"."data_tables"."custom_subdomain" IS 'Optional custom subdomain for public portals. If NULL, the default domain is used. Must be 3-50 chars, lowercase alphanumeric with hyphens.';



CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "form_id" "uuid",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "body_html" "text",
    "sender_email" "text" NOT NULL,
    "sender_name" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_campaigns" IS 'Bulk email send campaigns with aggregated stats';



CREATE TABLE IF NOT EXISTS "public"."email_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "recipient_email" character varying(255) NOT NULL,
    "recipient_name" character varying(255),
    "subject" character varying(500) NOT NULL,
    "body" "text" NOT NULL,
    "body_html" "text",
    "sender_email" character varying(255) NOT NULL,
    "submission_id" "uuid",
    "form_id" "uuid",
    "service_type" character varying(50) DEFAULT 'gmail'::character varying,
    "priority" integer DEFAULT 5,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "scheduled_for" timestamp with time zone DEFAULT "now"(),
    "attempt_count" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_queue_service_type_check" CHECK ((("service_type")::"text" = ANY (ARRAY[('gmail'::character varying)::"text", ('resend'::character varying)::"text"]))),
    CONSTRAINT "email_queue_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('processing'::character varying)::"text", ('sent'::character varying)::"text", ('failed'::character varying)::"text", ('retrying'::character varying)::"text"])))
);


ALTER TABLE "public"."email_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_queue" IS 'Queue for bulk email sending with staggering and retry logic';



COMMENT ON COLUMN "public"."email_queue"."priority" IS 'Priority 1-10, higher numbers sent first';



COMMENT ON COLUMN "public"."email_queue"."scheduled_for" IS 'When to send this email (for staggering)';



CREATE TABLE IF NOT EXISTS "public"."email_signatures" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "content" "text" NOT NULL,
    "content_html" "text",
    "is_html" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "form_id" "uuid",
    "created_by_id" "text",
    "name" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "body_html" "text",
    "type" "text" DEFAULT 'manual'::"text",
    "trigger_event" "text",
    "trigger_conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "share_with" "text" DEFAULT 'everyone'::"text",
    "shared_with_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_templates" IS 'Reusable email templates for manual or automated sends';



CREATE TABLE IF NOT EXISTS "public"."embedding_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "content_hash" "text",
    "priority" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."embedding_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."embedding_queue" IS 'Queue for async embedding generation by external service';



CREATE TABLE IF NOT EXISTS "public"."search_index" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "table_id" "uuid",
    "workspace_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "content" "text",
    "search_vector" "tsvector",
    "hub_type" "text",
    "data_entity_type" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_indexed_at" timestamp with time zone DEFAULT "now"(),
    "view_count" integer DEFAULT 0,
    "search_click_count" integer DEFAULT 0,
    "importance_score" real DEFAULT 1.0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding_model" "text",
    "embedding_created_at" timestamp with time zone,
    "embedding" "public"."vector"(1024),
    "field_embeddings" "jsonb" DEFAULT '{}'::"jsonb",
    "indexed_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "pii_fields" "text"[] DEFAULT '{}'::"text"[],
    "last_ai_analysis_at" timestamp with time zone
);


ALTER TABLE "public"."search_index" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_index" IS 'Denormalized full-text search index for fast AI-powered search';



COMMENT ON COLUMN "public"."search_index"."embedding_model" IS 'Model used to generate embedding (for cache invalidation on model change)';



COMMENT ON COLUMN "public"."search_index"."field_embeddings" IS 'Per-field embeddings for semantic search';



COMMENT ON COLUMN "public"."search_index"."indexed_fields" IS 'Which fields contributed to this index entry';



COMMENT ON COLUMN "public"."search_index"."pii_fields" IS 'Field names that contain PII (for filtering)';



CREATE OR REPLACE VIEW "public"."embedding_stats" AS
 SELECT "si"."workspace_id",
    "count"(*) AS "total_items",
    "count"("si"."embedding") AS "items_with_embeddings",
    "round"(((100.0 * ("count"("si"."embedding"))::numeric) / (NULLIF("count"(*), 0))::numeric), 1) AS "coverage_pct",
    "count"(*) FILTER (WHERE ("eq"."status" = 'pending'::"text")) AS "pending_embeddings",
    "count"(*) FILTER (WHERE ("eq"."status" = 'failed'::"text")) AS "failed_embeddings",
    "max"("si"."embedding_created_at") AS "last_embedding_at"
   FROM ("public"."search_index" "si"
     LEFT JOIN "public"."embedding_queue" "eq" ON ((("si"."entity_id" = "eq"."entity_id") AND ("si"."entity_type" = "eq"."entity_type"))))
  GROUP BY "si"."workspace_id";


ALTER VIEW "public"."embedding_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_types" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "expected_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "display_template" "text",
    "search_weight" real DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."entity_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_types" IS 'Registry of semantic entity types (person, event, etc.)';



CREATE TABLE IF NOT EXISTS "public"."field_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "row_version_id" "uuid" NOT NULL,
    "row_id" "uuid" NOT NULL,
    "field_id" "uuid",
    "field_name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "field_label" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "change_action" "text" NOT NULL,
    "nested_path" "text"[],
    "similarity_score" double precision,
    "semantic_change_type" "text",
    "contains_pii" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "field_changes_change_action_check" CHECK (("change_action" = ANY (ARRAY['add'::"text", 'update'::"text", 'remove'::"text", 'reorder'::"text"])))
);


ALTER TABLE "public"."field_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."field_type_registry" (
    "id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "input_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "storage_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "config_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_container" boolean DEFAULT false,
    "is_searchable" boolean DEFAULT true,
    "is_sortable" boolean DEFAULT true,
    "is_filterable" boolean DEFAULT true,
    "is_editable" boolean DEFAULT true,
    "supports_pii" boolean DEFAULT false,
    "table_renderer" "text",
    "form_renderer" "text",
    "review_renderer" "text",
    "ai_schema" "jsonb" DEFAULT '{}'::"jsonb",
    "default_semantic_type" "text",
    "track_changes" boolean DEFAULT true,
    "require_reason" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "module_id" "text",
    "is_system_field" boolean DEFAULT false,
    "parent_field_type" "text",
    "default_config" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "field_type_registry_category_check" CHECK (("category" = ANY (ARRAY['primitive'::"text", 'container'::"text", 'layout'::"text", 'special'::"text"])))
);


ALTER TABLE "public"."field_type_registry" OWNER TO "postgres";


COMMENT ON COLUMN "public"."field_type_registry"."module_id" IS 'Which module this field type belongs to (null = universal)';



COMMENT ON COLUMN "public"."field_type_registry"."is_system_field" IS 'System fields are auto-created and cannot be deleted';



COMMENT ON COLUMN "public"."field_type_registry"."parent_field_type" IS 'For inheritance - base field type this extends';



CREATE TABLE IF NOT EXISTS "public"."file_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "applicant_folder_id" "uuid" NOT NULL,
    "table_file_id" "uuid",
    "external_file_id" "text",
    "external_file_url" "text",
    "original_filename" "text" NOT NULL,
    "file_size_bytes" bigint,
    "mime_type" "text",
    "sync_status" "text" DEFAULT 'pending'::"text",
    "sync_error" "text",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_sync_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."file_sync_log" IS 'Logs file sync operations to external storage';



CREATE TABLE IF NOT EXISTS "public"."form_integration_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "workspace_integration_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "external_folder_id" "text",
    "external_folder_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."form_integration_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_integration_settings" IS 'Per-form settings for workspace integrations';



CREATE TABLE IF NOT EXISTS "public"."gmail_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expiry" timestamp with time zone,
    "scopes" "jsonb" DEFAULT '[]'::"jsonb",
    "send_permission" "text" DEFAULT 'myself'::"text",
    "allowed_user_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "needs_reconnect" boolean DEFAULT false,
    "reconnect_reason" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."gmail_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."gmail_connections" IS 'OAuth tokens for Gmail API integration per workspace';



CREATE TABLE IF NOT EXISTS "public"."hub_module_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "module_id" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "enabled_by" "uuid",
    "enabled_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auto_create_fields" boolean DEFAULT true,
    "custom_field_overrides" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."hub_module_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."hub_module_configs" IS 'Per-table (hub) module enablement and configuration';



COMMENT ON COLUMN "public"."hub_module_configs"."auto_create_fields" IS 'Whether to auto-create required fields when module is enabled';



COMMENT ON COLUMN "public"."hub_module_configs"."custom_field_overrides" IS 'Override default field configs for this specific hub';



CREATE TABLE IF NOT EXISTS "public"."integration_credentials" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "user_id" "text" NOT NULL,
    "integration_type" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "credentials" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."integration_credentials" IS 'Stored credentials for third-party integrations';



CREATE TABLE IF NOT EXISTS "public"."metadata_schema" (
    "id" "text" NOT NULL,
    "applies_to" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "description" "text",
    "example_value" "jsonb",
    "is_required" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."metadata_schema" OWNER TO "postgres";


COMMENT ON TABLE "public"."metadata_schema" IS 'Documentation of expected metadata fields for each table';



CREATE TABLE IF NOT EXISTS "public"."module_definitions" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "category" "text" DEFAULT 'core'::"text",
    "is_premium" boolean DEFAULT false,
    "is_beta" boolean DEFAULT false,
    "is_deprecated" boolean DEFAULT false,
    "available_for_hub_types" "text"[] DEFAULT ARRAY['data'::"text"],
    "dependencies" "text"[] DEFAULT ARRAY[]::"text"[],
    "settings_schema" "jsonb" DEFAULT '{}'::"jsonb",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "module_definitions_category_check" CHECK (("category" = ANY (ARRAY['core'::"text", 'productivity'::"text", 'communication'::"text", 'integration'::"text"])))
);


ALTER TABLE "public"."module_definitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."module_definitions" IS 'Central registry of all available modules and which hub types can use them';



CREATE TABLE IF NOT EXISTS "public"."module_field_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "module_id" "text" NOT NULL,
    "field_type_id" "text" NOT NULL,
    "is_required" boolean DEFAULT false,
    "is_auto_created" boolean DEFAULT false,
    "default_config" "jsonb" DEFAULT '{}'::"jsonb",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."module_field_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_history_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "hub_module_config_id" "uuid" NOT NULL,
    "track_changes" boolean,
    "require_change_reason" boolean,
    "version_retention_days" integer,
    "require_approval" boolean,
    "approval_type" "text",
    "specific_approvers" "uuid"[],
    "enable_ai_suggestions" boolean,
    "auto_apply_threshold" double precision,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."module_history_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ba_user_id" "text",
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'editor'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_members" IS 'Links users to organizations with role-based access';



COMMENT ON COLUMN "public"."organization_members"."ba_user_id" IS 'Better Auth user ID (TEXT) - replaces user_id UUID';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "organizations_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Top-level container for multi-tenant architecture';



CREATE TABLE IF NOT EXISTS "public"."portal_applicants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "submission_data" "jsonb" DEFAULT '{}'::"jsonb",
    "reset_token" character varying(255),
    "reset_token_expiry" timestamp without time zone,
    "last_login_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "row_id" "uuid",
    "ba_user_id" "text"
);


ALTER TABLE "public"."portal_applicants" OWNER TO "postgres";


COMMENT ON TABLE "public"."portal_applicants" IS 'Stores portal applicant accounts with custom authentication (not Supabase Auth)';



COMMENT ON COLUMN "public"."portal_applicants"."password_hash" IS 'Bcrypt hashed password';



COMMENT ON COLUMN "public"."portal_applicants"."submission_data" IS 'Stores signup form data in JSONB format';



COMMENT ON COLUMN "public"."portal_applicants"."reset_token" IS 'Token for password reset (expires after 24 hours)';



COMMENT ON COLUMN "public"."portal_applicants"."ba_user_id" IS 'Links to ba_users.id after migration. Portal applicants are now managed through Better Auth.';



CREATE TABLE IF NOT EXISTS "public"."portal_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portal_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "op_id" "text" NOT NULL,
    "parents" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "op_type" "text" NOT NULL,
    "path" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "value" "jsonb",
    "timestamp" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."portal_operations" OWNER TO "postgres";


COMMENT ON TABLE "public"."portal_operations" IS 'Stores CRDT operations for collaborative portal editing using eg-walker algorithm';



COMMENT ON COLUMN "public"."portal_operations"."op_id" IS 'Serialized [agent, seq] version from eg-walker';



COMMENT ON COLUMN "public"."portal_operations"."parents" IS 'Array of parent operation IDs that this operation depends on';



COMMENT ON COLUMN "public"."portal_operations"."op_type" IS 'Type of operation: update_field, add_field, delete_field, add_section, delete_section, update_section, reorder_fields, reorder_sections, update_settings';



COMMENT ON COLUMN "public"."portal_operations"."path" IS 'JSON path to the field being modified in the portal config';



COMMENT ON COLUMN "public"."portal_operations"."value" IS 'The new value being set (null for delete operations)';



CREATE TABLE IF NOT EXISTS "public"."recommendation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "form_id" "uuid" NOT NULL,
    "field_id" "text" NOT NULL,
    "recommender_name" "text" NOT NULL,
    "recommender_email" "text" NOT NULL,
    "recommender_relationship" "text",
    "recommender_organization" "text",
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reminded_at" timestamp with time zone,
    "reminder_count" integer DEFAULT 0,
    "submitted_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recommendation_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recommendation_requests"."status" IS 'Status values: pending, submitted, expired, cancelled';



CREATE TABLE IF NOT EXISTS "public"."review_workflows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "application_type" "text",
    "is_active" boolean DEFAULT true,
    "default_rubric_id" "uuid",
    "default_stage_sequence" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "form_id" "uuid"
);


ALTER TABLE "public"."review_workflows" OWNER TO "postgres";


COMMENT ON TABLE "public"."review_workflows" IS 'Review workflow definitions for application processing';



CREATE TABLE IF NOT EXISTS "public"."reviewer_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "default_permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reviewer_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."reviewer_types" IS 'Types/roles of reviewers (e.g., Financial Reviewer, Academic Reviewer)';



CREATE TABLE IF NOT EXISTS "public"."row_versions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "row_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "change_type" "text" NOT NULL,
    "change_reason" "text",
    "change_summary" "text",
    "batch_operation_id" "uuid",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "ai_assisted" boolean DEFAULT false,
    "ai_confidence" double precision,
    "ai_suggestion_id" "uuid",
    "is_archived" boolean DEFAULT false,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "archive_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "module_id" "text",
    "sub_module_id" "uuid",
    "archive_reason" "text" DEFAULT ''::"text",
    CONSTRAINT "row_versions_change_type_check" CHECK (("change_type" = ANY (ARRAY['create'::"text", 'update'::"text", 'restore'::"text", 'import'::"text", 'ai_edit'::"text", 'approval'::"text", 'bulk'::"text"])))
);


ALTER TABLE "public"."row_versions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."row_versions"."module_id" IS 'Which module triggered this version (for module-specific history)';



COMMENT ON COLUMN "public"."row_versions"."sub_module_id" IS 'Which sub-module triggered this version';



CREATE TABLE IF NOT EXISTS "public"."rubrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "max_score" integer DEFAULT 100,
    "total_points" integer DEFAULT 100,
    "rubric_type" "text" DEFAULT 'analytic'::"text",
    "categories" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rubrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."rubrics" IS 'Scoring rubrics with categories and point values';



CREATE TABLE IF NOT EXISTS "public"."search_analytics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "query" "text" NOT NULL,
    "query_tokens" "text"[],
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "result_count" integer,
    "clicked_result_id" "uuid",
    "clicked_result_type" "text",
    "clicked_result_position" integer,
    "search_at" timestamp with time zone DEFAULT "now"(),
    "click_at" timestamp with time zone,
    "time_to_click_ms" integer,
    "source" "text" DEFAULT 'omnisearch'::"text",
    "session_id" "text",
    "ba_user_id" "text"
);


ALTER TABLE "public"."search_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_analytics" IS 'Search query and click analytics for relevance learning';



COMMENT ON COLUMN "public"."search_analytics"."ba_user_id" IS 'Better Auth user ID (TEXT) - replaces user_id UUID';



CREATE TABLE IF NOT EXISTS "public"."semantic_field_types" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "patterns" "text"[] DEFAULT '{}'::"text"[],
    "sample_values" "jsonb" DEFAULT '[]'::"jsonb",
    "embedding_weight" real DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."semantic_field_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."semantic_field_types" IS 'Registry of semantic field types for AI detection';



CREATE TABLE IF NOT EXISTS "public"."sent_emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid",
    "workspace_id" "uuid" NOT NULL,
    "form_id" "uuid",
    "submission_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "recipient_name" "text",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "body_html" "text",
    "sender_email" "text" NOT NULL,
    "sender_name" "text",
    "gmail_message_id" "text",
    "tracking_id" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "open_count" integer DEFAULT 0,
    "first_opened_at" timestamp with time zone,
    "last_opened_at" timestamp with time zone,
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gmail_thread_id" "text",
    "clicked_at" timestamp with time zone,
    "click_count" integer DEFAULT 0,
    "bounced_at" timestamp with time zone,
    "bounce_reason" "text",
    "opened_at" timestamp with time zone
);


ALTER TABLE "public"."sent_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."sent_emails" IS 'Individual sent emails with tracking data';



CREATE TABLE IF NOT EXISTS "public"."stage_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(50) DEFAULT 'blue'::character varying,
    "icon" character varying(50) DEFAULT 'check'::character varying,
    "action_type" character varying(50) DEFAULT 'set_status'::character varying NOT NULL,
    "target_group_id" "uuid",
    "target_stage_id" "uuid",
    "status_value" character varying(100),
    "requires_comment" boolean DEFAULT false,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stage_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stage_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(50) DEFAULT 'blue'::character varying,
    "icon" character varying(50) DEFAULT 'folder'::character varying,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stage_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."stage_groups" IS 'Groups within a stage - applications stay in stage but organized into sub-groups';



CREATE TABLE IF NOT EXISTS "public"."stage_reviewer_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "reviewer_type_id" "uuid" NOT NULL,
    "rubric_id" "uuid",
    "assigned_rubric_id" "uuid",
    "visibility_config" "jsonb" DEFAULT '{}'::"jsonb",
    "field_visibility_config" "jsonb" DEFAULT '{}'::"jsonb",
    "min_reviews_required" integer DEFAULT 1,
    "can_view_prior_scores" boolean DEFAULT false,
    "can_view_prior_comments" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stage_reviewer_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."stage_reviewer_configs" IS 'Configuration linking stages, reviewer types, and rubrics';



CREATE TABLE IF NOT EXISTS "public"."sub_modules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "parent_module_id" "text" NOT NULL,
    "hub_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "data_table_id" "uuid",
    "uses_parent_table" boolean DEFAULT true,
    "filter_config" "jsonb" DEFAULT '{}'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_enabled" boolean DEFAULT true,
    "position" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ba_created_by" "text"
);


ALTER TABLE "public"."sub_modules" OWNER TO "postgres";


COMMENT ON TABLE "public"."sub_modules" IS 'Child modules within a parent module (e.g., Events within Attendance module)';



COMMENT ON COLUMN "public"."sub_modules"."ba_created_by" IS 'Better Auth user ID (TEXT) - replaces created_by UUID';



CREATE TABLE IF NOT EXISTS "public"."submission_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "changed_fields" "text"[],
    "change_type" character varying(20) DEFAULT 'autosave'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."submission_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_fields" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "validation" "jsonb" DEFAULT '{}'::"jsonb",
    "formula" "text",
    "formula_dependencies" "text"[],
    "linked_table_id" "uuid",
    "linked_column_id" "uuid",
    "rollup_function" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "width" integer DEFAULT 150,
    "is_visible" boolean DEFAULT true,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "semantic_type" "text",
    "is_searchable" boolean DEFAULT true,
    "is_display_field" boolean DEFAULT false,
    "search_weight" real DEFAULT 1.0,
    "sample_values" "jsonb" DEFAULT '[]'::"jsonb",
    "field_type_id" "text" NOT NULL,
    "parent_field_id" "uuid",
    "section_id" "text"
);


ALTER TABLE "public"."table_fields" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_fields" IS 'Column definitions for data tables with type and validation';



COMMENT ON COLUMN "public"."table_fields"."semantic_type" IS 'Semantic meaning of this column (name, email, status, etc.). Helps AI understand data.';



COMMENT ON COLUMN "public"."table_fields"."is_display_field" IS 'If true, this is the primary field to display when showing this row.';



COMMENT ON COLUMN "public"."table_fields"."search_weight" IS 'Search ranking weight (1.0 = normal, 2.0 = double importance).';



CREATE TABLE IF NOT EXISTS "public"."table_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" "uuid",
    "row_id" "uuid",
    "field_id" "uuid",
    "workspace_id" "uuid",
    "filename" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "storage_bucket" "text" DEFAULT 'workspace-assets'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text",
    "description" "text",
    "alt_text" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "version" integer DEFAULT 1,
    "parent_file_id" "uuid",
    "is_current" boolean DEFAULT true,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."table_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_table_id" "uuid" NOT NULL,
    "source_column_id" "uuid" NOT NULL,
    "target_table_id" "uuid" NOT NULL,
    "target_column_id" "uuid",
    "link_type" "text" DEFAULT 'one_to_many'::"text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "table_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['one_to_one'::"text", 'one_to_many'::"text", 'many_to_many'::"text"])))
);


ALTER TABLE "public"."table_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_links" IS 'Relationships between tables (foreign keys)';



CREATE TABLE IF NOT EXISTS "public"."table_row_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "source_row_id" "uuid" NOT NULL,
    "target_row_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."table_row_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_row_links" IS 'Actual row-to-row relationship data';



CREATE TABLE IF NOT EXISTS "public"."table_rows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "position" bigint DEFAULT 0,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stage_group_id" "uuid",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "ba_created_by" "text",
    "ba_updated_by" "text"
);


ALTER TABLE "public"."table_rows" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_rows" IS 'Actual data rows stored as JSONB for flexibility';



COMMENT ON COLUMN "public"."table_rows"."stage_group_id" IS 'Current stage group the application is in (within its current stage)';



COMMENT ON COLUMN "public"."table_rows"."tags" IS 'Array of tag names applied to this application';



COMMENT ON COLUMN "public"."table_rows"."ba_created_by" IS 'Better Auth user ID (TEXT) - replaces created_by UUID';



COMMENT ON COLUMN "public"."table_rows"."ba_updated_by" IS 'Better Auth user ID (TEXT) - replaces updated_by UUID';



CREATE TABLE IF NOT EXISTS "public"."table_views" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'grid'::"text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "filters" "jsonb" DEFAULT '[]'::"jsonb",
    "sorts" "jsonb" DEFAULT '[]'::"jsonb",
    "grouping" "jsonb" DEFAULT '{}'::"jsonb",
    "is_shared" boolean DEFAULT false,
    "is_locked" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "ba_created_by" "text",
    CONSTRAINT "table_views_view_type_check" CHECK (("type" = ANY (ARRAY['grid'::"text", 'kanban'::"text", 'calendar'::"text", 'gallery'::"text", 'timeline'::"text", 'form'::"text", 'portal'::"text"])))
);


ALTER TABLE "public"."table_views" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_views" IS 'Different views of data (grid, kanban, calendar, etc.)';



COMMENT ON COLUMN "public"."table_views"."config" IS 'View-specific configuration. For portal views, contains sections, translations, theme, and submission_settings.';



COMMENT ON COLUMN "public"."table_views"."ba_created_by" IS 'Better Auth user ID (TEXT) - replaces created_by UUID';



CREATE TABLE IF NOT EXISTS "public"."tag_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "review_workflow_id" "uuid" NOT NULL,
    "stage_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "trigger_type" character varying(50) NOT NULL,
    "trigger_tag" character varying(255) NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tag_automations" OWNER TO "postgres";


COMMENT ON TABLE "public"."tag_automations" IS 'Automated actions triggered when tags are added/removed';



CREATE OR REPLACE VIEW "public"."v_fields_with_effective_config" AS
 SELECT "tf"."id",
    "tf"."table_id",
    "tf"."field_type_id",
    "tf"."name",
    "tf"."label",
    "tf"."description",
    "tf"."position",
    "tf"."width",
    "tf"."is_visible",
    "tf"."is_primary",
    "tf"."parent_field_id",
    "tf"."linked_table_id",
    "tf"."semantic_type",
    "tf"."is_searchable",
    "tf"."search_weight",
    "tf"."created_at",
    "tf"."updated_at",
    "ftr"."category",
    "ftr"."storage_schema",
    "ftr"."input_schema",
    "ftr"."config_schema",
    "ftr"."is_container",
    COALESCE("tf"."is_searchable", "ftr"."is_searchable") AS "effective_is_searchable",
    "ftr"."is_sortable",
    "ftr"."is_filterable",
    "ftr"."is_editable",
    "ftr"."supports_pii",
    "ftr"."ai_schema",
    (COALESCE("ftr"."default_config", '{}'::"jsonb") || COALESCE("tf"."config", '{}'::"jsonb")) AS "effective_config",
    "tf"."config" AS "instance_config",
    "ftr"."default_config" AS "registry_default_config"
   FROM ("public"."table_fields" "tf"
     LEFT JOIN "public"."field_type_registry" "ftr" ON (("tf"."field_type_id" = "ftr"."id")));


ALTER VIEW "public"."v_fields_with_effective_config" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_table_files_current" AS
 SELECT "id",
    "table_id",
    "row_id",
    "field_id",
    "workspace_id",
    "filename",
    "original_filename",
    "mime_type",
    "size_bytes",
    "storage_bucket",
    "storage_path",
    "public_url",
    "description",
    "alt_text",
    "metadata",
    "tags",
    "version",
    "parent_file_id",
    "uploaded_by",
    "created_at",
    "updated_at",
        CASE
            WHEN ("mime_type" ~~ 'image/%'::"text") THEN 'image'::"text"
            WHEN ("mime_type" ~~ 'video/%'::"text") THEN 'video'::"text"
            WHEN ("mime_type" ~~ 'audio/%'::"text") THEN 'audio'::"text"
            WHEN ("mime_type" = 'application/pdf'::"text") THEN 'pdf'::"text"
            WHEN (("mime_type" ~~ 'application/vnd.ms-excel%'::"text") OR ("mime_type" ~~ 'application/vnd.openxmlformats-officedocument.spreadsheet%'::"text")) THEN 'spreadsheet'::"text"
            WHEN (("mime_type" ~~ 'application/vnd.ms-word%'::"text") OR ("mime_type" ~~ 'application/vnd.openxmlformats-officedocument.wordprocessing%'::"text")) THEN 'document'::"text"
            ELSE 'file'::"text"
        END AS "file_category",
        CASE
            WHEN ("size_bytes" >= 1073741824) THEN ("round"((("size_bytes")::numeric / (1073741824)::numeric), 2) || ' GB'::"text")
            WHEN ("size_bytes" >= 1048576) THEN ("round"((("size_bytes")::numeric / (1048576)::numeric), 2) || ' MB'::"text")
            WHEN ("size_bytes" >= 1024) THEN ("round"((("size_bytes")::numeric / (1024)::numeric), 2) || ' KB'::"text")
            ELSE ("size_bytes" || ' bytes'::"text")
        END AS "formatted_size"
   FROM "public"."table_files" "f"
  WHERE (("is_current" = true) AND ("deleted_at" IS NULL));


ALTER VIEW "public"."v_table_files_current" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wf_api_keys" (
    "id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text",
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."wf_api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."wf_api_keys" IS 'API keys for authenticating workflow webhook triggers';



COMMENT ON COLUMN "public"."wf_api_keys"."key_hash" IS 'SHA-256 hash of the full API key - never store the actual key';



COMMENT ON COLUMN "public"."wf_api_keys"."key_prefix" IS 'Prefix of the key (e.g., wfb_abc...) for user identification';



COMMENT ON COLUMN "public"."wf_api_keys"."last_used_at" IS 'Timestamp of last API key usage for tracking';



CREATE TABLE IF NOT EXISTS "public"."workflow_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "review_workflow_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(50) DEFAULT 'gray'::character varying,
    "icon" character varying(50) DEFAULT 'circle'::character varying,
    "action_type" character varying(50) DEFAULT 'move_to_group'::character varying NOT NULL,
    "target_group_id" "uuid",
    "target_stage_id" "uuid",
    "requires_comment" boolean DEFAULT false,
    "is_system" boolean DEFAULT false,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workflow_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_webhook_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "workflow_id" "text" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "api_key" "text",
    "trigger_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workflow_webhook_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."workflow_webhook_configs" IS 'Stores webhook configurations for workflow automations triggered by application events';



COMMENT ON COLUMN "public"."workflow_webhook_configs"."workflow_id" IS 'Reference to the workflow in the external workflow builder system';



COMMENT ON COLUMN "public"."workflow_webhook_configs"."trigger_type" IS 'Event type: new_submission, stage_changed, score_submitted, tag_changed, status_changed';



CREATE TABLE IF NOT EXISTS "public"."workspace_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "integration_type" "text" NOT NULL,
    "is_enabled" boolean DEFAULT false,
    "is_connected" boolean DEFAULT false,
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "connected_email" "text",
    "connected_at" timestamp with time zone,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."workspace_integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspace_integrations" IS 'Third-party integration configurations per workspace (Google Drive, Dropbox, etc.)';



CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "added_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'active'::character varying,
    "invited_email" "text",
    "invited_by" "uuid",
    "invite_token" "text",
    "invite_expires_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "hub_access" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "ba_user_id" "text",
    "ba_invited_by" "text",
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspace_members" IS 'Granular workspace access control';



COMMENT ON COLUMN "public"."workspace_members"."ba_user_id" IS 'Better Auth user ID (TEXT) - references ba_users.id. Populated for migrated users. The Go backend checks both user_id (UUID) and ba_user_id (TEXT) for compatibility.';



COMMENT ON COLUMN "public"."workspace_members"."ba_invited_by" IS 'Better Auth user ID (TEXT) - replaces invited_by UUID';



CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3B82F6'::"text",
    "icon" "text" DEFAULT 'folder'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "ai_description" "text",
    "data_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_subdomain" character varying(63),
    "ba_organization_id" "text",
    "ba_created_by" "text"
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspaces" IS 'Project containers within organizations';



COMMENT ON COLUMN "public"."workspaces"."logo_url" IS 'Public URL of the workspace logo stored in Supabase Storage (workspace-assets bucket)';



COMMENT ON COLUMN "public"."workspaces"."ai_description" IS 'Natural language description of what this workspace contains, for AI context.';



COMMENT ON COLUMN "public"."workspaces"."ba_organization_id" IS 'Links workspace to Better Auth organization for multi-tenant support';



COMMENT ON COLUMN "public"."workspaces"."ba_created_by" IS 'Better Auth user ID (TEXT) - replaces created_by UUID';



ALTER TABLE ONLY "drizzle"."__drizzle_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"drizzle"."__drizzle_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "drizzle"."__drizzle_migrations"
    ADD CONSTRAINT "__drizzle_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applicant_folders"
    ADD CONSTRAINT "applicant_folders_form_integration_id_row_id_key" UNIQUE ("form_integration_id", "row_id");



ALTER TABLE ONLY "public"."applicant_folders"
    ADD CONSTRAINT "applicant_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_groups"
    ADD CONSTRAINT "application_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_stages"
    ADD CONSTRAINT "application_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_submissions"
    ADD CONSTRAINT "application_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_submissions"
    ADD CONSTRAINT "application_submissions_user_id_form_id_key" UNIQUE ("user_id", "form_id");



ALTER TABLE ONLY "public"."automation_workflow_execution_logs"
    ADD CONSTRAINT "automation_workflow_execution_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_workflow_executions"
    ADD CONSTRAINT "automation_workflow_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_workflows"
    ADD CONSTRAINT "automation_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_accounts"
    ADD CONSTRAINT "ba_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_invitations"
    ADD CONSTRAINT "ba_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_members"
    ADD CONSTRAINT "ba_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."ba_members"
    ADD CONSTRAINT "ba_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_organizations"
    ADD CONSTRAINT "ba_organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_organizations"
    ADD CONSTRAINT "ba_organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ba_sessions"
    ADD CONSTRAINT "ba_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_sessions"
    ADD CONSTRAINT "ba_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."ba_users"
    ADD CONSTRAINT "ba_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."ba_users"
    ADD CONSTRAINT "ba_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ba_verifications"
    ADD CONSTRAINT "ba_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_operations"
    ADD CONSTRAINT "batch_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_approvals"
    ADD CONSTRAINT "change_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_statuses"
    ADD CONSTRAINT "custom_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_tags"
    ADD CONSTRAINT "custom_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_custom_slug_key" UNIQUE ("custom_slug");



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_custom_subdomain_key" UNIQUE ("custom_subdomain");



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_workspace_id_slug_key" UNIQUE ("workspace_id", "slug");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_signatures"
    ADD CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embedding_queue"
    ADD CONSTRAINT "embedding_queue_entity_id_entity_type_key" UNIQUE ("entity_id", "entity_type");



ALTER TABLE ONLY "public"."embedding_queue"
    ADD CONSTRAINT "embedding_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_types"
    ADD CONSTRAINT "entity_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."field_changes"
    ADD CONSTRAINT "field_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."field_type_registry"
    ADD CONSTRAINT "field_type_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_sync_log"
    ADD CONSTRAINT "file_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_integration_settings"
    ADD CONSTRAINT "form_integration_settings_form_id_workspace_integration_id_key" UNIQUE ("form_id", "workspace_integration_id");



ALTER TABLE ONLY "public"."form_integration_settings"
    ADD CONSTRAINT "form_integration_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_connections"
    ADD CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_module_configs"
    ADD CONSTRAINT "hub_module_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hub_module_configs"
    ADD CONSTRAINT "hub_module_configs_table_id_module_id_key" UNIQUE ("table_id", "module_id");



ALTER TABLE ONLY "public"."integration_credentials"
    ADD CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metadata_schema"
    ADD CONSTRAINT "metadata_schema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_definitions"
    ADD CONSTRAINT "module_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_field_configs"
    ADD CONSTRAINT "module_field_configs_module_id_field_type_id_key" UNIQUE ("module_id", "field_type_id");



ALTER TABLE ONLY "public"."module_field_configs"
    ADD CONSTRAINT "module_field_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_history_settings"
    ADD CONSTRAINT "module_history_settings_hub_module_config_id_key" UNIQUE ("hub_module_config_id");



ALTER TABLE ONLY "public"."module_history_settings"
    ADD CONSTRAINT "module_history_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."portal_applicants"
    ADD CONSTRAINT "portal_applicants_form_id_email_key" UNIQUE ("form_id", "email");



ALTER TABLE ONLY "public"."portal_applicants"
    ADD CONSTRAINT "portal_applicants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_applicants"
    ADD CONSTRAINT "portal_applicants_reset_token_key" UNIQUE ("reset_token");



ALTER TABLE ONLY "public"."portal_operations"
    ADD CONSTRAINT "portal_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendation_requests"
    ADD CONSTRAINT "recommendation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendation_requests"
    ADD CONSTRAINT "recommendation_requests_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."review_workflows"
    ADD CONSTRAINT "review_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviewer_types"
    ADD CONSTRAINT "reviewer_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_entity_id_entity_type_key" UNIQUE ("entity_id", "entity_type");



ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semantic_field_types"
    ADD CONSTRAINT "semantic_field_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sent_emails"
    ADD CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_actions"
    ADD CONSTRAINT "stage_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_groups"
    ADD CONSTRAINT "stage_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_reviewer_configs"
    ADD CONSTRAINT "stage_reviewer_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_modules"
    ADD CONSTRAINT "sub_modules_hub_id_parent_module_id_slug_key" UNIQUE ("hub_id", "parent_module_id", "slug");



ALTER TABLE ONLY "public"."sub_modules"
    ADD CONSTRAINT "sub_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_versions"
    ADD CONSTRAINT "submission_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_versions"
    ADD CONSTRAINT "submission_versions_submission_id_version_key" UNIQUE ("submission_id", "version");



ALTER TABLE ONLY "public"."table_fields"
    ADD CONSTRAINT "table_columns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_files"
    ADD CONSTRAINT "table_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_links"
    ADD CONSTRAINT "table_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_row_links"
    ADD CONSTRAINT "table_row_links_link_id_source_row_id_target_row_id_key" UNIQUE ("link_id", "source_row_id", "target_row_id");



ALTER TABLE ONLY "public"."table_row_links"
    ADD CONSTRAINT "table_row_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_rows"
    ADD CONSTRAINT "table_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_views"
    ADD CONSTRAINT "table_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag_automations"
    ADD CONSTRAINT "tag_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wf_api_keys"
    ADD CONSTRAINT "wf_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_webhook_configs"
    ADD CONSTRAINT "workflow_webhook_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_workspace_id_integration_type_key" UNIQUE ("workspace_id", "integration_type");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_custom_subdomain_key" UNIQUE ("custom_subdomain");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_organization_id_slug_key" UNIQUE ("organization_id", "slug");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_field_suggestions_ba_reviewed_by" ON "public"."ai_field_suggestions" USING "btree" ("ba_reviewed_by") WHERE ("ba_reviewed_by" IS NOT NULL);



CREATE INDEX "idx_ai_suggestions_field" ON "public"."ai_field_suggestions" USING "btree" ("field_id", "status");



CREATE INDEX "idx_ai_suggestions_module" ON "public"."ai_field_suggestions" USING "btree" ("module_id") WHERE ("module_id" IS NOT NULL);



CREATE INDEX "idx_ai_suggestions_pending" ON "public"."ai_field_suggestions" USING "btree" ("status", "confidence" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_ai_suggestions_row" ON "public"."ai_field_suggestions" USING "btree" ("row_id", "status");



CREATE INDEX "idx_ai_suggestions_table" ON "public"."ai_field_suggestions" USING "btree" ("table_id", "status", "created_at" DESC);



CREATE INDEX "idx_app_submissions_data" ON "public"."application_submissions" USING "gin" ("data");



CREATE INDEX "idx_app_submissions_form" ON "public"."application_submissions" USING "btree" ("form_id");



CREATE INDEX "idx_app_submissions_form_status" ON "public"."application_submissions" USING "btree" ("form_id", "status");



CREATE INDEX "idx_app_submissions_form_user" ON "public"."application_submissions" USING "btree" ("form_id", "user_id");



CREATE INDEX "idx_app_submissions_stage" ON "public"."application_submissions" USING "btree" ("stage_id");



CREATE INDEX "idx_app_submissions_status" ON "public"."application_submissions" USING "btree" ("status");



CREATE INDEX "idx_app_submissions_user" ON "public"."application_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_applicant_folders_row" ON "public"."applicant_folders" USING "btree" ("row_id");



CREATE INDEX "idx_application_groups_review_workflow_id" ON "public"."application_groups" USING "btree" ("review_workflow_id");



CREATE INDEX "idx_application_groups_workspace_id" ON "public"."application_groups" USING "btree" ("workspace_id");



CREATE INDEX "idx_application_stages_order" ON "public"."application_stages" USING "btree" ("review_workflow_id", "order_index");



CREATE INDEX "idx_application_stages_workflow" ON "public"."application_stages" USING "btree" ("review_workflow_id");



CREATE INDEX "idx_application_stages_workspace" ON "public"."application_stages" USING "btree" ("workspace_id");



CREATE INDEX "idx_automation_workflow_execution_logs_execution_id" ON "public"."automation_workflow_execution_logs" USING "btree" ("execution_id");



CREATE INDEX "idx_automation_workflow_execution_logs_node_id" ON "public"."automation_workflow_execution_logs" USING "btree" ("node_id");



CREATE INDEX "idx_automation_workflow_execution_logs_status" ON "public"."automation_workflow_execution_logs" USING "btree" ("status");



CREATE INDEX "idx_automation_workflow_executions_ba_user_id" ON "public"."automation_workflow_executions" USING "btree" ("ba_user_id") WHERE ("ba_user_id" IS NOT NULL);



CREATE INDEX "idx_automation_workflow_executions_created_at" ON "public"."automation_workflow_executions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_automation_workflow_executions_status" ON "public"."automation_workflow_executions" USING "btree" ("status");



CREATE INDEX "idx_automation_workflow_executions_user_id" ON "public"."automation_workflow_executions" USING "btree" ("user_id");



CREATE INDEX "idx_automation_workflow_executions_workflow_id" ON "public"."automation_workflow_executions" USING "btree" ("workflow_id");



CREATE INDEX "idx_automation_workflows_ba_user_id" ON "public"."automation_workflows" USING "btree" ("ba_user_id") WHERE ("ba_user_id" IS NOT NULL);



CREATE INDEX "idx_automation_workflows_is_active" ON "public"."automation_workflows" USING "btree" ("is_active");



CREATE INDEX "idx_automation_workflows_trigger_type" ON "public"."automation_workflows" USING "btree" ("trigger_type");



CREATE INDEX "idx_automation_workflows_user_id" ON "public"."automation_workflows" USING "btree" ("user_id");



CREATE INDEX "idx_automation_workflows_workspace_id" ON "public"."automation_workflows" USING "btree" ("workspace_id");



CREATE INDEX "idx_ba_accounts_provider" ON "public"."ba_accounts" USING "btree" ("provider_id", "account_id");



CREATE INDEX "idx_ba_accounts_user_id" ON "public"."ba_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_ba_invitations_email" ON "public"."ba_invitations" USING "btree" ("email");



CREATE INDEX "idx_ba_invitations_email_status" ON "public"."ba_invitations" USING "btree" ("email", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_ba_invitations_org_id" ON "public"."ba_invitations" USING "btree" ("organization_id");



CREATE INDEX "idx_ba_members_org_id" ON "public"."ba_members" USING "btree" ("organization_id");



CREATE INDEX "idx_ba_members_org_user" ON "public"."ba_members" USING "btree" ("organization_id", "user_id");



CREATE INDEX "idx_ba_members_user_id" ON "public"."ba_members" USING "btree" ("user_id");



CREATE INDEX "idx_ba_organizations_slug" ON "public"."ba_organizations" USING "btree" ("slug");



CREATE INDEX "idx_ba_sessions_expires_at" ON "public"."ba_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_ba_sessions_token" ON "public"."ba_sessions" USING "btree" ("token");



CREATE INDEX "idx_ba_sessions_user_id" ON "public"."ba_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_ba_users_email" ON "public"."ba_users" USING "btree" ("email");



CREATE INDEX "idx_ba_users_metadata" ON "public"."ba_users" USING "gin" ("metadata");



CREATE INDEX "idx_ba_users_supabase_id" ON "public"."ba_users" USING "btree" ("supabase_user_id");



CREATE INDEX "idx_ba_users_type" ON "public"."ba_users" USING "btree" ("user_type");



CREATE INDEX "idx_ba_verifications_token" ON "public"."ba_verifications" USING "btree" ("token");



CREATE INDEX "idx_ba_verifications_type" ON "public"."ba_verifications" USING "btree" ("type");



CREATE INDEX "idx_batch_operations_table" ON "public"."batch_operations" USING "btree" ("table_id", "created_at" DESC);



CREATE INDEX "idx_batch_operations_workspace" ON "public"."batch_operations" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_change_approvals_approver" ON "public"."change_approvals" USING "btree" ("specific_approver_id", "status");



CREATE INDEX "idx_change_approvals_ba_reviewed_by" ON "public"."change_approvals" USING "btree" ("ba_reviewed_by") WHERE ("ba_reviewed_by" IS NOT NULL);



CREATE INDEX "idx_change_approvals_pending" ON "public"."change_approvals" USING "btree" ("status", "expires_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_change_approvals_row" ON "public"."change_approvals" USING "btree" ("row_id", "status");



CREATE INDEX "idx_change_approvals_table" ON "public"."change_approvals" USING "btree" ("table_id", "status", "requested_at" DESC);



CREATE INDEX "idx_change_requests_ba_reviewed_by" ON "public"."change_requests" USING "btree" ("ba_reviewed_by") WHERE ("ba_reviewed_by" IS NOT NULL);



CREATE INDEX "idx_change_requests_requested_by" ON "public"."change_requests" USING "btree" ("requested_by", "status");



CREATE INDEX "idx_change_requests_row" ON "public"."change_requests" USING "btree" ("row_id", "status");



CREATE INDEX "idx_change_requests_table" ON "public"."change_requests" USING "btree" ("table_id", "status");



CREATE INDEX "idx_change_requests_workspace" ON "public"."change_requests" USING "btree" ("workspace_id", "status");



CREATE INDEX "idx_custom_statuses_stage" ON "public"."custom_statuses" USING "btree" ("stage_id");



CREATE INDEX "idx_custom_statuses_workspace" ON "public"."custom_statuses" USING "btree" ("workspace_id");



CREATE INDEX "idx_custom_tags_stage" ON "public"."custom_tags" USING "btree" ("stage_id");



CREATE INDEX "idx_custom_tags_workflow" ON "public"."custom_tags" USING "btree" ("review_workflow_id");



CREATE INDEX "idx_custom_tags_workspace" ON "public"."custom_tags" USING "btree" ("workspace_id");



CREATE INDEX "idx_data_tables_ba_created_by" ON "public"."data_tables" USING "btree" ("ba_created_by") WHERE ("ba_created_by" IS NOT NULL);



CREATE INDEX "idx_data_tables_custom_slug" ON "public"."data_tables" USING "btree" ("custom_slug") WHERE ("custom_slug" IS NOT NULL);



CREATE INDEX "idx_data_tables_custom_subdomain" ON "public"."data_tables" USING "btree" ("custom_subdomain") WHERE ("custom_subdomain" IS NOT NULL);



CREATE INDEX "idx_data_tables_hub_type" ON "public"."data_tables" USING "btree" ("hub_type");



CREATE INDEX "idx_data_tables_is_archived" ON "public"."data_tables" USING "btree" ("is_archived");



CREATE INDEX "idx_data_tables_is_hidden" ON "public"."data_tables" USING "btree" ("workspace_id", "is_hidden") WHERE ("is_hidden" = false);



CREATE INDEX "idx_data_tables_search_vector" ON "public"."data_tables" USING "gin" ("search_vector");



CREATE UNIQUE INDEX "idx_data_tables_slug" ON "public"."data_tables" USING "btree" ("slug");



CREATE INDEX "idx_data_tables_workspace_id" ON "public"."data_tables" USING "btree" ("workspace_id");



CREATE INDEX "idx_data_tables_workspace_slug" ON "public"."data_tables" USING "btree" ("workspace_id", "slug");



CREATE INDEX "idx_email_campaigns_form" ON "public"."email_campaigns" USING "btree" ("form_id");



CREATE INDEX "idx_email_campaigns_workspace" ON "public"."email_campaigns" USING "btree" ("workspace_id");



CREATE INDEX "idx_email_queue_campaign" ON "public"."email_queue" USING "btree" ("campaign_id");



CREATE INDEX "idx_email_queue_priority_status" ON "public"."email_queue" USING "btree" ("priority" DESC, "status", "scheduled_for");



CREATE INDEX "idx_email_queue_scheduled" ON "public"."email_queue" USING "btree" ("scheduled_for");



CREATE INDEX "idx_email_queue_status" ON "public"."email_queue" USING "btree" ("status");



CREATE INDEX "idx_email_queue_workspace" ON "public"."email_queue" USING "btree" ("workspace_id");



CREATE INDEX "idx_email_signatures_workspace" ON "public"."email_signatures" USING "btree" ("workspace_id");



CREATE INDEX "idx_email_templates_form" ON "public"."email_templates" USING "btree" ("form_id");



CREATE INDEX "idx_email_templates_workspace" ON "public"."email_templates" USING "btree" ("workspace_id");



CREATE INDEX "idx_embedding_queue_status" ON "public"."embedding_queue" USING "btree" ("status", "priority" DESC, "created_at");



CREATE INDEX "idx_field_changes_field" ON "public"."field_changes" USING "btree" ("field_id", "created_at" DESC);



CREATE INDEX "idx_field_changes_field_name" ON "public"."field_changes" USING "btree" ("field_name", "created_at" DESC);



CREATE INDEX "idx_field_changes_row" ON "public"."field_changes" USING "btree" ("row_id", "created_at" DESC);



CREATE INDEX "idx_field_changes_version" ON "public"."field_changes" USING "btree" ("row_version_id");



CREATE INDEX "idx_fields_table_order" ON "public"."table_fields" USING "btree" ("table_id", "position");



CREATE INDEX "idx_file_sync_log_file" ON "public"."file_sync_log" USING "btree" ("table_file_id");



CREATE INDEX "idx_file_sync_log_folder" ON "public"."file_sync_log" USING "btree" ("applicant_folder_id");



CREATE INDEX "idx_files_row_id" ON "public"."table_files" USING "btree" ("row_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_files_table_id" ON "public"."table_files" USING "btree" ("table_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_form_integration_settings_form" ON "public"."form_integration_settings" USING "btree" ("form_id");



CREATE INDEX "idx_gmail_connections_user" ON "public"."gmail_connections" USING "btree" ("user_id");



CREATE INDEX "idx_gmail_connections_workspace" ON "public"."gmail_connections" USING "btree" ("workspace_id");



CREATE INDEX "idx_hub_module_configs_enabled" ON "public"."hub_module_configs" USING "btree" ("table_id", "is_enabled");



CREATE INDEX "idx_hub_module_configs_module" ON "public"."hub_module_configs" USING "btree" ("module_id");



CREATE INDEX "idx_hub_module_configs_table" ON "public"."hub_module_configs" USING "btree" ("table_id");



CREATE INDEX "idx_integration_credentials_integration_type" ON "public"."integration_credentials" USING "btree" ("integration_type");



CREATE INDEX "idx_integration_credentials_user_id" ON "public"."integration_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_integration_credentials_workspace_id" ON "public"."integration_credentials" USING "btree" ("workspace_id");



CREATE INDEX "idx_module_field_configs_module" ON "public"."module_field_configs" USING "btree" ("module_id");



CREATE INDEX "idx_organization_members_ba_user_id" ON "public"."organization_members" USING "btree" ("ba_user_id") WHERE ("ba_user_id" IS NOT NULL);



CREATE INDEX "idx_organizations_slug" ON "public"."organizations" USING "btree" ("slug");



CREATE INDEX "idx_portal_applicants_ba_user_id" ON "public"."portal_applicants" USING "btree" ("ba_user_id");



CREATE INDEX "idx_portal_applicants_form_email" ON "public"."portal_applicants" USING "btree" ("form_id", "email");



CREATE INDEX "idx_portal_applicants_reset_token" ON "public"."portal_applicants" USING "btree" ("reset_token") WHERE ("reset_token" IS NOT NULL);



CREATE INDEX "idx_portal_operations" ON "public"."portal_operations" USING "btree" ("portal_id", "timestamp");



CREATE INDEX "idx_portal_operations_op_id" ON "public"."portal_operations" USING "btree" ("portal_id", "op_id");



CREATE INDEX "idx_portal_operations_timestamp" ON "public"."portal_operations" USING "btree" ("timestamp");



CREATE INDEX "idx_recommendation_requests_email" ON "public"."recommendation_requests" USING "btree" ("recommender_email");



CREATE INDEX "idx_recommendation_requests_form" ON "public"."recommendation_requests" USING "btree" ("form_id");



CREATE INDEX "idx_recommendation_requests_status" ON "public"."recommendation_requests" USING "btree" ("status");



CREATE INDEX "idx_recommendation_requests_submission" ON "public"."recommendation_requests" USING "btree" ("submission_id");



CREATE INDEX "idx_recommendation_requests_token" ON "public"."recommendation_requests" USING "btree" ("token");



CREATE INDEX "idx_review_workflows_active" ON "public"."review_workflows" USING "btree" ("is_active");



CREATE INDEX "idx_review_workflows_form_id" ON "public"."review_workflows" USING "btree" ("form_id");



CREATE INDEX "idx_review_workflows_workspace" ON "public"."review_workflows" USING "btree" ("workspace_id");



CREATE INDEX "idx_reviewer_types_workspace" ON "public"."reviewer_types" USING "btree" ("workspace_id");



CREATE INDEX "idx_row_versions_archived" ON "public"."row_versions" USING "btree" ("is_archived", "archive_expires_at") WHERE ("is_archived" = true);



CREATE INDEX "idx_row_versions_batch" ON "public"."row_versions" USING "btree" ("batch_operation_id");



CREATE INDEX "idx_row_versions_module" ON "public"."row_versions" USING "btree" ("module_id") WHERE ("module_id" IS NOT NULL);



CREATE INDEX "idx_row_versions_row" ON "public"."row_versions" USING "btree" ("row_id", "version_number" DESC);



CREATE INDEX "idx_row_versions_sub_module" ON "public"."row_versions" USING "btree" ("sub_module_id") WHERE ("sub_module_id" IS NOT NULL);



CREATE INDEX "idx_row_versions_table" ON "public"."row_versions" USING "btree" ("table_id", "changed_at" DESC);



CREATE UNIQUE INDEX "idx_row_versions_unique" ON "public"."row_versions" USING "btree" ("row_id", "version_number");



CREATE INDEX "idx_row_versions_user" ON "public"."row_versions" USING "btree" ("changed_by", "changed_at" DESC);



CREATE INDEX "idx_rows_data_gin" ON "public"."table_rows" USING "gin" ("data" "jsonb_path_ops");



CREATE INDEX "idx_rows_table_created" ON "public"."table_rows" USING "btree" ("table_id", "created_at" DESC);



CREATE INDEX "idx_rows_table_updated" ON "public"."table_rows" USING "btree" ("table_id", "updated_at" DESC);



CREATE INDEX "idx_rubrics_workspace" ON "public"."rubrics" USING "btree" ("workspace_id");



CREATE INDEX "idx_search_analytics_ba_user_id" ON "public"."search_analytics" USING "btree" ("ba_user_id") WHERE ("ba_user_id" IS NOT NULL);



CREATE INDEX "idx_search_analytics_clicked" ON "public"."search_analytics" USING "btree" ("clicked_result_id");



CREATE INDEX "idx_search_analytics_query" ON "public"."search_analytics" USING "gin" ("query_tokens");



CREATE INDEX "idx_search_analytics_user" ON "public"."search_analytics" USING "btree" ("workspace_id", "search_at" DESC);



CREATE INDEX "idx_search_analytics_workspace" ON "public"."search_analytics" USING "btree" ("workspace_id", "search_at" DESC);



CREATE INDEX "idx_search_index_content_trgm" ON "public"."search_index" USING "gin" ("content" "public"."gin_trgm_ops");



CREATE INDEX "idx_search_index_embedding" ON "public"."search_index" USING "hnsw" ("embedding" "public"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_search_index_hub" ON "public"."search_index" USING "btree" ("hub_type");



CREATE INDEX "idx_search_index_search_vector" ON "public"."search_index" USING "gin" ("search_vector");



CREATE INDEX "idx_search_index_table" ON "public"."search_index" USING "btree" ("table_id");



CREATE INDEX "idx_search_index_tags" ON "public"."search_index" USING "gin" ("tags");



CREATE INDEX "idx_search_index_title_trgm" ON "public"."search_index" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_search_index_trgm" ON "public"."search_index" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_search_index_type" ON "public"."search_index" USING "btree" ("entity_type");



CREATE INDEX "idx_search_index_vector" ON "public"."search_index" USING "gin" ("search_vector");



CREATE INDEX "idx_search_index_workspace" ON "public"."search_index" USING "btree" ("workspace_id");



CREATE INDEX "idx_sent_emails_campaign" ON "public"."sent_emails" USING "btree" ("campaign_id");



CREATE INDEX "idx_sent_emails_form" ON "public"."sent_emails" USING "btree" ("form_id");



CREATE INDEX "idx_sent_emails_recipient" ON "public"."sent_emails" USING "btree" ("recipient_email");



CREATE INDEX "idx_sent_emails_tracking" ON "public"."sent_emails" USING "btree" ("tracking_id");



CREATE INDEX "idx_sent_emails_workspace" ON "public"."sent_emails" USING "btree" ("workspace_id");



CREATE INDEX "idx_stage_actions_stage_id" ON "public"."stage_actions" USING "btree" ("stage_id");



CREATE INDEX "idx_stage_groups_stage" ON "public"."stage_groups" USING "btree" ("stage_id");



CREATE INDEX "idx_stage_groups_workspace" ON "public"."stage_groups" USING "btree" ("workspace_id");



CREATE INDEX "idx_stage_reviewer_configs_reviewer_type" ON "public"."stage_reviewer_configs" USING "btree" ("reviewer_type_id");



CREATE INDEX "idx_stage_reviewer_configs_stage" ON "public"."stage_reviewer_configs" USING "btree" ("stage_id");



CREATE INDEX "idx_sub_modules_ba_created_by" ON "public"."sub_modules" USING "btree" ("ba_created_by") WHERE ("ba_created_by" IS NOT NULL);



CREATE INDEX "idx_sub_modules_data_table" ON "public"."sub_modules" USING "btree" ("data_table_id");



CREATE INDEX "idx_sub_modules_hub" ON "public"."sub_modules" USING "btree" ("hub_id");



CREATE INDEX "idx_sub_modules_parent" ON "public"."sub_modules" USING "btree" ("parent_module_id");



CREATE INDEX "idx_submission_versions_submission" ON "public"."submission_versions" USING "btree" ("submission_id");



CREATE INDEX "idx_submissions_form_id" ON "public"."application_submissions" USING "btree" ("form_id", "created_at" DESC);



CREATE INDEX "idx_submissions_status" ON "public"."application_submissions" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_submissions_user_updated" ON "public"."application_submissions" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_table_columns_is_primary" ON "public"."table_fields" USING "btree" ("table_id", "is_primary");



CREATE INDEX "idx_table_columns_position" ON "public"."table_fields" USING "btree" ("table_id", "position");



CREATE INDEX "idx_table_columns_table" ON "public"."table_fields" USING "btree" ("table_id");



CREATE INDEX "idx_table_fields_parent" ON "public"."table_fields" USING "btree" ("parent_field_id");



CREATE INDEX "idx_table_fields_searchable" ON "public"."table_fields" USING "btree" ("table_id", "is_searchable") WHERE ("is_searchable" = true);



CREATE INDEX "idx_table_fields_section_id" ON "public"."table_fields" USING "btree" ("section_id");



CREATE INDEX "idx_table_fields_table_id" ON "public"."table_fields" USING "btree" ("table_id");



CREATE INDEX "idx_table_fields_type_id" ON "public"."table_fields" USING "btree" ("field_type_id");



CREATE INDEX "idx_table_files_current" ON "public"."table_files" USING "btree" ("row_id", "field_id", "is_current") WHERE (("is_current" = true) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_table_files_field" ON "public"."table_files" USING "btree" ("field_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_metadata" ON "public"."table_files" USING "gin" ("metadata");



CREATE INDEX "idx_table_files_mime" ON "public"."table_files" USING "btree" ("mime_type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_row" ON "public"."table_files" USING "btree" ("row_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_row_field" ON "public"."table_files" USING "btree" ("row_id", "field_id") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "idx_table_files_storage_path" ON "public"."table_files" USING "btree" ("storage_bucket", "storage_path") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_table" ON "public"."table_files" USING "btree" ("table_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_table_row" ON "public"."table_files" USING "btree" ("table_id", "row_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_tags" ON "public"."table_files" USING "gin" ("tags");



CREATE INDEX "idx_table_files_versions" ON "public"."table_files" USING "btree" ("parent_file_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_files_workspace" ON "public"."table_files" USING "btree" ("workspace_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_table_links_source" ON "public"."table_links" USING "btree" ("source_table_id");



CREATE INDEX "idx_table_links_target" ON "public"."table_links" USING "btree" ("target_table_id");



CREATE INDEX "idx_table_row_links_link" ON "public"."table_row_links" USING "btree" ("link_id");



CREATE INDEX "idx_table_row_links_source" ON "public"."table_row_links" USING "btree" ("source_row_id");



CREATE INDEX "idx_table_row_links_target" ON "public"."table_row_links" USING "btree" ("target_row_id");



CREATE INDEX "idx_table_rows_ba_created_by" ON "public"."table_rows" USING "btree" ("ba_created_by") WHERE ("ba_created_by" IS NOT NULL);



CREATE INDEX "idx_table_rows_ba_updated_by" ON "public"."table_rows" USING "btree" ("ba_updated_by") WHERE ("ba_updated_by" IS NOT NULL);



CREATE INDEX "idx_table_rows_created_at" ON "public"."table_rows" USING "btree" ("created_at");



CREATE INDEX "idx_table_rows_data_gin" ON "public"."table_rows" USING "gin" ("data");



CREATE INDEX "idx_table_rows_is_archived" ON "public"."table_rows" USING "btree" ("is_archived");



CREATE INDEX "idx_table_rows_stage_group" ON "public"."table_rows" USING "btree" ("stage_group_id");



CREATE INDEX "idx_table_rows_table" ON "public"."table_rows" USING "btree" ("table_id");



CREATE INDEX "idx_table_rows_table_id" ON "public"."table_rows" USING "btree" ("table_id");



CREATE INDEX "idx_table_rows_tags" ON "public"."table_rows" USING "gin" ("tags");



CREATE INDEX "idx_table_views_ba_created_by" ON "public"."table_views" USING "btree" ("ba_created_by") WHERE ("ba_created_by" IS NOT NULL);



CREATE INDEX "idx_table_views_created_by" ON "public"."table_views" USING "btree" ("created_by");



CREATE INDEX "idx_table_views_table" ON "public"."table_views" USING "btree" ("table_id");



CREATE INDEX "idx_table_views_table_id" ON "public"."table_views" USING "btree" ("table_id");



CREATE INDEX "idx_table_views_table_type" ON "public"."table_views" USING "btree" ("table_id", "type");



CREATE INDEX "idx_table_views_type" ON "public"."table_views" USING "btree" ("type");



CREATE INDEX "idx_tag_automations_stage" ON "public"."tag_automations" USING "btree" ("stage_id");



CREATE INDEX "idx_tag_automations_trigger_tag" ON "public"."tag_automations" USING "btree" ("trigger_tag");



CREATE INDEX "idx_tag_automations_workflow" ON "public"."tag_automations" USING "btree" ("review_workflow_id");



CREATE INDEX "idx_tag_automations_workspace" ON "public"."tag_automations" USING "btree" ("workspace_id");



CREATE INDEX "idx_views_table_id" ON "public"."table_views" USING "btree" ("table_id");



CREATE INDEX "idx_wf_api_keys_key_hash" ON "public"."wf_api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_wf_api_keys_user_id" ON "public"."wf_api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_workflow_actions_review_workflow_id" ON "public"."workflow_actions" USING "btree" ("review_workflow_id");



CREATE INDEX "idx_workflow_actions_workspace_id" ON "public"."workflow_actions" USING "btree" ("workspace_id");



CREATE INDEX "idx_workflow_webhooks_form_id" ON "public"."workflow_webhook_configs" USING "btree" ("form_id");



CREATE INDEX "idx_workflow_webhooks_trigger_type" ON "public"."workflow_webhook_configs" USING "btree" ("form_id", "trigger_type") WHERE ("enabled" = true);



CREATE INDEX "idx_workspace_integrations_type" ON "public"."workspace_integrations" USING "btree" ("integration_type");



CREATE INDEX "idx_workspace_integrations_workspace" ON "public"."workspace_integrations" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_members_ba_invited_by" ON "public"."workspace_members" USING "btree" ("ba_invited_by") WHERE ("ba_invited_by" IS NOT NULL);



CREATE INDEX "idx_workspace_members_ba_user_id" ON "public"."workspace_members" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_invite_token" ON "public"."workspace_members" USING "btree" ("invite_token");



CREATE INDEX "idx_workspace_members_invited_email" ON "public"."workspace_members" USING "btree" ("invited_email");



CREATE INDEX "idx_workspace_members_user" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_workspace" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_members_workspace_ba_user" ON "public"."workspace_members" USING "btree" ("workspace_id", "ba_user_id");



CREATE INDEX "idx_workspaces_ba_created_by" ON "public"."workspaces" USING "btree" ("ba_created_by") WHERE ("ba_created_by" IS NOT NULL);



CREATE INDEX "idx_workspaces_ba_org" ON "public"."workspaces" USING "btree" ("ba_organization_id");



CREATE INDEX "idx_workspaces_custom_subdomain" ON "public"."workspaces" USING "btree" ("custom_subdomain") WHERE ("custom_subdomain" IS NOT NULL);



CREATE INDEX "idx_workspaces_org_id" ON "public"."workspaces" USING "btree" ("organization_id") WHERE ("is_archived" = false);



CREATE INDEX "idx_workspaces_org_slug" ON "public"."workspaces" USING "btree" ("organization_id", "slug");



CREATE OR REPLACE TRIGGER "applicant_folders_updated_at" BEFORE UPDATE ON "public"."applicant_folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_timestamp"();



CREATE OR REPLACE TRIGGER "auto_enable_modules_trigger" AFTER INSERT ON "public"."data_tables" FOR EACH ROW EXECUTE FUNCTION "public"."auto_enable_default_modules"();



CREATE OR REPLACE TRIGGER "auto_index_row" AFTER INSERT OR UPDATE ON "public"."table_rows" FOR EACH ROW EXECUTE FUNCTION "public"."auto_queue_row_for_embedding"();



CREATE OR REPLACE TRIGGER "form_integration_settings_updated_at" BEFORE UPDATE ON "public"."form_integration_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_timestamp"();



CREATE OR REPLACE TRIGGER "recommendation_request_updated" BEFORE UPDATE ON "public"."recommendation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_recommendation_request_timestamp"();



CREATE OR REPLACE TRIGGER "search_index_vector_update" BEFORE INSERT OR UPDATE OF "title", "subtitle", "content" ON "public"."search_index" FOR EACH ROW EXECUTE FUNCTION "public"."update_search_vector"();



CREATE OR REPLACE TRIGGER "trigger_auto_create_module_fields" AFTER INSERT OR UPDATE ON "public"."hub_module_configs" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_module_fields"();



CREATE OR REPLACE TRIGGER "trigger_auto_semantic_type" BEFORE INSERT ON "public"."table_fields" FOR EACH ROW EXECUTE FUNCTION "public"."auto_detect_semantic_type"();



CREATE OR REPLACE TRIGGER "trigger_data_tables_search_vector" BEFORE INSERT OR UPDATE OF "name", "description", "hub_type", "entity_type" ON "public"."data_tables" FOR EACH ROW EXECUTE FUNCTION "public"."update_data_tables_search_vector"();



CREATE OR REPLACE TRIGGER "trigger_queue_embedding" AFTER INSERT OR UPDATE ON "public"."search_index" FOR EACH ROW EXECUTE FUNCTION "public"."queue_for_embedding"();



CREATE OR REPLACE TRIGGER "trigger_sync_field_type_id" BEFORE INSERT OR UPDATE ON "public"."table_fields" FOR EACH ROW EXECUTE FUNCTION "public"."sync_field_type_id"();



CREATE OR REPLACE TRIGGER "trigger_table_files_updated_at" BEFORE UPDATE ON "public"."table_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_table_files_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_table_rows_search_index" AFTER INSERT OR UPDATE ON "public"."table_rows" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_index_row"();



CREATE OR REPLACE TRIGGER "trigger_table_rows_search_index_delete" BEFORE DELETE ON "public"."table_rows" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_remove_row_index"();



CREATE OR REPLACE TRIGGER "trigger_update_submission_timestamp" BEFORE UPDATE ON "public"."application_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_submission_timestamp"();



CREATE OR REPLACE TRIGGER "update_application_groups_updated_at" BEFORE UPDATE ON "public"."application_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_application_stages_updated_at" BEFORE UPDATE ON "public"."application_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hub_module_configs_updated_at" BEFORE UPDATE ON "public"."hub_module_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_module_definitions_updated_at" BEFORE UPDATE ON "public"."module_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organization_members_updated_at" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_review_workflows_updated_at" BEFORE UPDATE ON "public"."review_workflows" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reviewer_types_updated_at" BEFORE UPDATE ON "public"."reviewer_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rubrics_updated_at" BEFORE UPDATE ON "public"."rubrics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stage_actions_updated_at" BEFORE UPDATE ON "public"."stage_actions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stage_reviewer_configs_updated_at" BEFORE UPDATE ON "public"."stage_reviewer_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_table_columns_updated_at" BEFORE UPDATE ON "public"."table_fields" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_table_views_updated_at" BEFORE UPDATE ON "public"."table_views" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workflow_actions_updated_at" BEFORE UPDATE ON "public"."workflow_actions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workspaces_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "workspace_integrations_updated_at" BEFORE UPDATE ON "public"."workspace_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_integration_timestamp"();



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_applied_version_id_fkey" FOREIGN KEY ("applied_version_id") REFERENCES "public"."row_versions"("id");



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."table_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."module_definitions"("id");



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_sub_module_id_fkey" FOREIGN KEY ("sub_module_id") REFERENCES "public"."sub_modules"("id");



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_field_suggestions"
    ADD CONSTRAINT "ai_field_suggestions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applicant_folders"
    ADD CONSTRAINT "applicant_folders_form_integration_id_fkey" FOREIGN KEY ("form_integration_id") REFERENCES "public"."form_integration_settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applicant_folders"
    ADD CONSTRAINT "applicant_folders_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_groups"
    ADD CONSTRAINT "application_groups_review_workflow_id_fkey" FOREIGN KEY ("review_workflow_id") REFERENCES "public"."review_workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_groups"
    ADD CONSTRAINT "application_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_stages"
    ADD CONSTRAINT "application_stages_review_workflow_id_fkey" FOREIGN KEY ("review_workflow_id") REFERENCES "public"."review_workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_stages"
    ADD CONSTRAINT "application_stages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_submissions"
    ADD CONSTRAINT "application_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_submissions"
    ADD CONSTRAINT "application_submissions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_submissions"
    ADD CONSTRAINT "application_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ba_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_workflow_execution_logs"
    ADD CONSTRAINT "automation_workflow_execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."automation_workflow_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_workflow_executions"
    ADD CONSTRAINT "automation_workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_workflows"
    ADD CONSTRAINT "automation_workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ba_accounts"
    ADD CONSTRAINT "ba_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ba_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ba_invitations"
    ADD CONSTRAINT "ba_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."ba_users"("id");



ALTER TABLE ONLY "public"."ba_invitations"
    ADD CONSTRAINT "ba_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."ba_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ba_members"
    ADD CONSTRAINT "ba_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."ba_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ba_members"
    ADD CONSTRAINT "ba_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ba_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ba_sessions"
    ADD CONSTRAINT "ba_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ba_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ba_users"
    ADD CONSTRAINT "ba_users_supabase_user_id_fkey" FOREIGN KEY ("supabase_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."batch_operations"
    ADD CONSTRAINT "batch_operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."batch_operations"
    ADD CONSTRAINT "batch_operations_rolled_back_by_fkey" FOREIGN KEY ("rolled_back_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."batch_operations"
    ADD CONSTRAINT "batch_operations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_operations"
    ADD CONSTRAINT "batch_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_approvals"
    ADD CONSTRAINT "change_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."change_approvals"
    ADD CONSTRAINT "change_approvals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."change_approvals"
    ADD CONSTRAINT "change_approvals_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_approvals"
    ADD CONSTRAINT "change_approvals_specific_approver_id_fkey" FOREIGN KEY ("specific_approver_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."change_approvals"
    ADD CONSTRAINT "change_approvals_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_applied_version_id_fkey" FOREIGN KEY ("applied_version_id") REFERENCES "public"."row_versions"("id");



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_statuses"
    ADD CONSTRAINT "custom_statuses_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_statuses"
    ADD CONSTRAINT "custom_statuses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_tags"
    ADD CONSTRAINT "custom_tags_review_workflow_id_fkey" FOREIGN KEY ("review_workflow_id") REFERENCES "public"."review_workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_tags"
    ADD CONSTRAINT "custom_tags_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_tags"
    ADD CONSTRAINT "custom_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_entity_type_fkey" FOREIGN KEY ("entity_type") REFERENCES "public"."entity_types"("id");



ALTER TABLE ONLY "public"."data_tables"
    ADD CONSTRAINT "data_tables_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."data_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."table_rows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_changes"
    ADD CONSTRAINT "field_changes_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."table_fields"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."field_changes"
    ADD CONSTRAINT "field_changes_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_changes"
    ADD CONSTRAINT "field_changes_row_version_id_fkey" FOREIGN KEY ("row_version_id") REFERENCES "public"."row_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_type_registry"
    ADD CONSTRAINT "field_type_registry_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."module_definitions"("id");



ALTER TABLE ONLY "public"."field_type_registry"
    ADD CONSTRAINT "field_type_registry_parent_field_type_fkey" FOREIGN KEY ("parent_field_type") REFERENCES "public"."field_type_registry"("id");



ALTER TABLE ONLY "public"."file_sync_log"
    ADD CONSTRAINT "file_sync_log_applicant_folder_id_fkey" FOREIGN KEY ("applicant_folder_id") REFERENCES "public"."applicant_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_sync_log"
    ADD CONSTRAINT "file_sync_log_table_file_id_fkey" FOREIGN KEY ("table_file_id") REFERENCES "public"."table_files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_workflows"
    ADD CONSTRAINT "fk_default_rubric" FOREIGN KEY ("default_rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."field_type_registry"
    ADD CONSTRAINT "fk_default_semantic_type" FOREIGN KEY ("default_semantic_type") REFERENCES "public"."semantic_field_types"("id");



ALTER TABLE ONLY "public"."form_integration_settings"
    ADD CONSTRAINT "form_integration_settings_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_integration_settings"
    ADD CONSTRAINT "form_integration_settings_workspace_integration_id_fkey" FOREIGN KEY ("workspace_integration_id") REFERENCES "public"."workspace_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_module_configs"
    ADD CONSTRAINT "hub_module_configs_enabled_by_fkey" FOREIGN KEY ("enabled_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hub_module_configs"
    ADD CONSTRAINT "hub_module_configs_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."module_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hub_module_configs"
    ADD CONSTRAINT "hub_module_configs_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_credentials"
    ADD CONSTRAINT "integration_credentials_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."module_field_configs"
    ADD CONSTRAINT "module_field_configs_field_type_id_fkey" FOREIGN KEY ("field_type_id") REFERENCES "public"."field_type_registry"("id");



ALTER TABLE ONLY "public"."module_field_configs"
    ADD CONSTRAINT "module_field_configs_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."module_definitions"("id");



ALTER TABLE ONLY "public"."module_history_settings"
    ADD CONSTRAINT "module_history_settings_hub_module_config_id_fkey" FOREIGN KEY ("hub_module_config_id") REFERENCES "public"."hub_module_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_applicants"
    ADD CONSTRAINT "portal_applicants_ba_user_id_fkey" FOREIGN KEY ("ba_user_id") REFERENCES "public"."ba_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."portal_applicants"
    ADD CONSTRAINT "portal_applicants_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."table_views"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_operations"
    ADD CONSTRAINT "portal_operations_portal_id_fkey" FOREIGN KEY ("portal_id") REFERENCES "public"."table_views"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_workflows"
    ADD CONSTRAINT "review_workflows_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."data_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_workflows"
    ADD CONSTRAINT "review_workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviewer_types"
    ADD CONSTRAINT "reviewer_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_batch_operation_id_fkey" FOREIGN KEY ("batch_operation_id") REFERENCES "public"."batch_operations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."module_definitions"("id");



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_sub_module_id_fkey" FOREIGN KEY ("sub_module_id") REFERENCES "public"."sub_modules"("id");



ALTER TABLE ONLY "public"."row_versions"
    ADD CONSTRAINT "row_versions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."search_index"
    ADD CONSTRAINT "search_index_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_actions"
    ADD CONSTRAINT "stage_actions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_actions"
    ADD CONSTRAINT "stage_actions_target_group_id_fkey" FOREIGN KEY ("target_group_id") REFERENCES "public"."application_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stage_actions"
    ADD CONSTRAINT "stage_actions_target_stage_id_fkey" FOREIGN KEY ("target_stage_id") REFERENCES "public"."application_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stage_groups"
    ADD CONSTRAINT "stage_groups_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_groups"
    ADD CONSTRAINT "stage_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_reviewer_configs"
    ADD CONSTRAINT "stage_reviewer_configs_assigned_rubric_id_fkey" FOREIGN KEY ("assigned_rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stage_reviewer_configs"
    ADD CONSTRAINT "stage_reviewer_configs_reviewer_type_id_fkey" FOREIGN KEY ("reviewer_type_id") REFERENCES "public"."reviewer_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_reviewer_configs"
    ADD CONSTRAINT "stage_reviewer_configs_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stage_reviewer_configs"
    ADD CONSTRAINT "stage_reviewer_configs_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_modules"
    ADD CONSTRAINT "sub_modules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sub_modules"
    ADD CONSTRAINT "sub_modules_data_table_id_fkey" FOREIGN KEY ("data_table_id") REFERENCES "public"."data_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sub_modules"
    ADD CONSTRAINT "sub_modules_hub_id_fkey" FOREIGN KEY ("hub_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_modules"
    ADD CONSTRAINT "sub_modules_parent_module_id_fkey" FOREIGN KEY ("parent_module_id") REFERENCES "public"."module_definitions"("id");



ALTER TABLE ONLY "public"."submission_versions"
    ADD CONSTRAINT "submission_versions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."application_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_fields"
    ADD CONSTRAINT "table_columns_linked_column_id_fkey" FOREIGN KEY ("linked_column_id") REFERENCES "public"."table_fields"("id");



ALTER TABLE ONLY "public"."table_fields"
    ADD CONSTRAINT "table_columns_linked_table_id_fkey" FOREIGN KEY ("linked_table_id") REFERENCES "public"."data_tables"("id");



ALTER TABLE ONLY "public"."table_fields"
    ADD CONSTRAINT "table_columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_fields"
    ADD CONSTRAINT "table_fields_field_type_id_fkey" FOREIGN KEY ("field_type_id") REFERENCES "public"."field_type_registry"("id");



ALTER TABLE ONLY "public"."table_fields"
    ADD CONSTRAINT "table_fields_parent_field_id_fkey" FOREIGN KEY ("parent_field_id") REFERENCES "public"."table_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_files"
    ADD CONSTRAINT "table_files_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."table_fields"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_files"
    ADD CONSTRAINT "table_files_parent_file_id_fkey" FOREIGN KEY ("parent_file_id") REFERENCES "public"."table_files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_files"
    ADD CONSTRAINT "table_files_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_files"
    ADD CONSTRAINT "table_files_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_files"
    ADD CONSTRAINT "table_files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_links"
    ADD CONSTRAINT "table_links_source_column_id_fkey" FOREIGN KEY ("source_column_id") REFERENCES "public"."table_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_links"
    ADD CONSTRAINT "table_links_source_table_id_fkey" FOREIGN KEY ("source_table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_links"
    ADD CONSTRAINT "table_links_target_column_id_fkey" FOREIGN KEY ("target_column_id") REFERENCES "public"."table_fields"("id");



ALTER TABLE ONLY "public"."table_links"
    ADD CONSTRAINT "table_links_target_table_id_fkey" FOREIGN KEY ("target_table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_row_links"
    ADD CONSTRAINT "table_row_links_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."table_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_row_links"
    ADD CONSTRAINT "table_row_links_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_row_links"
    ADD CONSTRAINT "table_row_links_target_row_id_fkey" FOREIGN KEY ("target_row_id") REFERENCES "public"."table_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_rows"
    ADD CONSTRAINT "table_rows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."table_rows"
    ADD CONSTRAINT "table_rows_stage_group_id_fkey" FOREIGN KEY ("stage_group_id") REFERENCES "public"."stage_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_rows"
    ADD CONSTRAINT "table_rows_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_rows"
    ADD CONSTRAINT "table_rows_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."table_views"
    ADD CONSTRAINT "table_views_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."table_views"
    ADD CONSTRAINT "table_views_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tag_automations"
    ADD CONSTRAINT "tag_automations_review_workflow_id_fkey" FOREIGN KEY ("review_workflow_id") REFERENCES "public"."review_workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tag_automations"
    ADD CONSTRAINT "tag_automations_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."application_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tag_automations"
    ADD CONSTRAINT "tag_automations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wf_api_keys"
    ADD CONSTRAINT "wf_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ba_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_review_workflow_id_fkey" FOREIGN KEY ("review_workflow_id") REFERENCES "public"."review_workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_target_group_id_fkey" FOREIGN KEY ("target_group_id") REFERENCES "public"."application_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_target_stage_id_fkey" FOREIGN KEY ("target_stage_id") REFERENCES "public"."application_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workflow_actions"
    ADD CONSTRAINT "workflow_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_webhook_configs"
    ADD CONSTRAINT "workflow_webhook_configs_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."data_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_webhook_configs"
    ADD CONSTRAINT "workflow_webhook_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."ba_users"("id");



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_ba_organization_id_fkey" FOREIGN KEY ("ba_organization_id") REFERENCES "public"."ba_organizations"("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can add organization members" ON "public"."organization_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "organization_members_1"
  WHERE (("organization_members_1"."organization_id" = "organization_members_1"."organization_id") AND ("organization_members_1"."user_id" = "auth"."uid"()) AND ("organization_members_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can manage module configs" ON "public"."hub_module_configs" USING (("table_id" IN ( SELECT "dt"."id"
   FROM ("public"."data_tables" "dt"
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE (("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage row versions" ON "public"."row_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = ( SELECT "data_tables"."workspace_id"
           FROM "public"."data_tables"
          WHERE ("data_tables"."id" = "row_versions"."table_id"))) AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can update organization members" ON "public"."organization_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Anyone can view entity types" ON "public"."entity_types" FOR SELECT USING (true);



CREATE POLICY "Anyone can view metadata schema" ON "public"."metadata_schema" FOR SELECT USING (true);



CREATE POLICY "Anyone can view module definitions" ON "public"."module_definitions" FOR SELECT USING (true);



CREATE POLICY "Anyone can view semantic field types" ON "public"."semantic_field_types" FOR SELECT USING (true);



CREATE POLICY "Delete table_files" ON "public"."table_files" FOR DELETE USING (true);



CREATE POLICY "Field types are readable by all" ON "public"."field_type_registry" FOR SELECT USING (true);



CREATE POLICY "Guest scanner can view columns" ON "public"."table_fields" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Guest scanner can view rows" ON "public"."table_rows" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Guest scanner can view tables" ON "public"."data_tables" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Guest scanner can view workspaces" ON "public"."workspaces" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Insert table_files" ON "public"."table_files" FOR INSERT WITH CHECK (true);



CREATE POLICY "Only superadmins can modify module definitions" ON "public"."module_definitions" USING (false);



CREATE POLICY "Owners can remove organization members" ON "public"."organization_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = 'owner'::"text")))));



CREATE POLICY "Read table_files" ON "public"."table_files" FOR SELECT USING (("deleted_at" IS NULL));



CREATE POLICY "Service can manage embedding queue" ON "public"."embedding_queue" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert organization members" ON "public"."organization_members" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert workspace members" ON "public"."workspace_members" FOR INSERT WITH CHECK (true);



CREATE POLICY "Update table_files" ON "public"."table_files" FOR UPDATE USING (true);



CREATE POLICY "Users can add themselves to organizations" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create columns in their workspaces" ON "public"."table_fields" FOR INSERT WITH CHECK (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create recommendations" ON "public"."recommendation_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create rows in their workspace tables" ON "public"."table_rows" FOR INSERT WITH CHECK (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create search analytics" ON "public"."search_analytics" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "Users can create tables in their workspaces" ON "public"."data_tables" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create workspaces in their organizations" ON "public"."workspaces" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can delete columns in their workspaces" ON "public"."table_fields" FOR DELETE USING (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete recommendations" ON "public"."recommendation_requests" FOR DELETE USING (true);



CREATE POLICY "Users can delete rows in their workspace tables" ON "public"."table_rows" FOR DELETE USING (("table_id" IN ( SELECT "dt"."id"
   FROM "public"."data_tables" "dt"
  WHERE ("dt"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete tables in their workspaces" ON "public"."data_tables" FOR DELETE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = 'admin'::"text")))));



CREATE POLICY "Users can manage configs for editable stages" ON "public"."stage_reviewer_configs" USING (("stage_id" IN ( SELECT "application_stages"."id"
   FROM "public"."application_stages"
  WHERE ("application_stages"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))))));



CREATE POLICY "Users can manage links in editable tables" ON "public"."table_links" USING (("source_table_id" IN ( SELECT "dt"."id"
   FROM ("public"."data_tables" "dt"
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE (("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can manage reviewer types in editable workspaces" ON "public"."reviewer_types" USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can manage row links in editable tables" ON "public"."table_row_links" USING (("link_id" IN ( SELECT "tl"."id"
   FROM (("public"."table_links" "tl"
     JOIN "public"."data_tables" "dt" ON (("tl"."source_table_id" = "dt"."id")))
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE (("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can manage rubrics in editable workspaces" ON "public"."rubrics" USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can manage stages in editable workspaces" ON "public"."application_stages" USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can manage their own views" ON "public"."table_views" USING ((("created_by" = "auth"."uid"()) OR ("table_id" IN ( SELECT "dt"."id"
   FROM ("public"."data_tables" "dt"
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE (("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can manage workflows in editable workspaces" ON "public"."review_workflows" USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can search accessible workspaces" ON "public"."search_index" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update columns in their workspaces" ON "public"."table_fields" FOR UPDATE USING (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"())))))) WITH CHECK (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update recommendations" ON "public"."recommendation_requests" FOR UPDATE USING (true);



CREATE POLICY "Users can update rows in their workspace tables" ON "public"."table_rows" FOR UPDATE USING (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"())))))) WITH CHECK (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update tables in their workspaces" ON "public"."data_tables" FOR UPDATE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update workspaces they have access to" ON "public"."workspaces" FOR UPDATE USING (("id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text"]))))));



CREATE POLICY "Users can view all views in accessible tables" ON "public"."table_views" FOR SELECT USING (("table_id" IN ( SELECT "dt"."id"
   FROM ("public"."data_tables" "dt"
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE ("wm"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view columns in their workspaces" ON "public"."table_fields" FOR SELECT USING (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view configs for accessible stages" ON "public"."stage_reviewer_configs" FOR SELECT USING (("stage_id" IN ( SELECT "application_stages"."id"
   FROM "public"."application_stages"
  WHERE ("application_stages"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view links in accessible tables" ON "public"."table_links" FOR SELECT USING (("source_table_id" IN ( SELECT "dt"."id"
   FROM ("public"."data_tables" "dt"
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE ("wm"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view module configs for accessible tables" ON "public"."hub_module_configs" FOR SELECT USING (("table_id" IN ( SELECT "dt"."id"
   FROM ("public"."data_tables" "dt"
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE ("wm"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view recommendations for their submissions" ON "public"."recommendation_requests" FOR SELECT USING (true);



CREATE POLICY "Users can view reviewer types in accessible workspaces" ON "public"."reviewer_types" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view row links in accessible tables" ON "public"."table_row_links" FOR SELECT USING (("link_id" IN ( SELECT "tl"."id"
   FROM (("public"."table_links" "tl"
     JOIN "public"."data_tables" "dt" ON (("tl"."source_table_id" = "dt"."id")))
     JOIN "public"."workspace_members" "wm" ON (("dt"."workspace_id" = "wm"."workspace_id")))
  WHERE ("wm"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view row versions in their workspace" ON "public"."row_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = ( SELECT "data_tables"."workspace_id"
           FROM "public"."data_tables"
          WHERE ("data_tables"."id" = "row_versions"."table_id"))) AND ("wm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view rows in their workspace tables" ON "public"."table_rows" FOR SELECT USING (("table_id" IN ( SELECT "data_tables"."id"
   FROM "public"."data_tables"
  WHERE ("data_tables"."workspace_id" IN ( SELECT "workspace_members"."workspace_id"
           FROM "public"."workspace_members"
          WHERE ("workspace_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view rubrics in accessible workspaces" ON "public"."rubrics" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view stages in accessible workspaces" ON "public"."application_stages" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view tables in their workspaces" ON "public"."data_tables" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their organization memberships" ON "public"."organization_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their organizations" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own search analytics" ON "public"."search_analytics" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their workspace memberships" ON "public"."workspace_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their workspaces" ON "public"."workspaces" FOR SELECT USING (("id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view workflows in accessible workspaces" ON "public"."review_workflows" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view workspaces in their organizations" ON "public"."workspaces" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Workspace admins can add members" ON "public"."workspace_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "workspace_members_1"
  WHERE (("workspace_members_1"."workspace_id" = "workspace_members_1"."workspace_id") AND ("workspace_members_1"."user_id" = "auth"."uid"()) AND ("workspace_members_1"."role" = 'admin'::"text")))));



CREATE POLICY "Workspace admins can remove members" ON "public"."workspace_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "workspace_members"."workspace_id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = 'admin'::"text")))));



CREATE POLICY "Workspace admins can update members" ON "public"."workspace_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "workspace_members"."workspace_id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = 'admin'::"text")))));



ALTER TABLE "public"."ai_field_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."change_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."embedding_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."field_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."field_type_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hub_module_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metadata_schema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_field_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "module_field_configs_read" ON "public"."module_field_configs" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."module_history_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "module_history_settings_access" ON "public"."module_history_settings" USING ((EXISTS ( SELECT 1
   FROM ("public"."hub_module_configs" "hmc"
     JOIN "public"."data_tables" "dt" ON (("dt"."id" = "hmc"."table_id")))
  WHERE (("hmc"."id" = "module_history_settings"."hub_module_config_id") AND (("dt"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."workspace_members" "wm"
          WHERE (("wm"."workspace_id" = "dt"."workspace_id") AND ("wm"."user_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_workflows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviewer_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."row_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rubrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."semantic_field_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stage_reviewer_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sub_modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sub_modules_access" ON "public"."sub_modules" USING ((EXISTS ( SELECT 1
   FROM "public"."data_tables" "dt"
  WHERE (("dt"."id" = "sub_modules"."hub_id") AND (("dt"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."workspace_members" "wm"
          WHERE (("wm"."workspace_id" = "dt"."workspace_id") AND ("wm"."user_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."table_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_row_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."application_stages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."change_approvals";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."data_tables";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."hub_module_configs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."review_workflows";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reviewer_types";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."row_versions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rubrics";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."search_index";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."stage_reviewer_configs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sub_modules";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."table_fields";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."table_rows";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."table_views";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."archive_row_version"("p_version_id" "uuid", "p_archived_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_row_version"("p_version_id" "uuid", "p_archived_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_row_version"("p_version_id" "uuid", "p_archived_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_create_module_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_create_module_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_create_module_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_detect_semantic_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_detect_semantic_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_detect_semantic_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_enable_default_modules"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_enable_default_modules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_enable_default_modules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_queue_row_for_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_queue_row_for_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_queue_row_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_enable_module"("p_table_id" "uuid", "p_module_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_enable_module"("p_table_id" "uuid", "p_module_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_enable_module"("p_table_id" "uuid", "p_module_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_file_version"("p_parent_file_id" "uuid", "p_filename" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_storage_path" "text", "p_public_url" "text", "p_uploaded_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_file_version"("p_parent_file_id" "uuid", "p_filename" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_storage_path" "text", "p_public_url" "text", "p_uploaded_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_file_version"("p_parent_file_id" "uuid", "p_filename" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_storage_path" "text", "p_public_url" "text", "p_uploaded_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_row_version"("p_row_id" "uuid", "p_table_id" "uuid", "p_data" "jsonb", "p_metadata" "jsonb", "p_change_type" "text", "p_change_reason" "text", "p_changed_by" "uuid", "p_batch_operation_id" "uuid", "p_ai_assisted" boolean, "p_ai_confidence" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."create_row_version"("p_row_id" "uuid", "p_table_id" "uuid", "p_data" "jsonb", "p_metadata" "jsonb", "p_change_type" "text", "p_change_reason" "text", "p_changed_by" "uuid", "p_batch_operation_id" "uuid", "p_ai_assisted" boolean, "p_ai_confidence" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_row_version"("p_row_id" "uuid", "p_table_id" "uuid", "p_data" "jsonb", "p_metadata" "jsonb", "p_change_type" "text", "p_change_reason" "text", "p_changed_by" "uuid", "p_batch_operation_id" "uuid", "p_ai_assisted" boolean, "p_ai_confidence" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_cascade"("target_user_id" "uuid", "reassign_to_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_cascade"("target_user_id" "uuid", "reassign_to_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_cascade"("target_user_id" "uuid", "reassign_to_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_semantic_type"("p_field_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_semantic_type"("p_field_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_semantic_type"("p_field_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_row_searchable_text"("p_row_data" "jsonb", "p_fields" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_row_searchable_text"("p_row_data" "jsonb", "p_fields" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_row_searchable_text"("p_row_data" "jsonb", "p_fields" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_similar"("p_entity_id" "uuid", "p_entity_type" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_similar"("p_entity_id" "uuid", "p_entity_type" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_similar"("p_entity_id" "uuid", "p_entity_type" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_modules"("p_hub_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_modules"("p_hub_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_modules"("p_hub_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_effective_field_config"("p_field_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_effective_field_config"("p_field_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_field_config"("p_field_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hub_module_fields"("p_hub_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_hub_module_fields"("p_hub_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hub_module_fields"("p_hub_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_module_row_history"("p_row_id" "uuid", "p_module_id" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_module_row_history"("p_row_id" "uuid", "p_module_id" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_module_row_history"("p_row_id" "uuid", "p_module_id" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."application_submissions" TO "anon";
GRANT ALL ON TABLE "public"."application_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."application_submissions" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_submission"("p_user_id" "text", "p_form_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_submission"("p_user_id" "text", "p_form_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_submission"("p_user_id" "text", "p_form_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_result_boost"("p_entity_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_result_boost"("p_entity_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_result_boost"("p_entity_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_row_file_stats"("p_row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_row_file_stats"("p_row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_row_file_stats"("p_row_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_row_files"("p_row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_row_files"("p_row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_row_files"("p_row_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_row_history"("p_row_id" "uuid", "p_redact_pii" boolean, "p_include_archived" boolean, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_row_history"("p_row_id" "uuid", "p_redact_pii" boolean, "p_include_archived" boolean, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_row_history"("p_row_id" "uuid", "p_redact_pii" boolean, "p_include_archived" boolean, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_row_version_number"("p_row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_row_version_number"("p_row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_row_version_number"("p_row_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_fields_with_registry"("p_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_fields_with_registry"("p_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_fields_with_registry"("p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_schema_for_ai"("p_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_schema_for_ai"("p_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_schema_for_ai"("p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_summary_for_ai"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_summary_for_ai"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_summary_for_ai"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" real, "p_semantic_weight" real) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" real, "p_semantic_weight" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" real, "p_semantic_weight" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_query_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" double precision, "p_semantic_weight" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_query_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" double precision, "p_semantic_weight" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search"("p_workspace_id" "uuid", "p_query" "text", "p_query_embedding" "public"."vector", "p_filters" "jsonb", "p_limit" integer, "p_keyword_weight" double precision, "p_semantic_weight" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."index_table_row"("p_row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."index_table_row"("p_row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_table_row"("p_row_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_workspace_to_organization"("p_workspace_id" "uuid", "p_owner_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_workspace_to_organization"("p_workspace_id" "uuid", "p_owner_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_workspace_to_organization"("p_workspace_id" "uuid", "p_owner_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_existing_hub_types"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_existing_hub_types"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_existing_hub_types"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_portal_applicants_to_ba_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_portal_applicants_to_ba_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_portal_applicants_to_ba_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_portal_to_view"("p_table_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_portal_to_view"("p_table_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_portal_to_view"("p_table_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_supabase_user_to_better_auth"("p_supabase_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_supabase_user_to_better_auth"("p_supabase_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_supabase_user_to_better_auth"("p_supabase_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_for_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_for_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_for_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_for_embedding"("p_entity_id" "uuid", "p_entity_type" "text", "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."queue_for_embedding"("p_entity_id" "uuid", "p_entity_type" "text", "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_for_embedding"("p_entity_id" "uuid", "p_entity_type" "text", "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_search_index"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_search_index"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_search_index"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."semantic_search"("p_workspace_id" "uuid", "p_embedding" "public"."vector", "p_limit" integer, "p_similarity_threshold" real) TO "anon";
GRANT ALL ON FUNCTION "public"."semantic_search"("p_workspace_id" "uuid", "p_embedding" "public"."vector", "p_limit" integer, "p_similarity_threshold" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."semantic_search"("p_workspace_id" "uuid", "p_embedding" "public"."vector", "p_limit" integer, "p_similarity_threshold" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_search"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."smart_search"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_search"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."smart_search_fuzzy"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."smart_search_fuzzy"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."smart_search_fuzzy"("p_workspace_id" "uuid", "p_query" "text", "p_filters" "jsonb", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_file"("p_file_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_file"("p_file_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_file"("p_file_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_field_type_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_field_type_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_field_type_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_search_click"("p_entity_id" "uuid", "p_entity_type" "text", "p_user_id" "uuid", "p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."track_search_click"("p_entity_id" "uuid", "p_entity_type" "text", "p_user_id" "uuid", "p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_search_click"("p_entity_id" "uuid", "p_entity_type" "text", "p_user_id" "uuid", "p_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_index_row"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_index_row"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_index_row"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_remove_row_index"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_remove_row_index"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_remove_row_index"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_data_tables_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_data_tables_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_data_tables_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_embeddings"("p_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_embeddings"("p_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_embeddings"("p_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integration_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_integration_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integration_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pulse_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pulse_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pulse_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_recommendation_request_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_recommendation_request_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_recommendation_request_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_activity"("session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_activity"("session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_activity"("session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_submission_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_submission_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_submission_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_table_files_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_table_files_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_table_files_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_table_row_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_table_row_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_table_row_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_custom_slug"("slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_custom_slug"("slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_custom_slug"("slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_custom_subdomain"("subdomain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_custom_subdomain"("subdomain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_custom_subdomain"("subdomain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_field_config"("p_field_type_id" "text", "p_config" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_field_config"("p_field_type_id" "text", "p_config" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_field_config"("p_field_type_id" "text", "p_config" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."ai_field_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."ai_field_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_field_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."applicant_folders" TO "anon";
GRANT ALL ON TABLE "public"."applicant_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."applicant_folders" TO "service_role";



GRANT ALL ON TABLE "public"."application_groups" TO "anon";
GRANT ALL ON TABLE "public"."application_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."application_groups" TO "service_role";



GRANT ALL ON TABLE "public"."application_stages" TO "anon";
GRANT ALL ON TABLE "public"."application_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."application_stages" TO "service_role";



GRANT ALL ON TABLE "public"."automation_workflow_execution_logs" TO "anon";
GRANT ALL ON TABLE "public"."automation_workflow_execution_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_workflow_execution_logs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_workflow_executions" TO "anon";
GRANT ALL ON TABLE "public"."automation_workflow_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_workflow_executions" TO "service_role";



GRANT ALL ON TABLE "public"."automation_workflows" TO "anon";
GRANT ALL ON TABLE "public"."automation_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_workflows" TO "service_role";



GRANT ALL ON TABLE "public"."ba_accounts" TO "anon";
GRANT ALL ON TABLE "public"."ba_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."ba_invitations" TO "anon";
GRANT ALL ON TABLE "public"."ba_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."ba_members" TO "anon";
GRANT ALL ON TABLE "public"."ba_members" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_members" TO "service_role";



GRANT ALL ON TABLE "public"."ba_organizations" TO "anon";
GRANT ALL ON TABLE "public"."ba_organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_organizations" TO "service_role";



GRANT ALL ON TABLE "public"."ba_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ba_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."ba_users" TO "anon";
GRANT ALL ON TABLE "public"."ba_users" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_users" TO "service_role";



GRANT ALL ON TABLE "public"."ba_verifications" TO "anon";
GRANT ALL ON TABLE "public"."ba_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."batch_operations" TO "anon";
GRANT ALL ON TABLE "public"."batch_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_operations" TO "service_role";



GRANT ALL ON TABLE "public"."change_approvals" TO "anon";
GRANT ALL ON TABLE "public"."change_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."change_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."change_requests" TO "anon";
GRANT ALL ON TABLE "public"."change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."custom_statuses" TO "anon";
GRANT ALL ON TABLE "public"."custom_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."custom_tags" TO "anon";
GRANT ALL ON TABLE "public"."custom_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_tags" TO "service_role";



GRANT ALL ON TABLE "public"."data_tables" TO "anon";
GRANT ALL ON TABLE "public"."data_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."data_tables" TO "service_role";



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."email_queue" TO "anon";
GRANT ALL ON TABLE "public"."email_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."email_queue" TO "service_role";



GRANT ALL ON TABLE "public"."email_signatures" TO "anon";
GRANT ALL ON TABLE "public"."email_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."email_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."embedding_queue" TO "anon";
GRANT ALL ON TABLE "public"."embedding_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."embedding_queue" TO "service_role";



GRANT ALL ON TABLE "public"."search_index" TO "anon";
GRANT ALL ON TABLE "public"."search_index" TO "authenticated";
GRANT ALL ON TABLE "public"."search_index" TO "service_role";



GRANT ALL ON TABLE "public"."embedding_stats" TO "anon";
GRANT ALL ON TABLE "public"."embedding_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."embedding_stats" TO "service_role";



GRANT ALL ON TABLE "public"."entity_types" TO "anon";
GRANT ALL ON TABLE "public"."entity_types" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_types" TO "service_role";



GRANT ALL ON TABLE "public"."field_changes" TO "anon";
GRANT ALL ON TABLE "public"."field_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."field_changes" TO "service_role";



GRANT ALL ON TABLE "public"."field_type_registry" TO "anon";
GRANT ALL ON TABLE "public"."field_type_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."field_type_registry" TO "service_role";



GRANT ALL ON TABLE "public"."file_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."file_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."file_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."form_integration_settings" TO "anon";
GRANT ALL ON TABLE "public"."form_integration_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."form_integration_settings" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_connections" TO "anon";
GRANT ALL ON TABLE "public"."gmail_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_connections" TO "service_role";



GRANT ALL ON TABLE "public"."hub_module_configs" TO "anon";
GRANT ALL ON TABLE "public"."hub_module_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."hub_module_configs" TO "service_role";



GRANT ALL ON TABLE "public"."integration_credentials" TO "anon";
GRANT ALL ON TABLE "public"."integration_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."metadata_schema" TO "anon";
GRANT ALL ON TABLE "public"."metadata_schema" TO "authenticated";
GRANT ALL ON TABLE "public"."metadata_schema" TO "service_role";



GRANT ALL ON TABLE "public"."module_definitions" TO "anon";
GRANT ALL ON TABLE "public"."module_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."module_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."module_field_configs" TO "anon";
GRANT ALL ON TABLE "public"."module_field_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."module_field_configs" TO "service_role";



GRANT ALL ON TABLE "public"."module_history_settings" TO "anon";
GRANT ALL ON TABLE "public"."module_history_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."module_history_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."portal_applicants" TO "anon";
GRANT ALL ON TABLE "public"."portal_applicants" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_applicants" TO "service_role";



GRANT ALL ON TABLE "public"."portal_operations" TO "anon";
GRANT ALL ON TABLE "public"."portal_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_operations" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_requests" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_requests" TO "service_role";



GRANT ALL ON TABLE "public"."review_workflows" TO "anon";
GRANT ALL ON TABLE "public"."review_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."review_workflows" TO "service_role";



GRANT ALL ON TABLE "public"."reviewer_types" TO "anon";
GRANT ALL ON TABLE "public"."reviewer_types" TO "authenticated";
GRANT ALL ON TABLE "public"."reviewer_types" TO "service_role";



GRANT ALL ON TABLE "public"."row_versions" TO "anon";
GRANT ALL ON TABLE "public"."row_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."row_versions" TO "service_role";



GRANT ALL ON TABLE "public"."rubrics" TO "anon";
GRANT ALL ON TABLE "public"."rubrics" TO "authenticated";
GRANT ALL ON TABLE "public"."rubrics" TO "service_role";



GRANT ALL ON TABLE "public"."search_analytics" TO "anon";
GRANT ALL ON TABLE "public"."search_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."search_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."semantic_field_types" TO "anon";
GRANT ALL ON TABLE "public"."semantic_field_types" TO "authenticated";
GRANT ALL ON TABLE "public"."semantic_field_types" TO "service_role";



GRANT ALL ON TABLE "public"."sent_emails" TO "anon";
GRANT ALL ON TABLE "public"."sent_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."sent_emails" TO "service_role";



GRANT ALL ON TABLE "public"."stage_actions" TO "anon";
GRANT ALL ON TABLE "public"."stage_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_actions" TO "service_role";



GRANT ALL ON TABLE "public"."stage_groups" TO "anon";
GRANT ALL ON TABLE "public"."stage_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_groups" TO "service_role";



GRANT ALL ON TABLE "public"."stage_reviewer_configs" TO "anon";
GRANT ALL ON TABLE "public"."stage_reviewer_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_reviewer_configs" TO "service_role";



GRANT ALL ON TABLE "public"."sub_modules" TO "anon";
GRANT ALL ON TABLE "public"."sub_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_modules" TO "service_role";



GRANT ALL ON TABLE "public"."submission_versions" TO "anon";
GRANT ALL ON TABLE "public"."submission_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_versions" TO "service_role";



GRANT ALL ON TABLE "public"."table_fields" TO "anon";
GRANT ALL ON TABLE "public"."table_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."table_fields" TO "service_role";



GRANT ALL ON TABLE "public"."table_files" TO "anon";
GRANT ALL ON TABLE "public"."table_files" TO "authenticated";
GRANT ALL ON TABLE "public"."table_files" TO "service_role";



GRANT ALL ON TABLE "public"."table_links" TO "anon";
GRANT ALL ON TABLE "public"."table_links" TO "authenticated";
GRANT ALL ON TABLE "public"."table_links" TO "service_role";



GRANT ALL ON TABLE "public"."table_row_links" TO "anon";
GRANT ALL ON TABLE "public"."table_row_links" TO "authenticated";
GRANT ALL ON TABLE "public"."table_row_links" TO "service_role";



GRANT ALL ON TABLE "public"."table_rows" TO "anon";
GRANT ALL ON TABLE "public"."table_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."table_rows" TO "service_role";



GRANT ALL ON TABLE "public"."table_views" TO "anon";
GRANT ALL ON TABLE "public"."table_views" TO "authenticated";
GRANT ALL ON TABLE "public"."table_views" TO "service_role";



GRANT ALL ON TABLE "public"."tag_automations" TO "anon";
GRANT ALL ON TABLE "public"."tag_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_automations" TO "service_role";



GRANT ALL ON TABLE "public"."v_fields_with_effective_config" TO "anon";
GRANT ALL ON TABLE "public"."v_fields_with_effective_config" TO "authenticated";
GRANT ALL ON TABLE "public"."v_fields_with_effective_config" TO "service_role";



GRANT ALL ON TABLE "public"."v_table_files_current" TO "anon";
GRANT ALL ON TABLE "public"."v_table_files_current" TO "authenticated";
GRANT ALL ON TABLE "public"."v_table_files_current" TO "service_role";



GRANT ALL ON TABLE "public"."wf_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."wf_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."wf_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_actions" TO "anon";
GRANT ALL ON TABLE "public"."workflow_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_actions" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_webhook_configs" TO "anon";
GRANT ALL ON TABLE "public"."workflow_webhook_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_webhook_configs" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_integrations" TO "anon";
GRANT ALL ON TABLE "public"."workspace_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


  create policy "Anyone can view avatars"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'user-assets'::text));



  create policy "Authenticated upload workspace-assets"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'workspace-assets'::text));



  create policy "Delete files workspace-assets"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'workspace-assets'::text));



  create policy "Public read workspace-assets"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'workspace-assets'::text));



  create policy "Update own files workspace-assets"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'workspace-assets'::text));



  create policy "Users can delete own avatar"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'user-assets'::text) AND ((storage.foldername(name))[1] = 'avatars'::text) AND (split_part(storage.filename(name), '_'::text, 1) = (auth.uid())::text)));



  create policy "Users can update own avatar"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'user-assets'::text) AND ((storage.foldername(name))[1] = 'avatars'::text) AND (split_part(storage.filename(name), '_'::text, 1) = (auth.uid())::text)));



  create policy "Users can upload own avatar"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'user-assets'::text) AND ((storage.foldername(name))[1] = 'avatars'::text) AND (split_part(storage.filename(name), '_'::text, 1) = (auth.uid())::text)));



