// @ts-nocheck - Disable type checking for crypto buffer types
// Node.js crypto module has compatibility issues with strict Buffer types

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";

// Database connection - reuse pool across requests
const globalForDb = globalThis as unknown as {
  workflowPool: Pool | undefined;
};

function getPool(): Pool {
  if (!globalForDb.workflowPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.workflowPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return globalForDb.workflowPool;
}

// ========================================
// ID GENERATION
// ========================================

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 21;

export function generateId(): string {
  let result = "";
  const bytes = randomBytes(ID_LENGTH);
  for (let i = 0; i < ID_LENGTH; i++) {
    result += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return result;
}

// ========================================
// ENCRYPTION CONFIGURATION
// ========================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const ENCRYPTION_KEY_ENV = "INTEGRATION_ENCRYPTION_KEY";

function getEncryptionKey(): Buffer {
  const keyHex = process.env[ENCRYPTION_KEY_ENV];

  if (!keyHex) {
    // Generate a default key for development (in production this should be set!)
    console.warn(
      `WARNING: ${ENCRYPTION_KEY_ENV} not set. Using default key (NOT SECURE FOR PRODUCTION)`
    );
    return Buffer.from(
      "0000000000000000000000000000000000000000000000000000000000000000",
      "hex"
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} must be a 64-character hex string (32 bytes)`
    );
  }

  return Buffer.from(keyHex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

function encryptConfig(config: Record<string, unknown>): string {
  return encrypt(JSON.stringify(config));
}

function decryptConfig(encryptedConfig: string): Record<string, unknown> {
  try {
    const decrypted = decrypt(encryptedConfig);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Failed to decrypt config:", error);
    return {};
  }
}

// ========================================
// TYPES
// ========================================

import type { IntegrationConfig, IntegrationType } from "@/lib/types/integration";

export type DbUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
};

export type DbIntegration = {
  id: string;
  user_id: string;
  name: string;
  type: IntegrationType;
  config: IntegrationConfig;
  is_managed: boolean | null;
  created_at: Date;
  updated_at: Date;
};

export type DbApiKey = {
  id: string;
  user_id: string;
  name: string | null;
  key_hash: string;
  key_prefix: string;
  created_at: Date;
  last_used_at: Date | null;
};

export type DbWorkflow = {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  workspace_id: string;
  nodes: unknown[];
  edges: unknown[];
  visibility: "private" | "public" | "workspace";
  trigger_type: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type DbWorkflowExecution = {
  id: string;
  workflow_id: string;
  user_id: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  trigger_type: string | null;
  trigger_data: unknown | null;
  output: unknown | null;
  error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration: number;
  created_at: Date;
  updated_at: Date;
};

export type DbWorkflowExecutionLog = {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string | null;
  node_label: string | null;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: unknown | null;
  output: unknown | null;
  error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration: number;
  created_at: Date;
};

// ========================================
// USER QUERIES
// ========================================

export async function getUser(userId: string): Promise<DbUser | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, email, image, email_verified, created_at, updated_at 
     FROM ba_users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateUser(
  userId: string,
  updates: { name?: string; email?: string }
): Promise<boolean> {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }

  if (setClauses.length === 0) return true;

  setClauses.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await pool.query(
    `UPDATE ba_users SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
    values
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUserAccount(userId: string): Promise<{ provider_id: string } | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT provider_id FROM ba_accounts WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// ========================================
// INTEGRATION QUERIES
// ========================================

export async function getIntegrations(
  userId: string,
  type?: IntegrationType
): Promise<DbIntegration[]> {
  const pool = getPool();
  let query = `
    SELECT id, user_id, name, type, credentials as config, is_active as is_managed, created_at, updated_at
    FROM integration_credentials
    WHERE user_id = $1
  `;
  const params: unknown[] = [userId];

  if (type) {
    query += ` AND integration_type = $2`;
    params.push(type);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, params);

  return result.rows.map((row) => ({
    ...row,
    config: typeof row.config === "string" ? decryptConfig(row.config) : row.config,
  }));
}

export async function getIntegration(
  integrationId: string,
  userId: string
): Promise<DbIntegration | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, name, integration_type as type, credentials as config, is_active as is_managed, created_at, updated_at
     FROM integration_credentials
     WHERE id = $1 AND user_id = $2`,
    [integrationId, userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    config: typeof row.config === "string" ? decryptConfig(row.config) : row.config,
  };
}

export async function getIntegrationById(
  integrationId: string
): Promise<DbIntegration | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, name, integration_type as type, credentials as config, is_active as is_managed, created_at, updated_at
     FROM integration_credentials
     WHERE id = $1`,
    [integrationId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    config: typeof row.config === "string" ? decryptConfig(row.config) : row.config,
  };
}

export async function createIntegration(
  userId: string,
  name: string,
  type: IntegrationType,
  config: IntegrationConfig,
  workspaceId?: string
): Promise<DbIntegration> {
  const pool = getPool();
  const id = generateId();
  const encryptedConfig = encryptConfig(config);

  // Try to insert with workspace_id first, fall back to NULL if it fails
  // This handles both cases where workspace_id is required or nullable
  try {
    const result = await pool.query(
      `INSERT INTO integration_credentials (id, user_id, workspace_id, name, integration_type, credentials, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, user_id, name, integration_type as type, credentials as config, is_active as is_managed, created_at, updated_at`,
      [id, userId, workspaceId || null, name, type, encryptedConfig]
    );

    return {
      ...result.rows[0],
      config,
    };
  } catch (error) {
    // If the error is about NOT NULL constraint on workspace_id, try a user-level table or throw a better error
    if (error instanceof Error && error.message.includes('null value in column "workspace_id"')) {
      // Try to get the user's first workspace as a fallback
      const workspaceResult = await pool.query(
        `SELECT w.id FROM workspaces w
         JOIN workspace_members wm ON w.id = wm.workspace_id
         WHERE wm.user_id = $1
         LIMIT 1`,
        [userId]
      );
      
      if (workspaceResult.rows.length > 0) {
        const result = await pool.query(
          `INSERT INTO integration_credentials (id, user_id, workspace_id, name, integration_type, credentials, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id, user_id, name, integration_type as type, credentials as config, is_active as is_managed, created_at, updated_at`,
          [id, userId, workspaceResult.rows[0].id, name, type, encryptedConfig]
        );

        return {
          ...result.rows[0],
          config,
        };
      }
    }
    throw error;
  }
}

export async function updateIntegration(
  integrationId: string,
  userId: string,
  updates: { name?: string; config?: IntegrationConfig }
): Promise<DbIntegration | null> {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.config !== undefined) {
    setClauses.push(`credentials = $${paramIndex++}`);
    values.push(encryptConfig(updates.config));
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = NOW()`);
  values.push(integrationId, userId);

  const result = await pool.query(
    `UPDATE integration_credentials 
     SET ${setClauses.join(", ")} 
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING id, user_id, name, integration_type as type, credentials as config, is_active as is_managed, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    config: updates.config || (typeof row.config === "string" ? decryptConfig(row.config) : row.config),
  };
}

export async function deleteIntegration(
  integrationId: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM integration_credentials WHERE id = $1 AND user_id = $2`,
    [integrationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ========================================
// API KEY QUERIES
// ========================================

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(24).toString("base64url");
  const key = `wfb_${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 11);
  return { key, hash, prefix };
}

export async function getApiKeys(userId: string): Promise<DbApiKey[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, name, key_hash, key_prefix, created_at, last_used_at
     FROM wf_api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function createApiKey(
  userId: string,
  name?: string
): Promise<DbApiKey & { key: string }> {
  const pool = getPool();
  const id = generateId();
  const { key, hash, prefix } = generateApiKey();

  const result = await pool.query(
    `INSERT INTO wf_api_keys (id, user_id, name, key_hash, key_prefix, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, user_id, name, key_hash, key_prefix, created_at, last_used_at`,
    [id, userId, name || null, hash, prefix]
  );

  return {
    ...result.rows[0],
    key,
  };
}

export async function deleteApiKey(
  keyId: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM wf_api_keys WHERE id = $1 AND user_id = $2`,
    [keyId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function validateApiKey(
  apiKey: string
): Promise<{ userId: string; keyId: string } | null> {
  const pool = getPool();
  const hash = createHash("sha256").update(apiKey).digest("hex");

  const result = await pool.query(
    `UPDATE wf_api_keys SET last_used_at = NOW()
     WHERE key_hash = $1
     RETURNING id, user_id`,
    [hash]
  );

  if (result.rows.length === 0) return null;

  return {
    userId: result.rows[0].user_id,
    keyId: result.rows[0].id,
  };
}

// ========================================
// WORKFLOW QUERIES
// ========================================

export async function getWorkflows(userId: string): Promise<DbWorkflow[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, description, user_id, workspace_id, nodes, edges, visibility, trigger_type, is_active, created_at, updated_at
     FROM automation_workflows
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getWorkflow(workflowId: string): Promise<DbWorkflow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, description, user_id, workspace_id, nodes, edges, visibility, trigger_type, is_active, created_at, updated_at
     FROM automation_workflows
     WHERE id = $1`,
    [workflowId]
  );
  return result.rows[0] || null;
}

export async function getWorkflowByUser(
  workflowId: string,
  userId: string
): Promise<DbWorkflow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, description, user_id, workspace_id, nodes, edges, visibility, trigger_type, is_active, created_at, updated_at
     FROM automation_workflows
     WHERE id = $1 AND user_id = $2`,
    [workflowId, userId]
  );
  return result.rows[0] || null;
}

export async function createWorkflow(
  userId: string,
  workspaceId: string,
  data: {
    name: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
    visibility?: "private" | "public" | "workspace";
  }
): Promise<DbWorkflow> {
  const pool = getPool();
  const id = generateId();

  const result = await pool.query(
    `INSERT INTO automation_workflows (id, user_id, workspace_id, name, description, nodes, edges, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      id,
      userId,
      workspaceId,
      data.name,
      data.description || null,
      JSON.stringify(data.nodes),
      JSON.stringify(data.edges),
      data.visibility || "private",
    ]
  );
  return result.rows[0];
}

