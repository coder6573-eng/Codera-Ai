# Codera AI — Product Design & UX Implementation Blueprint

*Prepared November 22, 2026 · Audience: the AI coding agent implementing the redesign in github.com/coder6573-eng/Codera-Ai · Version 1.0*

## 0. How to read this document

This is a design specification, not an implementation. It says what the interface must look like and do. It never asks for backend changes, new services, paid plans, API keys or new dependencies.

**Evidence labels.** Every statement about functionality carries one of these.

| Label | Meaning |
| --- | --- |
| \[EXISTING\] | Confirmed in the repository README or package.json during research. |
| \[VERIFY\] | Probably true, but not visible from outside the repo. Confirm in source before relying on it; adapt the UI mapping if it differs. |
| \[UX-NEW\] | New front-end behavior built only from existing data and handlers. No backend change, no storage-schema change. |
| \[FUTURE\] | Needs new backend or product capability. Do not build. Leave a design hook only. |

**Conventions.** Sizes are CSS px at 1x. Tokens use the prefix `--cd-`; CSS classes use `cd-`. Icons are lucide-react names (already a dependency). Colors are hex. Contrast ratios quoted here were computed, not estimated.

**What the research could and could not see.**

- Read: the repository root page, README.md and package.json on branch main.
- Not readable: src/, functions/api/, tests/, desktop/ and floot-export/. GitHub blocks automated access to folder listings, and file fetches were rate-limited. This document therefore asserts no component names, file names, CSS class names or state shapes. Wherever the design depends on one it says \[VERIFY\]; §16 lists exactly what to search for.
- Competitor findings come from public documentation, release notes and articles retrieved in November 2026, paraphrased. The live products were not operated. Re-check a competitor detail before copying it.

**Scope.** §3–§4 compare competitors and three directions. From §5 onward every specification describes the recommended direction, **Direction C: Loop**.

## 1. Design overview (handoff item A)

**Recommendation: Direction C, “Loop”.** The README describes one flow: User → Workspace → Project → Plan → Build → Project Files → Live Preview, followed by automatic audits and AI repair. Loop makes that flow the interface instead of hiding it behind generic chat-plus-preview panels.

Why it is the right fit:

1. **It mirrors what Codera actually does.** Plan, Build, audit and repair already exist \[EXISTING\]. A visible Plan → Build → Verify rail needs only derived UI state.
2. **One obvious next step.** A single “next action” button changes with project state (Build this plan, Repair 3 issues, Export). New users never wonder what to do.
3. **Works on a phone.** Each stage has one primary surface; phones show one surface at a time with four bottom tabs instead of squeezing a three-pane IDE.
4. **Builds trust in a free model.** Codera runs on Kilo Auto Free, whose output quality and availability vary \[EXISTING\]. The design surfaces checks, repairs, changes and one-tap restore, so mistakes are cheap.
5. **Own identity.** The loop, the plan-as-document and the audit-to-repair path are not copied from any competitor.

**Decisions at a glance**

| Topic | Decision |
| --- | --- |
| Mode vs view | **Mode** (Plan or Build) sits in the composer and decides what the next prompt does. **View** (Preview, Code, Plan, Issues, History) sits in workspace tabs. The stage rail only reports progress and jumps views; it never changes mode. |
| Desktop builder | Header 56 · Chat 400 (resizable 320–560) · Workspace · Status bar 28. |
| Phone builder | Header 52 · one view at a time · bottom tabs Chat, Preview, Code, Issues · composer docked above the tabs. |
| Styling | Plain CSS custom properties and plain CSS files. No Tailwind, CSS-in-JS or UI kit. |
| Icons and fonts | lucide-react only; system font stacks, no font downloads. |
| Themes | Light, dark, follow-system. Both fully specified. |
| Dependencies added | None. Panels, sheets, dialogs, tabs and toasts are small in-house components. |
| Data changed | None. localStorage keys, schemas, the /api/generate contract and file formats stay as they are. |

## 2. Existing product audit

Source: README.md and package.json (the §0 limits apply). The status column uses the evidence labels.

