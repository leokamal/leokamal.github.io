/**
 * Composition root: resolves DOM dependencies, constructs the components, and
 * wires them together. This is the only module that reaches into the global
 * document — everything else receives what it needs via its constructor
 * (dependency injection), which keeps the components decoupled and testable.
 *
 * @module main
 */

import { PREVIEW_DEBOUNCE_MS } from "./config/constants.js";
import { debounce } from "./utils/debounce.js";
import { copyText, readClipboardText } from "./utils/clipboard.js";
import { I18n } from "./i18n/I18n.js";
import { EditorManager } from "./editors/EditorManager.js";
import { PreviewRenderer } from "./preview/PreviewRenderer.js";
import { ConsolePanel } from "./console/ConsolePanel.js";
import { ResizableGrid } from "./layout/ResizableGrid.js";

function bootstrap() {
  const byId = (id) => document.getElementById(id);

  // i18n first so the console empty-state can be built with the right language.
  // Editor placeholders + all labelled markup are handled declaratively inside
  // I18n.apply(); only the dynamically-rendered console empty-state needs this
  // callback. `consolePanel` is referenced lazily (invoked from apply() below,
  // after it exists).
  const i18n = new I18n({
    onChange: (_lang, dict) => consolePanel.setEmptyText(dict["console.empty"]),
  });
  const dict = i18n.dict();

  // Console panel — renders messages forwarded from the preview.
  const consolePanel = new ConsolePanel({
    output: byId("console-output"),
    clearButton: byId("clear-console"),
    emptyText: dict["console.empty"],
  });

  // Preview — owns the sandboxed iframe; clears the console before each run and
  // streams captured messages into the panel.
  const preview = new PreviewRenderer({
    frame: byId("preview"),
    onBeforeRender: () => consolePanel.clear(),
    onConsoleMessage: (message) => consolePanel.append(message),
  });

  // Editors — empty <textarea>s with native placeholders; any edit (typed or
  // programmatic) schedules a debounced re-render of the preview.
  const editors = new EditorManager({
    mounts: { html: byId("editor-html"), css: byId("editor-css"), js: byId("editor-js") },
    onChange: debounce(() => preview.render(editors.getSources()), PREVIEW_DEBOUNCE_MS),
  });

  wireLanguageSwitcher(byId("lang-select"), i18n);
  wireEditorActions(editors);
  wirePreviewMaximize(byId("toggle-preview-max"), byId("workspace"), i18n);

  setupResizableLayout();

  i18n.apply(); // first translation pass (also fires onChange)
  preview.render(editors.getSources()); // first paint (empty until the user types)
}

/** Bind the <select> to the i18n controller and keep it in sync. */
function wireLanguageSwitcher(select, i18n) {
  select.value = i18n.lang;
  select.addEventListener("change", () => {
    i18n.setLang(select.value);
    select.value = i18n.lang; // reflect rejected/unknown choices
  });
}

/**
 * Wire every editor toolbar button (copy / paste / clear) to its editor and
 * give brief visual feedback on success/failure.
 */
function wireEditorActions(editors) {
  for (const btn of document.querySelectorAll(".icon-btn[data-action]")) {
    btn.addEventListener("click", async () => {
      const kind = btn.dataset.editor;
      try {
        if (btn.dataset.action === "copy") {
          await copyText(editors.getSource(kind));
        } else if (btn.dataset.action === "paste") {
          editors.insertText(kind, await readClipboardText());
        } else if (btn.dataset.action === "clear") {
          editors.clear(kind);
        }
        flash(btn, "icon-btn--ok");
      } catch {
        flash(btn, "icon-btn--err");
      }
    });
  }
}

/**
 * Toggle "maximized preview" mode: the preview pane fills the workspace while
 * the editors and console collapse (see `.preview-max` in styles/layout.css).
 * The state lives in one class on the workspace; the button's icon (CSS),
 * pressed state, and tooltip track it. We keep `data-i18n-title` pointing at
 * the active state's key so a later language switch stays correct — I18n.apply()
 * reads that attribute — and mirror it into title/aria-label here for the
 * immediate update without re-running a full translation pass.
 */
function wirePreviewMaximize(button, workspace, i18n) {
  const sync = (maximized) => {
    const key = maximized ? "action.restore" : "action.maximize";
    button.setAttribute("data-i18n-title", key);
    button.title = i18n.t(key);
    button.setAttribute("aria-label", i18n.t(key));
    button.setAttribute("aria-pressed", String(maximized));
  };
  button.addEventListener("click", () => sync(workspace.classList.toggle("preview-max")));
  sync(false);
}

/** Add a state class for a moment to acknowledge an action. */
function flash(el, className) {
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), 600);
}

/** Attach drag-resize behaviour to the three grid containers. */
function setupResizableLayout() {
  const gutter = (name) => document.querySelector(`.gutter[data-resizer="${name}"]`);
  const editorsEl = document.getElementById("editors");
  const previewColEl = document.getElementById("preview-col");
  const editorPanes = editorsEl.querySelectorAll(".editor-pane");

  // Editors ↔ preview (vertical handle).
  new ResizableGrid({
    container: document.getElementById("workspace"),
    axis: "x",
    trackVars: ["--ws-c1", "--ws-c2"],
    initialFractions: [1, 1],
    handles: [
      { el: gutter("main"), before: 0, after: 1, beforePane: editorsEl, afterPane: previewColEl },
    ],
  });

  // HTML / CSS / JS (two horizontal handles).
  new ResizableGrid({
    container: editorsEl,
    axis: "y",
    trackVars: ["--ed-r1", "--ed-r2", "--ed-r3"],
    initialFractions: [1, 1, 1],
    handles: [
      { el: gutter("ed1"), before: 0, after: 1, beforePane: editorPanes[0], afterPane: editorPanes[1] },
      { el: gutter("ed2"), before: 1, after: 2, beforePane: editorPanes[1], afterPane: editorPanes[2] },
    ],
  });

  // Preview ↔ console (horizontal handle).
  new ResizableGrid({
    container: previewColEl,
    axis: "y",
    trackVars: ["--pv-r1", "--pv-r2"],
    initialFractions: [2.4, 1],
    handles: [
      {
        el: gutter("console"),
        before: 0,
        after: 1,
        beforePane: previewColEl.querySelector(".preview-pane"),
        afterPane: previewColEl.querySelector(".console-pane"),
      },
    ],
  });
}

// `type="module"` scripts are deferred, so the DOM is ready here.
bootstrap();
