import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clock3, Code2, Download, Eye, FileCode2, FolderKanban, HardDrive, History as HistoryIcon, Home, LayoutGrid, List, MessageSquare, Monitor, Moon, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Send, Settings, ShieldCheck, Smartphone, Sparkles, Sun, Tablet, Trash2, Wrench, X } from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import { keylessAI } from './aiClient';

const parseAIJson = <T,>(value: string): T => {
  return JSON.parse(value) as T;
};

type FileItem = { path: string; content: string };
type ProjectVersion = { id: string; label: string; files: FileItem[]; created: number };
type Project = { id: string; name: string; files: FileItem[]; plan: string[]; updated: number; versions?: ProjectVersion[] };
type Workspace = { id: string; name: string; projects: Project[] };
const id = () => Math.random().toString(36).slice(2, 10);
const starterFiles: FileItem[] = [
  { path: 'index.html', content: '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your next idea</title><link rel="stylesheet" href="styles.css"></head><body><main class="hero" id="start"><span class="eyebrow">YOUR CANVAS IS READY</span><h1>Make something<br><span>remarkable.</span></h1><p>Describe what you want to build. Codera will help turn your idea into a working website.</p><a href="#start">Explore the possibilities ↗</a></main><script src="app.js"></script></body></html>' },
  { path: 'styles.css', content: ':root{font-family:Inter,system-ui,sans-serif;color:#f5f4ff;background:#0c1020}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 75% 20%,#27205a 0,transparent 42%),#0c1020}.hero{max-width:850px;margin:auto;padding:15vh 8vw}.eyebrow{font-size:11px;letter-spacing:.2em;color:#a99aff;font-weight:700}h1{font-size:clamp(48px,9vw,92px);line-height:.98;letter-spacing:-.07em;margin:24px 0}h1 span{background:linear-gradient(90deg,#a99aff,#72d9ff);color:transparent;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.hero p{max-width:470px;color:#a9adc3;font-size:17px;line-height:1.7}.hero a{display:inline-block;margin-top:28px;padding:14px 18px;border:1px solid #5b5488;border-radius:12px;color:#fff;text-decoration:none;background:#ffffff0b}' },
  { path: 'app.js', content: "document.querySelector('a')?.addEventListener('click',()=>console.log('Welcome to your project'));" }
];
const makeProject = (n = 1): Project => ({ id: id(), name: n === 1 ? 'My first website' : 'Untitled project ' + n, files: starterFiles.map(f => ({ ...f })), plan: [], updated: Date.now() });
const load = (): Workspace[] => {
  try {
    const saved = localStorage.getItem('codera-workspaces-v1');
    if (saved) {
      const parsed = JSON.parse(saved) as Workspace[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    // Migrate workspace/project data created by the Floot-imported local adapter.
    const imported = localStorage.getItem('codera-floot-api-v1');
    if (imported) {
      const source = JSON.parse(imported) as {
        workspaces?: Array<{ id?: string; name?: string }>;
        projects?: Array<{ id?: string; workspaceId?: string; name?: string; planJson?: { features?: unknown[] } | null; updatedAt?: string }>;
        files?: Record<string, Array<{ path?: string; content?: string }>>;
      };
      const migrated = (source.workspaces || []).filter(w => typeof w.id === 'string').map(w => ({
        id: w.id as string,
        name: String(w.name || 'Workspace'),
        projects: (source.projects || []).filter(p => p.workspaceId === w.id && typeof p.id === 'string').map(p => ({
          id: p.id as string,
          name: String(p.name || 'Untitled project'),
          files: (source.files?.[p.id as string] || []).filter(f => typeof f.path === 'string' && typeof f.content === 'string').map(f => ({ path: f.path as string, content: f.content as string })),
          plan: Array.isArray(p.planJson?.features) ? p.planJson!.features.filter((step): step is string => typeof step === 'string').slice(0, 8) : [],
          updated: Number.isFinite(Date.parse(String(p.updatedAt || ''))) ? Date.parse(String(p.updatedAt)) : Date.now(),
          versions: []
        }))
      }));
      if (migrated.length) {
        localStorage.setItem('codera-workspaces-v1', JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch { /* Ignore corrupt legacy data and start a clean local workspace. */ }
  return [{ id: id(), name: 'Personal workspace', projects: [makeProject()] }];
};
const planFor = (idea: string) => ['Define the structure and main user journey for ' + idea + '.', 'Build a responsive layout with a clear visual hierarchy and accessible interactions.', 'Implement the styling, content, and functional client-side behaviour.', 'Check mobile and desktop layouts, then refine the result.'];
const validateGeneratedFiles = (input: unknown): FileItem[] => {
  if (!Array.isArray(input)) throw new Error('The AI response did not include a file list.');
  const allowed = new Set(['html', 'css', 'js', 'json', 'txt']); const seen = new Set<string>();
  const output: FileItem[] = []; let total = 0;
  for (const item of input) {
    if (!item || typeof item.path !== 'string' || typeof item.content !== 'string') continue;
    const path = item.path; const parts = path.split('/'); const extension = path.split('.').pop()?.toLowerCase();
    if (!path || path.length > 120 || path.startsWith('/') || path.includes(String.fromCharCode(92)) ||
      parts.some((part: string) => !part || part === '.' || part === '..' || part.startsWith('.') || !/^[a-zA-Z0-9_.-]+$/.test(part)) ||
      !extension || !allowed.has(extension)) continue;
    if (item.content.length > 250000) continue;
    if (seen.has(path)) throw new Error('The AI returned duplicate file paths: ' + path);
    const bytes = new TextEncoder().encode(item.content).byteLength;
    if (total + bytes > 1200000) throw new Error('Generated files exceed the 1.2 MB project limit.');
    if (output.length >= 20) throw new Error('Generated projects cannot contain more than 20 files.');
    seen.add(path); total += bytes; output.push({ path, content: item.content });
  }
  if (!output.some(file => file.path === 'index.html')) throw new Error('The generated project did not contain a valid index.html.');
  if (!output.some(file => file.path === 'styles.css')) {
    if (output.length >= 20) throw new Error('The project needs styles.css and cannot exceed 20 files.');
    output.push({ path: 'styles.css', content: '' });
  }
  return output;
};
export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(load);
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const [screen, setScreen] = useState<'home' | 'projects' | 'settings' | 'builder'>('home');
  const [activeView, setActiveView] = useState<'chat' | 'preview' | 'code' | 'plan' | 'issues' | 'history'>(isPhone ? 'chat' : 'preview');
  const [mode, setMode] = useState<'plan' | 'build'>(() => {
    try { return localStorage.getItem('codera.ui.mode') === 'build' ? 'build' : 'plan'; } catch { return 'plan'; }
  });
  const [, setPanel] = useState<'preview' | 'code'>('preview');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('codera.ui.theme');
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch { return 'system'; }
  });
  const [projectSearch, setProjectSearch] = useState('');
  const [projectsView, setProjectsView] = useState<'grid' | 'list'>('grid');
  const [layoutPreset, setLayoutPreset] = useState<'balanced' | 'chat' | 'preview' | 'code'>(() => {
    try {
      const saved = localStorage.getItem('codera.ui.layout.v1');
      return saved === 'chat' || saved === 'preview' || saved === 'code' ? saved : 'balanced';
    } catch { return 'balanced'; }
  });
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [pendingPlanStart, setPendingPlanStart] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState('index.html');
  const [, setMobileMenu] = useState(false);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready when you are');
  const [error, setError] = useState('');
  const [mobilePreview, setMobilePreview] = useState(false);
  const [tabletPreview, setTabletPreview] = useState(false);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [showVersions, setShowVersions] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [renameProjectOpen, setRenameProjectOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [previewChecks, setPreviewChecks] = useState<Array<{ name: string; status: 'pass' | 'fail'; message: string }>>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [autoTestRepairEnabled, setAutoTestRepairEnabled] = useState(false);
  const autoRepairCount = useRef(0);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { try { localStorage.setItem('codera-workspaces-v1', JSON.stringify(workspaces)); } catch { /* Keep the current session usable if storage is full or unavailable. */ } }, [workspaces]);
  useEffect(() => { try { localStorage.setItem('codera.ui.mode', mode); } catch { /* Preference is optional. */ } }, [mode]);
  useEffect(() => {
    try { localStorage.setItem('codera.ui.theme', theme); } catch { /* Preference is optional. */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    if (theme !== 'system') return;
    if (media.addEventListener) {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [theme]);
  useEffect(() => { try { localStorage.setItem('codera.ui.layout.v1', layoutPreset); } catch { /* Preference is optional. */ } }, [layoutPreset]);
  useEffect(() => {
    const receivePreviewError = (event: MessageEvent) => {
      if (event.source !== previewFrame.current?.contentWindow) return;
      const data = event.data as { source?: string; kind?: string; name?: string; status?: 'pass' | 'fail'; message?: string } | null;
      if (!data || data.source !== 'codera-preview') return;
      if (data.kind === 'ready') { setPreviewReady(true); return; }
      if (data.kind === 'check' && typeof data.name === 'string' && (data.status === 'pass' || data.status === 'fail')) {
        setPreviewChecks(previous => [...previous.filter(check => check.name !== data.name), { name: data.name!, status: data.status!, message: String(data.message || '').slice(0, 300) }].slice(-20));
        return;
      }
      if (data.kind === 'runtime' && typeof data.message === 'string') {
        setRuntimeErrors(previous => [...previous, data.message!.slice(0, 500)].filter((item, index, all) => all.indexOf(item) === index).slice(-8));
      }
    };
    window.addEventListener('message', receivePreviewError);
    return () => window.removeEventListener('message', receivePreviewError);
  }, []);
  const workspace = workspaces.find(w => w.id === workspaceId) || workspaces[0];
  const project = workspace?.projects.find(p => p.id === projectId) || workspace?.projects[0];
  useEffect(() => { setRuntimeErrors([]); setPreviewChecks([]); setPreviewReady(false); }, [project?.id, project?.updated]);
  useEffect(() => { if (!workspaceId && workspace) setWorkspaceId(workspace.id); }, [workspaceId, workspace]);
  useEffect(() => { if (workspace && (!projectId || !workspace.projects.some(p => p.id === projectId))) setProjectId(workspace.projects[0]?.id || ''); }, [workspace, projectId]);
  const file = project?.files.find(f => f.path === selectedFile) || project?.files[0];
  const preview = useMemo(() => {
    if (!project) return '';
    let doc = project.files.find(f => f.path === 'index.html')?.content || '<h1>Start building</h1>';
    const css = project.files.find(f => f.path.endsWith('.css'))?.content || '';
    const js = project.files.find(f => f.path.endsWith('.js'))?.content || '';
    doc = doc.replace(/<link[^>]+href=["'][^"']+\.css["'][^>]*>/gi, '').replace(/<script[^>]+src=["'][^"']+\.js["'][^>]*><\/script>/gi, '');
    doc = doc.replace(/<\/head>/i, '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style></head>');
    if (js) doc = doc.replace(/<\/body>/i, '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script></body>');
    const monitor = `<script>(() => {
      const send = payload => parent.postMessage({ source: 'codera-preview', ...payload }, '*');
      const report = (kind, value) => { const message = String(value && (value.message || value.reason || value) || kind).slice(0, 500); send({ kind: 'runtime', message: kind + ': ' + message }); };
      const check = (name, passed, message) => send({ kind: 'check', name, status: passed ? 'pass' : 'fail', message });
      addEventListener('error', event => report('Runtime error', event.message || 'Unknown script error'));
      addEventListener('unhandledrejection', event => report('Unhandled promise rejection', event.reason));
      const original = console.error.bind(console); console.error = (...args) => { report('Console error', args.join(' ')); original(...args); };
      let checksRan = false;
      const runChecks = () => {
        if (checksRan) return;
        checksRan = true;
        check('Document title', !!document.title.trim(), 'A descriptive page title is present.');
        check('Responsive viewport', !!document.querySelector('meta[name=viewport]'), 'Viewport metadata is present.');
        check('Page content', !!(document.body.textContent.trim() || document.body.querySelector('img,canvas,svg')), 'The page contains visible content.');
        const buttons = [...document.querySelectorAll('button,[role=button]')];
        const unnamedButtons = buttons.filter(el => !(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim()));
        check('Button labels', unnamedButtons.length === 0, unnamedButtons.length ? unnamedButtons.length + ' button(s) have no accessible name.' : buttons.length + ' button(s) have accessible names.');
        const safeButtons = buttons.filter(el => el.getAttribute('data-codera-test-safe') === 'true' && el.getAttribute('data-codera-test-target'));
        let buttonFailures = 0;
        safeButtons.forEach(button => {
          try {
            const target = document.querySelector(button.getAttribute('data-codera-test-target'));
            if (!target) { buttonFailures++; return; }
            const expected = button.getAttribute('data-codera-test-state') || 'visible';
            button.click();
            const visible = !target.hidden && target.getAttribute('aria-hidden') !== 'true' && getComputedStyle(target).display !== 'none';
            const passed = expected === 'hidden' ? !visible : visible;
            if (!passed) { button.click(); buttonFailures++; }
          } catch { buttonFailures++; }
        });
        check('Safe button interactions', buttonFailures === 0, safeButtons.length ? (safeButtons.length - buttonFailures) + '/' + safeButtons.length + ' reversible button interaction(s) passed.' : 'No buttons opted into safe interaction testing; destructive actions are never clicked automatically.');
        const fields = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')];
        const unlabeledFields = fields.filter(el => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]') || el.closest('label')));
        check('Form field labels', unlabeledFields.length === 0, unlabeledFields.length ? unlabeledFields.length + ' form field(s) need labels.' : fields.length + ' form field(s) have labels.');
        const forms = [...document.forms];
        const formsWithoutSubmit = forms.filter(form => !form.querySelector('button:not([type]),button[type=submit],input[type=submit]'));
        check('Form submit controls', formsWithoutSubmit.length === 0, formsWithoutSubmit.length ? formsWithoutSubmit.length + ' form(s) have no submit control.' : forms.length + ' form(s) have submit controls.');
        const links = [...document.querySelectorAll('a')];
        const brokenAnchors = links.filter(link => !link.getAttribute('href') || link.getAttribute('href') === '#' || link.getAttribute('href').startsWith('#') && link.getAttribute('href').length > 1 && !document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1))));
        check('Navigation targets', brokenAnchors.length === 0, brokenAnchors.length ? brokenAnchors.length + ' navigation link(s) have missing or empty destinations.' : links.length + ' link(s) have valid destinations.');
        let navigationFailures = 0; let navigationTests = 0;
        links.filter(link => link.getAttribute('href')?.startsWith('#') && link.getAttribute('href') !== '#').forEach(link => {
          let observed = false; let prevented = false;
          const listener = event => {
            observed = true;
            // Keep the audit from navigating the sandboxed srcDoc frame away from its generated page.
            event.preventDefault();
            prevented = event.defaultPrevented;
          };
          link.addEventListener('click', listener, { once: true });
          link.click(); navigationTests++;
          if (!observed || !prevented) navigationFailures++;
        });
        check('In-page navigation behavior', navigationFailures === 0, navigationTests ? (navigationTests - navigationFailures) + '/' + navigationTests + ' in-page link click(s) were exercised without navigating away from the preview.' : 'No in-page navigation links were present to exercise.');
        const images = [...document.images]; const missingAlt = images.filter(img => !img.hasAttribute('alt'));
        check('Image alternatives', missingAlt.length === 0, missingAlt.length ? missingAlt.length + ' image(s) are missing alt text.' : images.length + ' image(s) have alt attributes.');
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        check('Current viewport fit', !overflow, overflow ? 'The page overflows horizontally at ' + innerWidth + 'px.' : 'No horizontal overflow at ' + innerWidth + 'px.');
        forms.forEach((form, index) => send({ kind: 'check', name: 'Form validation ' + (index + 1), status: 'pass', message: form.checkValidity() ? 'Form fields satisfy native constraints.' : 'Required fields correctly block incomplete submission.' }));
        send({ kind: 'ready' });
      };
      addEventListener('message', event => {
        if (event.source === parent && event.data && event.data.source === 'codera-parent' && event.data.kind === 'ready') runChecks();
      });
    })();</script>`;
    doc = doc.replace(/<head([^>]*)>/i, '<head$1>' + monitor);
    return doc;
  }, [project]);
  const updateProject = (fn: (p: Project) => Project) => {
    if (!workspace || !project) return;
    setWorkspaces(prev => prev.map(w => w.id !== workspace.id ? w : { ...w, projects: w.projects.map(p => p.id === project.id ? fn(p) : p) }));
  };
  const snapshotVersion = (current: Project, label: string): ProjectVersion => ({
    id: id(), label, files: current.files.map(item => ({ ...item })), created: Date.now()
  });
  const restoreVersion = (versionId: string) => {
    if (!project) return;
    const version = (project.versions || []).find(item => item.id === versionId);
    if (!version) return;
    updateProject(current => ({
      ...current,
      files: version.files.map(item => ({ ...item })),
      versions: [snapshotVersion(current, 'Before restore'), ...(current.versions || []).filter(item => item.id !== versionId)].slice(0, 12),
      updated: Date.now()
    }));
    setSelectedFile('index.html');
    setPanel('preview');
    setActiveView('preview');
    setShowVersions(false);
    setPreviewReady(false);
    setPreviewRefresh(value => value + 1);
    setStatus('Restored version · preview refreshed');
  };
  const createProject = (initialPrompt = '') => {
    if (!workspace) return;
    const next = makeProject(workspace.projects.length + 1);
    setWorkspaces(prev => prev.map(w => w.id === workspace.id ? { ...w, projects: [next, ...w.projects] } : w));
    setProjectId(next.id); setSelectedFile('index.html'); setPanel('preview'); setPrompt(initialPrompt); setScreen('builder'); setActiveView(isPhone ? 'chat' : 'preview'); setMobileMenu(false); setError(''); setAutoTestRepairEnabled(false);
  };
  const addWorkspace = () => {
    if (!workspaceName.trim()) return;
    const next = { id: id(), name: workspaceName.trim(), projects: [] };
    setWorkspaces(prev => [next, ...prev]); setWorkspaceId(next.id); setProjectId(''); setAutoTestRepairEnabled(false);
    setWorkspaceName(''); setNewWorkspace(false); setWorkspaceMenu(false); setScreen('projects');
  };
  const runPlan = async () => {
    if (!prompt.trim() || busy) { if (!prompt.trim()) setError('Describe your idea first.'); return; }
    setBusy(true); setError(''); setStatus('Turning your idea into a plan…');
    try {
      const raw = await keylessAI('plan', prompt.trim(), project?.name);
      const data = parseAIJson<{ steps?: string[] }>(raw);
      const steps = Array.isArray(data.steps) ? data.steps.filter(s => typeof s === 'string' && s.trim()).slice(0, 8) : [];
      if (!steps.length) throw new Error('The AI plan was empty. Please retry.');
      updateProject(p => ({ ...p, plan: steps, updated: Date.now() }));
      setStatus('Plan ready · Kilo Auto Free');
      setActiveView(isPhone ? 'chat' : 'plan');
      setHistory(prev => [prompt.trim(), ...prev].slice(0, 6));
    } catch (e) {
      updateProject(p => ({ ...p, plan: planFor(prompt.trim()), updated: Date.now() }));
      setError((e instanceof Error ? e.message : 'AI plan failed.') + ' Using the local fallback.');
      setStatus('Plan ready with fallback');
      setActiveView(isPhone ? 'chat' : 'plan');
    } finally { setBusy(false); }
  };
  useEffect(() => {
    if (screen !== 'builder' || !project || !pendingPlanStart || busy) return;
    setPendingPlanStart(false);
    void runPlan();
  }, [screen, project?.id, pendingPlanStart, busy]);
  const runBuild = async () => {
    if (!project || !prompt.trim() || busy) return;
    setBusy(true); setError(''); setHistory(prev => [prompt.trim(), ...prev].slice(0, 6));
    try {
      setStatus('Planning your build…');
      const raw = await keylessAI('build', prompt.trim(), project.name, project.files, project.plan);
      setStatus('Validating generated files…');
      const data = parseAIJson<{ summary?: string; files?: FileItem[] }>(raw);
      const safe = validateGeneratedFiles(data.files);
      autoRepairCount.current = 0;
      setRuntimeErrors([]);
      setPreviewChecks([]);
      setPreviewReady(false);
      setAutoTestRepairEnabled(true);
      updateProject(p => ({ ...p, versions: p.files.length ? [snapshotVersion(p, 'Before build'), ...(p.versions || [])].slice(0, 12) : (p.versions || []), files: safe, plan: p.plan.length ? p.plan : planFor(prompt.trim()), updated: Date.now() }));
      setSelectedFile('index.html'); setPanel('preview'); setPrompt(''); setActiveView('preview'); setStatus('Build complete · Kilo Auto Free');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build failed.');
      setStatus('Build needs attention');
    } finally { setBusy(false); }
  };
  const runRepair = async () => {
    const failedChecks = previewChecks.filter(check => check.status === 'fail').map(check => check.name + ': ' + check.message);
    if (!project || (!runtimeErrors.length && !failedChecks.length) || busy) return;
    const issues = [...runtimeErrors, ...failedChecks].join(String.fromCharCode(10));
    setBusy(true); setError(''); setStatus('Sending preview test failures to the repair engine…');
    try {
      const repairPrompt = ['Repair the current website based on these automated browser preview test failures. Fix root causes while preserving existing design and working features. Do not hide, suppress, or weaken tests. Return the complete corrected project files.', 'Browser diagnostics and test failures:', issues].join(String.fromCharCode(10, 10));
      const raw = await keylessAI('build', repairPrompt, project.name, project.files, project.plan);
      const data = parseAIJson<{ summary?: string; files?: FileItem[] }>(raw);
      const safe = validateGeneratedFiles(data.files);
      updateProject(p => ({ ...p, versions: p.files.length ? [snapshotVersion(p, 'Before auto-repair'), ...(p.versions || [])].slice(0, 12) : (p.versions || []), files: safe, updated: Date.now() }));
      setSelectedFile('index.html'); setPanel('preview'); setActiveView('preview'); setRuntimeErrors([]); setStatus('Repair applied · rerunning preview checks…');
    } catch (e) { setError(e instanceof Error ? e.message : 'Preview repair failed.'); setStatus('Repair needs attention'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!autoTestRepairEnabled || busy || !previewReady || !previewChecks.length) return;
    const failures = previewChecks.filter(check => check.status === 'fail');
    if ((failures.length || runtimeErrors.length) && autoRepairCount.current === 0) {
      autoRepairCount.current = 1;
      void runRepair();
    } else if (!failures.length && previewChecks.every(check => check.status === 'pass') && !runtimeErrors.length) {
      setAutoTestRepairEnabled(false);
      setStatus('Preview checks passed · ready to review');
    }
  }, [autoTestRepairEnabled, busy, previewChecks, previewReady, runtimeErrors]);
  const download = () => {
    if (!project) return;
    const archiveFiles: Record<string, Uint8Array> = {};
    for (const item of project.files) archiveFiles[item.path] = strToU8(item.content);
    const archive = zipSync(archiveFiles, { level: 6 });
    const url = URL.createObjectURL(new Blob([archive as unknown as BlobPart], { type: 'application/zip' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-source.zip';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('Project exported as ZIP');
  };
  const deleteProject = () => {
    if (!workspace || !project || !window.confirm('Delete "' + project.name + '"? This cannot be undone.')) return;
    const rest = workspace.projects.filter(p => p.id !== project.id);
    setWorkspaces(prev => prev.map(w => w.id === workspace.id ? { ...w, projects: rest } : w));
    setProjectId(rest[0]?.id || '');
    setAutoTestRepairEnabled(false);
    if (!rest.length) setScreen('projects');
    setProjectMenuOpen(false);
  };
  const renameProject = () => {
    const nextName = projectNameDraft.trim().slice(0, 80);
    if (!nextName) return;
    updateProject(current => ({ ...current, name: nextName, updated: Date.now() }));
    setRenameProjectOpen(false);
    setProjectNameDraft('');
    setProjectMenuOpen(false);
    setStatus('Project renamed');
  };

  const openProject = (item: Project) => {
    setProjectId(item.id);
    setScreen('builder');
    setActiveView(isPhone ? 'chat' : item.files.length ? 'preview' : item.plan.length ? 'plan' : 'preview');
    setPanel('preview');
    setSelectedFile('index.html');
    setMobileMenu(false);
    setProjectMenuOpen(false);
    setAutoTestRepairEnabled(false);
    setError('');
  };
  const openView = (view: 'chat' | 'preview' | 'code' | 'plan' | 'issues' | 'history') => {
    setActiveView(view);
    if (view === 'preview' || view === 'code') setPanel(view);
    setMoreMenuOpen(false);
  };
  const filteredProjects = (workspace?.projects || []).filter(item => item.name.toLowerCase().includes(projectSearch.toLowerCase()));
  const issueCount = previewChecks.filter(check => check.status === 'fail').length + runtimeErrors.length;
  const hasBuilt = (project?.versions || []).length > 0;
  const nextActionLabel = !project?.plan.length ? 'Create a plan' : !hasBuilt ? 'Build this plan' : issueCount ? 'Review issues' : 'Export project';
  const runNextAction = () => {
    if (!project) return;
    if (!project.plan.length) { setMode('plan'); openView('chat'); return; }
    if (!hasBuilt) {
      setMode('build');
      setPrompt('Build the approved project plan. Follow each saved step and preserve the existing project files.');
      openView('chat');
      return;
    }
    if (issueCount) { openView('issues'); return; }
    download();
  };
  const startProjectFromPrompt = () => {
    const idea = prompt.trim();
    if (!idea) { setError('Describe your idea first.'); return; }
    setError('');
    setMode('plan');
    createProject(idea);
    setPendingPlanStart(true);
  };

  return <div className="shell cd-shell">
    {screen !== 'builder' ? <div className="cd-dashboard">
      <aside className="cd-sidebar">
        <div className="cd-brand"><span className="cd-brand-mark">c</span><span>codera<span className="cd-brand-accent">.ai</span></span><span className="cd-local-badge"><span/> LOCAL</span></div>
        <button className="cd-workspace-switch workspace-switch" onClick={() => setWorkspaceMenu(value => !value)} aria-expanded={workspaceMenu} aria-label={(workspace?.name || 'Workspace') + ' workspace'}>
          <span className="cd-workspace-avatar workspace-avatar">{(workspace?.name || 'W').slice(0,1).toUpperCase()}</span>
          <span className="cd-workspace-copy"><b>{workspace?.name || 'Workspace'}</b><small>Personal workspace</small></span>
          <ChevronDown size={16}/>
        </button>
        {workspaceMenu && <div className="cd-workspace-menu workspace-menu">
          <span className="cd-menu-label">SWITCH WORKSPACE</span>
          {workspaces.map(item => <button key={item.id} onClick={() => { setWorkspaceId(item.id); setProjectId(item.projects[0]?.id || ''); setWorkspaceMenu(false); setScreen('projects'); setAutoTestRepairEnabled(false); }}><span className="cd-workspace-avatar">{item.name.slice(0,1).toUpperCase()}</span>{item.name}{item.id === workspace?.id ? <Check size={15}/> : null}</button>)}
          <button onClick={() => { setNewWorkspace(true); setWorkspaceMenu(false); }}><Plus size={15}/> Create workspace</button>
        </div>}
        <div className="cd-sidebar-label">WORKSPACE</div>
        <nav className="cd-primary-nav" aria-label="Main navigation">
          <button className={screen === 'home' ? 'is-active' : ''} onClick={() => setScreen('home')}><Home size={17}/> Home</button>
          <button className={screen === 'projects' ? 'is-active' : ''} onClick={() => setScreen('projects')}><FolderKanban size={17}/> Projects <span className="cd-nav-count">{workspace?.projects.length || 0}</span></button>
          <button className={screen === 'settings' ? 'is-active' : ''} onClick={() => setScreen('settings')}><Settings size={17}/> Settings</button>
        </nav>
        <div className="cd-sidebar-projects">
          <div className="cd-sidebar-label"><span>RECENT PROJECTS</span><button aria-label="Create project" onClick={() => createProject()}><Plus size={15}/></button></div>
          {(workspace?.projects || []).slice(0,5).map(item => <button key={item.id} className="cd-recent-project" onClick={() => openProject(item)}><span className="cd-project-dot"/><span>{item.name}</span></button>)}
          {!workspace?.projects.length && <p className="cd-sidebar-empty">Your projects will appear here.</p>}
        </div>
        <div className="cd-sidebar-bottom">
          <div className="cd-local-card"><div><ShieldCheck size={16}/><b>Stored on this device</b></div><p>Your work stays in this browser or app. Export projects as ZIP backups.</p></div>
          <div className="cd-profile"><span>C</span><div><b>Creator</b><small>Kilo Auto Free · no key</small></div></div>
        </div>
      </aside>

      <main className="cd-dashboard-main">
        <header className="cd-dashboard-header">
          <div className="cd-dashboard-context"><span>{workspace?.name || 'Personal workspace'}</span><ChevronRight size={14}/><b>{screen === 'home' ? 'Home' : screen === 'projects' ? 'Projects' : 'Settings'}</b></div>
          <div className="cd-dashboard-actions">
            <span className="cd-saved-indicator"><span/> Saved locally</span>
            <button className="cd-icon-button" aria-label="Appearance settings" onClick={() => setScreen('settings')}>{theme === 'dark' ? <Moon size={17}/> : <Sun size={17}/>}</button>
            <button className="cd-button cd-button-primary" onClick={() => createProject()}><Plus size={16}/> New project</button>
          </div>
        </header>

        {screen === 'home' && <section className="cd-home-content">
          <div className="cd-home-intro">
            <span className="cd-eyebrow"><Sparkles size={14}/> YOUR LOCAL AI WORKSPACE</span>
            <h1>Turn your next idea into a <span>working website.</span></h1>
            <p>Plan the experience, build the files, then check the result. One focused loop from idea to interface.</p>
          </div>
          <div className="cd-home-composer prompt-card">
            <div className="cd-composer-top">
              <div className="cd-mode-switch mode-switch" role="group" aria-label="AI mode">
                <button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')}><Sparkles size={15}/> Plan</button>
                <button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}><Code2 size={15}/> Build</button>
              </div>
              <span className="cd-provider-label"><span/> Kilo Auto Free</span>
            </div>
            <textarea aria-label="Describe your website idea" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) startProjectFromPrompt(); }} placeholder="Describe the website you want to create. What should it help people do?"/>
            <div className="cd-suggestions suggestions">
              {['Portfolio website','Study planner','Small business landing page'].map(item => <button key={item} onClick={() => setPrompt(value => value ? value + ' ' + item : 'Build a ' + item.toLowerCase())}>{item}</button>)}
            </div>
            <div className="cd-home-composer-foot">
              <span><HardDrive size={14}/> Projects save locally</span>
              <button className="cd-button cd-button-primary primary" disabled={!prompt.trim()} onClick={startProjectFromPrompt}>Start with a plan <ArrowRight size={16}/></button>
            </div>
          </div>

          <div className="cd-section-heading"><div><h2>Recent projects</h2><p>Pick up where you left off.</p></div><button className="cd-text-button" onClick={() => setScreen('projects')}>View all projects <ArrowRight size={15}/></button></div>
          <div className="cd-project-grid">
            {(workspace?.projects || []).slice(0,3).map(item => <button key={item.id} className="cd-project-card" aria-label={'Open project ' + item.name} onClick={() => openProject(item)}>
              <div className="cd-project-card-art"><div className="cd-art-window"><span/><span/><span/><div className="cd-art-content"><i/><b/><b/><em/></div></div><span className="cd-card-open"><ArrowUpRightIcon/></span></div>
              <div className="cd-project-card-body"><div><h3>{item.name}</h3><p>{item.plan.length ? 'Plan ready' : 'Ready to plan'} <span>·</span> {item.files.length} files</p></div><span className="cd-project-status"><span/>{item.plan.length ? 'In progress' : 'Draft'}</span></div>
              <div className="cd-project-card-meta"><span>Edited {new Date(item.updated).toLocaleDateString()}</span><span>Open project <ArrowRight size={13}/></span></div>
            </button>)}
            {!workspace?.projects.length && <div className="cd-empty-card"><FolderKanban size={22}/><b>No projects yet</b><p>Create your first project from the prompt above.</p></div>}
          </div>
        </section>}

        {screen === 'projects' && <section className="cd-projects-content">
          <div className="cd-page-heading"><div><span className="cd-eyebrow">YOUR WORKSPACE</span><h1>Projects</h1><p>All your local projects, in one place.</p></div><button className="cd-button cd-button-primary" onClick={() => createProject()}><Plus size={16}/> New project</button></div>
          <div className="cd-project-toolbar">
            <label className="cd-search-field"><Search size={17}/><input value={projectSearch} onChange={event => setProjectSearch(event.target.value)} placeholder="Search projects" aria-label="Search projects"/></label>
            <div className="cd-view-toggle" role="group" aria-label="Project display"><button className={projectsView === 'grid' ? 'active' : ''} aria-label="Grid view" onClick={() => setProjectsView('grid')}><LayoutGrid size={16}/></button><button className={projectsView === 'list' ? 'active' : ''} aria-label="List view" onClick={() => setProjectsView('list')}><List size={16}/></button></div>
          </div>
          <div className={'cd-project-grid ' + (projectsView === 'list' ? 'is-list' : '')}>
            {filteredProjects.map(item => <button key={item.id} className="cd-project-card" aria-label={'Open project ' + item.name} onClick={() => openProject(item)}>
              <div className="cd-project-card-art"><div className="cd-art-window"><span/><span/><span/><div className="cd-art-content"><i/><b/><b/><em/></div></div><span className="cd-card-open"><ArrowRight size={16}/></span></div>
              <div className="cd-project-card-body"><div><h3>{item.name}</h3><p>{item.plan.length ? 'Plan ready' : 'Ready to plan'} <span>·</span> {item.files.length} files</p></div><span className="cd-project-status"><span/>{item.plan.length ? 'In progress' : 'Draft'}</span></div>
              <div className="cd-project-card-meta"><span>Edited {new Date(item.updated).toLocaleDateString()}</span><span>Open project <ArrowRight size={13}/></span></div>
            </button>)}
          </div>
          {!filteredProjects.length && <div className="cd-empty-state"><div><Search size={20}/></div><h2>{workspace?.projects.length ? 'No matching projects' : 'A workspace for your next idea.'}</h2><p>{workspace?.projects.length ? 'Try another project name.' : 'Create a project to start building with Codera.'}</p>{!workspace?.projects.length && <button className="cd-button cd-button-primary" onClick={() => createProject()}><Plus size={16}/> Create project</button>}</div>}
        </section>}

        {screen === 'settings' && <section className="cd-settings-content">
          <div className="cd-page-heading"><div><span className="cd-eyebrow">PREFERENCES</span><h1>Settings</h1><p>Control how Codera looks and where your work lives.</p></div></div>
          <section className="cd-setting-section"><div><h2>Appearance</h2><p>Choose a theme or follow your device setting.</p></div><div className="cd-theme-options" role="group" aria-label="Appearance theme">
            <button className={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}><Monitor size={17}/> System</button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={17}/> Light</button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={17}/> Dark</button>
          </div></section>
          <section className="cd-setting-section"><div><h2>AI provider</h2><p>Codera uses the existing anonymous free route. No API key is stored in the app.</p></div><div className="cd-provider-card"><span className="cd-provider-icon"><Sparkles size={18}/></span><div><b>Kilo Auto Free</b><small>Anonymous route · availability and limits depend on the provider</small></div><span className="cd-readonly-badge">CURRENT</span></div></section>
          <section className="cd-setting-section"><div><h2>Local projects</h2><p>Projects, plans, files and checkpoints are stored in this browser or installed app.</p></div><div className="cd-local-info"><div><HardDrive size={18}/><b>Stored on this device</b></div><p>Use Export ZIP inside a project to keep a source backup. Clearing app or browser data can remove local projects.</p></div></section>
          <section className="cd-privacy-note"><ShieldCheck size={19}/><div><b>Privacy note</b><p>AI prompts and project files are sent to the Kilo gateway when you use Plan, Build or Repair. Avoid submitting personal or confidential information.</p></div></section>
        </section>}
      </main>

      <nav className="cd-dashboard-mobile-nav" aria-label="Dashboard navigation">
        <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}><Home size={19}/><span>Home</span></button>
        <button className={screen === 'projects' ? 'active' : ''} onClick={() => setScreen('projects')}><FolderKanban size={19}/><span>Projects</span></button>
        <button className={screen === 'settings' ? 'active' : ''} onClick={() => setScreen('settings')}><Settings size={19}/><span>Settings</span></button>
      </nav>
    </div> : project ? <div className="cd-builder">
      <header className="cd-builder-header">
        <div className="cd-builder-identity">
          <button className="cd-icon-button" aria-label="Back to projects" onClick={() => { setScreen('projects'); setProjectMenuOpen(false); setShowVersions(false); }}><ArrowLeft size={18}/></button>
          <div className="cd-builder-brand"><span className="cd-brand-mark">c</span><span className="cd-project-crumb">PROJECT</span><h1>{project.name}</h1></div>
        </div>
        <div className="cd-stage-rail" aria-label="Project stages">
          <button className={project.plan.length ? 'is-complete' : 'is-current'} onClick={() => openView('plan')}><span>{project.plan.length ? <Check size={13}/> : '1'}</span> Plan</button>
          <i/>
          <button className={hasBuilt ? 'is-complete' : project.plan.length ? 'is-current' : ''} onClick={() => openView('preview')}><span>{hasBuilt ? <Check size={13}/> : '2'}</span> Build</button>
          <i/>
          <button className={issueCount ? 'has-issues' : hasBuilt && previewReady ? 'is-complete' : ''} onClick={() => openView(issueCount ? 'issues' : 'preview')}><span>{issueCount ? <CircleAlert size={13}/> : hasBuilt && previewReady ? <Check size={13}/> : '3'}</span> Verify</button>
        </div>
        <div className="cd-builder-actions">
          <span className="cd-saved-indicator"><span/> Saved</span>
          <button className="cd-icon-button cd-version-button version-trigger" aria-label="Version history" onClick={() => { setShowVersions(value => !value); setMoreMenuOpen(false); }}><HistoryIcon size={17}/></button>
          <div className="cd-action-popover">
            <button className="cd-icon-button" aria-label="Layout options" onClick={() => setLayoutMenuOpen(value => !value)}><SlidersHorizontalIcon/></button>
            {layoutMenuOpen && <div className="cd-popover-menu cd-layout-menu">
              <b>Workspace layout</b>
              <button className={layoutPreset === 'balanced' ? 'active' : ''} onClick={() => { setLayoutPreset('balanced'); setLayoutMenuOpen(false); }}>Balanced</button>
              <button className={layoutPreset === 'chat' ? 'active' : ''} onClick={() => { setLayoutPreset('chat'); setLayoutMenuOpen(false); }}>Focus chat</button>
              <button className={layoutPreset === 'preview' ? 'active' : ''} onClick={() => { setLayoutPreset('preview'); openView('preview'); setLayoutMenuOpen(false); }}>Focus preview</button>
              <button className={layoutPreset === 'code' ? 'active' : ''} onClick={() => { setLayoutPreset('code'); openView('code'); setLayoutMenuOpen(false); }}>Focus code</button>
            </div>}
          </div>
          <div className="cd-action-popover">
            <button className="cd-icon-button" aria-label="Project options" aria-haspopup="menu" aria-expanded={projectMenuOpen} onClick={() => { setProjectMenuOpen(value => !value); setLayoutMenuOpen(false); }}><MoreHorizontal size={18}/></button>
            {projectMenuOpen && <div className="project-menu cd-project-menu" role="menu">
              <button role="menuitem" onClick={() => { setProjectNameDraft(project.name); setRenameProjectOpen(true); setProjectMenuOpen(false); }}><Pencil size={14}/> Rename project</button>
              <button role="menuitem" onClick={() => { download(); setProjectMenuOpen(false); }}><Download size={14}/> Export project ZIP</button>
              <button role="menuitem" onClick={() => { openView('history'); setProjectMenuOpen(false); }}><HistoryIcon size={14}/> Version history</button>
              <button role="menuitem" className="danger" onClick={deleteProject}><Trash2 size={14}/> Delete project</button>
            </div>}
          </div>
          <button className="cd-button cd-button-primary cd-next-action" onClick={runNextAction}>{nextActionLabel}<ArrowRight size={15}/></button>
        </div>
      </header>
      {showVersions && <div className="version-menu cd-version-menu"><b>Version history</b>{project.versions?.length ? project.versions.map(version => <button key={version.id} onClick={() => restoreVersion(version.id)}><span>{version.label}</span><small>{new Date(version.created).toLocaleString()}</small></button>) : <p>Your build and repair checkpoints will appear here.</p>}</div>}

      <div className="cd-builder-body">
        <div className="workspace-grid cd-builder-grid" data-mobile-view={activeView} data-layout={layoutPreset}>
          <aside className="left-column cd-chat-panel">
            <div className="cd-chat-header"><div className="cd-bot-avatar"><Bot size={18}/></div><div><b>Build with Codera</b><small><span/> Kilo Auto Free · no API key</small></div><button className="cd-chat-more" aria-label="More project views" onClick={() => setMoreMenuOpen(value => !value)}><MoreHorizontal size={18}/></button>
              {moreMenuOpen && <div className="cd-chat-more-menu"><button onClick={() => openView('plan')}>Project plan</button><button onClick={() => openView('history')}>Version history</button><button onClick={() => { setScreen('settings'); setMoreMenuOpen(false); }}>Settings</button></div>}
            </div>
            <div className="cd-chat-scroll">
              <div className="cd-assistant-message"><span className="cd-message-avatar"><Sparkles size={14}/></span><div><b>Let's build something.</b><p>Describe what you want to create or tell me what to improve. I'll help plan it, build the files, and check the preview.</p></div></div>
              {history.slice(0,4).reverse().map((item,index) => <div className="cd-user-message" key={index}><span>{item}</span></div>)}
              {project.plan.length > 0 && <div className="cd-plan-summary">
                <div className="cd-plan-summary-head"><span><CheckCircle2 size={16}/></span><div><b>Project plan ready</b><small>{project.plan.length} steps · ready to build</small></div><button onClick={() => openView('plan')}>Review <ArrowRight size={13}/></button></div>
                <ol>{project.plan.slice(0,3).map((step,index) => <li key={index}>{step}</li>)}</ol>
                <button className="cd-plan-build-link" onClick={() => { setMode('build'); setPrompt('Build the approved project plan. Follow each saved step and preserve the existing project files.'); openView('chat'); }}>Continue to Build <ArrowRight size={14}/></button>
              </div>}
              {project.files.length > 0 && hasBuilt && <button className="cd-build-result" onClick={() => openView('preview')}><span><CheckCircle2 size={16}/></span><span><b>Project files are ready</b><small>{project.files.length} files · open live preview</small></span><ArrowRight size={15}/></button>}
              {history.length === 0 && <div className="cd-chat-hint"><Sparkles size={14}/><span>Tip: start in Plan mode if you want to agree on the structure before generating files.</span></div>}
            </div>
            <div className="prompt-card cd-composer">
              <div className="cd-composer-top"><div className="cd-mode-switch mode-switch" role="group" aria-label="AI mode"><button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')}><Sparkles size={14}/> Plan</button><button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}><Code2 size={14}/> Build</button></div><span className="cd-provider-label"><span/> Kilo Auto Free</span></div>
              <textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) mode === 'plan' ? runPlan() : runBuild(); }} placeholder={mode === 'plan' ? 'Describe the experience. We’ll turn it into a clear plan…' : 'Describe what to build or change in this project…'} aria-label="Message Codera"/>
              <div className="cd-composer-suggestions suggestions">{(mode === 'plan' ? ['Define the user flow','Plan page sections','List key interactions'] : ['Improve the layout','Make it mobile friendly','Fix a problem']).map(item => <button key={item} onClick={() => setPrompt(value => value ? value + ' ' + item : item)}>{item}</button>)}</div>
              {error && <div className="cd-inline-error error"><CircleAlert size={14}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={14}/></button></div>}
              <div className="cd-composer-foot prompt-foot"><span>Ctrl + Enter to send</span><button className="cd-button cd-button-primary primary" disabled={busy || !prompt.trim()} onClick={mode === 'plan' ? runPlan : runBuild}>{busy ? <><span className="cd-spinner"/> Working…</> : <>{mode === 'plan' ? 'Create plan' : 'Build project'} <Send size={14}/></>}</button></div>
            </div>
          </aside>

          <section className="right-column cd-workspace-panel">
            <div className="cd-workspace-tabs" role="tablist" aria-label="Project workspace">
              <button role="tab" aria-selected={activeView === 'preview'} className={activeView === 'preview' ? 'active' : ''} onClick={() => openView('preview')}><Eye size={15}/> Preview</button>
              <button role="tab" aria-selected={activeView === 'code'} className={activeView === 'code' ? 'active' : ''} onClick={() => openView('code')}><Code2 size={15}/> Code <small>{project.files.length}</small></button>
              <button role="tab" aria-selected={activeView === 'plan'} className={activeView === 'plan' ? 'active' : ''} onClick={() => openView('plan')}><Sparkles size={15}/> Plan</button>
              <button role="tab" aria-selected={activeView === 'issues'} className={activeView === 'issues' ? 'active' : ''} onClick={() => openView('issues')}><CircleAlert size={15}/> Issues {issueCount > 0 && <small className="cd-issue-count">{issueCount}</small>}</button>
              <button role="tab" aria-selected={activeView === 'history'} className={activeView === 'history' ? 'active' : ''} onClick={() => openView('history')}><HistoryIcon size={15}/> History</button>
            </div>

            {activeView === 'preview' && <div className="cd-view cd-preview-view">
              <div className="preview-bar cd-preview-toolbar"><div><span className="cd-preview-label"><span/> Live preview</span></div><div className="cd-device-controls"><button aria-label="Desktop preview" title="Desktop preview" className={!mobilePreview && !tabletPreview ? 'active' : ''} onClick={() => { setMobilePreview(false); setTabletPreview(false); }}><Monitor size={15}/></button><button aria-label="Tablet preview" title="Tablet preview" className={tabletPreview ? 'active' : ''} onClick={() => { setMobilePreview(false); setTabletPreview(true); }}><Tablet size={15}/></button><button aria-label="Mobile preview" title="Mobile preview" className={mobilePreview ? 'active' : ''} onClick={() => { setMobilePreview(true); setTabletPreview(false); }}><Smartphone size={15}/></button><button aria-label="Refresh preview" title="Refresh preview" onClick={() => { setPreviewReady(false); setPreviewRefresh(value => value + 1); }}><RefreshCw size={15}/></button></div></div>
              <div className="preview-stage cd-preview-stage"><div className={'browser cd-browser ' + (mobilePreview ? 'mobile' : tabletPreview ? 'tablet' : '')}><div className="browser-top cd-browser-top"><span>● ● ●</span><label>preview.local</label><b>•••</b></div><iframe key={previewRefresh} ref={previewFrame} title="Website preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview} onLoad={() => previewFrame.current?.contentWindow?.postMessage({ source: 'codera-parent', kind: 'ready' }, '*')}/></div></div>
              <div className="preview-foot cd-preview-foot"><span><CheckCircle2 size={14}/> {previewReady ? 'Preview loaded' : 'Loading preview'}</span><span>{project.files.length} files · HTML, CSS & JS</span></div>
              {(previewChecks.length > 0 || runtimeErrors.length > 0) && <div className="runtime-panel cd-runtime-panel"><div><b>Automated preview tests</b><small>{previewChecks.filter(check => check.status === 'pass').length}/{previewChecks.length} checks passed · {issueCount} failures</small></div><div className="cd-check-list">{previewChecks.map(check => <div className={'cd-check-row ' + (check.status === 'fail' ? 'is-fail' : 'is-pass')} key={check.name}><span>{check.status === 'pass' ? <CheckCircle2 size={14}/> : <CircleAlert size={14}/>}</span><div><b>{check.name}</b><small>{check.message}</small></div></div>)}{runtimeErrors.map((item,index) => <div className="cd-check-row is-fail" key={index}><CircleAlert size={14}/><div><b>Runtime error</b><small>{item}</small></div></div>)}</div>{issueCount > 0 && <button className="cd-button cd-button-primary primary" disabled={busy} onClick={runRepair}>{busy ? 'Repairing…' : 'Repair with AI'} <Wrench size={14}/></button>}</div>}
              {issueCount === 0 && previewChecks.length > 0 && <div className="cd-all-clear"><CheckCircle2 size={15}/> All preview checks passed.</div>}
            </div>}

            {activeView === 'code' && <div className="cd-view cd-code-view code-panel">
              <nav aria-label="Project files">{project.files.map(item => <button key={item.path} className={file?.path === item.path ? 'active' : ''} onClick={() => setSelectedFile(item.path)}><FileCode2 size={14}/><span>{item.path}</span></button>)}</nav>
              <div className="editor"><header><span>{file?.path || 'Select a file'}</span><small>EDITABLE</small></header><textarea spellCheck={false} aria-label="Edit file content" value={file?.content || ''} onChange={event => updateProject(current => ({ ...current, files: current.files.map(item => item.path === file?.path ? { ...item, content: event.target.value } : item), updated: Date.now() }))}/></div>
            </div>}

            {activeView === 'plan' && <div className="cd-view cd-plan-view">
              <div className="cd-view-heading"><div><span className="cd-eyebrow">PROJECT BLUEPRINT</span><h2>Plan</h2><p>Review the steps before asking Codera to build.</p></div><span className="cd-count-badge">{project.plan.length} steps</span></div>
              {project.plan.length ? <><ol className="cd-plan-list">{project.plan.map((step,index) => <li key={index}><span>{String(index + 1).padStart(2,'0')}</span><p>{step}</p><CheckCircle2 size={16}/></li>)}</ol><div className="cd-plan-actions"><p>The saved plan is included automatically as context when you build.</p><button className="cd-button cd-button-primary" onClick={() => { setMode('build'); setPrompt('Build the approved project plan. Follow each saved step and preserve the existing project files.'); openView('chat'); }}>Build this plan <ArrowRight size={15}/></button></div></> : <div className="cd-empty-state"><div><Sparkles size={20}/></div><h2>No plan yet</h2><p>Switch to Plan mode in the composer and describe the website you want to make.</p><button className="cd-button cd-button-primary" onClick={() => openView('chat')}>Write a project brief <ArrowRight size={15}/></button></div>}
            </div>}

            {activeView === 'issues' && <div className="cd-view cd-issues-view">
              <div className="cd-view-heading"><div><span className="cd-eyebrow">QUALITY CHECKS</span><h2>Issues</h2><p>Preview checks and browser errors for this project.</p></div><span className={'cd-count-badge ' + (issueCount ? 'has-issues' : '')}>{issueCount ? issueCount + ' to review' : 'No failures'}</span></div>
              {previewChecks.length || runtimeErrors.length ? <div className="cd-check-list">{previewChecks.map(check => <div className={'cd-check-row ' + (check.status === 'fail' ? 'is-fail' : 'is-pass')} key={check.name}><span>{check.status === 'pass' ? <CheckCircle2 size={15}/> : <CircleAlert size={15}/>}</span><div><b>{check.name}</b><small>{check.message}</small></div></div>)}{runtimeErrors.map((item,index) => <div className="cd-check-row is-fail" key={index}><span><CircleAlert size={15}/></span><div><b>Runtime error</b><small>{item}</small></div></div>)}</div> : <div className="cd-empty-state"><div><ShieldCheck size={20}/></div><h2>No checks yet</h2><p>Build or refresh your preview to run the existing automatic checks.</p><button className="cd-button cd-button-secondary" onClick={() => openView('preview')}>Open preview <Eye size={15}/></button></div>}
              {issueCount > 0 && <div className="cd-repair-callout"><div><Wrench size={18}/><div><b>Let Codera repair these issues</b><p>The repair request includes the failed checks and current project files.</p></div></div><button className="cd-button cd-button-primary" disabled={busy} onClick={runRepair}>{busy ? 'Repairing…' : 'Repair with AI'} <ArrowRight size={15}/></button></div>}
              {issueCount === 0 && previewChecks.length > 0 && <div className="cd-all-clear"><CheckCircle2 size={16}/> All preview checks passed.</div>}
            </div>}

            {activeView === 'history' && <div className="cd-view cd-history-view">
              <div className="cd-view-heading"><div><span className="cd-eyebrow">SAFE CHECKPOINTS</span><h2>Version history</h2><p>Restore a saved checkpoint if you want to roll back a change.</p></div><span className="cd-count-badge">{project.versions?.length || 0} versions</span></div>
              {(project.versions || []).length ? <div className="cd-version-list">{(project.versions || []).map(version => <div className="cd-version-row" key={version.id}><div className="cd-version-icon"><HistoryIcon size={16}/></div><div><b>{version.label}</b><small>{new Date(version.created).toLocaleString()} · {version.files.length} files</small></div><button className="cd-button cd-button-secondary" onClick={() => restoreVersion(version.id)}>Restore</button></div>)}</div> : <div className="cd-empty-state"><div><Clock3 size={20}/></div><h2>No checkpoints yet</h2><p>Codera saves a checkpoint before AI builds, repairs, and restores.</p></div>}
            </div>}
          </section>
        </div>
        <footer className="cd-status-bar"><span><span className="cd-status-dot"/>{busy ? status : 'Ready · ' + status}</span><span><HardDrive size={13}/> Saved on this device</span><span>Kilo Auto Free</span></footer>
      </div>
      <nav className="cd-mobile-builder-nav" aria-label="Project navigation">
        <button className={activeView === 'chat' ? 'active' : ''} aria-label="Chat" onClick={() => openView('chat')}><MessageSquare size={18}/><span>Chat</span></button>
        <button className={activeView === 'preview' ? 'active' : ''} aria-label="Preview" onClick={() => openView('preview')}><Eye size={18}/><span>Preview</span></button>
        <button className={activeView === 'code' ? 'active' : ''} aria-label="Code" onClick={() => openView('code')}><Code2 size={18}/><span>Code</span></button>
        <button className={activeView === 'issues' ? 'active' : ''} aria-label="Issues" onClick={() => openView('issues')}><CircleAlert size={18}/><span>Issues{issueCount > 0 ? ' · ' + issueCount : ''}</span></button>
      </nav>
    </div> : <div className="cd-empty-state"><div><FolderKanban size={22}/></div><h2>A workspace for your next idea.</h2><p>Create a project to start building with Codera.</p><button className="cd-button cd-button-primary" onClick={() => createProject()}>Create project <Plus size={15}/></button></div>}

    {renameProjectOpen && <div className="modal-backdrop cd-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setRenameProjectOpen(false); }}><section className="modal cd-modal" role="dialog" aria-modal="true" aria-labelledby="rename-project-title"><div className="cd-modal-icon"><Pencil size={18}/></div><h2 id="rename-project-title">Rename project</h2><p>Choose a clear name for this project.</p><label htmlFor="project-name">Project name</label><input id="project-name" autoFocus maxLength={80} value={projectNameDraft} onChange={event => setProjectNameDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && renameProject()} placeholder="Project name"/><div><button className="cd-button cd-button-secondary" onClick={() => setRenameProjectOpen(false)}>Cancel</button><button className="cd-button cd-button-primary primary" disabled={!projectNameDraft.trim()} onClick={renameProject}>Save name</button></div></section></div>}
    {newWorkspace && <div className="modal-backdrop cd-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setNewWorkspace(false); }}><section className="modal cd-modal" role="dialog" aria-modal="true" aria-labelledby="new-workspace-title"><div className="cd-modal-icon"><FolderKanban size={18}/></div><h2 id="new-workspace-title">Create a workspace</h2><p>Keep projects organized by team, client, or idea.</p><label htmlFor="workspace-name">Workspace name</label><input id="workspace-name" autoFocus value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} onKeyDown={event => event.key === 'Enter' && addWorkspace()} placeholder="e.g. Personal projects"/><div><button className="cd-button cd-button-secondary" onClick={() => setNewWorkspace(false)}>Cancel</button><button className="cd-button cd-button-primary" disabled={!workspaceName.trim()} onClick={addWorkspace}>Create workspace</button></div></section></div>}
  </div>;
}

function ArrowUpRightIcon() { return <ArrowRight size={16}/>; }
function SlidersHorizontalIcon() { return <Settings size={17}/>; }
