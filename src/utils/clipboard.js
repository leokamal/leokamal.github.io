/**
 * Thin wrappers around the async Clipboard API with clear failure modes.
 * @module utils/clipboard
 *
 * The Clipboard API only works in a secure context (https or localhost) and
 * may prompt for permission; callers should handle the rejected promise (e.g.
 * show feedback on the button).
 */

/**
 * Copy text to the clipboard.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard write is unavailable in this context.");
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Read text from the clipboard.
 * @returns {Promise<string>}
 */
export async function readClipboardText() {
  if (!navigator.clipboard?.readText) {
    throw new Error("Clipboard read is unavailable in this context.");
  }
  return navigator.clipboard.readText();
}
