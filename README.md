# Live Static Preview

A single-page, CodePen-style playground. Three editors — **HTML**, **CSS**, and
**JavaScript** — feed a **live preview** that re-renders as you type. Built with
**vanilla JavaScript** and plain `<textarea>` inputs: **no build step, no runtime
dependencies.**

> Layout: editors on the left (HTML / CSS / JS stacked), live preview and
> console on the right, with draggable handles between every pane.

## Features

- Three plain-`<textarea>` editors (HTML / CSS / JS) with a dark, monospace look.
- Editors **start empty with placeholder hints** — type or paste your own code
  and it previews immediately. **Load example** drops in demo code to start from.
- Per-editor toolbar: **Copy**, **Paste**, **Clear** (Clipboard API, with
  success/error feedback).
- Live preview, **debounced ~300 ms**, rendered into a **sandboxed `<iframe>`**.
- **Console panel** capturing `console.log/info/warn/error/debug` from the
  preview, plus uncaught errors and unhandled promise rejections.
- **Multi-language UI** — **Français** (default), **العربية** (RTL), **English** —
  switchable from the top bar and remembered across reloads.
- **Resizable panes** (CSS Grid + drag handles, keyboard-accessible, RTL-aware).
- **Responsive**: collapses to a single stacked column on narrow screens.

> **Clipboard note:** Copy/Paste use the async Clipboard API, which only works in
> a **secure context** (https or `http://localhost`) and may ask permission the
> first time. Served locally that's fine; opening over `file://` will disable it.

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
> a server for those — it's still zero build. Note: the Clipboard buttons also
> need a secure context (a server), as noted above.

> **Works fully offline.** There are no CDN requests or runtime dependencies —
> the editors are plain `<textarea>`s and all logic is local ES modules.

---

## Why "no build step"?

The brief allowed either *"runs by opening `index.html`"* **or** *"a minimal
Vite setup."* I chose **no build step**: the app is plain `index.html` +
`styles/` + `src/` ES modules, with **zero `npm install`, zero tooling, and no
runtime dependencies** — which matters most for the security-sensitive sandbox
logic, where there's nothing to audit but the code itself.

The editors are plain `<textarea>` inputs, so there's no editor library to load.
The only trade-off versus a real code editor is the loss of syntax highlighting
and line numbers (see the roadmap for re-adding one). Vite remains available but
**optional** — `npm install && npm run build` bundles and minifies the local
modules into a production copy; nothing requires it to run.

### Why a server?

Modern browsers treat each ES module as a fetch. Over `file://` the page's
origin is `null`, and Chrome/Edge refuse cross-origin module fetches from a
`null` origin (*"Cross origin requests are only supported for protocol schemes:
http, https, …"*). Any static HTTP server gives the page a real origin and the
modules load. This is a browser security rule, not a build requirement.

---

## How it works

```
 ┌───────────┐  keystroke  ┌────────────┐  300ms   ┌───────────────────────┐
 │ 3 textarea│ ──────────▶ │  debounce  │ ───────▶ │ buildPreviewDocument() │
 │ editors   │             └────────────┘          └───────────┬───────────┘
 └───────────┘                                                  │ srcdoc
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
│   │   ├── constants.js        # tunable values (debounce, channel, lang key)
│   │   └── defaults.js         # EXAMPLE_SOURCES (demo for "Load example")
│   ├── utils/
│   │   ├── debounce.js
│   │   └── clipboard.js        # Clipboard API wrappers (copy / paste)
│   ├── i18n/
│   │   ├── translations.js     # fr (default) / ar (RTL) / en dictionaries
│   │   └── I18n.js             # applies [data-i18n], sets <html> lang/dir
│   ├── editors/
│   │   └── EditorManager.js    # owns the 3 editors; placeholders + copy/paste/clear
│   ├── preview/
│   │   ├── PreviewRenderer.js  # facade over the sandboxed iframe + msg auth
│   │   ├── documentTemplate.js # pure: sources -> HTML document string
│   │   └── consoleBridge.js    # the script injected INTO the preview
│   ├── console/
│   │   └── ConsolePanel.js     # console UI (renders via textContent)
│   └── layout/
│       └── ResizableGrid.js    # reusable drag/keyboard resizer (RTL-aware)
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
| **Adapter** | `EditorManager` | Wraps the three `<textarea>`s behind a small source API (`getSources`/`setSource`/`insertText`), so the rest of the app never touches the DOM inputs. |
| **Pure function** | `documentTemplate`, `debounce` | No side effects → trivial to test. |
| **Observer** | `input` events, `message` listener, resize pointer events | React to changes via callbacks instead of polling. |

I deliberately **did not** add a global event bus or a state-management library:
with three collaborators, explicit constructor wiring is clearer and easier to
trace than indirection. Good structure is also knowing which patterns to skip.

The CSS mirrors this: design tokens, layout, components, and responsive rules
live in separate files that `styles/main.css` imports **in cascade order**.
(`@import` adds request waterfalls, so a production build would concatenate
them — see below.)

### Internationalization (i18n)

The UI ships in **French (default), Arabic (RTL), and English**, switchable from
the top bar and persisted to `localStorage`.

- **Markup stays the source of structure.** Translatable nodes carry
  `data-i18n="key"` (sets `textContent`) or `data-i18n-title="key"` (sets
  `title` + `aria-label`, for the icon-only toolbar buttons). `I18n.apply()`
  walks those attributes — no string concatenation in JS.
- **Editor placeholders** are native `<textarea>` placeholders carrying
  `data-i18n-placeholder="key"`, re-translated by `I18n.apply()` like any other
  attribute. The only text delivered via the `onChange(lang, dict)` callback is
  the console empty-state, because it's rendered dynamically (not in the markup).
- **RTL** sets `<html dir="rtl">`; the layout uses **logical properties**
  (`border-inline-start`, `margin-inline-start`) and the resizer mirrors its
  horizontal drag, so Arabic is a true right-to-left mirror. A tiny inline
  script in `index.html` applies the saved direction before first paint to
  avoid a flash.
- Adding a language = one dictionary in `src/i18n/translations.js` (+ a
  `<option>`); a smoke test enforces key parity across languages.

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
- **Syntax highlighting + line numbers** by swapping the `<textarea>`s for a
  real editor (CodeMirror 6 / Monaco). `EditorManager` already isolates the
  editor behind a small API, so only that one module changes; bundle the editor
  with the optional **Vite** build (`npm install && npm run build`).
- Tab-to-indent, autocomplete, linting (ESLint/Stylelint in a worker), Emmet,
  Prettier format, multi-file support, library/CDN imports.
- Layout presets, persisted pane sizes, light/dark toggle.

**Robustness & ops**
- Service worker for an installable offline shell.
- Tests: unit (document builder, debounce, message auth, EditorManager), and
  Playwright E2E for the live-render + console-capture loop.
- Telemetry/error reporting, and an allowlist/size cap on preview output.

---

## License

MIT — do what you like.
