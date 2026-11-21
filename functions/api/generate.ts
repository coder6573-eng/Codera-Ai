interface Env { KILO_BASE_URL?: string }
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
  if (window && window.reset > now && window.count >= 8) return reply({ error: 'Codera request limit reached. Wait a minute and try again.' }, 429);
  if (!window || window.reset <= now) requestWindows.set(client, { count: 1, reset: now + 60000 });
  else window.count += 1;

  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return reply({ error: 'Request body must be valid JSON.' }, 400); }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return reply({ error: 'Add a description before building.' }, 400);
  if (prompt.length > MAX_PROMPT) return reply({ error: 'The prompt is too long. Keep it under 12,000 characters.' }, 413);

  const files = Array.isArray(body.files)
    ? body.files.slice(0, 20).filter(f => f && validPath(f.path) && typeof f.content === 'string').map(f => ({ path: f.path, content: f.content.slice(0, MAX_FILE) }))
    : [];
  const isPlan = body.mode === 'plan';
  const system = isPlan
    ? 'You are Codera, a senior product engineer. Turn the user website idea into a practical implementation plan. Return ONLY valid JSON: {"steps":["step one","step two"]}. Give 4 to 7 concrete ordered steps, covering structure, visual design, implementation, responsive behaviour, and validation.'
    : 'You are Codera, a senior frontend engineer. Generate or update a complete polished responsive website using plain HTML, CSS, and browser JavaScript. Return ONLY valid JSON, no markdown fences, with this shape: {"summary":"short summary","files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}]}. Always include index.html and styles.css; include app.js when useful. Keep interactions functional, accessible, and mobile-first. Avoid external dependencies, remote scripts, trackers, API keys, and secrets. Improve existing files when relevant. Paths must be relative. Never include secrets or credentials.';

  const endpoint = (env.KILO_BASE_URL || 'https://ai-gateway.kilo.ai/api/v1/chat/completions').replace(/\/+$/, '');
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kilocode-mode': isPlan ? 'plan' : 'code'
      },
      body: JSON.stringify({
        model: 'kilo-auto/free',
        temperature: 0.35,
        max_tokens: 12000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: 'Project: ' + String(body.projectName || 'Untitled').slice(0, 100) + '\nUser request: ' + prompt + '\nCurrent files: ' + JSON.stringify(files) }
        ]
      })
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return reply({ error: 'Kilo Auto Free is rate-limiting requests. Try again later.' }, 429);
      return reply({ error: 'Kilo Auto Free returned an error (' + upstream.status + '). Please retry shortly.' }, 502);
    }
    const result = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = result.choices?.[0]?.message?.content;
    if (!content) return reply({ error: 'Kilo Auto Free returned an empty response. Please retry.' }, 502);

    let parsed: { summary?: string; files?: FileInput[]; steps?: string[] };
    try {
      const clean = content.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(clean) as typeof parsed;
    } catch { return reply({ error: 'The AI response was not valid project JSON. Please retry.' }, 502); }

    if (isPlan) {
      const steps = Array.isArray(parsed.steps) ? parsed.steps.filter(s => typeof s === 'string' && s.trim()).slice(0, 8) : [];
      if (!steps.length) return reply({ error: 'The AI plan was empty. Please retry.' }, 502);
      return reply({ steps, provider: 'Kilo Auto Free' });
    }

    const generated = Array.isArray(parsed.files)
      ? parsed.files.filter(f => f && validPath(f.path) && typeof f.content === 'string' && f.content.length <= MAX_FILE).slice(0, 20)
      : [];
    if (!generated.some(f => f.path === 'index.html')) return reply({ error: 'The generated project did not contain index.html. Please retry.' }, 502);
    if (!generated.some(f => f.path === 'styles.css')) generated.push({ path: 'styles.css', content: '' });
    return reply({ summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : 'Project updated.', files: generated, provider: 'Kilo Auto Free' });
  } catch {
    return reply({ error: 'Could not reach Kilo Auto Free. Check your connection and try again.' }, 502);
  }
};
