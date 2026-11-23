import type {
  AgentPlatform,
  AgentToolDefinition,
  AgentToolResult,
} from './types';
import { assertFileSize, assertWorkspaceFileCount, normalizeWorkspacePath, validateCommand } from './security';\nimport { searchOfflineGuides } from './knowledge';\nimport { getOfflineTemplate, listOfflineTemplates } from './templates';

const objectArgs = (value: Record<string, unknown>, key: string): string => {
  const item = value[key];
  if (typeof item !== 'string' || !item.trim()) throw new Error('Tool argument "' + key + '" must be a non-empty string.');
  return item;
};

const success = (output: string, data?: unknown, changedFiles?: string[]): AgentToolResult => ({
  ok: true,
  output,
  data,
  changedFiles,
});

const failure = (error: unknown): AgentToolResult => ({
  ok: false,
  output: '',
  error: error instanceof Error ? error.message : String(error),
});

export function createWorkspaceTools(platform: AgentPlatform): AgentToolDefinition[] {
  const listFiles: AgentToolDefinition = {
    name: 'list_files',
    description: 'List project files relative to the active workspace root. Use this before editing unfamiliar projects.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_args, context) {
      try {
        const paths = await platform.listFiles(context.signal);
        assertWorkspaceFileCount(paths);
        return success(paths.join('\n') || '(workspace is empty)', { paths });
      } catch (error) { return failure(error); }
    },
  };

  const readFile: AgentToolDefinition = {
    name: 'read_file',
    description: 'Read one text file from the active project. Paths must be relative to the project root.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative project file path' } },
      required: ['path'],
      additionalProperties: false,
    },
    async execute(args, context) {
      try {
        const path = normalizeWorkspacePath(args.path);
        const content = await platform.readFile(path, context.signal);
        return success(content.slice(0, 30000), { path, truncated: content.length > 30000 });
      } catch (error) { return failure(error); }
    },
  };

  const writeFile: AgentToolDefinition = {
    name: 'write_file',
    description: 'Create or replace a project text file. Always provide its complete intended contents.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string', description: 'Complete UTF-8 text contents' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    async execute(args, context) {
      try {
        const path = normalizeWorkspacePath(args.path);
        if (typeof args.content !== 'string') throw new Error('File content must be a string.');
        assertFileSize(args.content);
        const existing = await platform.listFiles(context.signal);
        if (!existing.includes(path) && existing.length >= 250) throw new Error('The workspace file limit has been reached.');
        await platform.writeFile(path, args.content, context.signal);
        context.emit({
          id: 'file_' + Date.now().toString(36),
          runId: context.runId,
          kind: 'file_changed',
          timestamp: Date.now(),
          step: 0,
          message: 'Updated ' + path,
          path,
        });
        return success('Wrote ' + path + ' (' + new TextEncoder().encode(args.content).byteLength + ' bytes).', { path }, [path]);
      } catch (error) { return failure(error); }
    },
  };

  const writeFiles: AgentToolDefinition = {
    name: 'write_files',
    description: 'Create or replace several project files in one atomic-looking batch. Use for a coherent multi-file implementation.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          minItems: 1,
          maxItems: 40,
          items: {
            type: 'object',
            properties: { path: { type: 'string' }, content: { type: 'string' } },
            required: ['path', 'content'],
            additionalProperties: false,
          },
        },
      },
      required: ['files'],
      additionalProperties: false,
    },
    async execute(args, context) {
      try {
        if (!Array.isArray(args.files) || args.files.length < 1 || args.files.length > 40) {
          throw new Error('A write batch must contain between 1 and 40 files.');
        }
        const files = args.files.map(item => {
          if (!item || typeof item !== 'object') throw new Error('Invalid file entry.');
          const entry = item as Record<string, unknown>;
          const path = normalizeWorkspacePath(entry.path);
          if (typeof entry.content !== 'string') throw new Error('File content must be a string for ' + path + '.');
          assertFileSize(entry.content);
          return { path, content: entry.content };
        });
        const paths = await platform.listFiles(context.signal);
        const newPaths = files.filter(file => !paths.includes(file.path));
        if (paths.length + newPaths.length > 250) throw new Error('The workspace file limit would be exceeded.');
        const totalBytes = files.reduce((total, file) => total + new TextEncoder().encode(file.content).byteLength, 0);
        if (totalBytes > 5_000_000) throw new Error('A single write batch cannot exceed 5 MB.');
        const changed: string[] = [];
        for (const file of files) {
          await platform.writeFile(file.path, file.content, context.signal);
          changed.push(file.path);
        }
        for (const path of changed) {
          context.emit({
            id: 'file_' + Date.now().toString(36) + '_' + changed.indexOf(path),
            runId: context.runId,
            kind: 'file_changed',
            timestamp: Date.now(),
            step: 0,
            message: 'Updated ' + path,
            path,
          });
        }
        return success('Updated ' + changed.length + ' files: ' + changed.join(', '), { count: changed.length }, changed);
      } catch (error) { return failure(error); }
    },
  };

  const deleteFile: AgentToolDefinition = {
    name: 'delete_file',
    description: 'Delete a project file. This action always requires explicit user approval.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, reason: { type: 'string' } },
      required: ['path', 'reason'],
      additionalProperties: false,
    },
    requiresApproval: true,
    destructive: true,
    async execute(args, context) {
      try {
        const path = normalizeWorkspacePath(args.path);
        await platform.deleteFile(path, context.signal);
        return success('Deleted ' + path + '.', { path }, [path]);
      } catch (error) { return failure(error); }
    },
  };

  const searchFiles: AgentToolDefinition = {
    name: 'search_files',
    description: 'Search text across project files. Returns matching path, line number, and line content.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', minLength: 1, maxLength: 200 } },
      required: ['query'],
      additionalProperties: false,
    },
    async execute(args, context) {
      try {
        const query = objectArgs(args, 'query').slice(0, 200);
        if (!platform.searchFiles) return failure('File search is not supported on this platform.');
        const matches = await platform.searchFiles(query, context.signal);
        return success(matches.slice(0, 100).map(match => match.path + ':' + match.line + ': ' + match.text).join('\n') || 'No matches found.', { matches: matches.slice(0, 100) });
      } catch (error) { return failure(error); }
    },
  };

  const listTemplates: AgentToolDefinition = {
    name: 'list_starter_templates',
    description: 'List Codera’s built-in offline project starters for responsive websites, accessible forms, dashboards, and offline PWAs.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute() {
      const templates = listOfflineTemplates();
      return success(JSON.stringify(templates, null, 2), { templates });
    },
  };

  const getTemplate: AgentToolDefinition = {
    name: 'get_starter_template',
    description: 'Retrieve the complete files for one built-in starter template. Use write_files to add the returned files to the active project, then customize them for the user.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Template id returned by list_starter_templates' } },
      required: ['id'],
      additionalProperties: false,
    },
    async execute(args) {
      try {
        const id = objectArgs(args, 'id');
        const template = getOfflineTemplate(id);
        if (!template) return failure('Unknown starter template. Call list_starter_templates to see available ids.');
        return success(JSON.stringify(template, null, 2), { template });
      } catch (error) { return failure(error); }
    },
  };

  const searchReference: AgentToolDefinition = {
    name: 'search_offline_reference',
    description: 'Search Codera’s built-in offline web-development guides for practical HTML, CSS, JavaScript, React, TypeScript, accessibility, security, debugging, performance, testing, and PWA guidance.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', minLength: 2, maxLength: 200 } },
      required: ['query'],
      additionalProperties: false,
    },
    async execute(args) {
      try {
        const query = objectArgs(args, 'query').slice(0, 200);
        const results = searchOfflineGuides(query, 5);
        return success(results.map((item, index) => (index + 1) + '. ' + item.title + '\\n' + item.excerpt).join('\\n\\n') || 'No matching offline guide was found.', { results });
      } catch (error) { return failure(error); }
    },
  };

  const verifyBrowser: AgentToolDefinition = {
    name: 'verify_browser',
    description: 'Open the project HTML in Codera’s bundled offline Chromium browser at desktop and mobile viewport sizes. Report page errors, console errors, missing images, and horizontal overflow. Available in the desktop app.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'HTML entry path, usually index.html' } },
      additionalProperties: false,
    },
    async execute(args, context) {
      try {
        if (!platform.verifyBrowser) return failure('Offline Chromium verification is available in the Codera desktop app, not this platform.');
        const path = typeof args.path === 'string' && args.path.trim() ? normalizeWorkspacePath(args.path) : 'index.html';
        const result = await platform.verifyBrowser(path, context.signal);
        const summary = result.results.map(view => {
          const row = view as Record<string, unknown>;
          return [
            String(row.viewport || 'viewport'),
            'title: ' + String(row.title || '(no title)'),
            'horizontal overflow: ' + String(row.horizontalOverflow),
            'console errors: ' + String(Array.isArray(row.consoleErrors) ? row.consoleErrors.length : 0),
            'page errors: ' + String(Array.isArray(row.pageErrors) ? row.pageErrors.length : 0),
          ].join(' | ');
        }).join('\\n');
        return result.passed
          ? success('Offline browser verification completed.\\n' + summary, result)
          : { ok: false, output: 'Browser verification found issues.\\n' + summary, data: result, error: 'Review browser verification results and repair the project.' };
      } catch (error) { return failure(error); }
    },
  };

  const runCommand: AgentToolDefinition = {
    name: 'run_command',
    description: 'Run an allowlisted project command without a shell, such as npm run build, npm test, git status, or rg TODO. Commands that change dependencies or repository state require approval.',
    inputSchema: {
      type: 'object',
      properties: {
        executable: { type: 'string' },
        args: { type: 'array', items: { type: 'string' }, maxItems: 40 },
      },
      required: ['executable', 'args'],
      additionalProperties: false,
    },
    async execute(args, context) {
      try {
        if (!platform.runCommand) return failure('Terminal execution is unavailable on this platform. Use Preview and Diagnostics instead.');
        const command = validateCommand(args.executable, args.args);
        let approved = false;
        if (command.requiresApproval) {
          approved = (await context.requestApproval?.(command.executable + ' ' + command.args.join(' '), args)) === true;
          if (!approved) return failure('Command was not approved by the user.');
        }
        const result = await platform.runCommand(command.executable, command.args, '.', context.signal, approved);
        const output = [
          '$ ' + command.executable + ' ' + command.args.join(' '),
          'exit code: ' + result.code,
          result.stdout,
          result.stderr ? 'stderr:\n' + result.stderr : '',
        ].filter(Boolean).join('\n').slice(0, 18000);
        return result.code === 0
          ? success(output, { exitCode: result.code })
          : { ok: false, output, error: 'Command exited with code ' + result.code + '.' };
      } catch (error) { return failure(error); }
    },
  };

  const inspectProject: AgentToolDefinition = {
    name: 'inspect_project',
    description: 'Inspect the project structure and basic file metadata before planning changes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_args, context) {
      try {
        const paths = await platform.listFiles(context.signal);
        assertWorkspaceFileCount(paths);
        const files = await Promise.all(paths.slice(0, 80).map(async path => {
          try {
            const content = await platform.readFile(path, context.signal);
            return { path, bytes: new TextEncoder().encode(content).byteLength, lines: content.split('\n').length };
          } catch {
            return { path, bytes: -1, lines: -1 };
          }
        }));
        return success(files.map(file => file.path + ' (' + file.lines + ' lines, ' + file.bytes + ' bytes)').join('\n'), { files });
      } catch (error) { return failure(error); }
    },
  };

  return [listFiles, inspectProject, readFile, searchFiles, listTemplates, getTemplate, searchReference, writeFile, writeFiles, deleteFile, verifyBrowser, runCommand];
}

export function toolDefinitions(tools: AgentToolDefinition[]) {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
