/**
 * Demo content loaded by the "Load example" button. The editors themselves
 * start empty (with translated placeholders); this is opt-in sample code.
 * @module config/defaults
 */

/** @typedef {{ html: string, css: string, js: string }} Sources */

/** @type {Readonly<Sources>} */
export const EXAMPLE_SOURCES = Object.freeze({
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
});
