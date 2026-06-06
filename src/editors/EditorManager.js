/**
 * Owns the three CodeMirror 6 editors and exposes their combined sources.
 * @module editors/EditorManager
 */

import { EditorView, basicSetup } from "codemirror";
import { placeholder } from "@codemirror/view";
import { Compartment } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

/** @typedef {"html" | "css" | "js"} SourceKind */

/** Source kinds in a stable order — iterate this, never Object.keys. */
const KINDS = /** @type {ReadonlyArray<SourceKind>} */ (["html", "css", "js"]);

/**
 * Strategy lookup: maps a source kind to its CodeMirror language extension
 * factory. Adding a language is a one-line change here.
 * @type {Record<SourceKind, () => import("@codemirror/state").Extension>}
 */
const LANGUAGE_STRATEGIES = { html, css, js: javascript };

export class EditorManager {
  /** @type {Record<SourceKind, EditorView>} */
  #views = /** @type {any} */ ({});
  /** Per-editor compartment so the placeholder can be re-translated live. */
  #placeholderCompartments = /** @type {Record<SourceKind, Compartment>} */ ({});

  /**
   * @param {object} options
   * @param {Record<SourceKind, HTMLElement>} options.mounts        host elements
   * @param {Partial<Record<SourceKind, string>>} [options.sources] initial contents (default empty)
   * @param {Partial<Record<SourceKind, string>>} [options.placeholders] ghost text per editor
   * @param {() => void} [options.onChange]   invoked after every document edit
   */
  constructor({ mounts, sources = {}, placeholders = {}, onChange }) {
    for (const kind of KINDS) {
      const compartment = new Compartment();
      this.#placeholderCompartments[kind] = compartment;
      this.#views[kind] = EditorManager.#createView({
        parent: mounts[kind],
        doc: sources[kind] ?? "",
        language: LANGUAGE_STRATEGIES[kind](),
        placeholderText: placeholders[kind] ?? "",
        placeholderCompartment: compartment,
        onChange,
      });
    }
  }

  /**
   * Factory: build a fully configured EditorView for one source kind.
   * @returns {EditorView}
   */
  static #createView({ parent, doc, language, placeholderText, placeholderCompartment, onChange }) {
    const notifyOnEdit = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.();
    });

    return new EditorView({
      doc,
      parent,
      extensions: [
        basicSetup,
        oneDark,
        language,
        EditorView.lineWrapping,
        placeholderCompartment.of(placeholder(placeholderText)),
        notifyOnEdit,
      ],
    });
  }

  /** @returns {Record<SourceKind, string>} the current contents of every editor */
  getSources() {
    /** @type {any} */
    const out = {};
    for (const kind of KINDS) out[kind] = this.#views[kind].state.doc.toString();
    return out;
  }

  /**
   * Replace the contents of every editor (used by "Load example").
   * @param {Record<SourceKind, string>} sources
   */
  setSources(sources) {
    for (const kind of KINDS) this.setSource(kind, sources[kind] ?? "");
  }

  /** @param {SourceKind} kind @returns {string} */
  getSource(kind) {
    return this.#views[kind].state.doc.toString();
  }

  /** Replace one editor's contents. @param {SourceKind} kind @param {string} text */
  setSource(kind, text) {
    const view = this.#views[kind];
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }

  /** Empty one editor (the placeholder reappears). @param {SourceKind} kind */
  clear(kind) {
    this.setSource(kind, "");
  }

  /**
   * Insert text at the cursor (replacing any selection) — used by "Paste".
   * @param {SourceKind} kind @param {string} text
   */
  insertText(kind, text) {
    const view = this.#views[kind];
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }

  /**
   * Re-translate every editor's placeholder without touching its content.
   * @param {Partial<Record<SourceKind, string>>} placeholders
   */
  setPlaceholders(placeholders) {
    for (const kind of KINDS) {
      const view = this.#views[kind];
      view.dispatch({
        effects: this.#placeholderCompartments[kind].reconfigure(
          placeholder(placeholders[kind] ?? "")
        ),
      });
    }
  }
}
