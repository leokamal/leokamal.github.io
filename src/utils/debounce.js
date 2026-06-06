/**
 * Debounce utility.
 * @module utils/debounce
 */

/**
 * Trailing-edge debounce: returns a wrapper that delays invoking `fn` until
 * `wait` ms have passed since the most recent call. Bursts of calls collapse
 * into a single invocation with the latest arguments.
 *
 * @template {(...args: any[]) => void} F
 * @param {F} fn          function to debounce
 * @param {number} wait   quiet period in milliseconds
 * @returns {(...args: Parameters<F>) => void}
 */
export function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
