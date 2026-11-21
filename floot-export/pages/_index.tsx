import React, { useEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronLeft, Code2, Eye, Folder, Hammer, ListChecks, Menu, Plus, Sparkles, WandSparkles } from "lucide-react";
import styles from "./_index.module.css";

type Mode = "plan" | "build";
type Workspace = { id: string; name: string };
type Project = { id: string; workspaceId: string; name: string; prompt: string; planJson: any; status: string; updatedAt: string };
type FileItem = { path: string; content: string; language: string };

const ideas = [
  { title: "Personal portfolio", prompt: "Build a polished personal portfolio with a hero, projects, about section, skills, contact form, dark/light theme toggle, and smooth responsive interactions." },
  { title: "SaaS dashboard", prompt: "Build a responsive SaaS analytics dashboard with sidebar navigation, KPI cards, charts, activity feed, filters, empty states, and a mobile navigation." },
  { title: "Online store", prompt: "Build a modern online store with product cards, search, category filters, product details, cart drawer, quantity controls, and persistent cart state." },
];

function slugName(prompt: string) {
  const words = prompt.replace(/[^a-z0-9 ]/gi, "").trim().split(/\s+/).slice(0, 5);
  return words.length ? words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ") : "Untitled project";
}

function previewHtml(files: FileItem[]) {
  const html = files.find((f) => f.path === "index.html")?.content ?? "";
  const css = files.find((f) => f.path === "styles.css")?.content ?? "";
  const js = files.find((f) => f.path === "app.js")?.content ?? "";
  return html
    .replace(/<link[^>]+href=["'](?:\.\/)?styles\.css["'][^>]*>/i, "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>")
    .replace(/<script[^>]+src=["'](?:\.\/)?app\.js["'][^>]*><\/script>/i, "<script>" + js.replace(/<\/script/gi, "<\\/script") + "</script>");
}

export default function HomePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("build");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [preview, setPreview] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => { bootstrap(); }, []);

  async function bootstrap() {
    try {
      const wr = await fetch("/_api/workspaces");
      const wd = await wr.json();
      if (!wr.ok) throw new Error(wd.error || "Could not load workspaces.");
      let available: Workspace[] = wd.workspaces ?? [];
      let id = localStorage.getItem("codera.workspace");
      if (!id || !available.some((w) => w.id === id)) {
        const r = await fetch("/_api/workspaces", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: "My workspace" }) });
        const d = await r.json();
        const newId = String(d.workspace.id);
        id = newId;
        localStorage.setItem("codera.workspace", newId);
        available = [d.workspace, ...available];
      }
      if (!id) throw new Error("Workspace could not be created.");
      const r = await fetch("/_api/projects?workspaceId=" + encodeURIComponent(id));
      const d = await r.json();
      const selected = available.find((w) => w.id === id);
      setWorkspaces(available);
      setWorkspace(selected ?? { id, name: "My workspace" });
      setProjects(d.projects ?? []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load your workspace."); }
  }

  async function refreshProjects() {
    if (!workspace) return;
    const r = await fetch("/_api/projects?workspaceId=" + encodeURIComponent(workspace.id));
    const d = await r.json();
    setProjects(d.projects ?? []);
  }

  async function openProject(projectId: string) {
    setNotice("");
    const r = await fetch("/_api/project?projectId=" + encodeURIComponent(projectId));
    const d = await r.json();
    if (!r.ok) { setNotice(d.error || "Could not open project."); return; }
    setActive(d.project);
    setFiles(d.files ?? []);
    setPlan(d.project.planJson);
    setPrompt("");
    setMobileNav(false);
  }

  async function createProject(promptValue: string) {
    if (!workspace) throw new Error("Workspace is not ready.");
    const r = await fetch("/_api/projects", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ workspaceId: workspace.id, name: slugName(promptValue), prompt: promptValue }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Could not create project.");
    setProjects((p) => [d.project, ...p]);
    setActive(d.project);
    setFiles([]);
    return d.project;
  }

  async function send() {
    const value = prompt.trim();
    if (!value || busy) return;
    setBusy(true); setNotice("");
    try {
      const project = active ?? await createProject(value);
      if (mode === "plan") {
        const r = await fetch("/_api/project_plan", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ projectId: project.id, prompt: value }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Plan failed.");
        setPlan(d.plan); setActive((p) => p ? {...p, planJson: d.plan, status: "planned"} : p);
      } else {
        const r = await fetch("/_api/project_build", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ projectId: project.id, prompt: value, plan: plan ?? project.planJson }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Build failed.");
        const fresh = await fetch("/_api/project?projectId=" + encodeURIComponent(project.id));
        const fd = await fresh.json();
        setActive(fd.project); setFiles(fd.files ?? []); setPlan(fd.project.planJson);
      }
      await refreshProjects();
      setPrompt("");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Codera could not complete the request."); }
    finally { setBusy(false); }
  }

  function newProject() {
    setActive(null); setFiles([]); setPlan(null); setPrompt(""); setNotice(""); setMobileNav(false);
  }

  const iframeSrc = useMemo(() => files.length ? previewHtml(files) : "", [files]);
  const fileCount = files.length;

  return <main className={styles.app}>
    <aside className={mobileNav ? styles.sidebar + " " + styles.sidebarOpen : styles.sidebar}>
      <div className={styles.brand}><span className={styles.logo}><Code2 size={17}/></span><span>codera<span>.ai</span></span></div>
      <button className={styles.newProject} onClick={newProject}><Plus size={16}/> New project</button>
      <div className={styles.sideSection}><div className={styles.sideLabel}><span>WORKSPACE</span><button className={styles.sidePlus} aria-label="Create workspace" onClick={async () => { const name = window.prompt("Workspace name", "New workspace"); if (!name?.trim()) return; try { const r = await fetch("/_api/workspaces", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim()})}); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not create workspace."); localStorage.setItem("codera.workspace", d.workspace.id); setWorkspaces((w) => [d.workspace, ...w]); setWorkspace({id:d.workspace.id,name:d.workspace.name}); setProjects([]); setActive(null); setFiles([]); setPlan(null); setNotice(""); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create workspace."); } }}>+</button></div><div className={styles.workspaceSwitcher}><select aria-label="Workspace" value={workspace?.id ?? ""} onChange={async (e) => { const next = workspaces.find((w) => w.id === e.target.value); if (!next) return; localStorage.setItem("codera.workspace", next.id); setWorkspace(next); setActive(null); setFiles([]); setPlan(null); setNotice(""); const r = await fetch("/_api/projects?workspaceId=" + encodeURIComponent(next.id)); const d = await r.json(); if (r.ok) setProjects(d.projects ?? []); else setNotice(d.error || "Could not load projects."); }}><option value="" disabled>Select workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div></div>
      <div className={styles.sideSection}><div className={styles.sideLabel}><span>PROJECTS</span><span>{projects.length}</span></div>
        <div className={styles.projectList}>{projects.map((p) => <button key={p.id} className={active?.id === p.id ? styles.projectActive : styles.projectItem} onClick={() => openProject(p.id)}><Folder size={14}/><span>{p.name}</span></button>)}</div>
      </div>
      <div className={styles.sidebarFoot}><span>Auto Free model</span><small>kilo-auto/free</small></div>
    </aside>

    {mobileNav && <button className={styles.scrim} aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}><button className={styles.menu} onClick={() => setMobileNav(true)}><Menu size={18}/></button>{active ? <><ChevronLeft size={15}/><span>{active.name}</span></> : <span className={styles.topTitle}>New project</span>}</div>
        <div className={styles.topActions}>{active && <><button className={preview ? styles.tabActive : styles.tab} onClick={() => setPreview(true)}><Eye size={14}/> Preview</button><button className={!preview ? styles.tabActive : styles.tab} onClick={() => setPreview(false)}><Code2 size={14}/> Files</button></>}</div>
      </header>

      {!active ? <section className={styles.home}>
        <div className={styles.homeGlow}/>
        <div className={styles.homeContent}>
          <div className={styles.eyebrow}><i/> AI WEB APP BUILDER</div>
          <div className={styles.heroIcon}><WandSparkles size={22}/></div>
          <h1>What do you want to <em>build</em>?</h1>
          <p>Describe the product in plain English. Codera creates the project, files, and a working browser preview.</p>
          <Composer prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} busy={busy} send={send}/>
          <div className={styles.ideaGrid}>{ideas.map((idea) => <button key={idea.title} className={styles.idea} onClick={() => setPrompt(idea.prompt)}><strong>{idea.title}</strong><span>{idea.prompt.slice(0, 70)}…</span><b>↗</b></button>)}</div>
          {notice && <div className={styles.notice}>{notice}</div>}
        </div>
      </section> : <section className={styles.builder}>
        <div className={styles.chatPane}>
          <div className={styles.projectIntro}><div className={styles.smallIcon}><Sparkles size={15}/></div><div><h2>{active.name}</h2><p>{active.status === "built" ? "Your project is ready to refine." : "Turn the idea into a working web app."}</p></div></div>
          {plan && <div className={styles.plan}><div className={styles.planHead}><ListChecks size={14}/><strong>Plan</strong><span>{plan.features?.length ?? 0} features</span></div><p>{plan.summary}</p><div className={styles.planList}>{(plan.features ?? []).slice(0,5).map((x:string) => <span key={x}>✓ {x}</span>)}</div></div>}
          {files.length === 0 && <div className={styles.emptyBuild}><Sparkles size={18}/><h3>Ready to build</h3><p>Tell Codera what the app should do. Build mode writes the project files and prepares the live preview.</p></div>}
          {files.length > 0 && <div className={styles.fileMeta}><span>{fileCount} files</span><span>·</span><span>browser preview ready</span></div>}
          <div className={styles.builderComposer}><Composer prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} busy={busy} send={send}/></div>
          {notice && <div className={styles.notice}>{notice}</div>}
        </div>
        <div className={preview ? styles.previewPane : styles.previewPane + " " + styles.previewHidden}>
          <div className={styles.previewHeader}><span><i/> Live preview</span><span>{active.status === "built" ? "Updated just now" : "Waiting for build"}</span></div>
          {iframeSrc ? <iframe title="Generated web app preview" sandbox="allow-scripts allow-forms" className={styles.previewFrame} srcDoc={iframeSrc}/> : <div className={styles.previewEmpty}><Eye size={24}/><p>Your generated app will appear here.</p></div>}
        </div>
        {!preview && <div className={styles.filesPane}>{files.map((f) => <div key={f.path} className={styles.fileRow}><Code2 size={13}/><span>{f.path}</span><small>{f.language}</small></div>)}</div>}
      </section>}
    </section>
  </main>;
}

function Composer({ prompt, setPrompt, mode, setMode, busy, send }: { prompt:string; setPrompt:(v:string)=>void; mode:Mode; setMode:(v:Mode)=>void; busy:boolean; send:()=>void }) {
  return <div className={styles.composer}>
    <div className={styles.composerMode}><button className={mode === "build" ? styles.modeOn : styles.modeOff} onClick={() => setMode("build")}><Hammer size={13}/> Build</button><button className={mode === "plan" ? styles.modeOn : styles.modeOff} onClick={() => setMode("plan")}><ListChecks size={13}/> Plan</button><span>Web app</span></div>
    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={mode === "plan" ? "Describe the app you want to plan…" : "Describe the web app you want Codera to build…"} rows={3}/>
    <div className={styles.composerBottom}><span>Plain English · responsive by default</span><button className={styles.send} disabled={!prompt.trim() || busy} onClick={send}>{busy ? "Working…" : mode === "plan" ? "Plan" : "Build"} <ArrowUp size={16}/></button></div>
  </div>;
}

