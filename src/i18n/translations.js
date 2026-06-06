/**
 * UI translations and language metadata.
 * @module i18n/translations
 *
 * Default language is French ("fr"). Arabic ("ar") is right-to-left.
 * Keys are dotted strings referenced from index.html via `data-i18n*`
 * attributes and from the components that own non-DOM text (placeholders,
 * console empty-state).
 */

/** Default UI language. */
export const DEFAULT_LANG = "fr";

/** Languages offered in the switcher, in display order. */
export const SUPPORTED_LANGS = Object.freeze(["fr", "ar", "en"]);

/** Languages rendered right-to-left. */
export const RTL_LANGS = new Set(["ar"]);

/** Native names shown in the language switcher (never translated). */
export const LANG_NAMES = Object.freeze({ fr: "Français", ar: "العربية", en: "English" });

/** @typedef {Record<string, string>} Dictionary */

/** @type {Readonly<Record<string, Dictionary>>} */
export const TRANSLATIONS = Object.freeze({
  fr: {
    "app.title": "Aperçu statique en direct",
    "header.hint": "Rendu en direct · anti-rebond ~300 ms",
    "lang.switchLabel": "Langue",
    "action.loadExample": "Charger l'exemple",
    "action.copy": "Copier",
    "action.paste": "Coller",
    "action.clear": "Effacer",
    "preview.title": "Aperçu",
    "preview.meta": "iframe isolé · allow-scripts",
    "console.title": "Console",
    "console.clear": "Effacer",
    "console.empty": "La sortie de la console de l'aperçu apparaît ici.",
    "placeholder.html": "Écrivez ou collez votre HTML ici…",
    "placeholder.css": "Écrivez ou collez votre CSS ici…",
    "placeholder.js": "Écrivez ou collez votre JavaScript ici…",
  },

  ar: {
    "app.title": "معاينة ثابتة مباشرة",
    "header.hint": "عرض مباشر · بتأخير ~300 مللي ثانية",
    "lang.switchLabel": "اللغة",
    "action.loadExample": "تحميل مثال",
    "action.copy": "نسخ",
    "action.paste": "لصق",
    "action.clear": "مسح",
    "preview.title": "معاينة",
    "preview.meta": "إطار معزول · allow-scripts",
    "console.title": "وحدة التحكم",
    "console.clear": "مسح",
    "console.empty": "يظهر إخراج وحدة تحكم المعاينة هنا.",
    "placeholder.html": "اكتب أو الصق HTML هنا…",
    "placeholder.css": "اكتب أو الصق CSS هنا…",
    "placeholder.js": "اكتب أو الصق JavaScript هنا…",
  },

  en: {
    "app.title": "Live Static Preview",
    "header.hint": "Edits render live · ~300 ms debounce",
    "lang.switchLabel": "Language",
    "action.loadExample": "Load example",
    "action.copy": "Copy",
    "action.paste": "Paste",
    "action.clear": "Clear",
    "preview.title": "Preview",
    "preview.meta": "sandboxed iframe · allow-scripts",
    "console.title": "Console",
    "console.clear": "Clear",
    "console.empty": "Console output from the preview appears here.",
    "placeholder.html": "Write or paste your HTML here…",
    "placeholder.css": "Write or paste your CSS here…",
    "placeholder.js": "Write or paste your JavaScript here…",
  },
});
