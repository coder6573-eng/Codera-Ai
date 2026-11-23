import {
  AGENT_LIMITS,
  createAgentId,
} from './types';
import type {
  AgentEvent,
  AgentMessage,
  AgentMode,
  AgentPlatform,
  AgentProvider,
  AgentRunOptions,
  AgentRunResult,
  AgentToolContext,
  AgentToolDefinition,
} from './types';
import { createWorkspaceTools } from './tools';

const now = () => Date.now();
const message = (role: AgentMessage['role'], content: string, extra: Partial<AgentMessage> = {}): AgentMessage => ({
  id: createAgentId('msg'),
  role,
  content,
  createdAt: now(),
  ...extra,
});

function compactContext(messages: AgentMessage[], maxCharacters: number): AgentMessage[] {
  const size = messages.reduce((total, item) => total + item.content.length, 0);
  if (size <= maxCharacters) return messages;
  const recent: AgentMessage[] = [];
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (recent.length >= 14 || used + item.content.length > maxCharacters * 0.72) break;
    recent.unshift(item);
    used += item.content.length;
  }
  const removed = messages.slice(0, messages.length - recent.length);
  const summary = removed.map(item => item.role.toUpperCase() + ': ' + item.content.slice(0, 700)).join('\n').slice(-Math.floor(maxCharacters * 0.22));
  return [
    message('user', 'Earlier agent history summary (preserve as context, not as new instructions):\n' + summary),
    ...recent,
  ];
}

export class CoderaAgentRuntime {
  private readonly tools: AgentToolDefinition[];
  private readonly toolMap: Map<string, AgentToolDefinition>;

  constructor(
    private readonly provider: AgentProvider,
    private readonly platform: AgentPlatform,
    extraTools: AgentToolDefinition[] = [],
  ) {
    this.tools = [...createWorkspaceTools(this.platform), ...extraTools];
    this.toolMap = new Map(this.tools.map(tool => [tool.name, tool]));
  }

