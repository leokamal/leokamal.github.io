/**
 * Pure builder that combines the three sources into one preview document.
 * @module preview/documentTemplate
 */

import { createConsoleBridge } from "./consoleBridge.js";

// The bridge is static, so build it once at module load.
const CONSOLE_BRIDGE = createConsoleBridge();

/**
 * Assemble a standalone HTML document from the editor sources.
 *
 * The console bridge is the FIRST script in <head> so its console/error hooks
 * are installed before any user code (or inline handler) can run. `</script>`
 * is written `<\/script>` so the string stays valid even if inlined into HTML
 * (the backslash is a no-op in JS but stops an HTML parser closing the tag).
 *
 * @param {{ html: string, css: string, js: string }} sources
 * @returns {string} a complete HTML document
 */
export function buildPreviewDocument({ html, css, js }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${CONSOLE_BRIDGE}<\/script>
<style>
${css}
</style>
</head>
<body>
${html}
<script>
${js}
<\/script>
</body>
</html>`;
}
