/**
 * Facade over the sandboxed preview iframe.
 * @module preview/PreviewRenderer
 */

import { buildPreviewDocument } from "./documentTemplate.js";
import { CONSOLE_CHANNEL } from "../config/constants.js";

/**
 * Hides everything about driving the preview: building the document, loading it
 * into the iframe, and authenticating the console/error messages that come
 * back. Callers just call `render(sources)` and receive `onConsoleMessage`.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────────
 * The iframe is `sandbox="allow-scripts"` with NO `allow-same-origin` (declared
 * in index.html), so user code runs in an opaque ("null") origin and cannot
 * touch this page's DOM, cookies, or storage. NEVER add `allow-same-origin`:
 * combined with `allow-scripts` it dissolves the sandbox (shared origin, cookie
 * theft, and a `frameElement` escape that strips the sandbox attribute).
 *
 * Because the origin is "null" and untrustworthy, inbound messages are
 * authenticated by SOURCE IDENTITY (`event.source === frame.contentWindow`),
 * not by `event.origin`.
 */
export class PreviewRenderer {
  /** @type {HTMLIFrameElement} */
  #frame;
  /** @type {(message: { level: string, text: string }) => void} */
  #onConsoleMessage;
  /** @type {() => void} */
  #onBeforeRender;

  /**
   * @param {object} options
   * @param {HTMLIFrameElement} options.frame
   * @param {(message: { level: string, text: string }) => void} [options.onConsoleMessage]
   * @param {() => void} [options.onBeforeRender]  runs just before each render
   */
  constructor({ frame, onConsoleMessage = () => {}, onBeforeRender = () => {} }) {
    this.#frame = frame;
    this.#onConsoleMessage = onConsoleMessage;
    this.#onBeforeRender = onBeforeRender;
    window.addEventListener("message", this.#handleMessage);
  }

  /**
   * Render the given sources into the sandbox, replacing the previous run.
   * @param {{ html: string, css: string, js: string }} sources
   */
  render(sources) {
    this.#onBeforeRender();
    // Assigning srcdoc tears down the old document and loads this one fresh
    // inside the sandbox; each assignment yields a NEW contentWindow.
    this.#frame.srcdoc = buildPreviewDocument(sources);
  }

  /** Arrow field so `this` is bound when used as an event listener. */
  #handleMessage = (event) => {
    // SECURITY: opaque origin -> trust by source identity, not origin string.
    if (event.source !== this.#frame.contentWindow) return;

    const data = event.data;
    if (!data || data[CONSOLE_CHANNEL] !== true) return;

    this.#onConsoleMessage({
      level: String(data.level || "log"),
      text: data.text == null ? "" : String(data.text),
    });
  };

  /** Detach the global listener (teardown / testing hygiene). */
  dispose() {
    window.removeEventListener("message", this.#handleMessage);
  }
}
