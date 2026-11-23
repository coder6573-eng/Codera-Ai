import { test, expect } from '@playwright/test';
import { CoderaAgentRuntime } from '../../src/agent/runtime';
import type { AgentMode, AgentPlatform, AgentProvider, AgentTurn } from '../../src/agent/types';

function createMemoryPlatform(): AgentPlatform {
  const files = new Map<string, string>([
    ['index.html', '<main>old</main>'],
    ['styles.css', 'body { color: black; }'],
  ]);
  return {
    id: 'web',
    capabilities: new Set(['filesystem', 'search', 'preview', 'diagnostics']),
    async listFiles() { return [...files.keys()]; },
    async readFile(path) {
      const value = files.get(path);
      if (value === undefined) throw new Error('missing file');
      return value;
    },
    async writeFile(path, content) { files.set(path, content); },
    async deleteFile(path) {
      if (!files.delete(path)) throw new Error('missing file');
    },
    async searchFiles(query) {
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const [path, content] of files) {
        content.split('\n').forEach((line, index) => {
          if (line.includes(query)) matches.push({ path, line: index + 1, text: line });
        });
      }
      return matches;
    },
  };
}

function scriptedProvider(turns: AgentTurn[]): AgentProvider {
  return {
    id: 'test-provider',
    label: 'Test provider',
    async complete(_input: { mode: AgentMode }) {
      const next = turns.shift();
      if (!next) throw new Error('No scripted agent turn remains.');
      return next;
    },
  };
}

test('agent executes a multi-file write tool and finishes with verified tool history', async () => {
  const platform = createMemoryPlatform();
  const provider = scriptedProvider([
    {
      message: 'Implementing the requested page.',
      finishReason: 'tool_calls',
      toolCalls: [{
        id: 'write-1',
        name: 'write_files',
        arguments: {
          files: [
            { path: 'index.html', content: '<main>new page</main>' },
            { path: 'styles.css', content: 'main { color: rebeccapurple; }' },
          ],
        },
      }],
    },
    {
      message: 'Updated both files and completed the requested change.',
      finishReason: 'stop',
      toolCalls: [],
    },
  ]);
  const runtime = new CoderaAgentRuntime(provider, platform);
  const result = await runtime.run({
    mode: 'build',
    prompt: 'Update the page content and style.',
    projectName: 'Agent test',
    files: [],
  });

  expect(result.status).toBe('completed');
  expect(result.steps).toBe(2);
  expect(result.toolCalls).toBe(1);
  expect(result.changedFiles).toEqual(['index.html', 'styles.css']);
  expect(await platform.readFile('index.html', new AbortController().signal)).toBe('<main>new page</main>');
  expect(result.events.some(event => event.kind === 'tool_completed')).toBeTruthy();
});

test('agent rejects path traversal instead of reading outside the workspace', async () => {
  const platform = createMemoryPlatform();
  const provider = scriptedProvider([
    {
      message: 'Attempting to inspect a parent path.',
      finishReason: 'tool_calls',
      toolCalls: [{
        id: 'read-1',
        name: 'read_file',
        arguments: { path: '../outside.txt' },
      }],
    },
    {
      message: 'The path was blocked by workspace security. No outside file was read.',
      finishReason: 'stop',
      toolCalls: [],
    },
  ]);
  const runtime = new CoderaAgentRuntime(provider, platform);
  const result = await runtime.run({
    mode: 'verify',
    prompt: 'Inspect this project safely.',
    projectName: 'Security test',
    files: [],
  });

  expect(result.status).toBe('completed');
  expect(result.messages.some(item => item.role === 'tool' && item.content.includes('parent-directory'))).toBeTruthy();
});
