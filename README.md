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

Run the browser regression suite in another terminal:

```bash
npx playwright install chromium
npm run test:e2e
```

## Native applications (no deployment required)

Codera can also run as local desktop and Android applications. The desktop app uses an isolated Electron main-process bridge for anonymous Kilo Auto Free requests; the Android app uses Capacitor's native HTTP transport. Neither package contains an API key. AI generation requires an internet connection and remains subject to Kilo's anonymous free-model availability and limits. Projects remain stored locally on the device.

- Windows: `npm run desktop:dist` creates a portable EXE and a Windows installer in `release/`.
- Android: `npx cap add android`, then `npm run android:sync`; build the debug APK from the Android project with Gradle.
- GitHub Actions automatically packages both platforms and runs launch checks. The Android APK is debug-signed for testing/installation, not Play Store distribution.
- No Cloudflare deployment is performed by these workflows.

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
- Automatic preview audits for title, viewport, page content, button labels, opted-in safe button interactions, form labels and native validation, submit controls, in-page navigation, image alt text, and horizontal overflow
- One automatic AI repair attempt after a build when preview checks or runtime diagnostics fail, followed by a fresh audit
- Manual AI repair for remaining failures, using the diagnostics and current project files
- Desktop/tablet/mobile preview sizing
- Rename/delete project actions
- Prompt shortcuts and history
- Version history with restorable checkpoints before AI builds, automatic repairs, and version restores
- One-time migration of Floot-imported local workspaces, projects, plans, and files into Codera's current local format
- Responsive mobile workspace
- ZIP source export with all generated project files
- Same-origin server proxy with basic request limits and input validation
- Playwright end-to-end regression suite for button behaviour, navigation, form validation/submission, workspace/project flows, and 375px, 768px, and 1280px viewports, Floot data migration, and version restoration

Cloud sync, collaboration, visual element editing, and live deployment remain future work. The Android package is a native Capacitor application shell, but Codera does not currently schedule AI generations as persistent Android background jobs; keep the app open while a generation is running. Project files and checkpoints are saved locally and remain available when the app is reopened. The in-app preview audit performs structural/accessibility checks, native form validation, internal navigation clicks, and only clicks buttons explicitly marked by the generator as safe, reversible toggles. It does not click arbitrary generated buttons because clicks can have destructive side effects. The Playwright CI suite executes representative generated-site button, navigation, and form interactions and checks responsive rendering at three viewport widths. One automatic repair attempt is made per build; persistent failures remain visible for manual repair and review. Neither CI fixtures nor static audits can prove every possible generated website interaction. Kilo's anonymous free-tier quota and upstream availability remain provider-controlled.
