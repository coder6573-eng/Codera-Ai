/**
 * Codera Agent Runtime — shared contracts.
 *
 * The runtime is deliberately provider-neutral. Model adapters produce the same
 * structured actions, while platform adapters decide which tools are available.
 * No tool is allowed to access the host process unless the native bridge exposes it.
 */

export type AgentMode = 'plan' | 'build' | 'verify' | 'repair';
export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';
export type AgentRunStatus = 'idle' | 'running' | 'waiting_for_tool' | 'completed' | 'failed' | 'cancelled';
export type AgentEventKind =
  | 'run_started'
  | 'step_started'
  | 'thinking'
  | 'tool_started'
  | 'tool_completed'
  | 'tool_failed'
  | 'file_changed'
  | 'verification_started'
  | 'verification_completed'
  | 'run_completed'
  | 'run_failed'
  | 'run_cancelled';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  name?: string;
  toolCallId?: string;
  createdAt: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentTurn {
  message: string;
  toolCalls: AgentToolCall[];
  finishReason: 'tool_calls' | 'stop' | 'length' | 'unknown';
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AgentFile {
  path: string;
  content: string;
  language?: string;
  size?: number;
  modifiedAt?: number;
}

export interface AgentWorkspace {
  id: string;
  name: string;
  rootPath?: string;
  files: AgentFile[];
  metadata?: Record<string, unknown>;
}

export interface AgentProjectContext {
  workspace: AgentWorkspace;
  projectId: string;
  projectName: string;
  mode: AgentMode;
  userRequest: string;
  approvedPlan: string[];
  previousMessages: AgentMessage[];
  selectedPaths: string[];
}

export interface AgentToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
  error?: string;
  changedFiles?: string[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiresApproval?: boolean;
  destructive?: boolean;
  execute(args: Record<string, unknown>, context: AgentToolContext): Promise<AgentToolResult>;
}

export interface AgentToolContext {
  runId: string;
  workspace: AgentWorkspace;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
  requestApproval?: (tool: string, args: Record<string, unknown>) => Promise<boolean>;
}

export interface AgentEvent {
  id: string;
  runId: string;
  kind: AgentEventKind;
  timestamp: number;
  step: number;
  message: string;
  toolName?: string;
  toolCallId?: string;
  path?: string;
  data?: Record<string, unknown>;
}

export interface AgentRunOptions {
  runId?: string;
  maxSteps?: number;
  maxToolCalls?: number;
  maxContextCharacters?: number;
  maxFileBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  approval?: (tool: string, args: Record<string, unknown>) => Promise<boolean>;
  onEvent?: (event: AgentEvent) => void;
}

export interface AgentRunResult {
  runId: string;
  status: AgentRunStatus;
  summary: string;
  messages: AgentMessage[];
  events: AgentEvent[];
  changedFiles: string[];
  steps: number;
  toolCalls: number;
  error?: string;
}

export interface AgentProvider {
  readonly id: string;
  readonly label: string;
  complete(input: {
    mode: AgentMode;
    messages: AgentMessage[];
    tools: Array<Pick<AgentToolDefinition, 'name' | 'description' | 'inputSchema'>>;
    signal: AbortSignal;
  }): Promise<AgentTurn>;
}

export interface AgentPlatform {
  readonly id: 'web' | 'desktop' | 'android';
  readonly capabilities: ReadonlySet<'filesystem' | 'terminal' | 'git' | 'search' | 'preview' | 'diagnostics'>;
  readFile(path: string, signal: AbortSignal): Promise<string>;
  writeFile(path: string, content: string, signal: AbortSignal): Promise<void>;
  deleteFile(path: string, signal: AbortSignal): Promise<void>;
  listFiles(signal: AbortSignal): Promise<string[]>;
  runCommand?(command: string, args: string[], cwd: string, signal: AbortSignal, approved?: boolean): Promise<{ code: number; stdout: string; stderr: string }>;
  searchFiles?(query: string, signal: AbortSignal): Promise<Array<{ path: string; line: number; text: string }>>;
  verifyBrowser?(path: string, signal: AbortSignal): Promise<{ browser: string; entry: string; passed: boolean; results: Array<Record<string, unknown>> }>;
}

export const AGENT_LIMITS = Object.freeze({
  maxSteps: 18,
  maxToolCalls: 36,
  maxContextCharacters: 90000,
  maxFileBytes: 500000,
  maxWorkspaceFiles: 250,
  maxOutputCharacters: 24000,
  defaultTimeoutMs: 180000,
});

export const createAgentId = (prefix = 'agent') =>
  prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
