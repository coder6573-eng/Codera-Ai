# Codera AI

A local-first, mobile-friendly AI website builder.

## Architecture

User → Workspace → Project → Plan → Build → Project Files → Live Preview

## Storage

Workspaces, projects, plans, prompts, and generated files are persisted in browser localStorage. There is no required cloud database, authentication backend, or hosted project storage.

## AI

The default AI path uses Puter.js directly from the frontend. Puter documents its AI SDK as keyless and serverless, using a user-pays model so Codera does not need to own or expose an API key.

If Puter.js is unavailable, Codera keeps a local planning fallback. The optional Cloudflare `/api/generate` route remains in the repository for future server-side providers, but it is not required for the default setup.

## Local development

```bash
npm install
npm run dev
```

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- No database setup is required.
- No API key is required for the default Puter.js path.

## Included

- Multiple local workspaces and projects
- Plan and Build modes
- Keyless AI generation
- Local fallback planning
- Editable HTML/CSS/JS files
- Sandboxed live preview
- Desktop/mobile preview
- Rename/delete project actions
- Prompt shortcuts and history
- Responsive mobile workspace
- Source export
- Credential-safe server route kept as an optional extension

Cloud sync, collaboration, deployment, automatic repair passes, and ZIP export can be added later without changing the local workspace model.