| Area | What exists | Status |
| --- | --- | --- |
| Product | Local-first, mobile-friendly AI website builder. Flow: User → Workspace → Project → Plan → Build → Project Files → Live Preview. | \[EXISTING\] |
| Stack | React, Vite, TypeScript; lucide-react 0.468; fflate (ZIP); Capacitor 7 (Android); Electron 39 (Windows); Playwright. No Tailwind, router, state library, editor library or UI kit in dependencies. | \[EXISTING\] |
| Persistence | Workspaces, projects, plans, prompts and generated files live in browser localStorage. No cloud database, auth or hosted storage. | \[EXISTING\] |
| Workspaces and projects | Multiple local workspaces and projects; project rename; confirmed delete. | \[EXISTING\] |
| AI generation | Plan and Build requests go to same-origin /api/generate (a Cloudflare Pages Function), which calls the Kilo gateway with model kilo-auto/free and no API key. The free tier is rate-limited and the underlying model can change. | \[EXISTING\] |
| Plan to Build | Build receives the saved plan as context. | \[EXISTING\] |
| Output safety | Structured-output validation, bounded file sizes, safe relative paths, duplicate-path rejection, one automatic repair attempt for invalid builds. | \[EXISTING\] |
| Files and editor | Editable HTML, CSS and JS files. Editor implementation unknown; no editor library is installed, so a plain textarea or custom component is likely. | \[EXISTING\] / \[VERIFY\] |
| Live preview | Sandboxed preview with browser-side runtime error reporting; desktop, tablet and mobile sizing. | \[EXISTING\] |
| Diagnostics | Automatic audits: title, viewport, page content, button labels, opted-in safe button interactions, form labels and native validation, submit controls, in-page navigation, image alt text, horizontal overflow. | \[EXISTING\] |
| Repair | One automatic AI repair after a build if audits or runtime diagnostics fail, then a fresh audit. Manual AI repair for remaining failures, using diagnostics plus current files. | \[EXISTING\] |
| History | Version history with restorable checkpoints created before AI builds, automatic repairs and restores. | \[EXISTING\] |
| Prompts | Prompt shortcuts and prompt history. | \[EXISTING\] |
| Export and import | ZIP source export of all generated files; one-time migration of Floot-imported local data. | \[EXISTING\] |
| Responsive | “Responsive mobile workspace”; Playwright checks at 375, 768 and 1280 px. Exact layout unknown. | \[EXISTING\] / \[VERIFY\] |
| Native shells | Windows Electron app and Android Capacitor shell. Generation is not a persistent Android background job: the app must stay open while generating. | \[EXISTING\] |
| Not built | Cloud sync, collaboration, visual element editing, live deployment, Android background generation. | \[FUTURE\] |

**Constraints that follow from the stack**

- No router: navigation is probably state-driven. Keep it; add only a minimal history layer where §10 says so.
- No editor library: keep the current editor control and restyle it. Syntax highlighting is not required.
- No panel or sheet library: build resizers, sheets and dialogs in-house (small components, no dependency).
- Embedded Chromium (Electron, Android WebView): test safe areas, keyboard resizing and the Back button on a real device.

**Unknowns to resolve first.** §16 gives the search term for each: styling files and class naming; the navigation mechanism; storage keys and shapes; the generation call and its error shape; where phase states (validating, auto-repair, auditing) are set; the preview iframe and its error channel; the editor control; the checkpoint shape; the plan data shape; the test selectors in tests/.

## 3. Competitive research (November 2026)

| Product | What it does now (paraphrased from public docs and release notes) | Adopt | Avoid |
| --- | --- | --- | --- |
| **Lovable** | Chat panel left, live preview right. Project toolbar tabs: Preview (home), Code, More. Chat has three modes: Chat (discuss, never edits code), Plan (writes a plan you edit and approve) and Build. The dashboard has a central prompt box whose mode picker remembers the last choice, project cards with preview and Published badge, search, filters, folders and pinning. The code editor is optional; edits are paid-only and each save makes a version. | Prompt-first dashboard with remembered mode; plan approved before building; cards with status badges; code is optional, not required; manual edits create versions. | Three overlapping chat modes; hiding tools behind a generic More menu. |
| **Bolt.new** | One workspace switching between chat, code view, live preview and project settings. On mobile a preview card appears in chat after each build and opens full screen. Preview controls (reload, responsive mode, device preview) stay visible; open-in-window and full screen sit in an overflow menu. Plan mode chats without generating code. Visual edits (select tool) reached all users in September 2026. Version history supports rollback. | Preview card inside chat that opens full screen (best phone pattern found); compact preview toolbar with overflow; rollback. | IDE density on phones; settings mixed into the editor header. |
| **v0** | February 2026 relaunch: sandbox runtime, full VS Code-style editor, a Git branch per chat, design mode for editing on the preview, annotations that become one prompt, a Projects tab in the sidebar. Community threads from spring 2026 report preview failures and a missing “go to code” action after the update. | Sidebar project list; the annotation idea (as a \[FUTURE\] hook). | Adding power features at the cost of a reliable preview; making code access hard to find. |
| **Replit** | Plan toggle at the bottom of the chat input. Plan produces an ordered task list with Accept and Revise; “Start building” approves and switches to Build. Mobile app: home prompt box with a Plan option and recent projects, swiping between Agent, tasks and Preview, voice input, progress notifications. | Mode switch inside the composer; explicit approval button; recent projects under the prompt; fast chat-to-preview switching on phones. | Feature sprawl (tasks, integrations, deploys); navigation that relies on swiping alone. |