export async function updateWorkflow(
  workflowId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
    visibility?: "private" | "public" | "workspace";
  }
): Promise<DbWorkflow | null> {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.nodes !== undefined) {
    setClauses.push(`nodes = $${paramIndex++}`);
    values.push(JSON.stringify(updates.nodes));
  }
  if (updates.edges !== undefined) {
    setClauses.push(`edges = $${paramIndex++}`);
    values.push(JSON.stringify(updates.edges));
  }
  if (updates.visibility !== undefined) {
    setClauses.push(`visibility = $${paramIndex++}`);
    values.push(updates.visibility);
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = NOW()`);
  values.push(workflowId, userId);

  const result = await pool.query(
    `UPDATE automation_workflows 
     SET ${setClauses.join(", ")} 
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

export async function deleteWorkflow(
  workflowId: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM automation_workflows WHERE id = $1 AND user_id = $2`,
    [workflowId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function duplicateWorkflow(
  workflowId: string,
  userId: string
): Promise<DbWorkflow | null> {
  const pool = getPool();
  const original = await getWorkflowByUser(workflowId, userId);
  if (!original) return null;

  const id = generateId();
  const result = await pool.query(
    `INSERT INTO automation_workflows (id, user_id, workspace_id, name, description, nodes, edges, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'private', NOW(), NOW())
     RETURNING *`,
    [
      id,
      userId,
      original.workspace_id,
      `${original.name} (Copy)`,
      original.description,
      JSON.stringify(original.nodes),
      JSON.stringify(original.edges),
    ]
  );
  return result.rows[0];
}

// ========================================
// WORKFLOW EXECUTION QUERIES
// ========================================

export async function createExecution(
  workflowId: string,
  userId: string,
  input?: Record<string, unknown>
): Promise<DbWorkflowExecution> {
  const pool = getPool();
  const id = generateId();

  const result = await pool.query(
    `INSERT INTO automation_workflow_executions (id, workflow_id, user_id, status, trigger_data, started_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW(), NOW())
     RETURNING *`,
    [id, workflowId, userId, input ? JSON.stringify(input) : null]
  );
  return result.rows[0];
}

export async function updateExecution(
  executionId: string,
  updates: {
    status?: string;
    output?: unknown;
    error?: string;
    completedAt?: Date;
    duration?: number;
  }
): Promise<DbWorkflowExecution | null> {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.output !== undefined) {
    setClauses.push(`output = $${paramIndex++}`);
    values.push(JSON.stringify(updates.output));
  }
  if (updates.error !== undefined) {
    setClauses.push(`error = $${paramIndex++}`);
    values.push(updates.error);
  }
  if (updates.completedAt !== undefined) {
    setClauses.push(`completed_at = $${paramIndex++}`);
    values.push(updates.completedAt);
  }
  if (updates.duration !== undefined) {
    setClauses.push(`duration = $${paramIndex++}`);
    values.push(updates.duration);
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = NOW()`);
  values.push(executionId);

  const result = await pool.query(
    `UPDATE automation_workflow_executions 
     SET ${setClauses.join(", ")} 
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

export async function getExecutions(workflowId: string): Promise<DbWorkflowExecution[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM automation_workflow_executions
     WHERE workflow_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [workflowId]
  );
  return result.rows;
}

export async function getExecution(executionId: string): Promise<DbWorkflowExecution | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM automation_workflow_executions WHERE id = $1`,
    [executionId]
  );
  return result.rows[0] || null;
}

