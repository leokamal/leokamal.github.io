/**
 * Owns the three editor inputs (plain <textarea> elements) and exposes their
 * combined sources.
 * @module editors/EditorManager
 *
 * These are deliberately simple multiline text inputs — no editor library, no
 * external dependency. Placeholders are native textarea `placeholder`
 * attributes (translated by the i18n layer via `data-i18n-placeholder`).
 */

/** @typedef {"html" | "css" | "js"} SourceKind */

/** Source kinds in a stable order — iterate this, never Object.keys. */
const KINDS = /** @type {ReadonlyArray<SourceKind>} */ (["html", "css", "js"]);

export class EditorManager {
  /** @type {Record<SourceKind, HTMLTextAreaElement>} */
  #inputs = /** @type {any} */ ({});
  /** @type {(() => void) | undefined} */
  #onChange;

  /**
   * @param {object} options
   * @param {Record<SourceKind, HTMLTextAreaElement>} options.mounts  the <textarea> elements
   * @param {Partial<Record<SourceKind, string>>} [options.sources]   initial contents
   * @param {() => void} [options.onChange]  invoked after any edit (typed or programmatic)
   */
  constructor({ mounts, sources = {}, onChange }) {
    this.#onChange = onChange;
    for (const kind of KINDS) {
      const input = mounts[kind];
      this.#inputs[kind] = input;
      if (sources[kind] != null) input.value = sources[kind];
      // User typing/native paste fires `input`; programmatic edits below call
      // #onChange explicitly (setting .value never dispatches `input`).
      input.addEventListener("input", () => this.#onChange?.());
    }
  }

  /** @returns {Record<SourceKind, string>} the current contents of every editor */
  getSources() {
    /** @type {any} */
    const out = {};
    for (const kind of KINDS) out[kind] = this.#inputs[kind].value;
    return out;
  }

  /** @param {SourceKind} kind @returns {string} */
  getSource(kind) {
    return this.#inputs[kind].value;
  }

  /** Replace one editor's contents. @param {SourceKind} kind @param {string} text */
  setSource(kind, text) {
    this.#inputs[kind].value = text;
    this.#onChange?.();
  }

  /**
   * Replace the contents of every editor (used by "Load example").
   * @param {Record<SourceKind, string>} sources
   */
  setSources(sources) {
    for (const kind of KINDS) this.#inputs[kind].value = sources[kind] ?? "";
    this.#onChange?.();
  }

  /** Empty one editor (the placeholder reappears). @param {SourceKind} kind */
  clear(kind) {
    this.setSource(kind, "");
  }

  /**
   * Insert text at the caret (replacing any selection) — used by "Paste".
   * @param {SourceKind} kind @param {string} text
   */
  insertText(kind, text) {
    const input = this.#inputs[kind];
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length;
    input.setSelectionRange(caret, caret);
    input.focus();
    this.#onChange?.();
  }
}