**Patterns Codera adopts:** prompt-first start with a remembered mode · mode switch in the composer · explicit “build this plan” approval · preview shown as a card in chat on phones · compact preview toolbar · project cards with status · version rollback · code available but never required.

**Patterns Codera avoids:** more than two AI modes · IDE-grade chrome on phones · swipe-only navigation · hiding Code or Issues in a catch-all menu · any feature that implies cloud, accounts or deploy.

**Codera’s own identity:** (1) the Loop rail and next-action button; (2) the plan as a reviewable document; (3) a trust loop of audit → repair → review changes → restore; (4) local-first honesty: storage meter, export, privacy note; (5) free-model honesty: rate-limit-aware error states.

## 4. Three design directions

The directions differ in layout and interaction strategy, not only in color.

### Direction A — Workbench (simultaneous panes)

| Item | Definition |
| --- | --- |
| Philosophy | Show everything at once; the builder is an instrument panel for people who read code. |
| Visual identity | Graphite surfaces, 1px borders, electric-blue accent, square-ish radii (4–6), dark-first. |
| Palette | bg `#0F1115`, panel `#161920`, raised `#1D212B`, border `#2A2F3B`, text `#E7EAF0`, text-2 `#A9B0BF`, text-3 `#8B93A5`, accent `#4C8DFF` (label on accent `#06101F`, 5.96:1), success `#3FB950`, warning `#D29922`, error `#F85149`. |
| Typography | System sans 13/18 UI, mono 13/20 code, captions 12/16; weights 400/500/600. |
| Navigation | 48px icon activity bar (Chat, Files, Issues, History, Settings) plus a collapsible side panel. |
| Dashboard | Dense table: name, status, files, edited, actions; filter bar; no hero. |
| Builder | Chat 340, Editor 1fr, Preview 420, bottom panel 220 for Issues and History; draggable dividers everywhere. |
| Mobile | Five bottom tabs (Chat, Files, Code, Preview, Issues), 72px each at 360; editor-forward. |
| Components | 28–32px controls, no shadows except popovers. |
| Interaction | Keyboard-first, multi-tab editor, hover toolbars. |
| Verdict | Powerful, but resembles the Bolt, v0 and Replit editors (clone risk), is cramped on phones and intimidates first-time builders. |

### Direction B — Canvas (conversation-first)

| Item | Definition |
| --- | --- |
| Philosophy | The conversation is the product; code and diagnostics appear only when needed. |
| Visual identity | Warm paper, generous space, 16–20px radii, soft shadows, sage accent. |
| Palette | bg `#FBF9F6`, surface `#FFFFFF`, border `#E8E2D9`, text `#1F1B16`, text-2 `#4A443C`, text-3 `#6B645A`, accent `#2F7D5B` (white label 4.99:1), error `#B3261E`. |
| Typography | System sans 16/24 chat, 15/22 UI, display 30/38, mono 13/20. |
| Navigation | Top bar with a project switcher; no sidebar in the builder. |
| Dashboard | Centered prompt box over a card grid. |
| Builder | Centered chat column (max 720) with the preview docked at 40% width; Code and Issues open as 480px right drawers; the plan sits inline in chat. |
| Mobile | Chat-first; preview as a peek card that opens full screen; code and issues in sheets. |
| Components | Pill buttons (radius 999), 48px controls. |
| Interaction | Single focus, drawers, minimal chrome. |
| Verdict | Easiest to learn, but close to Lovable (clone risk), and it buries code and diagnostics, which weakens Codera’s audit-and-repair loop. |

### Direction C — Loop (stage-driven) — recommended

