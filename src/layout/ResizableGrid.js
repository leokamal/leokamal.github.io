/**
 * Reusable drag-to-resize behaviour for a CSS-grid container.
 * @module layout/ResizableGrid
 */

import { MIN_PANE_PX, KEYBOARD_RESIZE_STEP_PX } from "../config/constants.js";

/**
 * @typedef {object} Handle
 * @property {HTMLElement} el          the `.gutter` element (a real grid track)
 * @property {number} before          index into trackVars of the track above/left
 * @property {number} after           index into trackVars of the track below/right
 * @property {HTMLElement} beforePane  element to measure for the "before" track
 * @property {HTMLElement} afterPane   element to measure for the "after" track
 */

/**
 * Makes the boundaries of a grid container draggable. Each handle shifts `fr`
 * units between its two neighbouring tracks — one grows by exactly what the
 * other shrinks — so the rest of the layout is untouched and proportions
 * survive a window resize. Pointer capture keeps a drag alive even when the
 * cursor passes over the preview <iframe>.
 */
export class ResizableGrid {
  /** @type {HTMLElement} */
  #container;
  /** @type {boolean} */
  #horizontal;
  /** @type {string[]} */
  #trackVars;
  /** @type {number[]} */
  #fr;

  /**
   * @param {object} options
   * @param {HTMLElement} options.container
   * @param {"x"|"y"} options.axis
   * @param {string[]} options.trackVars         CSS custom properties, one per track
   * @param {number[]} options.initialFractions  starting fr value for each track
   * @param {Handle[]} options.handles
   */
  constructor({ container, axis, trackVars, initialFractions, handles }) {
    this.#container = container;
    this.#horizontal = axis === "x";
    this.#trackVars = trackVars;
    this.#fr = [...initialFractions];

    this.#apply();
    for (const handle of handles) this.#bindHandle(handle);
  }

  /** Write the current fr values into the container's inline styles. */
  #apply() {
    this.#trackVars.forEach((v, i) => this.#container.style.setProperty(v, `${this.#fr[i]}fr`));
  }

  /** @param {HTMLElement} el */
  #sizeOf(el) {
    const rect = el.getBoundingClientRect();
    return this.#horizontal ? rect.width : rect.height;
  }

  /** Pixels-per-fr and the fr floor for a handle's current neighbour pair. */
  #metrics(handle) {
    const px = this.#sizeOf(handle.beforePane) + this.#sizeOf(handle.afterPane);
    const pxPerFr = px / (this.#fr[handle.before] + this.#fr[handle.after]) || 1;
    return { pxPerFr, minFr: MIN_PANE_PX / pxPerFr };
  }

  /** Apply a new boundary, clamped so neither neighbour collapses. */
  #moveBoundary(handle, beforeFr, afterFr, minFr) {
    let nb = beforeFr;
    let na = afterFr;
    if (nb < minFr) { na -= minFr - nb; nb = minFr; }
    if (na < minFr) { nb -= minFr - na; na = minFr; }
    this.#fr[handle.before] = nb;
    this.#fr[handle.after] = na;
    this.#apply();
  }

  /** @param {Handle} handle */
  #bindHandle(handle) {
    handle.el.addEventListener("pointerdown", (e) => this.#startDrag(e, handle));
    handle.el.addEventListener("keydown", (e) => this.#onKeydown(e, handle));
  }

  /** @param {PointerEvent} e @param {Handle} handle */
  #startDrag(e, handle) {
    e.preventDefault();
    handle.el.setPointerCapture(e.pointerId);
    handle.el.classList.add("dragging");

    const startPos = this.#horizontal ? e.clientX : e.clientY;
    const startBefore = this.#fr[handle.before];
    const startAfter = this.#fr[handle.after];
    const { pxPerFr, minFr } = this.#metrics(handle);

    const onMove = (ev) => {
      const delta = (this.#horizontal ? ev.clientX : ev.clientY) - startPos;
      const df = delta / pxPerFr;
      this.#moveBoundary(handle, startBefore + df, startAfter - df, minFr);
    };
    const onUp = () => {
      handle.el.classList.remove("dragging");
      handle.el.removeEventListener("pointermove", onMove);
      handle.el.removeEventListener("pointerup", onUp);
      handle.el.removeEventListener("pointercancel", onUp);
    };

    handle.el.addEventListener("pointermove", onMove);
    handle.el.addEventListener("pointerup", onUp);
    handle.el.addEventListener("pointercancel", onUp);
  }

  /** Keyboard a11y: the focusable separator responds to arrow keys. */
  #onKeydown(e, handle) {
    const keys = this.#horizontal ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    const dir = keys.indexOf(e.key);
    if (dir === -1) return;
    e.preventDefault();

    const { pxPerFr, minFr } = this.#metrics(handle);
    const df = (KEYBOARD_RESIZE_STEP_PX / pxPerFr) * (dir === 0 ? -1 : 1);
    this.#moveBoundary(handle, this.#fr[handle.before] + df, this.#fr[handle.after] - df, minFr);
  }
}
