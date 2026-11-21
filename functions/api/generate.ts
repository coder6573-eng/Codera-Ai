interface Env { KILO_API_KEY?: string; KILO_MODEL?: string; KILO_BASE_URL?: string }
interface FileInput { path: string; content: string }
interface RequestBody { mode?: 'plan' | 'build'; prompt?: string; projectName?: string; files?: FileInput[] }
const MAX_PROMPT = 12000;
const MAX_FILE = 300000;
const requestWindows = new Map<string, { count: number; reset: number }>();
const validPath = (p: string) => typeof p === 'string' && p.length <= 120 && !p.startsWith('/') && !p.split('/').includes('..') && /^[a-zA-Z0-9._/-]+$/.test(p);
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return reply({ error: 'Cross-origin requests are not allowed.' }, 403);
  const client = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const window = requestWindows.get(client);
  if (window && window.reset > now && window.count >= 8) return reply({ error: 'Too many build requests. Try again in a minute.' }, 429);
  if (!window || window.reset <= now) requestWindows.set(client, { count: 1, reset: now + 60000 });
  else window.count += 1;
  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return reply({ error: 'Request body must be valid JSON.' }, 400); }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return reply({ error: 'Add a description before building.' }, 400);
  if (prompt.length > MAX_PROMPT) return reply({ error: 'The prompt is too long. Keep it under 12,000 characters.' }, 413);
  if (!env.KILO_API_KEY) return reply({ error: 'AI generation is not configured. Add KILO_API_KEY as a server-side Cloudflare Pages secret. Never put a key in frontend code.' }, 503);
  const files = Array.isArray(body.files) ? body.files.slice(0, 20).filter(f => f && validPath(f.path) && typeof f.content === 'string').map(f => ({ path: f.path, content: f.content.slice(0, MAX_FILE) })) : [];
  const isPlan = body.mode === 'plan';
  const system = isPlan
    ? 'You are Codera, a senior product engineer. Turn the user\'s website idea into a practical implementation plan. Return ONLY valid JSON: {"steps":["step one","step two"]}. Give 4 to 7 concrete, ordered steps, including structure, visual design, implementation, responsive behaviour, and validation. Avoid vague advice.'
    : 'You are Codera, a senior frontend engineer. Generate a complete, polished, responsive website using plain HTML, CSS, and browser JavaScript. Return ONLY valid JSON, no markdown fences, with this shape: {"summary":"short summary","files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}]}. Always include index.html and styles.css; include app.js when useful. Keep files self-contained and avoid external dependencies, remote scripts, trackers, or API keys. Use semantic accessible HTML, responsive CSS, and functional interactions. Improve existing files when relevant. Paths must be relative. Never include secrets or credentials.';
  const endpoint = (env.KILO_BASE_URL || 'https://ai-gateway.kilo.ai/api/v1/chat/completions').replace(/\/+$/, '');
  try {
    const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.KILO_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.KILO_MODEL || 'kilo-auto/free', temperature: 0.35, max_tokens: 12000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: 'Project: ' + String(body.projectName || 'Untitled').slice(0, 100) + '\nUser request: ' + prompt + '\nCurrent files: ' + JSON.stringify(files) }] }) });
    if (!upstream.ok) return reply({ error: upstream.status === 401 || upstream.status === 403 ? 'The configured AI credential was rejected. Update the server-side secret.' : upstream.status === 429 ? 'The AI provider is rate-limiting requests. Try again shortly.' : 'The AI provider returned an error (' + upstream.status + ').' }, 502);
    const result = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = result.choices?.[0]?.message?.content;
    if (!content) return reply({ error: 'The AI provider returned an empty response.' }, 502);
    let parsed: { summary?: string; files?: FileInput[]; steps?: string[] };
    try { parsed = JSON.parse(content) as typeof parsed; } catch { return reply({ error: 'The AI response was not valid project JSON. Please retry.' }, 502); }
    if (isPlan) {
      const steps = Array.isArray(parsed.steps) ? parsed.steps.filter(s => typeof s === 'string' && s.trim()).slice(0, 8) : [];
      if (!steps.length) return reply({ error: 'The AI plan was empty. Please retry.' }, 502);
      return reply({ steps });
    }
    const generated = Array.isArray(parsed.files) ? parsed.files.filter(f => f && validPath(f.path) && typeof f.content === 'string' && f.content.length <= MAX_FILE).slice(0, 20) : [];
    if (!generated.some(f => f.path === 'index.html')) return reply({ error: 'The generated project did not contain index.html. Please retry.' }, 502);
    return reply({ summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : 'Project updated.', files: generated });
  } catch { return reply({ error: 'Could not reach the AI provider. Check the server configuration and try again.' }, 502); }
};