/**
 * Workflow logging functions using Go backend API
 * TODO: Implement proper logging through Go backend API
 */

export type LogStepStartParams = {
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  input?: unknown;
};

export type LogStepStartResult = {
  logId: string;
  startTime: number;
};

/**
 * Log the start of a step execution
 * TODO: Implement via Go backend API
 */
export async function logStepStartDb(
  params: LogStepStartParams
): Promise<LogStepStartResult> {
  console.log('[Workflow] Step started:', params.nodeName);
  return {
    logId: crypto.randomUUID(),
    startTime: Date.now(),
  };
}

export type LogStepCompleteParams = {
  logId: string;
  startTime: number;
  status: "success" | "error";
  output?: unknown;
  error?: string;
};

/**
 * Log the completion of a step execution
 * TODO: Implement via Go backend API
 */
export async function logStepCompleteDb(
  params: LogStepCompleteParams
): Promise<void> {
  const duration = Date.now() - params.startTime;
  console.log('[Workflow] Step completed:', params.status, 'duration:', duration);
}

export type LogWorkflowCompleteParams = {
  executionId: string;
  status: "success" | "error";
  output?: unknown;
  error?: string;
  startTime: number;
};

/**
 * Log the completion of a workflow execution
 * TODO: Implement via Go backend API
 */
export async function logWorkflowCompleteDb(
  params: LogWorkflowCompleteParams
): Promise<void> {
  const duration = Date.now() - params.startTime;
  console.log('[Workflow] Workflow completed:', params.status, 'duration:', duration);
}

