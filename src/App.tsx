import React, { useEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronLeft, Code2, Eye, Folder, Hammer, ListChecks, Menu, Plus, Sparkles, WandSparkles } from "lucide-react";
import { keylessAI } from "../../src/aiClient";

type Mode = "plan" | "build";
type Workspace = { id: string; name: string };
type Project = { id: string; workspaceId: string; name: string; prompt: string; planJson: any; status: string; updatedAt: string };
type FileItem = { path: string; content: string; language: string };
type ApiWorkspace={id:string;name:string};
type ApiProject={id:string;workspaceId:string;name:string;prompt:string;planJson:any;status:string;updatedAt:string};
type ApiFile={path:string;content:string;language:string};
type ApiState={workspaces:ApiWorkspace[];projects:ApiProject[];files:Record<string,ApiFile[]>};
const apiLoad=():ApiState=>{try{const raw=localStorage.getItem("codera-floot-api-v1");if(raw)return JSON.parse(raw) as ApiState}catch{}return {workspaces:[],projects:[],files:{}}};
const apiSave=(s:ApiState)=>localStorage.setItem("codera-floot-api-v1",JSON.stringify(s));
const apiJson=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
async function flootFetch(input:string,init?:RequestInit):Promise<Response>{
 const s=apiLoad(), url=new URL(input,location.origin), method=init?.method??"GET";
 const body=init?.body?JSON.parse(String(init.body)):{};
 if(url.pathname==="/_api/workspaces"&&method==="GET")return apiJson({workspaces:s.workspaces});
 if(url.pathname==="/_api/workspaces"&&method==="POST"){const w={id:crypto.randomUUID(),name:String(body.name||"My workspace")};s.workspaces=[w,...s.workspaces];apiSave(s);return apiJson({workspace:w});}
 if(url.pathname==="/_api/projects"&&method==="GET"){return apiJson({projects:s.projects.filter(p=>p.workspaceId===url.searchParams.get("workspaceId"))});}
 if(url.pathname==="/_api/projects"&&method==="POST"){const id=crypto.randomUUID();const p={id,workspaceId:String(body.workspaceId),name:String(body.name||"Untitled project"),prompt:String(body.prompt||""),planJson:null,status:"draft",updatedAt:new Date().toISOString()};s.projects=[p,...s.projects];s.files[id]=[];apiSave(s);return apiJson({project:p});}
 if(url.pathname==="/_api/project"&&method==="GET"){const p=s.projects.find(x=>x.id===url.searchParams.get("projectId"));if(!p)return apiJson({error:"Project not found"},404);return apiJson({project:p,files:s.files[p.id]||[]});}
 if(url.pathname==="/_api/project_plan"&&method==="POST"){const p=s.projects.find(x=>x.id===body.projectId);if(!p)return apiJson({error:"Project not found"},404);try{const raw=await keylessAI("plan",String(body.prompt),p.name,s.files[p.id]||[],Array.isArray(body.plan)?body.plan:[]);const parsed=JSON.parse(raw);const steps=(parsed.steps||[]).filter((x:any)=>typeof x==="string").slice(0,8);const plan={title:p.name,summary:"Implementation plan for your request.",features:steps,architecture:[],files:[],acceptanceCriteria:steps,risks:[]};p.planJson=plan;p.status="planned";p.prompt=String(body.prompt);p.updatedAt=new Date().toISOString();apiSave(s);return apiJson({plan});}catch(e){return apiJson({error:e instanceof Error?e.message:"Plan failed"},500);}}
 if(url.pathname==="/_api/project_build"&&method==="POST"){const p=s.projects.find(x=>x.id===body.projectId);if(!p)return apiJson({error:"Project not found"},404);try{const raw=await keylessAI("build",String(body.prompt),p.name,s.files[p.id]||[],Array.isArray(body.plan?.features)?body.plan.features:[]);const parsed=JSON.parse(raw);const files=(parsed.files||[]).map((f:any)=>({path:String(f.path),content:String(f.content),language:String(f.language||f.path.split(".").pop()||"text")}));if(!files.some((f:any)=>f.path==="index.html"))throw new Error("Generated project is missing index.html.");s.files[p.id]=files;p.status="built";p.prompt=String(body.prompt);p.updatedAt=new Date().toISOString();apiSave(s);return apiJson({result:{summary:String(parsed.summary||"Project built."),files,removedFiles:[],verification:[]}});}catch(e){return apiJson({error:e instanceof Error?e.message:"Build failed"},500);}}
 return apiJson({error:"Unknown endpoint"},404);
}


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
  const css = files.find((f) => f.path === ""css"")?.content ?? "";
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
      const wr = await flootFetch("/_api/workspaces");
      const wd = await wr.json();
      if (!wr.ok) throw new Error(wd.error || "Could not load workspaces.");
      let available: Workspace[] = wd.workspaces ?? [];
      let id = localStorage.getItem("codera.workspace");
      if (!id || !available.some((w) => w.id === id)) {
        const r = await flootFetch("/_api/workspaces", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: "My workspace" }) });
        const d = await r.json();
        const newId = String(d.workspace.id);
        id = newId;
        localStorage.setItem("codera.workspace", newId);
        available = [d.workspace, ...available];
      }
      if (!id) throw new Error("Workspace could not be created.");
      const r = await flootFetch("/_api/projects?workspaceId=" + encodeURIComponent(id));
      const d = await r.json();
      const selected = available.find((w) => w.id === id);
      setWorkspaces(available);
      setWorkspace(selected ?? { id, name: "My workspace" });
      setProjects(d.projects ?? []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load your workspace."); }
  }

  async function refreshProjects() {
    if (!workspace) return;
    const r = await flootFetch("/_api/projects?workspaceId=" + encodeURIComponent(workspace.id));
    const d = await r.json();
    setProjects(d.projects ?? []);
  }

  async function openProject(projectId: string) {
    setNotice("");
    const r = await flootFetch("/_api/project?projectId=" + encodeURIComponent(projectId));
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
    const r = await flootFetch("/_api/projects", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ workspaceId: workspace.id, name: slugName(promptValue), prompt: promptValue }) });
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
        const r = await flootFetch("/_api/project_plan", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ projectId: project.id, prompt: value }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Plan failed.");
        setPlan(d.plan); setActive((p) => p ? {...p, planJson: d.plan, status: "planned"} : p);
      } else {
        const r = await flootFetch("/_api/project_build", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ projectId: project.id, prompt: value, plan: plan ?? project.planJson }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Build failed.");
        const fresh = await flootFetch("/_api/project?projectId=" + encodeURIComponent(project.id));
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

  return <main className="app">
    <aside className={mobileNav ? "sidebar sidebarOpen" : "sidebar"}>
      <div className="brand"><span className="logo"><Code2 size={17}/></span><span>codera<span>.ai</span></span></div>
      <button className="newProject" onClick={newProject}><Plus size={16}/> New project</button>
      <div className="sideSection"><div className="sideLabel"><span>WORKSPACE</span><button className="sidePlus" aria-label="Create workspace" onClick={async () => { const name = window.prompt("Workspace name", "New workspace"); if (!name?.trim()) return; try { const r = await flootFetch("/_api/workspaces", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim()})}); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not create workspace."); localStorage.setItem("codera.workspace", d.workspace.id); setWorkspaces((w) => [d.workspace, ...w]); setWorkspace({id:d.workspace.id,name:d.workspace.name}); setProjects([]); setActive(null); setFiles([]); setPlan(null); setNotice(""); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create workspace."); } }}>+</button></div><div className="workspaceSwitcher"><select aria-label="Workspace" value={workspace?.id ?? ""} onChange={async (e) => { const next = workspaces.find((w) => w.id === e.target.value); if (!next) return; localStorage.setItem("codera.workspace", next.id); setWorkspace(next); setActive(null); setFiles([]); setPlan(null); setNotice(""); const r = await flootFetch("/_api/projects?workspaceId=" + encodeURIComponent(next.id)); const d = await r.json(); if (r.ok) setProjects(d.projects ?? []); else setNotice(d.error || "Could not load projects."); }}><option value="" disabled>Select workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div></div>
      <div className="sideSection"><div className="sideLabel"><span>PROJECTS</span><span>{projects.length}</span></div>
        <div className="projectList">{projects.map((p) => <button key={p.id} className={active?.id === p.id ? "projectActive" : "projectItem"} onClick={() => openProject(p.id)}><Folder size={14}/><span>{p.name}</span></button>)}</div>
      </div>
      <div className="sidebarFoot"><span>Auto Free model</span><small>kilo-auto/free</small></div>
    </aside>

    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}

    <section className="main">
      <header className="topbar">
        <div className="topLeft"><button className="menu" onClick={() => setMobileNav(true)}><Menu size={18}/></button>{active ? <><ChevronLeft size={15}/><span>{active.name}</span></> : <span className="topTitle">New project</span>}</div>
        <div className="topActions">{active && <><button className={preview ? "tabActive" : "tab"} onClick={() => setPreview(true)}><Eye size={14}/> Preview</button><button className={!preview ? "tabActive" : "tab"} onClick={() => setPreview(false)}><Code2 size={14}/> Files</button></>}</div>
      </header>

      {!active ? <section className="home">
        <div className="homeGlow"/>
        <div className="homeContent">
          <div className="eyebrow"><i/> AI WEB APP BUILDER</div>
          <div className="heroIcon"><WandSparkles size={22}/></div>
          <h1>What do you want to <em>build</em>?</h1>
          <p>Describe the product in plain English. Codera creates the project, files, and a working browser preview.</p>
          <Composer prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} busy={busy} send={send}/>
          <div className="ideaGrid">{ideas.map((idea) => <button key={idea.title} className="idea" onClick={() => setPrompt(idea.prompt)}><strong>{idea.title}</strong><span>{idea.prompt.slice(0, 70)}…</span><b>↗</b></button>)}</div>
          {notice && <div className="notice">{notice}</div>}
        </div>
      </section> : <section className="builder">
        <div className="chatPane">
          <div className="projectIntro"><div className="smallIcon"><Sparkles size={15}/></div><div><h2>{active.name}</h2><p>{active.status === "built" ? "Your project is ready to refine." : "Turn the idea into a working web app."}</p></div></div>
          {plan && <div className="plan"><div className="planHead"><ListChecks size={14}/><strong>Plan</strong><span>{plan.features?.length ?? 0} features</span></div><p>{plan.summary}</p><div className="planList">{(plan.features ?? []).slice(0,5).map((x:string) => <span key={x}>✓ {x}</span>)}</div></div>}
          {files.length === 0 && <div className="emptyBuild"><Sparkles size={18}/><h3>Ready to build</h3><p>Tell Codera what the app should do. Build mode writes the project files and prepares the live preview.</p></div>}
          {files.length > 0 && <div className="fileMeta"><span>{fileCount} files</span><span>·</span><span>browser preview ready</span></div>}
          <div className="builderComposer"><Composer prompt={prompt} setPrompt={setPrompt} mode={mode} setMode={setMode} busy={busy} send={send}/></div>
          {notice && <div className="notice">{notice}</div>}
        </div>
        <div className={preview ? "previewPane" : "previewPane previewHidden"}>
          <div className="previewHeader"><span><i/> Live preview</span><span>{active.status === "built" ? "Updated just now" : "Waiting for build"}</span></div>
          {iframeSrc ? <iframe title="Generated web app preview" sandbox="allow-scripts allow-forms" className="previewFrame" srcDoc={iframeSrc}/> : <div className="previewEmpty"><Eye size={24}/><p>Your generated app will appear here.</p></div>}
        </div>
        {!preview && <div className="filesPane">{files.map((f) => <div key={f.path} className="fileRow"><Code2 size={13}/><span>{f.path}</span><small>{f.language}</small></div>)}</div>}
      </section>}
    </section>
  </main>;
}

function Composer({ prompt, setPrompt, mode, setMode, busy, send }: { prompt:string; setPrompt:(v:string)=>void; mode:Mode; setMode:(v:Mode)=>void; busy:boolean; send:()=>void }) {
  return <div className="composer">
    <div className="composerMode"><button className={mode === "build" ? "modeOn" : "modeOff"} onClick={() => setMode("build")}><Hammer size={13}/> Build</button><button className={mode === "plan" ? "modeOn" : "modeOff"} onClick={() => setMode("plan")}><ListChecks size={13}/> Plan</button><span>Web app</span></div>
    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={mode === "plan" ? "Describe the app you want to plan…" : "Describe the web app you want Codera to build…"} rows={3}/>
    <div className="composerBottom"><span>Plain English · responsive by default</span><button className="send" disabled={!prompt.trim() || busy} onClick={send}>{busy ? "Working…" : mode === "plan" ? "Plan" : "Build"} <ArrowUp size={16}/></button></div>
  </div>;
}
  189