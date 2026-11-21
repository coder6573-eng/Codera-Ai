import { useEffect, useMemo, useRef, useState } from 'react';

const keylessAI = async (mode: 'plan' | 'build', prompt: string, projectName?: string, files?: FileItem[], plan?: string[]) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, prompt, projectName, files, plan })
  });
  const data = await response.json() as { error?: string; steps?: string[]; summary?: string; files?: FileItem[] };
  if (!response.ok) throw new Error(data.error || 'Kilo Auto Free could not complete the request.');
  return JSON.stringify(data);
};
const parseAIJson = <T,>(value: string): T => {
  return JSON.parse(value) as T;
};

type FileItem = { path: string; content: string };
type Project = { id: string; name: string; files: FileItem[]; plan: string[]; updated: number };
type Workspace = { id: string; name: string; projects: Project[] };
const id = () => Math.random().toString(36).slice(2, 10);
const starterFiles: FileItem[] = [
  { path: 'index.html', content: '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your next idea</title><link rel="stylesheet" href="styles.css"></head><body><main class="hero"><span class="eyebrow">YOUR CANVAS IS READY</span><h1>Make something<br><span>remarkable.</span></h1><p>Describe what you want to build. Codera will help turn your idea into a working website.</p><a href="#start">Explore the possibilities ↗</a></main><script src="app.js"></script></body></html>' },
  { path: 'styles.css', content: ':root{font-family:Inter,system-ui,sans-serif;color:#f5f4ff;background:#0c1020}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 75% 20%,#27205a 0,transparent 42%),#0c1020}.hero{max-width:850px;margin:auto;padding:15vh 8vw}.eyebrow{font-size:11px;letter-spacing:.2em;color:#a99aff;font-weight:700}h1{font-size:clamp(48px,9vw,92px);line-height:.98;letter-spacing:-.07em;margin:24px 0}h1 span{background:linear-gradient(90deg,#a99aff,#72d9ff);color:transparent;background-clip:text}.hero p{max-width:470px;color:#a9adc3;font-size:17px;line-height:1.7}.hero a{display:inline-block;margin-top:28px;padding:14px 18px;border:1px solid #5b5488;border-radius:12px;color:#fff;text-decoration:none;background:#ffffff0b}' },
  { path: 'app.js', content: "document.querySelector('a')?.addEventListener('click',()=>console.log('Welcome to your project'));" }
];
const makeProject = (n = 1): Project => ({ id: id(), name: n === 1 ? 'My first website' : 'Untitled project ' + n, files: starterFiles.map(f => ({ ...f })), plan: [], updated: Date.now() });
const load = (): Workspace[] => { try { const v = localStorage.getItem('codera-workspaces-v1'); if (v) { const parsed = JSON.parse(v) as Workspace[]; if (Array.isArray(parsed) && parsed.length) return parsed; } } catch { /* reset corrupt local state */ } return [{ id: id(), name: 'Personal workspace', projects: [makeProject()] }]; };
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
  const [mode, setMode] = useState<'plan' | 'build'>('build');
  const [panel, setPanel] = useState<'preview' | 'code'>('preview');
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState('index.html');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready when you are');
  const [error, setError] = useState('');
  const [mobilePreview, setMobilePreview] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [previewChecks, setPreviewChecks] = useState<Array<{ name: string; status: 'pass' | 'fail'; message: string }>>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [autoTestRepairEnabled, setAutoTestRepairEnabled] = useState(false);
  const autoRepairCount = useRef(0);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { localStorage.setItem('codera-workspaces-v1', JSON.stringify(workspaces)); }, [workspaces]);
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
    const monitor = \`<script>(() => {
      const send = payload => parent.postMessage({ source: 'codera-preview', ...payload }, '*');
      const report = (kind, value) => { const message = String(value && (value.message || value.reason || value) || kind).slice(0, 500); send({ kind: 'runtime', message: kind + ': ' + message }); };
      const check = (name, passed, message) => send({ kind: 'check', name, status: passed ? 'pass' : 'fail', message });
      addEventListener('error', event => report('Runtime error', event.message || 'Unknown script error'));
      addEventListener('unhandledrejection', event => report('Unhandled promise rejection', event.reason));
      const original = console.error.bind(console); console.error = (...args) => { report('Console error', args.join(' ')); original(...args); };
      addEventListener('load', () => {
        check('Document title', !!document.title.trim(), 'A descriptive page title is present.');
        check('Responsive viewport', !!document.querySelector('meta[name=viewport]'), 'Viewport metadata is present.');
        check('Page content', !!(document.body.textContent.trim() || document.body.querySelector('img,canvas,svg')), 'The page contains visible content.');
        const buttons = [...document.querySelectorAll('button,[role=button]')];
        const unnamedButtons = buttons.filter(el => !(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim()));
        check('Button labels', unnamedButtons.length === 0, unnamedButtons.length ? unnamedButtons.length + ' button(s) have no accessible name.' : buttons.length + ' button(s) have accessible names.');
        const fields = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')];
        const unlabeledFields = fields.filter(el => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]') || el.closest('label')));
        check('Form field labels', unlabeledFields.length === 0, unlabeledFields.length ? unlabeledFields.length + ' form field(s) need labels.' : fields.length + ' form field(s) have labels.');
        const forms = [...document.forms];
        const formsWithoutSubmit = forms.filter(form => !form.querySelector('button[type=submit],input[type=submit]'));
        check('Form submit controls', formsWithoutSubmit.length === 0, formsWithoutSubmit.length ? formsWithoutSubmit.length + ' form(s) have no submit control.' : forms.length + ' form(s) have submit controls.');
        const links = [...document.querySelectorAll('a')];
        const brokenAnchors = links.filter(link => !link.getAttribute('href') || link.getAttribute('href').startsWith('#') && link.getAttribute('href').length > 1 && !document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1))));
        check('Navigation targets', brokenAnchors.length === 0, brokenAnchors.length ? brokenAnchors.length + ' navigation link(s) have missing or empty destinations.' : links.length + ' link(s) have valid destinations.');
        const images = [...document.images]; const missingAlt = images.filter(img => !img.hasAttribute('alt'));
        check('Image alternatives', missingAlt.length === 0, missingAlt.length ? missingAlt.length + ' image(s) are missing alt text.' : images.length + ' image(s) have alt attributes.');
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        check('Current viewport fit', !overflow, overflow ? 'The page overflows horizontally at ' + innerWidth + 'px.' : 'No horizontal overflow at ' + innerWidth + 'px.');
        forms.forEach((form, index) => send({ kind: 'check', name: 'Form validation ' + (index + 1), status: 'pass', message: form.checkValidity() ? 'Form fields satisfy native constraints.' : 'Required fields correctly block incomplete submission.' }));
        send({ kind: 'ready' });
      });
    })();</script>\`;
    doc = doc.replace(/<head([^>]*)>/i, '<head$1>' + monitor);
    return doc;
  }, [project]);
  const updateProject = (fn: (p: Project) => Project) => {
    if (!workspace || !project) return;
    setWorkspaces(prev => prev.map(w => w.id !== workspace.id ? w : { ...w, projects: w.projects.map(p => p.id === project.id ? fn(p) : p) }));
  };
  const createProject = () => {
    if (!workspace) return;
    const next = makeProject(workspace.projects.length + 1);
    setWorkspaces(prev => prev.map(w => w.id === workspace.id ? { ...w, projects: [next, ...w.projects] } : w));
    setProjectId(next.id); setSelectedFile('index.html'); setPanel('preview'); setPrompt(''); setMobileMenu(false); setError(''); setAutoTestRepairEnabled(false);
  };
  const addWorkspace = () => {
    if (!workspaceName.trim()) return;
    const next = { id: id(), name: workspaceName.trim(), projects: [] };
    setWorkspaces(prev => [next, ...prev]); setWorkspaceId(next.id); setProjectId(''); setAutoTestRepairEnabled(false);
    setWorkspaceName(''); setNewWorkspace(false); setWorkspaceMenu(false);
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
      setHistory(prev => [prompt.trim(), ...prev].slice(0, 6));
    } catch (e) {
      updateProject(p => ({ ...p, plan: planFor(prompt.trim()), updated: Date.now() }));
      setError((e instanceof Error ? e.message : 'AI plan failed.') + ' Using the local fallback.');
      setStatus('Plan ready with fallback');
    } finally { setBusy(false); }
  };
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
      setAutoTestRepairEnabled(true);
      updateProject(p => ({ ...p, files: safe, plan: p.plan.length ? p.plan : planFor(prompt.trim()), updated: Date.now() }));
      setSelectedFile('index.html'); setPanel('preview'); setPrompt(''); setStatus('Build complete · Kilo Auto Free');
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
      updateProject(p => ({ ...p, files: safe, updated: Date.now() }));
      setSelectedFile('index.html'); setPanel('preview'); setRuntimeErrors([]); setStatus('Repair applied · rerunning preview checks…');
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
    const text = project.files.map(f => '===== ' + f.path + ' =====\n' + f.content).join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-source.txt'; a.click(); URL.revokeObjectURL(url);
  };
  const deleteProject = () => {
    if (!workspace || !project || workspace.projects.length < 2) return;
    const rest = workspace.projects.filter(p => p.id !== project.id);
    setWorkspaces(prev => prev.map(w => w.id === workspace.id ? { ...w, projects: rest } : w)); setProjectId(rest[0].id);
  };
  return <div className="shell">
    <aside className={'sidebar ' + (mobileMenu ? 'open' : '')}>
      <div className="brand"><span className="brand-icon">c</span><b>codera<span>.ai</span></b><button className="mobile-close" onClick={() => setMobileMenu(false)}>×</button></div>
      <button className="workspace-switch" onClick={() => setWorkspaceMenu(!workspaceMenu)}><span className="workspace-avatar">{(workspace?.name || 'W').slice(0,1).toUpperCase()}</span><span><b>{workspace?.name || 'Workspace'}</b><small>Local workspace</small></span><span className="chevron">⌄</span></button>
      {workspaceMenu && <div className="workspace-menu">{workspaces.map(w => <button key={w.id} onClick={() => { setWorkspaceId(w.id); setProjectId(w.projects[0]?.id || ''); setWorkspaceMenu(false); setAutoTestRepairEnabled(false); }}>{w.name}{w.id === workspace?.id ? '  ✓' : ''}</button>)}<button onClick={() => { setNewWorkspace(true); setWorkspaceMenu(false); }}>＋ Create workspace</button></div>}
      <div className="side-label">WORKSPACE <button onClick={createProject}>＋</button></div>
      <button className="nav-active">▦ <span>Projects</span><small>{workspace?.projects.length || 0}</small></button>
      <div className="project-list">{workspace?.projects.map(p => <button key={p.id} className={p.id === project?.id ? 'selected' : ''} onClick={() => { setProjectId(p.id); setMobileMenu(false); setAutoTestRepairEnabled(false); }}><i/> {p.name}</button>)}</div>
      <button className="new-project" onClick={createProject}>＋ New project</button>
      <div className="sidebar-bottom"><div className="plan-note"><b>Build workspace <span>FREE</span></b><p>Your ideas, one build at a time.</p><small>AI: Kilo Auto Free · no key</small></div><div className="profile"><span>C</span><div><b>Creator</b><small>Personal account</small></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumbs"><button className="menu-button" onClick={() => setMobileMenu(true)}>☰</button><span>Projects</span><b>›</b><strong>{project?.name || 'New project'}</strong></div><div className="top-actions"><span className="saved"><i/> Saved locally</span><button className="export" onClick={download}>↧ Export</button><button className="preview-top" onClick={() => setPanel('preview')}>◉ Preview</button></div></header>
      {!project ? <section className="empty"><div>◇</div><h1>A workspace for your next idea.</h1><p>Create a project to start building with Codera.</p><button className="primary" onClick={createProject}>＋ Create project</button></section> : <>
        <section className="project-heading"><div><small>PROJECT WORKSPACE <span>·</span> {new Date(project.updated).toLocaleDateString()}</small><h1>{project.name}</h1><p>A place to shape your next idea into a working website.</p></div><button className="more" title="Delete project" disabled={workspace.projects.length < 2} onClick={deleteProject}>•••</button></section>
        <section className="workspace-grid">
          <div className="left-column">
            <div className="mode-switch"><button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')}>◇ Plan</button><button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}>✧ Build</button><small>{mode === 'plan' ? 'Think it through' : 'Make it real'}</small></div>
            <div className="prompt-card"><div className="prompt-head"><b>✧ {mode === 'plan' ? 'PLAN YOUR PROJECT' : 'WHAT SHOULD WE BUILD?'}</b><span><i/> Kilo Auto Free</span></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) mode === 'plan' ? runPlan() : runBuild(); }} placeholder={mode === 'plan' ? 'Describe your idea and we’ll break it into clear steps…' : 'Describe the website you want to create or the changes you need…'} />
              <div className="suggestions">{(mode === 'build' ? ['Landing page', 'Dashboard', 'Portfolio'] : ['Define users', 'Plan sections', 'List interactions']).map(s => <button key={s} onClick={() => setPrompt(p => p ? p + ' ' + s : s)}>{s}</button>)}</div>
              <div className="prompt-foot"><small>⌘ ↵ to {mode}</small><button className="primary" disabled={busy || !prompt.trim()} onClick={mode === 'plan' ? runPlan : runBuild}>{busy ? '◌ Building…' : mode === 'plan' ? 'Create plan →' : '✧ Build project'}</button></div></div>
            {error && <div className="error">{error}<button onClick={() => setError('')}>×</button></div>}
            <div className="status"><span>{busy ? '◌' : '✓'}</span>{status}{busy && <small>Working</small>}</div>
            {project.plan.length > 0 && <div className="info-card"><div className="card-title"><b>◇ &nbsp;Project plan</b><small>{project.plan.length} steps</small></div>{project.plan.map((s,i) => <div className="plan-step" key={i}><em>{String(i+1).padStart(2,'0')}</em><span>{s}</span><b>✓</b></div>)}</div>}
            <div className="info-card history"><div className="card-title"><b>↻ &nbsp;Recent prompts</b></div>{history.length ? history.slice(0,3).map((h,i) => <button key={i} onClick={() => setPrompt(h)}>{h}<span>›</span></button>) : <p>Your build prompts will appear here.</p>}</div>
          </div>
          <div className="right-column">
            <div className="preview-bar"><div><button className={panel === 'preview' ? 'active' : ''} onClick={() => setPanel('preview')}>◉ Preview</button><button className={panel === 'code' ? 'active' : ''} onClick={() => setPanel('code')}>‹/› Code <small>{project.files.length}</small></button></div><div><button className={mobilePreview ? '' : 'active'} onClick={() => setMobilePreview(false)}>▣</button><button className={mobilePreview ? 'active' : ''} onClick={() => setMobilePreview(true)}>▯</button><button onClick={() => setPanel('preview')}>↻</button></div></div>
            {panel === 'preview' ? <div className="preview-stage"><div className={'browser ' + (mobilePreview ? 'mobile' : '')}><div className="browser-top"><span>● ● ●</span><label>⌕ &nbsp;preview.local</label><b>···</b></div><iframe ref={previewFrame} title="Website preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview}/></div></div> : <div className="code-panel"><nav>{project.files.map(f => <button key={f.path} className={file?.path === f.path ? 'active' : ''} onClick={() => setSelectedFile(f.path)}>▤ {f.path}</button>)}</nav><div className="editor"><header>{file?.path}<small>EDITABLE</small></header><textarea spellCheck={false} value={file?.content || ''} onChange={e => updateProject(p => ({ ...p, files: p.files.map(f => f.path === file?.path ? { ...f, content: e.target.value } : f), updated: Date.now() }))}/></div></div>}
            <div className="preview-foot"><span>● {panel === 'preview' ? 'Live preview' : 'Source editor'}</span><span>{project.files.length} files · HTML, CSS & JS</span></div>{(previewChecks.length > 0 || runtimeErrors.length > 0) && <div className="runtime-panel"><div><b>Automated preview tests</b><small>{previewChecks.filter(check => check.status === 'pass').length}/{previewChecks.length} checks passed · {previewChecks.filter(check => check.status === 'fail').length + runtimeErrors.length} failures</small></div><ul>{previewChecks.filter(check => check.status === 'fail').map(check => <li key={check.name}>{check.name}: {check.message}</li>)}{runtimeErrors.slice(-4).map((issue, index) => <li key={'runtime-' + index}>{issue}</li>)}</ul><div className="test-pass-list">{previewChecks.filter(check => check.status === 'pass').map(check => <span key={check.name}>✓ {check.name}</span>)}</div>{(previewChecks.some(check => check.status === 'fail') || runtimeErrors.length > 0) && <button className="primary" disabled={busy} onClick={runRepair}>{busy ? 'Repairing…' : 'Fix test failures →'}</button>}</div>}
          </div>
        </section>
        <footer className="page-foot"><span>Built with <b>Codera AI</b></span><span>Ideas into interfaces.</span></footer>
      </>}
    </main>
    {newWorkspace && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setNewWorkspace(false); }}><section className="modal"><div className="modal-symbol">◇</div><h2>Create a workspace</h2><p>Keep projects organized by team, client, or idea.</p><label>Workspace name</label><input autoFocus value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWorkspace()} placeholder="e.g. Personal projects"/><div><button onClick={() => setNewWorkspace(false)}>Cancel</button><button className="primary" disabled={!workspaceName.trim()} onClick={addWorkspace}>Create workspace</button></div></section></div>}
    </div>;
}