| Item | Definition |
| --- | --- |
| Philosophy | Show the loop and always offer the next step. One primary surface per stage; everything else is one tap away. |
| Visual identity | Ink neutrals with teal “Signal” (build, primary actions) and indigo “Plan” accents; 8/12/16 radii; 1px borders; shadows only on floating layers; stage glyphs. |
| Palette | Light: bg `#F6F7F9`, surface `#FFFFFF`, text `#0E1520`, primary `#0B7A75`, plan `#5B4BC4`. Dark: bg `#0B0F14`, surface `#121821`, text `#E9EEF5`, primary `#34D3BE`, plan `#A99CFF`. Full set in §6. |
| Typography | System sans 14/20 UI, 15/22 chat, mono 13/20; weights 400/500/600/700. |
| Navigation | Dashboard: 248px sidebar on desktop, bottom tabs below 1024. Builder: no sidebar; 56px header with back, project name, Stage rail, next-action button, Layout and More menus. Phone: 52px header plus four bottom tabs. |
| Dashboard | Hero prompt box with remembered mode, shortcut chips and recent-project cards; the sidebar holds the workspace switcher and a recent list. |
| Builder | Chat 400 plus Workspace tabs (Preview, Code, Plan, Issues, History); four layout presets; 28px status bar. |
| Mobile | One view at a time; composer docked above the tabs; an “Ask AI” button opens a composer sheet from Preview and Code. |
| Components | 36–40px desktop controls, 44–48px touch controls. |
| Interaction | Views follow the stage automatically but never steal focus; progress never blocks; every AI change is reviewable and restorable. |
| Verdict | Strongest identity and the closest match to existing features; moderate effort (derived UI state, no backend). |

### Recommendation

Indicative judgment, 1 (weak) to 5 (strong); for implementation risk a higher score means safer.

| Criterion | A Workbench | B Canvas | C Loop |
| --- | --- | --- | --- |
| Fit with Codera’s existing flow | 3 | 3 | 5 |
| Phone usability | 2 | 5 | 4 |
| Implementation risk (5 = safest) | 3 | 4 | 4 |
| Distinct identity | 2 | 2 | 5 |
| First-run learnability | 2 | 5 | 4 |
| Keeps audit and repair prominent | 3 | 2 | 5 |
| **Total** | 15 | 21 | 27 |

**Choose C.** It is the only direction that makes Codera’s differentiators the interface. Its risks and mitigations:

- *Risk: the stage rail feels rigid.* Mitigation: the rail only follows state and jumps views; users can open any view at any time.
- *Risk: mode and view get confused.* Mitigation: mode lives only in the composer, view only in tabs; the send button’s color and label always state the mode.
- *Risk: derived phase states may not exist in code.* Mitigation: add UI-only state variables fed by the existing handlers; do not alter the handlers.
- *Borrowed on purpose:* Workbench’s resizable panels (inside the Code view) and Canvas’s calm chat typography.

## 5. Information architecture (handoff item B)

### 5.1 Screen hierarchy

```
Codera AI
+- Dashboard shell   sidebar at 1024+, bottom tabs below 1024
|  +- Home           prompt box, shortcut chips, recent projects
|  +- Projects       search, sort, grid or list, project actions
|  +- Settings       appearance, storage, privacy and AI
+- Builder           one project, full screen, no sidebar
|  +- Header         back, project name, Stage rail, next action, Layout, More
|  +- Chat panel     thread, Plan/Build composer, shortcuts, prompt history
|  +- Workspace      tabs: Preview, Code, Plan, Issues, History
|  |  +- Code        file explorer + editor
|  +- Status bar     tablet and desktop only
+- Overlays          Create project, Project settings, Changes review,
                     confirm dialogs, menus, sheets, toasts
```

### 5.2 Navigation map

| From | To | Trigger | Notes |
| --- | --- | --- | --- |
| Home | Builder (new project) | Submit the hero composer, or the Create project dialog | The project is created with the existing create handler, then the prompt is sent in the chosen mode (§10.2). |
| Home or Projects | Builder (existing) | Select a card, a list row or a sidebar recent item | Opens at the default view (§5.3). |
| Builder | Projects | Header Back button; Android Back at the Builder root | Never loses edits: §10.6. |
| Any dashboard screen | Settings | Sidebar item or bottom tab |  |
| Builder | Project settings | More menu, Project settings | Dialog on desktop, full-screen sheet on phones. |
| Builder | Versions | Workspace tab History, or More menu, Version history | Both open the same view. |
| Chat card | Workspace view | File chip opens Code; preview card opens Preview; plan card opens Plan; issues row opens Issues | On phones this switches the bottom tab. |

### 5.3 Default view when a project opens

