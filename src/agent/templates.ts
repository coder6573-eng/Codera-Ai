export interface OfflineTemplateFile {
  path: string;
  content: string;
}
export interface OfflineTemplate {
  id: string;
  name: string;
  description: string;
  stack: string[];
  files: OfflineTemplateFile[];
}

const templates: OfflineTemplate[] = [
  {
    id: 'vanilla-responsive',
    name: 'Responsive vanilla website',
    description: 'A clean HTML, CSS, and JavaScript starter with accessible navigation and mobile-first layout.',
    stack: ['HTML', 'CSS', 'JavaScript'],
    files: [
      { path: 'index.html', content: '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="A small responsive website"><title>New project</title><link rel="stylesheet" href="styles.css"></head><body><header class="site-header"><a class="brand" href="/">New project</a><nav aria-label="Main navigation"><a href="#about">About</a><a href="#contact">Contact</a></nav></header><main><section class="hero"><p class="eyebrow">STARTER PROJECT</p><h1>Build something useful.</h1><p>A responsive starting point, ready for your ideas.</p><a class="button" href="#about">Explore</a></section><section id="about" class="content"><h2>About this project</h2><p>Replace this content with your own.</p></section></main><footer id="contact">Made with care.</footer><script src="app.js" defer></script></body></html>' },
      { path: 'styles.css', content: ':root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f7f8fc;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0;min-width:320px}.site-header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:20px max(5vw,20px);background:#fff;border-bottom:1px solid #e7e9f0}.brand{font-weight:800;color:inherit;text-decoration:none}.site-header nav{display:flex;gap:20px;flex-wrap:wrap}.site-header nav a{color:#46516a;text-decoration:none}.hero,.content{width:min(100% - 40px,960px);margin:0 auto}.hero{padding:clamp(72px,14vw,150px) 0}.eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.14em;color:#635bdb}.hero h1{max-width:760px;font-size:clamp(2.7rem,8vw,6rem);line-height:1;letter-spacing:-.06em;margin:18px 0}.hero p:not(.eyebrow){max-width:540px;color:#65708a;font-size:1.15rem;line-height:1.7}.button{display:inline-block;margin-top:18px;padding:13px 20px;border-radius:10px;background:#5146d8;color:white;text-decoration:none}.content{padding:40px 0 100px}footer{padding:30px 5vw;background:#172033;color:#fff}@media(max-width:520px){.site-header{align-items:flex-start;flex-direction:column}.site-header nav{gap:14px}.hero{padding:72px 0}}' },
      { path: 'app.js', content: "document.querySelectorAll('a[href^=\"#\"]').forEach(link=>link.addEventListener('click',()=>{const target=document.querySelector(link.getAttribute('href'));if(target)target.setAttribute('tabindex','-1')}));" }
    ]
  },
  {
    id: 'accessible-contact-form',
    name: 'Accessible contact form',
    description: 'A semantic form with labels, native validation, and a clear submission status.',
    stack: ['HTML', 'CSS', 'JavaScript', 'Accessibility'],
    files: [
      { path: 'index.html', content: '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contact</title><link rel="stylesheet" href="styles.css"></head><body><main class="card"><h1>Contact us</h1><p>Send a message using the form below.</p><form id="contact-form"><label for="name">Your name</label><input id="name" name="name" autocomplete="name" required maxlength="80"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required><label for="message">Message</label><textarea id="message" name="message" rows="5" required maxlength="2000"></textarea><button type="submit">Send message</button><p id="status" role="status" aria-live="polite"></p></form></main><script src="app.js" defer></script></body></html>' },
      { path: 'styles.css', content: 'body{margin:0;padding:24px;min-height:100vh;display:grid;place-items:center;background:#f2f4fa;color:#20283a;font-family:system-ui,sans-serif}.card{width:min(100%,560px);padding:clamp(22px,5vw,40px);background:#fff;border:1px solid #e2e6ef;border-radius:18px;box-shadow:0 18px 55px #17203312}form{display:grid;gap:10px}label{font-weight:650;margin-top:12px}input,textarea{width:100%;padding:12px;border:1px solid #b9c1d2;border-radius:8px;font:inherit}input:focus-visible,textarea:focus-visible,button:focus-visible{outline:3px solid #8a83ff;outline-offset:2px}button{margin-top:12px;padding:13px;border:0;border-radius:9px;background:#5146d8;color:#fff;font:inherit;font-weight:700;cursor:pointer}#status{min-height:1.5em}' },
      { path: 'app.js', content: "const form=document.querySelector('#contact-form');const status=document.querySelector('#status');form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;status.textContent='Form validated. Connect a trusted backend to send this message.';form.reset()});" }
    ]
  },
  {
    id: 'dashboard-starter',
    name: 'Data dashboard starter',
    description: 'A responsive dashboard shell with accessible metric cards and a small interactive filter.',
    stack: ['HTML', 'CSS', 'JavaScript', 'Dashboard'],
    files: [
      { path: 'index.html', content: '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project dashboard</title><link rel="stylesheet" href="styles.css"></head><body><header><div><p class="eyebrow">WORKSPACE</p><h1>Overview</h1></div><label>Period <select id="period"><option value="week">This week</option><option value="month">This month</option></select></label></header><main><section class="metrics" aria-label="Key metrics"><article><span>Projects</span><strong id="projects">12</strong><small>Active projects</small></article><article><span>Tasks complete</span><strong id="tasks">84%</strong><small>Across your workspace</small></article><article><span>Review queue</span><strong id="reviews">5</strong><small>Awaiting review</small></article></section><section class="panel"><h2>Activity</h2><p id="summary" role="status">Showing this week’s sample data.</p><ul><li>Website refresh <span>Updated today</span></li><li>Mobile improvements <span>Updated yesterday</span></li><li>Accessibility review <span>Updated Monday</span></li></ul></section></main><script src="app.js" defer></script></body></html>' },
      { path: 'styles.css', content: 'body{margin:0;padding:clamp(20px,5vw,56px);background:#f4f6fb;color:#1d273b;font-family:Inter,system-ui,sans-serif}header{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:32px}.eyebrow{font-size:.72rem;letter-spacing:.14em;color:#5c55c8;font-weight:800}h1{font-size:clamp(2rem,5vw,3.5rem);margin:8px 0}label{display:grid;gap:6px}select{padding:10px;border:1px solid #cbd2e1;border-radius:8px;background:#fff}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:16px}.metrics article,.panel{padding:22px;background:#fff;border:1px solid #e4e8f0;border-radius:14px}.metrics span,.metrics small{display:block;color:#69748b}.metrics strong{display:block;font-size:2.6rem;margin:14px 0 4px}.panel{margin-top:20px}.panel li{padding:14px 0;border-top:1px solid #edf0f5;display:flex;justify-content:space-between;gap:16px}.panel li span{color:#69748b}@media(max-width:520px){.panel li{flex-direction:column}}' },
      { path: 'app.js', content: "const period=document.querySelector('#period');const summary=document.querySelector('#summary');period.addEventListener('change',()=>{summary.textContent=period.value==='week'?'Showing this week’s sample data.':'Showing this month’s sample data.';document.querySelector('#projects').textContent=period.value==='week'?'12':'38';document.querySelector('#tasks').textContent=period.value==='week'?'84%':'91%';document.querySelector('#reviews').textContent=period.value==='week'?'5':'11'});" }
    ]
  },
  {
    id: 'offline-pwa',
    name: 'Offline PWA starter',
    description: 'A minimal installable web app with a manifest and a versioned static asset cache.',
    stack: ['HTML', 'CSS', 'JavaScript', 'PWA', 'Service Worker'],
    files: [
      { path: 'index.html', content: '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#18243b"><link rel="manifest" href="manifest.webmanifest"><title>Offline starter</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>Offline-ready starter</h1><p>This sample demonstrates a basic service-worker cache. Replace the content with your app.</p><p id="connection" role="status">Checking connection…</p></main><script src="app.js" defer></script></body></html>' },
      { path: 'manifest.webmanifest', content: JSON.stringify({ name: 'Offline Starter', short_name: 'Starter', start_url: './', display: 'standalone', background_color: '#f5f7fb', theme_color: '#18243b', icons: [] }, null, 2) },
      { path: 'styles.css', content: 'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f7fb;color:#18243b;font-family:system-ui,sans-serif}main{max-width:620px;padding:36px;background:#fff;border:1px solid #e0e6f0;border-radius:16px;line-height:1.7}#connection{font-weight:700;color:#3d6a4d}' },
      { path: 'app.js', content: "const status=document.querySelector('#connection');const update=()=>{status.textContent=navigator.onLine?'You are online.':'You are offline.'};window.addEventListener('online',update);window.addEventListener('offline',update);update();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js').catch(error=>console.error('Service worker registration failed',error));" },
      { path: 'service-worker.js', content: "const CACHE='offline-starter-v1';const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match('./index.html'))))});" }
    ]
  }
];

export function listOfflineTemplates() {
  return templates.map(({ id, name, description, stack, files }) => ({ id, name, description, stack, fileCount: files.length }));
}

export function getOfflineTemplate(id: string): OfflineTemplate | undefined {
  const template = templates.find(item => item.id === id);
  return template ? { ...template, files: template.files.map(file => ({ ...file })) } : undefined;
}
