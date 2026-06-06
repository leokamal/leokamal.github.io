// =============================================================================
// Live Static Preview — app.js
//
// Wires three CodeMirror 6 editors (HTML / CSS / JS) to a sandboxed <iframe>
// that re-renders, debounced, as you type.
// =============================================================================

import { EditorView, basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const PREVIEW_DEBOUNCE_MS = 300;

// ── Starter content ─────────────────────────────────────────────────────────
const DEFAULTS = {
  html: [
    "<h1>Hello 👋</h1>",
    "<p>Edit HTML, CSS, and JS — the preview updates live.</p>",
    '<button id="ping">Log to console</button>',
  ].join("\n"),

  css: [
    "body {",
    "  font-family: system-ui, sans-serif;",
    "  margin: 2rem;",
    "  color: #21304a;",
    "}",
    "h1 { color: #2965f1; }",
    "button {",
    "  padding: .5rem 1rem;",
    "  border: 1px solid #2965f1;",
    "  border-radius: 8px;",
    "  background: #eaf0ff;",
    "  cursor: pointer;",
    "}",
  ].join("\n"),

  js: [
    "document.getElementById('ping').addEventListener('click', () => {",
    "  console.log('Button clicked at', new Date().toLocaleTimeString());",
    "});",
    "",
    "console.log('Preview script loaded ✅');",
  ].join("\n"),
};

// ── Editors ──────────────────────────────────────────────────────────────────

/** Trailing-edge debounce. */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Coalesce bursts of keystrokes into a single preview rebuild ~300 ms later.
const scheduleRender = debounce(() => render(), PREVIEW_DEBOUNCE_MS);

// CodeMirror notifies us of every transaction; we only care about doc edits.
const onDocChange = EditorView.updateListener.of((update) => {
  if (update.docChanged) scheduleRender();
});

function createEditor(hostId, doc, languageExtension) {
  return new EditorView({
    doc,
    extensions: [
      basicSetup,
      oneDark,
      languageExtension,
      EditorView.lineWrapping,
      onDocChange,
    ],
    parent: document.getElementById(hostId),
  });
}

const editors = {
  html: createEditor("editor-html", DEFAULTS.html, html()),
  css: createEditor("editor-css", DEFAULTS.css, css()),
  js: createEditor("editor-js", DEFAULTS.js, javascript()),
};

const readEditor = (view) => view.state.doc.toString();

function setEditor(view, text) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

// ── Building the preview document ─────────────────────────────────────────────

/**
 * Combine the three sources into one standalone HTML document.
 *
 * `</script>` is written as `<\/script>` so the string is robust even if this
 * file is ever inlined into an HTML <script> block (the backslash is a no-op in
 * a normal JS string but stops an HTML parser from closing the tag early).
 */
function buildPreviewDocument(htmlCode, cssCode, jsCode) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${cssCode}
</style>
</head>
<body>
${htmlCode}
<script>
${jsCode}
<\/script>
</body>
</html>`;
}

// ── Rendering into the sandboxed iframe ───────────────────────────────────────
const previewFrame = document.getElementById("preview");

/*
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SECURITY-CRITICAL: how the preview is isolated, and the same-origin risk. │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The preview runs ARBITRARY, UNTRUSTED user code. We contain it with two
 * mechanisms working together:
 *
 *   1. `srcdoc` — the combined document is the iframe's own content. We never
 *      write user code into THIS page's DOM, so it can't execute in our origin.
 *
 *   2. `sandbox="allow-scripts"` (set in index.html) — scripts may run, but we
 *      deliberately DO NOT include `allow-same-origin`. With scripts allowed but
 *      same-origin withheld, the browser assigns the iframe a unique, OPAQUE
 *      origin (it reports as "null"). From that opaque origin the user's code
 *      CANNOT:
 *        • read or write this page's DOM,
 *        • read our cookies / localStorage / sessionStorage / IndexedDB,
 *        • make same-origin fetch/XHR calls that ride our credentials.
 *      It also can't navigate the top window, open popups, submit forms, etc.,
 *      because we didn't grant those tokens either.
 *
 * THE SAME-ORIGIN RISK — why we must never add `allow-same-origin`:
 *   `allow-scripts` + `allow-same-origin` TOGETHER is effectively no sandbox at
 *   all. The frame would share OUR origin, so user code could read/modify our
 *   page, steal cookies and tokens, AND — the killer — reach up via
 *   `frameElement` to REMOVE its own `sandbox` attribute, then reload itself
 *   fully unsandboxed. The two tokens cancel each other out. So: scripts yes,
 *   same-origin never (for untrusted input).
 *
 * Because the origin is opaque, postMessage from the frame arrives with
 * `event.origin === "null"`, so we can't authenticate by origin string. Instead
 * the message handler (added later) checks `event.source === frame.contentWindow`.
 *
 * For defense-in-depth in production you'd ALSO serve the preview from a
 * separate origin (different domain) so a sandbox-escape bug still couldn't
 * touch the main app's cookies — see the README roadmap.
 */
function render() {
  const doc = buildPreviewDocument(
    readEditor(editors.html),
    readEditor(editors.css),
    readEditor(editors.js)
  );

  // Assigning srcdoc tears down the old document and loads `doc` fresh inside
  // the sandbox. Each assignment creates a NEW contentWindow.
  previewFrame.srcdoc = doc;
}

// ── Toolbar: reset to defaults ────────────────────────────────────────────────
document.getElementById("reset-btn").addEventListener("click", () => {
  setEditor(editors.html, DEFAULTS.html);
  setEditor(editors.css, DEFAULTS.css);
  setEditor(editors.js, DEFAULTS.js);
  render();
});

// ── First paint ───────────────────────────────────────────────────────────────
render();
