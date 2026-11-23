export interface OfflineGuide {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

export const OFFLINE_GUIDES: OfflineGuide[] = [
  {
    id: 'html-foundations',
    title: 'HTML structure, semantics, and forms',
    tags: ['html', 'semantic', 'forms', 'accessibility', 'web'],
    content: `Use HTML to describe meaning, not just appearance. Start with <!doctype html>, set lang on the html element, and include charset plus a responsive viewport meta tag. Use header, nav, main, section, article, aside, and footer according to their meaning. A page should normally have one primary main landmark and a clear heading hierarchy. Use buttons for actions and anchors for navigation. Give form controls visible labels connected with for/id, useful name attributes, and appropriate input types. Group related controls with fieldset and legend. Images that convey information need useful alt text; decorative images should use alt="". Tables are for tabular data and need header cells. Avoid clickable div elements when a native button or link exists. Native semantics improve keyboard access, screen-reader output, and browser behavior.`
  },
  {
    id: 'css-layout',
    title: 'Responsive CSS layout and visual systems',
    tags: ['css', 'responsive', 'grid', 'flexbox', 'layout', 'design'],
    content: `Prefer mobile-first CSS: write the narrow layout first, then add min-width media queries when the content needs more room. Use CSS Grid for two-dimensional page structure and Flexbox for one-dimensional alignment. Use minmax(), repeat(), auto-fit, and minmax(0, 1fr) to prevent grid overflow. Set box-sizing:border-box globally. Avoid fixed widths for major containers; use width:100%, max-width, clamp(), and fluid spacing. Test at narrow widths and with long text. Define design tokens in :root for color, spacing, radius, and typography. Keep focus-visible styles clear. Check contrast rather than relying on color alone. Avoid using viewport height as the only sizing rule on mobile because browser chrome changes the visible area.`
  },
  {
    id: 'javascript-dom',
    title: 'JavaScript, DOM, and browser events',
    tags: ['javascript', 'dom', 'events', 'async', 'browser'],
    content: `Prefer const by default and let when reassignment is required. Keep functions small and name them by intent. Query elements once when practical and check that a query returned an element before using it. Use addEventListener instead of inline event attributes. Use textContent for untrusted text; avoid assigning untrusted strings to innerHTML. Handle asynchronous work with async/await and try/catch. Disable or mark controls while a request is pending, and restore them in finally. Use URL and URLSearchParams to build URLs safely. Store only small preferences in localStorage; catch quota and parsing errors. Do not store secrets or authentication tokens in browser storage. Clean up event listeners and observers when components are removed.`
  },
  {
    id: 'typescript-react',
    title: 'TypeScript and React implementation patterns',
    tags: ['typescript', 'react', 'components', 'state', 'frontend'],
    content: `Model data with explicit interfaces or types. Avoid any when unknown is more accurate; narrow unknown with runtime checks. Keep React components focused and extract repeated behavior into hooks or components. State should represent information that changes over time; derive values from existing state instead of storing duplicates. Use stable keys for mapped children. Keep effects for synchronization with external systems, not for ordinary calculations. Clean up subscriptions, timers, and listeners in effects. Handle loading, empty, error, and success states. Forms should validate input and explain errors near the relevant field. Keep expensive work out of render paths. Prefer semantic HTML and keyboard-operable controls. Type API boundaries and validate untrusted JSON before trusting it.`
  },
  {
    id: 'vite-tooling',
    title: 'Vite projects, scripts, and dependency workflows',
    tags: ['vite', 'npm', 'node', 'tooling', 'build'],
    content: `A typical Vite project has package.json, index.html, src/main.ts or src/main.tsx, and source styles. package.json scripts should define dev, build, and preview. Run the existing scripts before inventing new ones. Keep dependencies purposeful and avoid installing a package for a trivial helper. Use a lockfile for repeatable installs. Do not edit node_modules directly. Keep environment variables prefixed with VITE_ only when they are safe to expose to browser code; never put private keys in client-side variables. Build output belongs in dist and should not be committed unless the repository explicitly expects it. Check the terminal exit code and read the first actionable error before changing configuration.`
  },
  {
    id: 'web-security',
    title: 'Frontend security and safe data handling',
    tags: ['security', 'xss', 'privacy', 'validation', 'web'],
    content: `Treat user input, model output, URLs, and imported files as untrusted. Render text with textContent or framework escaping. Sanitize rich HTML with a well-maintained sanitizer when HTML rendering is truly needed. Validate paths on the server or native boundary, normalize separators, reject traversal segments, and resolve the final path to confirm it stays inside the workspace. Do not expose filesystem APIs, shell access, or secrets to browser code. Avoid shell:true and pass command arguments as an array. Require explicit confirmation for destructive actions, dependency changes, and repository mutations. Limit file sizes, request sizes, execution time, and output length. Do not log credentials or full environment variables. Apply least privilege to every bridge and tool.`
  },
  {
    id: 'debugging',
    title: 'A reliable frontend debugging sequence',
    tags: ['debugging', 'errors', 'diagnostics', 'console', 'testing'],
    content: `Reproduce the issue before editing. Read the exact error and identify the first relevant stack frame. Check whether the failure is in type checking, bundling, runtime code, network access, or layout. Make the smallest change that addresses the cause. Re-run the failing command, then run the full build and relevant tests. For visual bugs, inspect the affected element, computed styles, viewport width, and overflow. For asynchronous bugs, inspect promise rejection paths and loading state transitions. Do not silence errors with broad catch blocks or disable lint/type checks to make a build pass. Record what was changed and which checks were actually run.`
  },
  {
    id: 'accessibility',
    title: 'Keyboard and assistive-technology accessibility',
    tags: ['accessibility', 'a11y', 'keyboard', 'screen reader', 'wcag'],
    content: `Every interactive feature should work without a mouse. Use native controls where possible. Ensure tab order follows the visual reading order and focus is visible. Dialogs should have an accessible name, move focus inside when opened, keep focus within while modal, and return focus to the trigger when closed. Do not communicate status only through color. Use labels for inputs and useful error messages. Keep heading levels logical. Provide accessible names for icon-only buttons with aria-label. Use aria-live sparingly for important asynchronous status updates. Respect reduced-motion preferences. Test zoom and narrow layouts. Automated checks catch some issues, but keyboard and screen-reader testing remain necessary.`
  },
  {
    id: 'performance',
    title: 'Web performance and asset loading',
    tags: ['performance', 'optimization', 'images', 'bundle'],
    content: `Measure before optimizing. Keep initial JavaScript small and split rarely used features when appropriate. Prefer modern image formats and responsive image sizes. Set image width and height to reduce layout shift. Lazy-load below-the-fold images, but do not lazy-load the main hero image by default. Avoid large synchronous tasks on the main thread. Debounce expensive search input when it fires on every keystroke. Cache stable data deliberately and invalidate it when the source changes. Inspect bundle output to find unexpectedly large dependencies. Avoid adding a dependency solely to save a few lines of code.`
  },
  {
    id: 'testing',
    title: 'Practical testing strategy for web projects',
    tags: ['testing', 'unit', 'integration', 'e2e', 'quality'],
    content: `Test behavior, not implementation details. Unit tests should cover deterministic helpers and edge cases. Integration tests should cover important component or service boundaries. End-to-end tests should focus on critical user journeys such as navigation, forms, saving, and the primary action. Include empty, invalid, loading, and failure states. Use realistic but non-sensitive fixtures. Avoid tests that depend on arbitrary sleeps; wait for observable state. Keep tests isolated and clean up created data. A passing build does not prove the UI works, and a passing screenshot does not prove interactions work. Report skipped tests honestly.`
  },
  {
    id: 'pwa-offline',
    title: 'Progressive web apps and offline behavior',
    tags: ['pwa', 'offline', 'service worker', 'cache', 'storage'],
    content: `A progressive web app should remain useful when network access is unavailable. Cache the application shell and stable static assets with a service worker, but define update and invalidation behavior. Do not cache private API responses by default. Use IndexedDB for structured or larger client-side data; localStorage is synchronous and suited only to small preferences. Explain when data is local-only and when it is synchronized. Handle quota failures and stale caches. Test first load, repeat load, offline navigation, and application updates. A service worker should never be treated as a secure storage boundary.`
  }
];

export function searchOfflineGuides(query: string, limit = 4): Array<{ title: string; id: string; excerpt: string; score: number }> {
  const terms = [...new Set(query.toLowerCase().split(/[^a-z0-9+#.-]+/).filter(term => term.length > 1))];
  if (!terms.length) return [];
  return OFFLINE_GUIDES.map(guide => {
    const haystack = (guide.title + ' ' + guide.tags.join(' ') + ' ' + guide.content).toLowerCase();
    const title = guide.title.toLowerCase();
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 4 : 0) + (guide.tags.some(tag => tag.includes(term)) ? 3 : 0) + (haystack.includes(term) ? 1 : 0), 0);
    const first = terms.map(term => guide.content.toLowerCase().indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const excerpt = guide.content.slice(Math.max(0, first - 180), Math.min(guide.content.length, first + 620)).trim();
    return { title: guide.title, id: guide.id, excerpt, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 8)));
}
