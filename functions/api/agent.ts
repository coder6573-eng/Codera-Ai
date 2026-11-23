interface Env { KILO_BASE_URL?: string }

const MAX_BODY_BYTES = 1_500_000;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 60_000;
const WINDOW = new Map<string, { count: number; reset: number }>();

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

function allowRequest(client: string): boolean {
  const now = Date.now();
  const current = WINDOW.get(client);
  if (current && current.reset > now && current.count >= 24) return false;
  if (!current || current.reset <= now) WINDOW.set(client, { count: 1, reset: now + 60_000 });
  else current.count += 1;
  if (WINDOW.size > 1500) {
    for (const [key, value] of WINDOW) if (value.reset <= now) WINDOW.delete(key);
  }
  return true;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'Agent context is too large.' }, 413);

  const client = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!allowRequest(client)) return json({ error: 'Agent request limit reached. Wait a minute and try again.' }, 429);

  let body: { messages?: Array<{ role: string; content: string; name?: string; tool_call_id?: string }>; mode?: string };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Agent context is too large.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }

  if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    return json({ error: 'Agent messages are missing or exceed the supported limit.' }, 400);
  }
  const messages = body.messages.map(message => {
    if (!message || !['system', 'user', 'assistant', 'tool'].includes(message.role) ||
      typeof message.content !== 'string' || message.content.length > MAX_MESSAGE_CHARS) {
      throw new Error('Invalid agent message.');
    }
    return {
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name.slice(0, 64) } : {}),
      ...(message.tool_call_id ? { tool_call_id: message.tool_call_id.slice(0, 100) } : {}),
    };
  });

  const endpoint = (env.KILO_BASE_URL || 'https://ai-gateway.kilo.ai/api/v1/chat/completions').replace(/\/+$/, '');
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kilocode-mode': body.mode === 'plan' ? 'plan' : 'code' },
      body: JSON.stringify({
        model: 'kilo-auto/free',
        temperature: 0.2,
        max_tokens: 6000,
        messages,
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!upstream.ok) {
      if (upstream.status === 429) return json({ error: 'Kilo Auto Free is rate-limiting requests. Try again later.' }, 429);
      return json({ error: 'Kilo Auto Free returned an error (' + upstream.status + ').' }, 502);
    }
    const data = await upstream.json();
    return json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent provider request failed.';
    return json({ error: /abort|timeout/i.test(message) ? 'Agent provider timed out.' : message }, 502);
  }
};
