/**
 * Application-wide constants — the single source of truth for tunable values.
 * @module config/constants
 */

/** Delay between the last keystroke and a preview rebuild (ms). */
export const PREVIEW_DEBOUNCE_MS = 300;

/** A pane can never be dragged smaller than this (px). */
export const MIN_PANE_PX = 60;

/** How far one arrow-key press nudges a resize handle (px). */
export const KEYBOARD_RESIZE_STEP_PX = 24;

/** Per-message console payload cap (characters). */
export const MAX_LOG_LENGTH = 5000;

/**
 * Marker placed on postMessage payloads from the preview's console bridge.
 * Shared by the bridge (running inside the iframe) and the parent listener so
 * the channel name is defined in exactly one place.
 */
export const CONSOLE_CHANNEL = "__previewConsole";

/** Console levels we recognise, in display order. */
export const CONSOLE_LEVELS = Object.freeze(["log", "info", "warn", "error", "debug"]);

/**
 * localStorage key for the chosen UI language. Also referenced by the inline
 * anti-FOUC script in index.html, so keep the two in sync.
 */
export const LANG_STORAGE_KEY = "lsp:lang";
