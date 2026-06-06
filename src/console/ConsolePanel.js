/**
 * Console panel UI component.
 * @module console/ConsolePanel
 */

import { CONSOLE_LEVELS } from "../config/constants.js";

const EMPTY_TEXT = "Console output from the preview appears here.";

/**
 * Renders captured console/error messages. Output is always written with
 * `textContent` (never `innerHTML`) so untrusted preview strings can't inject
 * markup into our trusted UI.
 */
export class ConsolePanel {
  /** @type {HTMLElement} */
  #output;

  /**
   * @param {object} options
   * @param {HTMLElement} options.output         scrolling log container
   * @param {HTMLElement|null} [options.clearButton]  optional "Clear" button
   */
  constructor({ output, clearButton }) {
    this.#output = output;
    clearButton?.addEventListener("click", () => this.clear());
    this.clear();
  }

  /** Reset to the empty-state placeholder. */
  clear() {
    this.#output.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "console-empty";
    empty.textContent = EMPTY_TEXT;
    this.#output.append(empty);
  }

  /**
   * Append one message and auto-scroll to the newest entry.
   * @param {{ level: string, text: string }} message
   */
  append({ level, text }) {
    this.#output.querySelector(".console-empty")?.remove();

    const safeLevel = CONSOLE_LEVELS.includes(level) ? level : "log";

    const entry = document.createElement("div");
    entry.className = `console-entry lvl-${safeLevel}`;

    const badge = document.createElement("span");
    badge.className = "lvl";
    badge.textContent = safeLevel;

    const msg = document.createElement("span");
    msg.className = "msg";
    msg.textContent = text; // untrusted -> plain text only

    entry.append(badge, msg);
    this.#output.append(entry);
    this.#output.scrollTop = this.#output.scrollHeight;
  }
}
