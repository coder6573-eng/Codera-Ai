import { KiloAgentProvider } from './kiloProvider';
import { createAgentPlatformSession } from './platform';
import { CoderaAgentRuntime } from './runtime';
import { createWorkspaceTools } from './tools';
import type { AgentEvent, AgentFile, AgentMode, AgentRunOptions, AgentRunResult } from './types';

export interface CoderaAgentTask {
  projectId: string;
  projectName: string;
  prompt: string;
  mode?: AgentMode;
  files: AgentFile[];
  plan?: string[];
  signal?: AbortSignal;
  approval?: AgentRunOptions['approval'];
  onEvent?: (event: AgentEvent) => void;
}

export interface CoderaAgentTaskResult {
  run: AgentRunResult;
  files: AgentFile[];
  platform: 'web' | 'desktop' | 'android';
}

/**
 * Execute one agent task against the active Codera project.
 * Native desktop projects are mirrored to a private on-device workspace first;
 * browser projects use an isolated in-memory workspace and are returned as files.
 */
export async function runCoderaAgentTask(task: CoderaAgentTask): Promise<CoderaAgentTaskResult> {
  const session = await createAgentPlatformSession(task.projectId, task.files);
  const tools = createWorkspaceTools(session.platform);
  const provider = new KiloAgentProvider(tools);
  const runtime = new CoderaAgentRuntime(provider, session.platform);
  const run = await runtime.run({
    mode: task.mode || 'build',
    prompt: task.prompt,
    projectName: task.projectName,
    files: task.files,
    plan: task.plan,
  }, {
    signal: task.signal,
    approval: task.approval,
    onEvent: task.onEvent,
  });
  const files = await session.collectFiles();
  return {
    run,
    files,
    platform: session.platform.id,
  };
}

export * from './types';
export { CoderaAgentRuntime } from './runtime';
export { createAgentPlatformSession } from './platform';
