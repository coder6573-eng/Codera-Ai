# Codera AI

A local-first, mobile-friendly AI website builder.

## Architecture

User → Workspace → Project → Plan → Build → Project Files → Live Preview

## Storage

Workspaces, projects, plans, prompts, and generated files are persisted in browser localStorage. There is no required cloud database, authentication backend, or hosted project storage.

## AI provider: Kilo Auto Free

Plan and Build requests are sent to the Kilo AI Gateway through the same-origin Cloudflare Pages Function at `/api/generate`.

- Model route: `kilo-auto/free`
- Gateway: `https://ai-gateway.kilo.ai/api/v1/chat/completions`
- Authentication: no API key is sent; Kilo documents anonymous access for free models.
- The app does not ask users to paste a provider key and does not expose any secret in frontend code.
- Free access is rate-limited and depends on Kilo and upstream provider availability. The underlying model may change as Kilo updates its Auto Free pool.

Kilo Auto Free may route prompts to partner providers with their own data-handling practices. Avoid submitting personal or confidential information.

## Local development

```bash
npm install
npm run dev
```

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- No database setup is required.
- No API key or provider secret is required for the default Kilo Auto Free route.

## Included

- Multiple local workspaces and projects
- Plan and Build modes powered by Kilo Auto Free; Build receives the saved plan as context
- Structured-output validation, bounded file sizes, safe relative paths, duplicate-path rejection, and one automatic repair attempt for invalid builds
- Editable HTML/CSS/JS files
- Sandboxed live preview with browser-side runtime error reporting
- Lightweight preview smoke checks for missing page title, viewport metadata, and empty page content
- One-click AI repair that sends preview diagnostics and current project files back through Kilo Auto Free
- Desktop/mobile preview
- Rename/delete project actions
- Prompt shortcuts and history
- Responsive mobile workspace
- Source export
- Same-origin server proxy with basic request limits and input validation

Cloud sync, collaboration, deployment, deeper automated interaction testing (for example, exercising forms and navigation), and ZIP export remain future work. Preview diagnostics catch uncaught JavaScript errors, unhandled promise rejections, console errors, and a few basic document-level smoke checks. They cannot guarantee that every user interaction works; after a repair, review the preview manually. The generation endpoint also performs one retry when the model returns invalid build JSON or an incomplete file set. Kilo's anonymous free-tier quota and upstream availability remain provider-controlled.
