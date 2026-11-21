# Codera AI

A mobile-friendly website-builder workspace. Organize projects, plan a build, generate HTML/CSS/JavaScript through a server-side AI endpoint, edit source files, and inspect a sandboxed live preview.

## Stack
- React + TypeScript + Vite
- Cloudflare Pages Functions for server-side generation
- Browser local storage for workspace/project persistence in this first version
- Kilo OpenAI-compatible chat completions gateway

## Local development
```bash
npm install
npm run dev
```
The workspace and preview run without an AI credential. Build mode requires the Pages Function and a provider credential.

## Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Add `KILO_API_KEY` as an encrypted environment variable/secret in Pages settings.
- Optional: `KILO_MODEL` (default `kilo-auto/free`) and `KILO_BASE_URL` (default Kilo chat completions endpoint).
- Redeploy after changing secrets.

**Credential safety:** Never commit a real provider key, put it in `src/`, expose it through a `VITE_` variable, or paste it into chat. The Pages Function reads it server-side and never returns it to the browser.

## Included
- Multiple workspaces and projects, persisted in this browser
- Plan mode with a structured starter plan
- Build mode through `/api/generate`
- Editable project files and sandboxed live preview
- Responsive mobile workspace
- Source text export

Authentication, database sync, collaboration, ZIP export, automatic repair loops, and cloud project storage are not implemented yet.