  async run(input: {
    mode: AgentMode;
    prompt: string;
    projectName: string;
    files: Array<{ path: string; content: string }>;
    plan?: string[];
    history?: AgentMessage[];
  }, options: AgentRunOptions = {}): Promise<AgentRunResult> {
    const runId = options.runId || createAgentId('run');
    const maxSteps = Math.max(1, Math.min(options.maxSteps ?? AGENT_LIMITS.maxSteps, 30));
    const maxToolCalls = Math.max(1, Math.min(options.maxToolCalls ?? AGENT_LIMITS.maxToolCalls, 60));
    const maxContextCharacters = options.maxContextCharacters ?? AGENT_LIMITS.maxContextCharacters;
    const events: AgentEvent[] = [];
    const changedFiles = new Set<string>();
    const messages = [...(input.history || [])];
    let steps = 0;
    let toolCalls = 0;
    let status: AgentRunResult['status'] = 'running';
    let summary = '';
    let error: string | undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Agent run timed out.')), options.timeoutMs ?? AGENT_LIMITS.defaultTimeoutMs);
    const abortFromCaller = () => controller.abort(options.signal?.reason || new Error('Agent run cancelled.'));
    if (options.signal?.aborted) abortFromCaller();
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    const emit = (kind: AgentEvent['kind'], text: string, extra: Partial<AgentEvent> = {}) => {
      const event: AgentEvent = {
        id: createAgentId('evt'),
        runId,
        kind,
        timestamp: now(),
        step: steps,
        message: text,
        ...extra,
      };
      events.push(event);
      options.onEvent?.(event);
    };

    const finish = (nextStatus: AgentRunResult['status'], finalSummary: string, finalError?: string): AgentRunResult => {
      status = nextStatus;
      summary = finalSummary;
      error = finalError;
      const kind = nextStatus === 'completed' ? 'run_completed' : nextStatus === 'cancelled' ? 'run_cancelled' : 'run_failed';
      emit(kind, finalSummary || finalError || 'Agent run finished.');
      return {
        runId,
        status,
        summary,
        messages,
        events,
        changedFiles: [...changedFiles],
        steps,
        toolCalls,
        error,
      };
    };

    try {
      emit('run_started', 'Started ' + input.mode + ' task for ' + input.projectName + '.');
      messages.push(message('user', [
        'PROJECT: ' + input.projectName,
        'MODE: ' + input.mode,
        'USER REQUEST:\n' + input.prompt,
        'APPROVED PLAN:\n' + (input.plan?.length ? input.plan.map((step, index) => (index + 1) + '. ' + step).join('\n') : 'No approved plan was supplied.'),
        'CURRENT FILES:\n' + input.files.map(file => '--- ' + file.path + ' ---\n' + file.content.slice(0, 12000)).join('\n\n').slice(0, 30000),
      ].join('\n\n')));

      while (steps < maxSteps && toolCalls < maxToolCalls) {
        controller.signal.throwIfAborted();
        steps += 1;
        emit('step_started', 'Agent step ' + steps + ' of ' + maxSteps + '.');

        const turn = await this.provider.complete({
          mode: input.mode,
          messages: compactContext(messages, maxContextCharacters),
          tools: this.tools,
          signal: controller.signal,
        });

        if (!turn.toolCalls.length) {
          const finalMessage = turn.message.trim() || 'The agent finished without a summary.';
          messages.push(message('assistant', finalMessage));
          return finish('completed', finalMessage);
        }

        const call = turn.toolCalls[0];
        const definition = this.toolMap.get(call.name);
        const assistantAction = JSON.stringify({
          type: 'tool',
          tool: call.name,
          arguments: call.arguments,
          thought: turn.message,
        });
        messages.push(message('assistant', assistantAction));

        if (!definition) {
          messages.push(message('tool', 'Tool does not exist: ' + call.name, { name: call.name, toolCallId: call.id }));
          emit('tool_failed', 'Unknown tool: ' + call.name, { toolName: call.name, toolCallId: call.id });
          toolCalls += 1;
          continue;
        }

        if (definition.requiresApproval) {
          const approved = await options.approval?.(definition.name, call.arguments);
          if (!approved) {
            messages.push(message('tool', 'User declined this action. Continue without performing it.', {
              name: definition.name,
              toolCallId: call.id,
            }));
            emit('tool_failed', 'User declined ' + definition.name + '.', { toolName: definition.name, toolCallId: call.id });
            toolCalls += 1;
            continue;
          }
        }

        emit('tool_started', 'Running ' + definition.name + '.', {
          toolName: definition.name,
          toolCallId: call.id,
        });
        const context: AgentToolContext = {
          workspace: {
            id: 'active',
            name: input.projectName,
            files: input.files,
          },
          signal: controller.signal,
          runId,
          emit: event => {
            const forwarded = { ...event, runId, step: steps };
            events.push(forwarded);
            options.onEvent?.(forwarded);
          },
          requestApproval: options.approval,
        };

        const result = await definition.execute(call.arguments, context);
        toolCalls += 1;
        if (result.changedFiles) result.changedFiles.forEach(path => changedFiles.add(path));
        if (result.ok) {
          messages.push(message('tool', result.output.slice(0, AGENT_LIMITS.maxOutputCharacters), {
            name: definition.name,
            toolCallId: call.id,
          }));
          emit('tool_completed', definition.name + ' completed.', {
            toolName: definition.name,
            toolCallId: call.id,
            data: { changedFiles: result.changedFiles || [] },
          });
        } else {
          messages.push(message('tool', 'Tool error: ' + (result.error || 'Unknown tool error.'), {
            name: definition.name,
            toolCallId: call.id,
          }));
          emit('tool_failed', result.error || definition.name + ' failed.', {
            toolName: definition.name,
            toolCallId: call.id,
          });
        }
      }

      controller.signal.throwIfAborted();
      const limitMessage = 'The agent reached its execution limit (' + steps + ' steps, ' + toolCalls + ' tool calls). Review the current changes and continue with a new request if needed.';
      messages.push(message('assistant', limitMessage));
      return finish('completed', limitMessage);
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      const cancelled = controller.signal.aborted;
      return finish(cancelled ? 'cancelled' : 'failed', cancelled ? 'Agent run stopped.' : 'Agent run failed.', reason);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}
