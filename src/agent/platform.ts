import type { AgentFile, AgentPlatform } from './types';
import { normalizeWorkspacePath } from './security';

export interface NativeAgentBridge {
  syncProject(payload: { projectId: string; files: AgentFile[] }): Promise<{ root: string; files: number }>;
  listFiles(payload: { projectId: string }): Promise<string[]>;
  readFile(payload: { projectId: string; path: string }): Promise<string>;
  writeFile(payload: { projectId: string; path: string; content: string }): Promise<unknown>;
  deleteFile(payload: { projectId: string; path: string }): Promise<unknown>;
  searchFiles(payload: { projectId: string; query: string }): Promise<Array<{ path: string; line: number; text: string }>>;
  runCommand(payload: { projectId: string; executable: string; args: string[]; cwd: string; approved: boolean }): Promise<{ code: number; stdout: string; stderr: string }>;
}

declare global {
  interface Window {
    coderaDesktop?: {
      complete: (payload: Record<string, unknown>) => Promise<unknown>;
      agent?: NativeAgentBridge;
    };
  }
}

export interface AgentPlatformSession {
  platform: AgentPlatform;
  collectFiles(): Promise<AgentFile[]>;
  syncFromFiles(files: AgentFile[]): Promise<void>;
}

export async function createAgentPlatformSession(
  projectId: string,
  initialFiles: AgentFile[],
): Promise<AgentPlatformSession> {
  const memory = new Map<string, string>();
  for (const file of initialFiles) {
    const path = normalizeWorkspacePath(file.path);
    memory.set(path, file.content);
  }

  const native = typeof window !== 'undefined' ? window.coderaDesktop?.agent : undefined;
  if (native) {
    await native.syncProject({ projectId, files: initialFiles });
    const platform: AgentPlatform = {
      id: 'desktop',
      capabilities: new Set(['filesystem', 'terminal', 'git', 'search', 'diagnostics', 'preview']),
      async listFiles(signal) {
        signal.throwIfAborted();
        return native.listFiles({ projectId });
      },
      async readFile(path, signal) {
        signal.throwIfAborted();
        return native.readFile({ projectId, path: normalizeWorkspacePath(path) });
      },
      async writeFile(path, content, signal) {
        signal.throwIfAborted();
        await native.writeFile({ projectId, path: normalizeWorkspacePath(path), content });
      },
      async deleteFile(path, signal) {
        signal.throwIfAborted();
        await native.deleteFile({ projectId, path: normalizeWorkspacePath(path) });
      },
      async searchFiles(query, signal) {
        signal.throwIfAborted();
        return native.searchFiles({ projectId, query });
      },
      async runCommand(executable, args, cwd, signal) {
        signal.throwIfAborted();
        return native.runCommand({ projectId, executable, args, cwd, approved: false });
      },
    };

    return {
      platform,
      async collectFiles() {
        const paths = await native.listFiles({ projectId });
        const files = await Promise.all(paths.map(async path => ({
          path,
          content: await native.readFile({ projectId, path }),
        })));
        return files;
      },
      async syncFromFiles(files) {
        await native.syncProject({ projectId, files });
      },
    };
  }

  const platform: AgentPlatform = {
    id: 'web',
    capabilities: new Set(['filesystem', 'search', 'preview', 'diagnostics']),
    async listFiles(signal) {
      signal.throwIfAborted();
      return [...memory.keys()].sort();
    },
    async readFile(path, signal) {
      signal.throwIfAborted();
      const normalized = normalizeWorkspacePath(path);
      const content = memory.get(normalized);
      if (content === undefined) throw new Error('File not found: ' + normalized);
      return content;
    },
    async writeFile(path, content, signal) {
      signal.throwIfAborted();
      memory.set(normalizeWorkspacePath(path), content);
    },
    async deleteFile(path, signal) {
      signal.throwIfAborted();
      const normalized = normalizeWorkspacePath(path);
      if (!memory.delete(normalized)) throw new Error('File not found: ' + normalized);
    },
    async searchFiles(query, signal) {
      signal.throwIfAborted();
      const needle = query.toLowerCase();
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const [path, content] of memory) {
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(needle) && matches.length < 200) {
            matches.push({ path, line: index + 1, text: line.slice(0, 500) });
          }
        });
      }
      return matches;
    },
  };

  return {
    platform,
    async collectFiles() {
      return [...memory.entries()].map(([path, content]) => ({ path, content }));
    },
    async syncFromFiles(files) {
      memory.clear();
      for (const file of files) memory.set(normalizeWorkspacePath(file.path), file.content);
    },
  };
}