| Project state | Desktop and tablet (Workspace tab) | Phone (bottom tab) |
| --- | --- | --- |
| No plan, no files | Preview, showing its empty state | Chat |
| Plan saved, no files | Plan | Chat, with the plan card and its Build button as the latest message |
| Files exist | Preview | Chat |

The phone always opens on Chat because the conversation is the entry point; the Preview tab shows a dot when a build finished since it was last visited.

### 5.4 Navigation implementation rules (no router dependency)

- Keep the app’s existing navigation mechanism \[VERIFY\]. Do not add react-router or any routing package.
- If navigation is plain React state, add a minimal history layer \[UX-NEW\]. Call `history.pushState` when entering the Builder and when opening a sheet, dialog or menu on a touch layout. One `popstate` listener closes the topmost overlay first, then leaves the Builder. This makes the Android Back button and the browser Back button behave correctly in the Capacitor WebView and in browsers.
- If the app already uses hash or URL routing, extend it with `#/projects`, `#/settings` and `#/p/:projectId/:view`. Never put prompts or file names in the URL.
- The Electron build behaves identically (Back does nothing at the dashboard root).
- View state (open Workspace tab, open file, scroll positions) lives in memory for the session and is never written to project data.

### 5.5 UI vocabulary

| UI label | Meaning in the existing app | Rule |
| --- | --- | --- |
| Workspace | A local workspace that groups projects | Shown only in the dashboard switcher. |
| Plan | Plan mode and the saved plan | Noun for the document, mode name in the composer. |
| Build | Build mode | Verb on the mode toggle and the Send button. |
| Verify | Preview, checks and repair as one stage | Used only in the Stage rail. |
| Checks | Preview audits and runtime diagnostics | The word “audit” never appears in user-facing text. |
| Issues | Failed checks and runtime errors | Tab name and badge. |
| Repair | Automatic or manual AI repair | Button label: “Repair with AI”. |
| Versions | Checkpoints | Example: “Version saved before build”. |
| Kilo Auto Free | The provider route | Shown as a read-only model badge; never renamed. |

### 5.6 New UI-only storage keys

These hold interface preferences only. They never touch project data and are excluded from ZIP export.

| Key | Holds | Default |
| --- | --- | --- |
| `codera.ui.theme` | `system`, `light` or `dark` | `system` |
| `codera.ui.mode` | Last composer mode, `plan` or `build` | `plan` |
| `codera.ui.layout.v1` | Desktop preset id and panel widths | preset 1, chat 400, tree 224 |
| `codera.ui.projects.v1` | Projects screen view (grid or list) and sort | grid, last edited |
| `codera.ui.editor.v1` | Word wrap, font size 12 to 18 | wrap on (phone) or off (desktop), 13 |
| `codera.ui.notices.v1` | Dismissed one-time notices (privacy, storage warning level) | none |

Every read and write is wrapped in try/catch and falls back to memory when storage is unavailable or full.

## 6. Design tokens (handoff item C)

Put all tokens in one file, `tokens.css`, imported before every other stylesheet \[VERIFY the current entry stylesheet\]. If the repo already defines CSS variables, keep the old names as aliases pointing to the new tokens so existing rules keep working during migration.

**Primary color:** Signal Teal. **Secondary color:** Plan Indigo.

### 6.1 Theme resolution

- A tiny inline script in `index.html`, placed before the stylesheet, sets `document.documentElement.dataset.theme` to `light` or `dark`. It reads `codera.ui.theme`; for `system` or no value it uses `matchMedia('(prefers-color-scheme: dark)')`. A `change` listener on that query updates the attribute while the preference is `system`. This prevents a flash of the wrong theme and keeps the CSS to exactly two color blocks.
- Without JavaScript the app renders in the light theme.
- Android WebView and Electron both report `prefers-color-scheme`; no native change is needed \[VERIFY on device\].

### 6.2 Color tokens, light (default)

