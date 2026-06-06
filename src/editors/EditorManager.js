/**
 * Owns the three CodeMirror 6 editors and exposes their combined sources.
 * @module editors/EditorManager
 */

import { EditorView, basicSetup } from "codemirror";
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

  /**
   * @param {object} options
   * @param {Record<SourceKind, HTMLElement>} options.mounts   host elements
   * @param {Record<SourceKind, string>}      options.sources  initial contents
   * @param {() => void} [options.onChange]   invoked after every document edit
   */
  constructor({ mounts, sources, onChange }) {
    for (const kind of KINDS) {
      this.#views[kind] = EditorManager.#createView(
        mounts[kind],
        sources[kind],
        LANGUAGE_STRATEGIES[kind](),
        onChange
      );
    }
  }

  /**
   * Factory: build a fully configured EditorView for one source kind.
   * @returns {EditorView}
   */
  static #createView(parent, doc, language, onChange) {
    const notifyOnEdit = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.();
    });

    return new EditorView({
      doc,
      parent,
      extensions: [basicSetup, oneDark, language, EditorView.lineWrapping, notifyOnEdit],
    });
  }

  /**
   * @returns {Record<SourceKind, string>} the current contents of every editor
   */
  getSources() {
    /** @type {any} */
    const out = {};
    for (const kind of KINDS) out[kind] = this.#views[kind].state.doc.toString();
    return out;
  }

  /**
   * Replace the contents of every editor (used by "Reset").
   * @param {Record<SourceKind, string>} sources
   */
  setSources(sources) {
    for (const kind of KINDS) {
      const view = this.#views[kind];
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: sources[kind] },
      });
    }
  }
}
