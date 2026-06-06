# Live Static Preview

A single-page, CodePen-style playground. Three editors — **HTML**, **CSS**, and
**JavaScript** — feed a **live preview** that re-renders as you type. Built with
**vanilla JavaScript** + **CodeMirror 6**. No build step.

> Layout: editors on the left (HTML / CSS / JS stacked), live preview and
> console on the right, with draggable handles between every pane.

## Features

- Three CodeMirror 6 editors with syntax highlighting and a dark theme.
- Live preview, **debounced ~300 ms**, rendered into a **sandboxed `<iframe>`**.
- **Console panel** capturing `console.log/info/warn/error/debug` from the
  preview, plus uncaught errors and unhandled promise rejections.
- **Resizable panes** (CSS Grid + drag handles, keyboard-accessible).
- **Responsive**: collapses to a single stacked column on narrow screens.

---

## Quick start

This project has **no build step** — the files *are* the app. You just need to
serve the folder over HTTP (one line) because browsers block loading local ES
modules over the `file://` protocol (see [Why a server?](#why-a-server)).

Pick whichever you have:

```bash
npm start              # convenience wrapper for `npx serve .` (no install needed)

# …or any static server:
npx serve .            # Node
python -m http.server  # Python 3
php -S localhost:8000  # PHP
```

Then open the printed URL (e.g. <http://localhost:3000>).

> **Opening `index.html` directly?** That works in **Firefox** (it allows
> `file://` modules) but **not Chrome/Edge** (they block them for security). Use
> a server for those — it's still zero build.

> **First load needs internet.** CodeMirror 6 is fetched from the
> [esm.sh](https://esm.sh) CDN via an import map. After that the browser caches
> it. For a fully offline/self-hosted build, see [Production roadmap](#production-roadmap).

---

## Why "no build step" (and not Vite)?

The brief allowed either *"runs by opening `index.html`"* **or** *"a minimal
Vite setup."* I chose **no build step**, loading CodeMirror 6's ES-module
packages from a CDN through a native [`<script type="importmap">`](index.html).

**Why:** it ships as plain files with **zero `npm install`, zero tooling, and
nothing to audit but the code itself** — which matters most for the
security-sensitive sandbox logic. CodeMirror 6 is the only runtime dependency,
and the import map's `?deps=@codemirror/state@6,@codemirror/view@6` query pins
its shared peer packages to a single version so the editor instances don't
desync.

**The trade-off** is a runtime dependency on the CDN and the `file://` caveat
above. For production you'd vendor CodeMirror and bundle — and because the
modules `import` the packages by their bare names, **the same source works under
Vite unchanged**: run `npm install` (the dev dependencies are already declared
in `package.json`) then `npm run build`. Vite resolves the bare imports from
`node_modules` and the import map is simply ignored. That migration is in the
roadmap below.

### Why a server?

Modern browsers treat each ES module as a fetch. Over `file://` the page's
origin is `null`, and Chrome/Edge refuse cross-origin module fetches from a
`null` origin (*"Cross origin requests are only supported for protocol schemes:
http, https, …"*). Any static HTTP server gives the page a real origin and the
modules load. This is a browser security rule, not a build requirement.

---

## How it works

```
 ┌──────────┐  keystroke   ┌────────────┐  300ms   ┌───────────────────────┐
 │ 3 editors │ ───────────▶ │  debounce  │ ───────▶ │ buildPreviewDocument() │
 │ (CM6)     │              └────────────┘          └───────────┬───────────┘
 └──────────┘                                                    │ srcdoc
                                                                 ▼
 ┌────────────────────┐   postMessage    ┌──────────────────────────────────┐
 │ Console panel       │ ◀─────────────── │ sandboxed <iframe>  (allow-scripts │
 │ (parent page)       │   {__previewConsole}│  only — opaque/null origin)     │
 └────────────────────┘                  └──────────────────────────────────┘
```

1. Each editor's `updateListener` fires on edit and schedules a **300 ms
   debounced** `render()`.
2. `render()` concatenates the three sources into one HTML document and assigns
   it to `iframe.srcdoc`, which reloads the preview inside the sandbox.
3. A small **bridge script** is injected as the *first* script in the preview.
   It wraps `console.*` and listens for `error` / `unhandledrejection`, then
   forwards everything to the parent via `postMessage`.
4. The parent's `message` handler authenticates each message and renders it into
   the console panel as **plain text** (`textContent`, never `innerHTML`).

### Security model

All of this is commented inline in
[`src/preview/PreviewRenderer.js`](src/preview/PreviewRenderer.js); the essentials:

- **`sandbox="allow-scripts"` with no `allow-same-origin`.** The preview runs
  arbitrary user code, so it's given a unique **opaque (`"null"`) origin**: it
  **cannot** read this page's DOM, cookies, or storage, and cannot make
  credentialed same-origin requests.
- **Never add `allow-same-origin`.** Combined with `allow-scripts` it nullifies
  the sandbox — user code would share our origin, could steal cookies/tokens,
  and could even reach `frameElement` to strip its own `sandbox` attribute and
  reload fully unsandboxed. *This is the same-origin risk.*
- **postMessage is authenticated by source, not origin.** Because the origin is
  `"null"` and untrustworthy, the parent accepts a message only when
  `event.source === iframe.contentWindow`.
- The preview is built with `srcdoc`, so untrusted code never touches the parent
  DOM, and console output is rendered with `textContent` to prevent it injecting
  markup back into the trusted UI.

---

## Project structure

```
.
├── index.html                  # markup, import map, sandboxed <iframe>
├── src/
│   ├── main.js                 # composition root: builds + wires components
│   ├── config/
│   │   ├── constants.js        # tunable values (debounce, channel name, …)
│   │   └── defaults.js         # starter HTML/CSS/JS
│   ├── utils/
│   │   └── debounce.js
│   ├── editors/
│   │   └── EditorManager.js    # owns the 3 CodeMirror editors
│   ├── preview/
│   │   ├── PreviewRenderer.js  # facade over the sandboxed iframe + msg auth
│   │   ├── documentTemplate.js # pure: sources -> HTML document string
│   │   └── consoleBridge.js    # the script injected INTO the preview
│   ├── console/
│   │   └── ConsolePanel.js     # console UI (renders via textContent)
│   └── layout/
│       └── ResizableGrid.js    # reusable drag/keyboard resizer
└── styles/                     # main.css @imports the partials in cascade order
    ├── main.css   tokens.css   base.css     layout.css
    ├── components.css          editor.css   console.css  responsive.css
```

### Architecture & design

Each module has **one responsibility** and receives its dependencies through its
constructor — nothing but `main.js` (the **composition root**) touches the global
`document`. That keeps every component decoupled and unit-testable in isolation.

Patterns applied where they earn their keep:

| Pattern | Where | Why |
| ------- | ----- | --- |
| **Composition root / DI** | `main.js` | Single place that knows the wiring; components stay pure. |
| **Facade** | `PreviewRenderer` | Hides iframe lifecycle, document building, and message auth behind `render()`. |
| **Factory** | `EditorManager.#createView` | One place that knows how to build a configured editor. |
| **Strategy** | `LANGUAGE_STRATEGIES` map | Adding a language is a one-line table entry. |
| **Pure function** | `documentTemplate`, `debounce` | No side effects → trivial to test. |
| **Observer** | editor `updateListener`, `message` listener, resize pointer events | React to changes via callbacks instead of polling. |

I deliberately **did not** add a global event bus or a state-management library:
with three collaborators, explicit constructor wiring is clearer and easier to
trace than indirection. Good structure is also knowing which patterns to skip.

The CSS mirrors this: design tokens, layout, components, and responsive rules
live in separate files that `styles/main.css` imports **in cascade order**.
(`@import` adds request waterfalls, so a production build would concatenate
them — see below.)

---

## Production roadmap

What I'd add to take this from playground to product:

**Isolation & security (highest priority)**
- **Separate-origin preview hosting.** Serve the preview from a different origin
  (e.g. `preview.sandbox.example.com`, ideally a sandbox-specific domain like
  GitHub's `*.githubusercontent.com` pattern). Then even a browser
  sandbox-escape bug can't reach the main app's cookies/storage. The preview
  page would receive code over `postMessage` and `document.write` it.
- Add a `Content-Security-Policy` to the preview document and rate-limit the
  console message channel to prevent a runaway loop from flooding the UI.

**Persistence & sharing**
- **Saving:** persist pens to `localStorage` for drafts, and to a backend
  (`POST /pens` → id) for accounts; autosave with the same debounce.
- **Sharing:** shareable URLs — small pens encoded in the URL hash
  (LZ-compressed), larger ones behind a short id; "Fork" to clone.
- **Export:** download as a `.zip` / standalone `index.html`, or "Open in
  CodeSandbox/StackBlitz."

**Editing experience**
- Vendor CodeMirror via **Vite** (remove the CDN runtime dependency, enable
  offline use, tree-shake, hash assets, concatenate the CSS partials) — the
  modules are already import-compatible, so `npm install && npm run build`.
- Autocomplete, linting (ESLint/Stylelint in a worker), Emmet, Prettier format,
  multi-file support, library/CDN imports (Babel/TS transpile in a worker).
- Layout presets, persisted pane sizes, light/dark toggle, vim/emacs keymaps.

**Robustness & ops**
- Graceful offline/CDN-failure banner; service worker for offline shell.
- Tests: unit (document builder, debounce, message auth), and Playwright E2E
  for the live-render + console-capture loop.
- Telemetry/error reporting, and an allowlist/size cap on preview output.

---

## License

MIT — do what you like.