```css
:root {
  color-scheme: light;
  /* Primary: Signal Teal (Build, main actions) */
  --cd-primary: #0B7A75;  --cd-primary-hover: #096964;  --cd-primary-active: #075853;
  --cd-primary-soft: #E3F5F3;  --cd-primary-soft-border: #B7E3DE;  --cd-primary-text: #075A56;  --cd-on-primary: #FFFFFF;
  /* Secondary: Plan Indigo (Plan mode, plan document) */
  --cd-plan: #5B4BC4;  --cd-plan-hover: #4E3FB0;  --cd-plan-active: #42349A;
  --cd-plan-soft: #EEEBFB;  --cd-plan-soft-border: #D2CBF3;  --cd-plan-text: #4A3BA8;  --cd-on-plan: #FFFFFF;
  /* Backgrounds and surfaces */
  --cd-bg: #F6F7F9;  --cd-surface: #FFFFFF;  --cd-surface-2: #F0F2F5;  --cd-surface-3: #E6E9EE;
  --cd-scrim: rgb(14 21 32 / 0.48);  --cd-selection: #BFE7E3;
  /* Text and icons */
  --cd-text: #0E1520;  --cd-text-2: #404B5C;  --cd-text-3: #586376;
  --cd-icon-muted: #677285;  --cd-text-disabled: #8B95A5;
  /* Borders */
  --cd-border: #DDE1E8;  --cd-border-strong: #C4CAD5;  --cd-input-border: #7A8597;
  /* Status */
  --cd-success: #176F41;  --cd-success-soft: #E5F5EC;  --cd-success-border: #B9E3CB;  --cd-success-text: #176F41;
  --cd-warning: #8A5300;  --cd-warning-soft: #FFF3DB;  --cd-warning-border: #F2D79B;  --cd-warning-text: #8A5300;  --cd-warning-fill: #B86E00;
  --cd-error: #B42318;  --cd-error-soft: #FDECEA;  --cd-error-border: #F4C0BB;  --cd-error-text: #B42318;
  --cd-error-solid: #B42318;  --cd-error-solid-hover: #9B1C13;  --cd-on-error: #FFFFFF;
  --cd-info: #1D5FA8;  --cd-info-soft: #E6F0FA;  --cd-info-border: #BAD3EE;  --cd-info-text: #1D5FA8;
  /* Focus */
  --cd-focus: #2563EB;
  /* Elevation */
  --cd-shadow-1: 0 1px 2px rgb(14 21 32 / 0.06), 0 1px 1px rgb(14 21 32 / 0.04);
  --cd-shadow-2: 0 4px 12px rgb(14 21 32 / 0.10), 0 2px 4px rgb(14 21 32 / 0.06);
  --cd-shadow-3: 0 12px 32px rgb(14 21 32 / 0.18), 0 4px 8px rgb(14 21 32 / 0.08);
}
```

### 6.3 Color tokens, dark

```css
:root[data-theme='dark'] {
  color-scheme: dark;
  --cd-primary: #34D3BE;  --cd-primary-hover: #5BE0CD;  --cd-primary-active: #7EEBDA;
  --cd-primary-soft: #0F2E2B;  --cd-primary-soft-border: #1B5A53;  --cd-primary-text: #6FE3D3;  --cd-on-primary: #04211E;
  --cd-plan: #A99CFF;  --cd-plan-hover: #BDB3FF;  --cd-plan-active: #CFC8FF;
  --cd-plan-soft: #221C4A;  --cd-plan-soft-border: #3D3480;  --cd-plan-text: #C4BBFF;  --cd-on-plan: #140F3A;
  --cd-bg: #0B0F14;  --cd-surface: #121821;  --cd-surface-2: #19212C;  --cd-surface-3: #222C39;
  --cd-scrim: rgb(0 0 0 / 0.60);  --cd-selection: #1F5C56;
  --cd-text: #E9EEF5;  --cd-text-2: #B4BECC;  --cd-text-3: #8E9AAD;
  --cd-icon-muted: #8E9AAD;  --cd-text-disabled: #5B6678;
  --cd-border: #263243;  --cd-border-strong: #36445A;  --cd-input-border: #667489;
  --cd-success: #4ADE80;  --cd-success-soft: #0F2B1B;  --cd-success-border: #1E5B38;  --cd-success-text: #7BE8A4;
  --cd-warning: #F5B544;  --cd-warning-soft: #33250A;  --cd-warning-border: #6B4C12;  --cd-warning-text: #F8C970;  --cd-warning-fill: #F5B544;
  --cd-error: #FF8A80;  --cd-error-soft: #3A1512;  --cd-error-border: #7A2B25;  --cd-error-text: #FFA59D;
  --cd-error-solid: #D92D20;  --cd-error-solid-hover: #B42318;  --cd-on-error: #FFFFFF;
  --cd-info: #7AB8FF;  --cd-info-soft: #12263D;  --cd-info-border: #264B73;  --cd-info-text: #7AB8FF;
  --cd-focus: #7AA7FF;
  --cd-shadow-1: 0 1px 2px rgb(0 0 0 / 0.50);
  --cd-shadow-2: 0 4px 12px rgb(0 0 0 / 0.50), 0 0 0 1px rgb(255 255 255 / 0.04);
  --cd-shadow-3: 0 12px 32px rgb(0 0 0 / 0.60), 0 0 0 1px rgb(255 255 255 / 0.06);
}
```

