import { z } from "zod";

const KILO_URL = "https://ai-gateway.kilo.ai/api/v1/chat/completions";

type FileInput = { path: string; content: string; language?: string };

const fileSchema = z.object({
  path: z.string().min(1).max(180),
  content: z.string().max(200000),
  language: z.string().default("text"),
});

const planSchema = z.object({
  title: z.string(),
  summary: z.string(),
  features: z.array(z.string()).max(20),
  architecture: z.array(z.string()).max(20),
  files: z.array(z.union([z.string(), fileSchema])).max(60),
  acceptanceCriteria: z.array(z.string()).max(20),
  risks: z.array(z.string()).max(12),
});

const buildSchema = z.object({
  summary: z.string(),
  files: z.array(fileSchema).min(1).max(80),
  removedFiles: z.array(z.string()).max(30).default([]),
  verification: z.array(z.string()).max(20).default([]),
});

const SYSTEM = `You are Codera AI's project generation engine.

Your job is to turn a user's plain-English web-app request into a complete, working web project artifact. You are NOT editing Codera itself. You are generating files that will be stored inside a user's Codera project.

QUALITY CONTRACT
- Build web applications only.
- Prefer a dependency-light, browser-runnable implementation for reliable previews. Use semantic HTML, modern CSS, and vanilla JS unless the user explicitly asks for a framework.
- If React/TypeScript is explicitly requested, include a sensible React/TS source structure, but ALWAYS also include a browser-runnable preview entrypoint (index.html + styles.css + app.js) unless the request truly cannot be previewed that way.
- Every visible control must have a real interaction or be clearly disabled.
- No fake backend calls, fake loading forever, broken links, placeholder buttons, lorem ipsum, or unexplained mock APIs.
- Use localStorage for persistence when the requested feature needs persistence but no backend is specified.
- Make the UI responsive from 360px upward.
- Include useful empty, loading, success and error states where relevant.
- Never put secrets, API keys, tokens, or private credentials in generated files.
- Do not depend on remote assets unless necessary; prefer CSS and inline SVG.
- Keep files focused and reasonably sized. Do not dump unrelated boilerplate.
- Preserve existing project files unless the requested change requires replacing them.

PREVIEW CONTRACT
The generated project will be previewed by loading index.html in a sandboxed browser. index.html must work without a build step. Relative links to styles.css and app.js are preferred.

RETURN CONTRACT
Return ONLY valid JSON matching the requested schema. Do not wrap it in markdown fences.`;

async function callKilo(messages: any[], mode: "plan" | "build", model = "kilo-auto/free") {
  const response = await fetch(KILO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-kilocode-mode": mode },
    body: JSON.stringify({ model, messages, max_tokens: 30000 }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Kilo AI ${response.status}: ${raw.slice(0, 800)}`);
  const data = JSON.parse(raw);
  const content = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) throw new Error("Kilo returned an empty response.");
  return content;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("Codera received an invalid structured response from the model.");
}

function compactFiles(files: FileInput[]) {
  return files.map((f) => `--- ${f.path} ---\n${f.content.slice(0, 50000)}`).join("\n\n");
}

function assertSafePath(path: string) {
  const normalized = path.replaceAll("\\\\", "/");
  if (normalized.startsWith("/") || normalized.includes("../") || normalized.includes("/..") || normalized.includes("\\0")) {
    throw new Error(`Unsafe generated file path: ${path}`);
  }
}

export async function createPlan(prompt: string, model = "kilo-auto/free") {
  const text = await callKilo([
    { role: "system", content: SYSTEM + "\nPLAN SCHEMA: {title, summary, features[], architecture[], files[], acceptanceCriteria[], risks[]}." },
    { role: "user", content: `Create an implementation-ready plan for this request. Do not generate code.\n\nUSER REQUEST:\n${prompt}` },
  ], "plan", model);
  return planSchema.parse(extractJson(text));
}

export async function buildProject(input: {
  prompt: string;
  plan?: unknown;
  files: FileInput[];
  model?: string;
}) {
  const existing = compactFiles(input.files);
  const context = existing ? `\nEXISTING PROJECT FILES:\n${existing}` : "\nEXISTING PROJECT FILES: none — create the initial project.";
  const text = await callKilo([
    { role: "system", content: SYSTEM + "\nBUILD SCHEMA: {summary, files:[{path,content,language}], removedFiles[], verification[]}." },
    { role: "user", content: `Build or update the project. Return the COMPLETE content for every file you change or create; do not return patches. Only include files that need to exist after this build.

USER REQUEST:
${input.prompt}

APPROVED PLAN:
${JSON.stringify(input.plan ?? null)}

${context}` },
  ], "build", input.model ?? "kilo-auto/free");
  const result = buildSchema.parse(extractJson(text));
  for (const file of result.files) assertSafePath(file.path);
  for (const path of result.removedFiles) assertSafePath(path);
  return result;
}
  121