/**
 * Builds the bridge script that runs INSIDE the preview iframe.
 * @module preview/consoleBridge
 */

import { CONSOLE_CHANNEL, MAX_LOG_LENGTH } from "../config/constants.js";

/**
 * Returns the source of the bridge as a string (it executes in the sandbox,
 * not here). Injected as the FIRST script in the preview so it intercepts
 * `console.*` and uncaught errors before any user code runs, forwarding them to
 * the parent via `postMessage`.
 *
 * It is intentionally plain ES5 (no bundler ever touches it) and must never
 * contain a literal closing `</script>` sequence.
 *
 * @param {object} [options]
 * @param {string} [options.channel]    payload marker, kept in sync with the parent
 * @param {number} [options.maxLength]  per-message character cap
 * @returns {string}
 */
export function createConsoleBridge({
  channel = CONSOLE_CHANNEL,
  maxLength = MAX_LOG_LENGTH,
} = {}) {
  return `
(function () {
  "use strict";
  var CHANNEL = ${JSON.stringify(channel)};
  var MAX_LENGTH = ${Number(maxLength)};

  // JSON replacer that survives circular refs, DOM nodes, functions, bigints.
  function replacer() {
    var seen = new WeakSet();
    return function (key, value) {
      if (typeof value === "function") return "ƒ " + (value.name || "anonymous") + "()";
      if (typeof value === "bigint") return value.toString() + "n";
      if (typeof value === "symbol") return value.toString();
      if (value instanceof Error) return value.name + ": " + value.message;
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
        if (typeof Node !== "undefined" && value instanceof Node) {
          return "<" + String(value.nodeName || "node").toLowerCase() + ">";
        }
      }
      return value;
    };
  }

  function format(value) {
    if (typeof value === "string") return value;
    if (typeof value === "undefined") return "undefined";
    if (value instanceof Error) return value.stack || (value.name + ": " + value.message);
    if (typeof value === "function") return value.toString();
    try { return JSON.stringify(value, replacer(), 2); }
    catch (e) { return String(value); }
  }

  function send(level, parts) {
    var text;
    try { text = Array.prototype.map.call(parts, format).join(" "); }
    catch (e) { text = "[unserializable log]"; }
    if (text.length > MAX_LENGTH) text = text.slice(0, MAX_LENGTH) + "… (truncated)";

    var payload = { level: level, text: text };
    payload[CHANNEL] = true;
    try {
      // Opaque sandbox origin: we can't know the parent's origin, so target
      // "*". Only non-sensitive console/error text is ever sent outward.
      parent.postMessage(payload, "*");
    } catch (e) { /* parent gone / serialization failed — ignore */ }
  }

  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : null;
    console[level] = function () {
      send(level, arguments);
      if (original) original.apply(console, arguments); // keep native devtools working
    };
  });

  // Surface runtime errors instead of failing silently.
  window.addEventListener("error", function (e) {
    if (!e) return;
    var where = e.filename ? " (" + (e.lineno || 0) + ":" + (e.colno || 0) + ")" : "";
    send("error", ["Uncaught " + (e.message || "error") + where]);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e ? e.reason : undefined;
    var msg = (r && r.message) ? r.message : (typeof r === "undefined" ? "(no reason)" : String(r));
    send("error", ["Unhandled promise rejection: " + msg]);
  });
})();
`;
}
