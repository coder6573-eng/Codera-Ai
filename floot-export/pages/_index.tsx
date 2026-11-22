pages/_index.tsx — lines 1-189 of 189 (version: 1795242259007, sha256: 25b7c7d40cc656b600d174c3f7d5b8245d401dcc2dc1d6f44de0423a141e1b14)
    1	import React, { useEffect, useMemo, useState } from "react";
    2	import { ArrowUp, ChevronLeft, Code2, Eye, Folder, Hammer, ListChecks, Menu, Plus, Sparkles, WandSparkles } from "lucide-react";
    3	import styles from "./_index.module.css";
    4	
    5	type Mode = "plan" | "build";
    6	type Workspace = { id: string; name: string };
    7	type Project = { id: string; workspaceId: string; name: string; prompt: string; planJson: any; status: string; updatedAt: string };
    8	type FileItem = { path: string; content: string; language: string };
    9	
   10	const ideas = [
   11	  { title: "Personal portfolio", prompt: "Build a polished personal portfolio with a hero, projects, about section, skills, contact form, dark/light theme toggle, and smooth responsive interactions." },
   12	  { title: "SaaS dashboard", prompt: "Build a responsive SaaS analytics dashboard with sidebar navigation, KPI cards, charts, activity feed, filters, empty states, and a mobile navigation." },
   13	  { title: "Online store", prompt: "Build a modern online store with product cards, search, category filters, product details, cart drawer, quantity controls, and persistent cart state." },
   14	];
   15	
   16	function slugName(prompt: string) {
   17	  const words = prompt.replace(/[^a-z0-9 ]/gi, "").trim().split(/\s+/).slice(0, 5);
   18	  return words.length ? words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ") : "Untitled project";
   19	}
   20	
   21	function previewHtml(files: FileItem[]) {
   22	  const html = files.find((f) => f.path === "index.html")?.content ?? "";
   23	  const css = files.find((f) => f.path === "styles.css")?.content ?? "";
   24	  const js = files.find((f) => f.path === "app.js")?.content ?? "";
   25	  return html
   26	    .replace(/<link[^>]+href=["'](?:\.\/)?styles\.css["'][^>]*>/i, "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>")
   27	    .replace(/<script[^>]+src=["'](?:\.\/)?app\.js["'][^>]*><\/script>/i, "<script>" + js.replace(/<\/script/gi, "<\\/script") + "</script>");
   28	}
   29	
   30	export default function HomePage() {
   31	  const [workspace, setWorkspace] = useState<Workspace | null>(null);
   32	  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
   33	  const [projects, setProjects] = useState<Project[]>([]);
   34	  const [active, setActive] = useState<Project | null>(null);
   35	  const [files, setFiles] = useState<FileItem[]>([]);
   36	  const [prompt, setPrompt] = useState("");
   37	  const [mode, setMode] = useState<Mode>("build");
   38	  const [busy, setBusy] = useState(false);
   39	  const [notice, setNotice] = useState("");
   40	  const [plan, setPlan] = useState<any>(null);
   41	  const [preview, setPreview] = useState(true);
   42	  const [mobileNav, setMobileNav] = useState(false);
   43	
   44	  useEffect(() => { bootstrap(); }, []);
   45	
   46	  async function bootstrap() {
   47	    try {
   48	      const wr = await fetch("/_api/workspaces");
   49	      const wd = await wr.json();
   50	      if (!wr.ok) throw new Error(wd.error || "Could not load workspaces.");
   51	      let available: Workspace[] = wd.workspaces ?? [];
   52	      let id = localStorage.getItem("codera.workspace");
   53	      if (!id || !available.some((w) => w.id === id)) {
   54	        const r = await fetch("/_api/workspaces", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: "My workspace" }) });
   55	        const d = await r.json();
   56	        const newId = String(d.workspace.id);
   57	        id = newId;
   58	        localStorage.setItem("codera.workspace", newId);
   59	        available = [d.workspace, ...available];
   60	      }
   61	      if (!id) throw new Error("Workspace could not be created.");
   62	      const r = await fetch("/_api/projects?workspaceId=" + encodeURIComponent(id));
   63	      const d = await r.json();
   64	      const selected = available.find((w) => w.id === id);
   65	      setWorkspaces(available);
   66	      setWorkspace(selected ?? { id, name: "My workspace" });
   67	      setProjects(d.projects ?? []);
   68	    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load your workspace."); }
   69	  }
   70	
   71	  async function refreshProjects() {
   72	    if (!workspace) return;
   73	    const r = await fetch("/_api/projects?workspaceId=" + encodeURIComponent(workspace.id));
   74	    const d = await r.json();
   75	    setProjects(d.projects ?? []);
   76	  }
   77	
   78	  async function openProject(projectId: string) {
   79	    setNotice("");
   80	    const r = await fetch("/_api/project?projectId=" + encodeURIComponent(projectId));
   81	    const d = await r.json();
   82	    if (!r.ok) { setNotice(d.error || "Could not open project."); return; }
   83	    setActive(d.project);
   84	    setFiles(d.files ?? []);
   85	    setPlan(d.project.planJson);
   86	    setPrompt("");
   87	    setMobileNav(false);
   88	  }
   89	
   90	  async function createProject(promptValue: string) {
   91	    if (!workspace) throw new Error("Workspace is not ready.");
   92	    const r = await fetch("/_api/projects", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ workspaceId: workspace.id, name: slugName(promptValue), prompt: promptValue }) });
   93	    const d = await r.json();
   94	    if (!r.ok) throw new Error(d.error || "Could not create project.");
   95	    setProjects((p) => [d.project, ...p]);
   96	    setActive(d.project);
   97	    setFiles([]);
   98	    return d.project;
   99	  }
  100	
  101	  async function send() {
  102	    const value = prompt.trim();
  103	    if (!value || busy) return;
  104	    setBusy(true); setNotice("");
  105	    try {
  106	      const project = active ?? await createProject(value);
  107	      if (mode === "plan") {
  108	        const r = await fetch("/_api/project_plan", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ projectId: project.id, prompt: value }) });
  109	        const d = await r.json();
  110	        if (!r.ok) throw new Error(d.error || "Plan failed.");
  111	        setPlan(d.plan); setActive((p) => p ? {...p, planJson: d.plan, status: "planned"} : p);
  112	      } else {
  113	        const r = await fetch("/_api/project_build", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ projectId: project.id, prompt: value, plan: plan ?? project.planJson }) });
  114	        const d = await r.json();
  115	        if (!r.ok) throw new Error(d.error || "Build failed.");
  116	        const fresh = await fetch("/_api/project?projectId=" + encodeURIComponent(project.id));
  117	        const fd = await fresh.json();
  118	        setActive(fd.project); setFiles(fd.files ?? []); setPlan(fd.project.planJson);
  119	      }
  120	      await refreshProjects();
  121	      setPrompt("");
  122	    } catch (e) { setNotice(e instanceof Error ? e.message : "Codera could not complete the request."); }
  123	    finally { setBusy(false); }
  124	  }
  125	
  126	  function newProject() {
  127	    setActive(null); setFiles([]); setPlan(null); setPrompt(""); setNotice(""); setMobileNav(false);
  128	  }
  129	
  130	  const iframeSrc = useMemo(() => files.length ? previewHtml(files) : "", [files]);
  131	  const fileCount = files.length;
  132	
  133	  return <main className={styles.app}>
  134	    <aside className={mobileNav ? styles.sidebar + " " + styles.sidebarOpen : styles.sidebar}>
  135	      <div className={styles.brand}><span className={styles.logo}><Code2 size={17}/></span><span>codera<span>.ai</span></span></div>
  136	      <button className={styles.newProject} onClick={newProject}><Plus size={16}/> New project</button>
  137	      <div className={styles.sideSection}><div className={styles.sideLabel}><span>WORKSPACE</span><button className={styles.sidePlus} aria-label="Create workspace" onClick={async () => { const name = window.prompt("Workspace name", "New workspace"); if (!name?.trim()) return; try { const r = await fetch("/_api/workspaces", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim()})}); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not create workspace."); localStorage.setItem("codera.workspace", d.workspace.id); setWorkspaces((w) => [d.workspace, ...w]); setWorkspace({id:d.workspace.id,name:d.workspace.name}); setProjects([]); setActive(null); setFiles([]); setPlan(null); setNotice(""); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create workspace."); } }}>+</button></div><div className={styles.workspaceSwitcher}><select aria-label="Workspace" value={workspace?.id ?? ""} onChange={async (e) => { const next = workspaces.find((w) => w.id === e.target.value); if (!next) return; localStorage.setItem("codera.workspace", next.id); setWorkspace(next); setActive(null); setFiles([]); setPlan(null); setNotice(""); const r = await fetch("/_api/projects?workspaceId=" + encodeURIComponent(next.id)); const d = await r.json(); if (r.ok) setProjects(d.projects ?? []); else setNotice(d.error || "Could not load projects."); }}><option value="" disabled>Select workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div></div>
  138	      <div className={styles.sideSection}><div className={styles.sideLabel}><span>PROJECTS</span><span>{projects.length}</span></div>
  139	        <div className={styles.projectList}>{projects.map((p) => <button key={p.id} className={active?.id === p.id ? styles.projectActive : styles.projectItem} onClick={() => openProject(p.id)}><Folder size={14}/><span>{p.name}</span></button>)}</div>
  140	      </div>
  141	      <div className={styles.sidebarFoot}><span>Auto Free model</span><small>kilo-auto/free</small></div>
  142	    </aside>
  143	
  144	    {mobileNav && <button className={styles.scrim} aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
  145	
  146	    <section className={styles.main}>
  147	      <header className={styles.topbar}>
  148	        <div className={styles.topLeft}><button className={styles.menu} onClick={() => setMobileNav(true)}><Menu size={18}/></button>{active ? <><ChevronLeft size={15}/><span>{active.name}</span></> : <span className={styles.topTitle}>New project</span>}</div>
  149	        <div className={styles.topActions}>{active && <><button className={preview ? styles.tabActive : styles.tab} onClick={() => setPreview(true)}><Eye size={14}/> Preview</button><button className={!preview ? styles.tabActive : styles.tab} onClick={() => setPreview(false)}><Code2 size={14}/> Files</button></>}</div>
  150	      </header>
  151	
  152	      {!active ? <section className={styles.home}>
  153	        <div className={styles.homeGlow}/>
  154	        <div className={styles.homeContent}>
  155	          <div className={styles.eyebrow}><i/> AI WEB APP BUILDER</div>
  156	          <div className={styles.heroIcon}><WandSparkles size={22}/></div>
  157	          <h1>What do you want to <em>build</em>?</h1>
  158	          <p>Describe the product in plain English. Codera creates the project, files, and a working browser preview.</p>
  159	          <Composer prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} busy={busy} send={send}/>
  160	          <div className={styles.ideaGrid}>{ideas.map((idea) => <button key={idea.title} className={styles.idea} onClick={() => setPrompt(idea.prompt)}><strong>{idea.title}</strong><span>{idea.prompt.slice(0, 70)}…</span><b>↗</b></button>)}</div>
  161	          {notice && <div className={styles.notice}>{notice}</div>}
  162	        </div>
  163	      </section> : <section className={styles.builder}>
  164	        <div className={styles.chatPane}>
  165	          <div className={styles.projectIntro}><div className={styles.smallIcon}><Sparkles size={15}/></div><div><h2>{active.name}</h2><p>{active.status === "built" ? "Your project is ready to refine." : "Turn the idea into a working web app."}</p></div></div>
  166	          {plan && <div className={styles.plan}><div className={styles.planHead}><ListChecks size={14}/><strong>Plan</strong><span>{plan.features?.length ?? 0} features</span></div><p>{plan.summary}</p><div className={styles.planList}>{(plan.features ?? []).slice(0,5).map((x:string) => <span key={x}>✓ {x}</span>)}</div></div>}
  167	          {files.length === 0 && <div className={styles.emptyBuild}><Sparkles size={18}/><h3>Ready to build</h3><p>Tell Codera what the app should do. Build mode writes the project files and prepares the live preview.</p></div>}
  168	          {files.length > 0 && <div className={styles.fileMeta}><span>{fileCount} files</span><span>·</span><span>browser preview ready</span></div>}
  169	          <div className={styles.builderComposer}><Composer prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} busy={busy} send={send}/></div>
  170	          {notice && <div className={styles.notice}>{notice}</div>}
  171	        </div>
  172	        <div className={preview ? styles.previewPane : styles.previewPane + " " + styles.previewHidden}>
  173	          <div className={styles.previewHeader}><span><i/> Live preview</span><span>{active.status === "built" ? "Updated just now" : "Waiting for build"}</span></div>
  174	          {iframeSrc ? <iframe title="Generated web app preview" sandbox="allow-scripts allow-forms" className={styles.previewFrame} srcDoc={iframeSrc}/> : <div className={styles.previewEmpty}><Eye size={24}/><p>Your generated app will appear here.</p></div>}
  175	        </div>
  176	        {!preview && <div className={styles.filesPane}>{files.map((f) => <div key={f.path} className={styles.fileRow}><Code2 size={13}/><span>{f.path}</span><small>{f.language}</small></div>)}</div>}
  177	      </section>}
  178	    </section>
  179	  </main>;
  180	}
  181	
  182	function Composer({ prompt, setPrompt, mode, setMode, busy, send }: { prompt:string; setPrompt:(v:string)=>void; mode:Mode; setMode:(v:Mode)=>void; busy:boolean; send:()=>void }) {
  183	  return <div className={styles.composer}>
  184	    <div className={styles.composerMode}><button className={mode === "build" ? styles.modeOn : styles.modeOff} onClick={() => setMode("build")}><Hammer size={13}/> Build</button><button className={mode === "plan" ? styles.modeOn : styles.modeOff} onClick={() => setMode("plan")}><ListChecks size={13}/> Plan</button><span>Web app</span></div>
  185	    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={mode === "plan" ? "Describe the app you want to plan…" : "Describe the web app you want Codera to build…"} rows={3}/>
  186	    <div className={styles.composerBottom}><span>Plain English · responsive by default</span><button className={styles.send} disabled={!prompt.trim() || busy} onClick={send}>{busy ? "Working…" : mode === "plan" ? "Plan" : "Build"} <ArrowUp size={16}/></button></div>
  187	  </div>;
  188	}
  189