### 6.4 Typography, spacing, radii, z-index, motion and layout tokens

```css
:root {
  /* Families: system stacks only (Roboto on Android, Segoe UI on Windows). No font downloads. */
  --cd-font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  --cd-font-mono: ui-monospace, SFMono-Regular, 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, 'Roboto Mono', 'Liberation Mono', monospace;
  /* Sizes and line heights */
  --cd-fs-xs: 12px;    --cd-lh-xs: 16px;
  --cd-fs-sm: 13px;    --cd-lh-sm: 18px;
  --cd-fs-md: 14px;    --cd-lh-md: 20px;
  --cd-fs-chat: 15px;  --cd-lh-chat: 22px;
  --cd-fs-lg: 16px;    --cd-lh-lg: 24px;
  --cd-fs-xl: 18px;    --cd-lh-xl: 26px;
  --cd-fs-2xl: 20px;   --cd-lh-2xl: 28px;
  --cd-fs-3xl: 24px;   --cd-lh-3xl: 32px;
  --cd-fs-4xl: 30px;   --cd-lh-4xl: 38px;
  --cd-fs-code: 13px;  --cd-lh-code: 20px;   /* touch: 14px / 22px */
  /* Weights */
  --cd-fw-regular: 400;  --cd-fw-medium: 500;  --cd-fw-semibold: 600;  --cd-fw-bold: 700;
  /* Spacing, 4px base */
  --cd-sp-0_5: 2px;  --cd-sp-1: 4px;  --cd-sp-1_5: 6px;  --cd-sp-2: 8px;  --cd-sp-3: 12px;  --cd-sp-4: 16px;
  --cd-sp-5: 20px;  --cd-sp-6: 24px;  --cd-sp-8: 32px;  --cd-sp-10: 40px;  --cd-sp-12: 48px;  --cd-sp-16: 64px;
  /* Radii */
  --cd-r-xs: 4px;  --cd-r-sm: 6px;  --cd-r-md: 8px;  --cd-r-lg: 12px;  --cd-r-xl: 16px;  --cd-r-full: 999px;
  /* Z-index layers */
  --cd-z-base: 0;  --cd-z-sticky: 100;  --cd-z-resizer: 150;  --cd-z-popover: 300;
  --cd-z-scrim: 400;  --cd-z-sheet: 410;  --cd-z-dialog-scrim: 500;  --cd-z-dialog: 510;
  --cd-z-toast: 700;  --cd-z-tooltip: 800;
  /* Motion */
  --cd-dur-fast: 120ms;  --cd-dur-base: 200ms;  --cd-dur-slow: 320ms;
  --cd-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --cd-ease-out: cubic-bezier(0.05, 0.7, 0.1, 1);
  --cd-ease-in: cubic-bezier(0.3, 0, 0.8, 0.15);
  /* Layout constants */
  --cd-h-header: 56px;  --cd-h-header-mobile: 52px;  --cd-h-tabbar: 64px;  --cd-h-status: 28px;
  --cd-h-tabs: 44px;  --cd-h-toolbar: 44px;  --cd-touch: 44px;
  --cd-w-sidebar: 248px;  --cd-w-chat: 400px;  --cd-w-chat-min: 320px;  --cd-w-chat-max: 560px;
  --cd-w-tree: 224px;  --cd-w-reading: 720px;  --cd-w-content: 1120px;  --cd-w-dialog: 480px;  --cd-w-dialog-lg: 560px;
  --cd-safe-top: env(safe-area-inset-top, 0px);  --cd-safe-bottom: env(safe-area-inset-bottom, 0px);
  --cd-safe-left: env(safe-area-inset-left, 0px);  --cd-safe-right: env(safe-area-inset-right, 0px);
}
```

**Type roles**

| Role | Size / line | Weight | Used for |
| --- | --- | --- | --- |
| Display | 30/38 | 600 | Hero heading on Home |
| Page title | 24/32 | 600 | Projects, Settings |
| Dialog and card title | 18/26 | 600 | Dialog titles, plan title |
| Section title | 16/24 | 600 | Panel headings |
| Project name (header) | 16/24 | 600 | Builder header |
| Chat body | 15/22 | 400 | Messages and composer on desktop |
| UI body, labels, buttons | 14/20 | 500 for buttons, tabs, nav; 400 for body | Everything else |
| Small | 13/18 | 400 or 500 | Helper text, card meta, toolbar labels |
| Caption | 12/16 | 500 | Badges, timestamps, counters |
| Code | 13/20 mono (14/22 on touch) | 400 | Editor, diffs, error details |

