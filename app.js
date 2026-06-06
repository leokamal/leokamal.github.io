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

// ── Console + error bridge (runs INSIDE the preview) ─────────────────────────
//
// This snippet is injected as the FIRST script in the preview so it is active
// before any user HTML/JS runs. It mirrors console.* and uncaught errors back
// to this page via postMessage. It is plain ES5 (no bundler touches it) and
// must not contain the literal sequence that closes a script tag.
const CONSOLE_BRIDGE = `
(function () {
  "use strict";

  // JSON.stringify replacer that survives circular refs, DOM nodes, functions.
  function replacer() {
    var seen = new WeakSet();
    return function (key, value) {
      if (typeof value === "function") return "ƒ " + (value.name || "anonymous") + "()";
      if (typeof value === "bigint") return value.toString() + "n";
      if (typeof value === "symbol") return value.toString();
      if (value instanceof Error) return value.name + ": " + value.message;
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
        if (typeof Node !== "undefined" && value instanceof Node) {
          return "<" + String(value.nodeName || "node").toLowerCase() + ">";
        }
      }
      return value;
    };
  }

  function format(value) {
    if (typeof value === "string") return value;
    if (typeof value === "undefined") return "undefined";
    if (value instanceof Error) return value.stack || (value.name + ": " + value.message);
    if (typeof value === "function") return value.toString();
    try { return JSON.stringify(value, replacer(), 2); }
    catch (e) { return String(value); }
  }

  function send(level, parts) {
    var text;
    try { text = Array.prototype.map.call(parts, format).join(" "); }
    catch (e) { text = "[unserializable log]"; }
    if (text.length > 5000) text = text.slice(0, 5000) + "… (truncated)";
    try {
      // The sandbox gives us an opaque origin, so we cannot know the parent's
      // origin to target it precisely; "*" is acceptable because we only ever
      // send non-sensitive console/error text outward.
      parent.postMessage({ __previewConsole: true, level: level, text: text }, "*");
    } catch (e) { /* parent gone / serialization failed — ignore */ }
  }

  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : null;
    console[level] = function () {
      send(level, arguments);
      if (original) original.apply(console, arguments); // keep native devtools working
    };
  });

  // Surface runtime errors instead of failing silently.
  window.addEventListener("error", function (e) {
    if (!e) return;
    var where = e.filename ? " (" + (e.lineno || 0) + ":" + (e.colno || 0) + ")" : "";
    send("error", ["Uncaught " + (e.message || "error") + where]);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e ? e.reason : undefined;
    var msg = (r && r.message) ? r.message : (typeof r === "undefined" ? "(no reason)" : String(r));
    send("error", ["Unhandled promise rejection: " + msg]);
  });
})();
`;

// ── Building the preview document ─────────────────────────────────────────────

/**
 * Combine the three sources into one standalone HTML document.
 *
 * `</script>` is written as `<\/script>` so the string is robust even if this
 * file is ever inlined into an HTML <script> block (the backslash is a no-op in
 * a normal JS string but stops an HTML parser from closing the tag early).
 *
 * The console bridge is the FIRST script in <head> so console.* overrides and
 * the error listeners are installed before any user code (or inline handlers)
 * can run.
 */
function buildPreviewDocument(htmlCode, cssCode, jsCode) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${CONSOLE_BRIDGE}<\/script>
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
  // Each run is fresh: clear logs from the previous render so the console
  // reflects only the current preview (mirrors CodePen / devtools "preserve
  // log off" behaviour).
  clearConsole();

  const doc = buildPreviewDocument(
    readEditor(editors.html),
    readEditor(editors.css),
    readEditor(editors.js)
  );

  // Assigning srcdoc tears down the old document and loads `doc` fresh inside
  // the sandbox. Each assignment creates a NEW contentWindow.
  previewFrame.srcdoc = doc;
}

// ── Console panel ──────────────────────────────────────────────────────────────
const consoleOutput = document.getElementById("console-output");
const LEVELS = ["log", "info", "warn", "error", "debug"];

function clearConsole() {
  consoleOutput.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "console-empty";
  empty.textContent = "Console output from the preview appears here.";
  consoleOutput.appendChild(empty);
}

function appendConsole(level, text) {
  const placeholder = consoleOutput.querySelector(".console-empty");
  if (placeholder) placeholder.remove();

  const safeLevel = LEVELS.includes(level) ? level : "log";
  const entry = document.createElement("div");
  entry.className = "console-entry lvl-" + safeLevel;

  const badge = document.createElement("span");
  badge.className = "lvl";
  badge.textContent = safeLevel;

  const msg = document.createElement("span");
  msg.className = "msg";
  // textContent (never innerHTML): preview output is untrusted, so we render it
  // as plain text and never let it inject markup into our trusted UI.
  msg.textContent = text;

  entry.append(badge, msg);
  consoleOutput.appendChild(entry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight; // auto-follow newest
}

// Receive messages forwarded by the in-preview bridge.
window.addEventListener("message", (event) => {
  // SECURITY: the sandbox runs in an opaque origin, so `event.origin` is the
  // string "null" and cannot be trusted. We authenticate by object identity
  // instead — accept ONLY messages whose source is our preview's live window.
  if (event.source !== previewFrame.contentWindow) return;

  const data = event.data;
  if (!data || data.__previewConsole !== true) return;

  appendConsole(String(data.level || "log"), data.text == null ? "" : String(data.text));
});

document.getElementById("clear-console").addEventListener("click", clearConsole);

// ── Toolbar: reset to defaults ────────────────────────────────────────────────
document.getElementById("reset-btn").addEventListener("click", () => {
  setEditor(editors.html, DEFAULTS.html);
  setEditor(editors.css, DEFAULTS.css);
  setEditor(editors.js, DEFAULTS.js);
  render();
});

// ── First paint ───────────────────────────────────────────────────────────────
render();
