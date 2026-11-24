import { AGENT_LIMITS } from './types';

const BLOCKED_SEGMENTS = new Set([
  '.git',
  '.ssh',
  '.gnupg',
  '.aws',
  '.azure',
  '.config',
  '.npmrc',
  '.pypirc',
  'secrets',
  'credentials',
  'node_modules',
  '.env',
  '.env.local',
  '.env.production',
]);

const SAFE_SEGMENT = /^[a-zA-Z0-9_@.-][a-zA-Z0-9_@ .-]*$/;
const FORBIDDEN_COMMAND_TOKENS = /[;&|<>\u0000\n\r`$]/;

export class AgentSecurityError extends Error {
  readonly code: string;
  constructor(message: string, code = 'AGENT_SECURITY_POLICY') {
    super(message);
    this.name = 'AgentSecurityError';
    this.code = code;
  }
}

export function normalizeWorkspacePath(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw new AgentSecurityError('A non-empty relative file path is required.', 'INVALID_PATH');
  }

  const raw = input.trim().replace(/\\/g, '/');
  if (raw.length > 240 || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) {
    throw new AgentSecurityError('Absolute paths and paths longer than 240 characters are not allowed.', 'INVALID_PATH');
  }

  const segments = raw.split('/');
  if (segments.length > 24) throw new AgentSecurityError('The file path is too deeply nested.', 'INVALID_PATH');

  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') {
      throw new AgentSecurityError('Empty, current-directory, and parent-directory path segments are not allowed.', 'INVALID_PATH');
    }
    if (!SAFE_SEGMENT.test(segment) || segment.endsWith('.') || segment.endsWith(' ')) {
      throw new AgentSecurityError('The file path contains unsupported characters.', 'INVALID_PATH');
    }
    if (BLOCKED_SEGMENTS.has(segment.toLowerCase()) || /^\\.env(?:\\.|$)/i.test(segment)) {
      throw new AgentSecurityError('Access to protected or dependency directories is blocked.', 'PROTECTED_PATH');
    }
    normalized.push(segment);
  }

  return normalized.join('/');
}

export function assertFileSize(content: string, limit = AGENT_LIMITS.maxFileBytes): void {
  const bytes = new TextEncoder().encode(content).byteLength;
  if (bytes > limit) {
    throw new AgentSecurityError('File exceeds the ' + limit + '-byte agent write limit.', 'FILE_TOO_LARGE');
  }
}

export function assertWorkspaceFileCount(paths: string[], limit = AGENT_LIMITS.maxWorkspaceFiles): void {
  if (paths.length > limit) {
    throw new AgentSecurityError('Workspace contains more than ' + limit + ' tracked files.', 'WORKSPACE_TOO_LARGE');
  }
}

export interface ValidatedCommand {
  executable: string;
  args: string[];
  requiresApproval: boolean;
  reason?: string;
}

const COMMAND_RULES: Record<string, { approval: boolean; blockedArgs?: RegExp[] }> = {
  node: { approval: false, blockedArgs: [/^-e$/, /^--eval$/, /^--require$/] },
  npm: { approval: true, blockedArgs: [/^publish$/i, /^login$/i, /^logout$/i, /^token$/i] },
  npx: { approval: true },
  pnpm: { approval: true },
  yarn: { approval: true },
  git: { approval: false, blockedArgs: [/^push$/i, /^pull$/i, /^fetch$/i, /^clone$/i, /^remote$/i, /^submodule$/i, /^reset$/i, /^clean$/i, /^filter-repo$/i, /^credential$/i] },
  python: { approval: true, blockedArgs: [/^-c$/, /^-mhttp\.server$/i] },
  python3: { approval: true, blockedArgs: [/^-c$/, /^-mhttp\.server$/i] },
  pytest: { approval: false },
  tsc: { approval: false },
  vite: { approval: false },
  eslint: { approval: false },
  prettier: { approval: false },
  biome: { approval: false },
  rg: { approval: false },
  ls: { approval: false },
  pwd: { approval: false },
  cat: { approval: false },
  head: { approval: false },
  tail: { approval: false },
  wc: { approval: false },
  find: { approval: false, blockedArgs: [/^-delete$/i, /^-exec$/i, /^-execdir$/i] },
};

export function validateCommand(executableInput: unknown, argsInput: unknown): ValidatedCommand {
  if (typeof executableInput !== 'string' || !Array.isArray(argsInput) || !argsInput.every(arg => typeof arg === 'string')) {
    throw new AgentSecurityError('Command must contain an executable and a string argument list.', 'INVALID_COMMAND');
  }

  const executable = executableInput.trim().toLowerCase().replace(/\\/g, '/').split('/').pop() || '';
  const rule = COMMAND_RULES[executable];
  if (!rule) {
    throw new AgentSecurityError('The command "' + executable + '" is not in Codera’s local execution allowlist.', 'COMMAND_NOT_ALLOWED');
  }

  const args = argsInput as string[];
  if (args.length > 40 || args.some(arg => arg.length > 1000 || FORBIDDEN_COMMAND_TOKENS.test(arg))) {
    throw new AgentSecurityError('Command arguments contain shell syntax or exceed the supported limits.', 'INVALID_COMMAND');
  }

  for (const arg of args) {
    if (rule.blockedArgs?.some(pattern => pattern.test(arg))) {
      throw new AgentSecurityError('This command option is blocked by the native execution policy.', 'COMMAND_OPTION_BLOCKED');
    }
    if (/^(?:\/|[a-zA-Z]:\\)/.test(arg)) {
      throw new AgentSecurityError('Commands cannot reference absolute host paths or parent directories.', 'HOST_PATH_BLOCKED');
    }
  }

  const packageMutation = ['install', 'add', 'remove', 'update', 'upgrade', 'uninstall'].includes((args[0] || '').toLowerCase());
  const gitMutation = executable === 'git' && ['init', 'add', 'commit', 'checkout', 'switch', 'merge', 'rebase', 'stash', 'branch'].includes((args[0] || '').toLowerCase());
  const requiresApproval = rule.approval || packageMutation || gitMutation;

  return {
    executable,
    args: [...args],
    requiresApproval,
    reason: requiresApproval ? 'This command can change project dependencies or repository state.' : undefined,
  };
}