Tracking is `-0.01em` at 24px and above, normal elsewhere. Numbers in timers and counters use `font-variant-numeric: tabular-nums`.

**Spacing use.** Page gutters 16 (phone), 24 (tablet), 32 (desktop). Card padding 16. Panel padding 16. Gap between sections 24. Gap between related controls 8. Gap between icon and label 8.

**Elevation use.** At rest, cards use a border only. `--cd-shadow-1`: hovered cards and the composer. `--cd-shadow-2`: menus and popovers. `--cd-shadow-3`: dialogs, sheets, toasts.

### 6.5 Breakpoints and media features

| Name | Range | Design widths | Builder layout |
| --- | --- | --- | --- |
| mobile | 0 to 767 | 360, 390, 430 (also run the existing 375 test) | One view at a time, bottom tabs |
| tablet | 768 to 1023 | 768 | Two columns: Chat 320 plus Workspace; dashboard uses bottom tabs |
| desktop | 1024 to 1439 | 1024, 1280 | Chat 360 (1024 to 1199) or 400 (1200+) plus Workspace; dashboard sidebar |
| wide | 1440 and up | 1440, 1920 | Same as desktop; content max widths apply |

Media queries: `(min-width: 768px)`, `(min-width: 1024px)`, `(min-width: 1440px)`. Touch sizing keys off `(pointer: coarse)`, not width. Also honor `(prefers-reduced-motion: reduce)`, `(prefers-contrast: more)` and `(forced-colors: active)`.

### 6.6 Base rules and focus ring

```css
html { font-family: var(--cd-font-sans); font-size: 16px; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { margin: 0; background: var(--cd-bg); color: var(--cd-text); font-size: var(--cd-fs-md); line-height: var(--cd-lh-md); -webkit-font-smoothing: antialiased; }
button, input, textarea, select { font: inherit; color: inherit; }
::selection { background: var(--cd-selection); }
:focus:not(:focus-visible) { outline: none; }
:focus-visible { outline: 2px solid var(--cd-focus); outline-offset: 2px; }
.cd-focus-inset:focus-visible { outline-offset: -2px; }   /* inside clipped containers */
@media (pointer: coarse) { input, textarea, select { font-size: 16px; } }   /* no zoom on focus */
@media (prefers-contrast: more) { :root { --cd-border: var(--cd-input-border); --cd-text-3: var(--cd-text-2); } }
@media (forced-colors: active) { :focus-visible { outline: 2px solid Highlight; } .cd-btn, .cd-card, .cd-input { border: 1px solid ButtonText; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

**Focus ring rule.** 2px solid `--cd-focus`, offset 2px (offset -2px inside clipped containers). The ring always sits on the surrounding surface, never on a control’s own fill, so it stays visible on teal and indigo buttons.

### 6.7 Verified contrast pairs

Computed with the WCAG 2.x relative-luminance formula on November 22, 2026. Rules: text at least 4.5:1; large text and UI boundaries or icons at least 3:1; disabled controls are exempt; `--cd-text-disabled` never carries essential information; status is never conveyed by color alone (always an icon plus text).

| Pair | Light | Dark |
| --- | --- | --- |
| Text on bg / surface | 17.08 / 18.31 | 16.49 / 15.29 |
| Text-2 on surface | 8.83 | 9.49 |
| Text-3 on surface (lowest: on surface-3) | 6.07 (4.99) | 6.26 (4.96) |
| On-primary label on primary | 5.18 | 9.03 |
| Primary-text on primary-soft | 7.15 | 9.41 |
| On-plan label on plan | 6.46 | 7.67 |
| Plan-text on plan-soft | 7.22 | 8.93 |
| Success-text on success-soft | 5.49 | 10.08 |
| Warning-text on warning-soft | 5.76 | 9.63 |
| Error-text on error-soft | 5.75 | 8.58 |
| On-error label on error-solid | 6.57 | 4.83 |
| Info-text on info-soft | 5.59 | at least 7 |
| Input border on surface (UI boundary) | 3.73 | 3.75 |
| Focus ring on surface | 5.17 | 7.47 |
