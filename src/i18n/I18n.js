/**
 * Tiny i18n controller: owns the current language, persists it, and applies
 * translations to the DOM.
 * @module i18n/I18n
 *
 * DOM contract (declarative — markup stays the source of truth for structure):
 *   [data-i18n]        -> element.textContent
 *   [data-i18n-title]  -> element.title AND aria-label (for icon-only buttons)
 * Non-DOM text (editor placeholders, console empty-state) is delivered to the
 * app through the `onChange(lang, dict)` callback so the owning components
 * update themselves.
 */

import {
  TRANSLATIONS,
  DEFAULT_LANG,
  RTL_LANGS,
} from "./translations.js";
import { LANG_STORAGE_KEY } from "../config/constants.js";

export class I18n {
  #translations;
  #defaultLang;
  #storageKey;
  #onChange;
  #lang;

  /**
   * @param {object} [options]
   * @param {Record<string, Record<string,string>>} [options.translations]
   * @param {string} [options.defaultLang]
   * @param {string} [options.storageKey]
   * @param {(lang: string, dict: Record<string,string>) => void} [options.onChange]
   */
  constructor({
    translations = TRANSLATIONS,
    defaultLang = DEFAULT_LANG,
    storageKey = LANG_STORAGE_KEY,
    onChange,
  } = {}) {
    this.#translations = translations;
    this.#defaultLang = defaultLang;
    this.#storageKey = storageKey;
    this.#onChange = onChange;
    this.#lang = this.#readStored() ?? defaultLang;
  }

  /** @returns {string} the active language code */
  get lang() {
    return this.#lang;
  }

  /** @returns {Record<string,string>} the active dictionary (falls back to default) */
  dict() {
    return this.#translations[this.#lang] ?? this.#translations[this.#defaultLang];
  }

  /**
   * Translate a single key.
   * @param {string} key
   * @returns {string}
   */
  t(key) {
    return this.dict()[key] ?? key;
  }

  /**
   * Switch language (no-op for unknown codes), persist it, and re-apply.
   * @param {string} lang
   */
  setLang(lang) {
    if (!this.#translations[lang] || lang === this.#lang) return;
    this.#lang = lang;
    try {
      localStorage.setItem(this.#storageKey, lang);
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
    this.apply();
  }

  /** Push the current dictionary into the DOM and notify the app. */
  apply() {
    const dict = this.dict();
    const root = document.documentElement;
    root.lang = this.#lang;
    root.dir = RTL_LANGS.has(this.#lang) ? "rtl" : "ltr";

    for (const el of document.querySelectorAll("[data-i18n]")) {
      const value = dict[el.getAttribute("data-i18n")];
      if (value != null) el.textContent = value;
    }
    for (const el of document.querySelectorAll("[data-i18n-title]")) {
      const value = dict[el.getAttribute("data-i18n-title")];
      if (value != null) {
        el.title = value;
        el.setAttribute("aria-label", value);
      }
    }

    if (dict["app.title"]) document.title = dict["app.title"];

    this.#onChange?.(this.#lang, dict);
  }

  /** @returns {string|null} a valid stored language, or null */
  #readStored() {
    try {
      const stored = localStorage.getItem(this.#storageKey);
      return stored && this.#translations[stored] ? stored : null;
    } catch {
      return null;
    }
  }
}