export async function deleteExecutions(workflowId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM automation_workflow_executions WHERE workflow_id = $1`,
    [workflowId]
  );
  return result.rowCount ?? 0;
}

// ========================================
// EXECUTION LOG QUERIES
// ========================================

export async function createExecutionLog(
  executionId: string,
  nodeId: string,
  nodeType: string,
  nodeLabel: string
): Promise<DbWorkflowExecutionLog> {
  const pool = getPool();
  const id = generateId();

  const result = await pool.query(
    `INSERT INTO automation_workflow_execution_logs (id, execution_id, node_id, node_type, node_label, status, started_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
     RETURNING *`,
    [id, executionId, nodeId, nodeType, nodeLabel]
  );
  return result.rows[0];
}

export async function updateExecutionLog(
  logId: string,
  updates: {
    status?: string;
    input?: unknown;
    output?: unknown;
    error?: string;
    completedAt?: Date;
    duration?: number;
  }
): Promise<DbWorkflowExecutionLog | null> {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.input !== undefined) {
    setClauses.push(`input = $${paramIndex++}`);
    values.push(JSON.stringify(updates.input));
  }
  if (updates.output !== undefined) {
    setClauses.push(`output = $${paramIndex++}`);
    values.push(JSON.stringify(updates.output));
  }
  if (updates.error !== undefined) {
    setClauses.push(`error = $${paramIndex++}`);
    values.push(updates.error);
  }
  if (updates.completedAt !== undefined) {
    setClauses.push(`completed_at = $${paramIndex++}`);
    values.push(updates.completedAt);
  }
  if (updates.duration !== undefined) {
    setClauses.push(`duration = $${paramIndex++}`);
    values.push(updates.duration);
  }

  if (setClauses.length === 0) return null;

  values.push(logId);

  const result = await pool.query(
    `UPDATE automation_workflow_execution_logs 
     SET ${setClauses.join(", ")} 
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

export async function getExecutionLogs(executionId: string): Promise<DbWorkflowExecutionLog[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM automation_workflow_execution_logs
     WHERE execution_id = $1
     ORDER BY created_at ASC`,
    [executionId]
  );
  return result.rows;
}

export async function getExecutionWithWorkflow(executionId: string): Promise<{
  execution: DbWorkflowExecution;
  workflow: DbWorkflow;
} | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT 
       e.*,
       w.id as w_id, w.name as w_name, w.nodes as w_nodes, w.edges as w_edges
     FROM automation_workflow_executions e
     JOIN automation_workflows w ON e.workflow_id = w.id
     WHERE e.id = $1`,
    [executionId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    execution: {
      id: row.id,
      workflow_id: row.workflow_id,
      user_id: row.user_id,
      status: row.status,
      trigger_type: row.trigger_type,
      trigger_data: row.trigger_data,
      output: row.output,
      error: row.error,
      started_at: row.started_at,
      completed_at: row.completed_at,
      duration: row.duration,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    workflow: {
      id: row.w_id,
      name: row.w_name,
      nodes: row.w_nodes,
      edges: row.w_edges,
    } as DbWorkflow,
  };
}

// ========================================
// VALIDATION HELPERS
// ========================================

type WorkflowNodeForValidation = {
  data?: {
    config?: {
      integrationId?: string;
    };
  };
};

export function extractIntegrationIds(nodes: WorkflowNodeForValidation[]): string[] {
  const integrationIds: string[] = [];

  for (const node of nodes) {
    const integrationId = node.data?.config?.integrationId;
    if (integrationId && typeof integrationId === "string") {
      integrationIds.push(integrationId);
    }
  }

  return [...new Set(integrationIds)];
}

export async function validateWorkflowIntegrations(
  nodes: WorkflowNodeForValidation[],
  userId: string
): Promise<{ valid: boolean; invalidIds?: string[] }> {
  const integrationIds = extractIntegrationIds(nodes);

  if (integrationIds.length === 0) {
    return { valid: true };
  }

  const pool = getPool();
  const placeholders = integrationIds.map((_, i) => `$${i + 1}`).join(", ");

  const result = await pool.query(
    `SELECT id, user_id FROM integration_credentials WHERE id IN (${placeholders})`,
    integrationIds
  );

  const invalidIds = result.rows
    .filter((i: { user_id: string }) => i.user_id !== userId)
    .map((i: { id: string }) => i.id);

  if (invalidIds.length > 0) {
    return { valid: false, invalidIds };
  }

  return { valid: true };
}

// ========================================
// WORKFLOW COUNT FOR NAMING
// ========================================

export async function getWorkflowCount(userId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM automation_workflows WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

// ========================================
// CURRENT WORKFLOW (AUTO-SAVE)
// ========================================

const CURRENT_WORKFLOW_NAME = "~~__CURRENT__~~";

export async function getCurrentWorkflow(userId: string): Promise<DbWorkflow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM automation_workflows 
     WHERE name = $1 AND user_id = $2 
     ORDER BY updated_at DESC LIMIT 1`,
    [CURRENT_WORKFLOW_NAME, userId]
  );
  return result.rows[0] || null;
}

export async function saveCurrentWorkflow(
  userId: string,
  nodes: unknown[],
  edges: unknown[],
  workspaceId?: string
): Promise<DbWorkflow> {
  const pool = getPool();

  // Check if current workflow exists
  const existing = await getCurrentWorkflow(userId);

  if (existing) {
    // Update existing
    const result = await pool.query(
      `UPDATE automation_workflows 
       SET nodes = $1, edges = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(nodes), JSON.stringify(edges), existing.id]
    );
    return result.rows[0];
  }

  // Create new
  const id = generateId();
  const result = await pool.query(
    `INSERT INTO automation_workflows (id, user_id, workspace_id, name, description, nodes, edges, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'private', NOW(), NOW())
     RETURNING *`,
    [
      id,
      userId,
      workspaceId || userId,
      CURRENT_WORKFLOW_NAME,
      "Auto-saved current workflow",
      JSON.stringify(nodes),
      JSON.stringify(edges),
    ]
  );
  return result.rows[0];
}
