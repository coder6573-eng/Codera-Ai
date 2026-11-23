import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { AgentFile, AgentPlatform } from './types';
import { normalizeWorkspacePath } from './security';

export interface NativeAgentBridge {
  syncProject(payload: { projectId: string; files: AgentFile[] }): Promise<{ root: string; files: number }>;
  listFiles(payload: { projectId: string }): Promise<string[]>;
  readFile(payload: { projectId: string; path: string }): Promise<string>;
  writeFile(payload: { projectId: string; path: string; content: string }): Promise<unknown>;
  deleteFile(payload: { projectId: string; path: string }): Promise<unknown>;
  searchFiles(payload: { projectId: string; query: string }): Promise<Array<{ path: string; line: number; text: string }>>;
  runCommand(payload: { projectId: string; executable: string; args: string[]; cwd: string; approved: boolean }): Promise<{ code: number; stdout: string; stderr: string }>;\n  verifyBrowser(payload: { projectId: string; path: string }): Promise<{ browser: string; entry: string; passed: boolean; results: Array<Record<string, unknown>> }>;
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
      async runCommand(executable, args, cwd, signal, approved = false) {
        signal.throwIfAborted();
        return native.runCommand({ projectId, executable, args, cwd, approved });
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

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(projectId)) throw new Error('Invalid project identifier.');
    const root = 'codera-agent-workspaces/' + projectId;
    const fullPath = (path: string) => root + '/' + normalizeWorkspacePath(path);

    const ensureRoot = async () => {
      await Filesystem.mkdir({ path: root, directory: Directory.Data, recursive: true }).catch(() => undefined);
    };
    const listAndroidFiles = async (directory = root, collected: string[] = []): Promise<string[]> => {
      const result = await Filesystem.readdir({ path: directory, directory: Directory.Data });
      for (const entry of result.files) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue;
        const relative = directory === root ? entry.name : directory.slice(root.length + 1) + '/' + entry.name;
        if (entry.type === 'directory') await listAndroidFiles(root + '/' + relative, collected);
        else if (entry.type === 'file') collected.push(relative);
        if (collected.length > 250) throw new Error('Android agent workspace exceeds 250 files.');
      }
      return collected;
    };
    await ensureRoot();
    for (const file of initialFiles) {
      await Filesystem.writeFile({
        path: fullPath(file.path),
        data: file.content,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    }

    const platform: AgentPlatform = {
      id: 'android',
      capabilities: new Set(['filesystem', 'search', 'preview', 'diagnostics']),
      async listFiles(signal) {
        signal.throwIfAborted();
        await ensureRoot();
        return (await listAndroidFiles()).sort();
      },
      async readFile(path, signal) {
        signal.throwIfAborted();
        const result = await Filesystem.readFile({ path: fullPath(path), directory: Directory.Data, encoding: Encoding.UTF8 });
        return typeof result.data === 'string' ? result.data : '';
      },
      async writeFile(path, content, signal) {
        signal.throwIfAborted();
        await Filesystem.writeFile({ path: fullPath(path), data: content, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
      },
      async deleteFile(path, signal) {
        signal.throwIfAborted();
        await Filesystem.deleteFile({ path: fullPath(path), directory: Directory.Data });
      },
      async searchFiles(query, signal) {
        signal.throwIfAborted();
        const paths = await listAndroidFiles();
        const matches: Array<{ path: string; line: number; text: string }> = [];
        for (const path of paths) {
          const result = await Filesystem.readFile({ path: fullPath(path), directory: Directory.Data, encoding: Encoding.UTF8 });
          const content = typeof result.data === 'string' ? result.data : '';
          content.split(/\\r?\\n/).forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase()) && matches.length < 200) {
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
        const paths = await listAndroidFiles();
        return Promise.all(paths.map(async path => ({
          path,
          content: (await Filesystem.readFile({ path: fullPath(path), directory: Directory.Data, encoding: Encoding.UTF8 })).data as string,
        })));
      },
      async syncFromFiles(files) {
        for (const file of files) {
          await Filesystem.writeFile({ path: fullPath(file.path), data: file.content, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
        }
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
