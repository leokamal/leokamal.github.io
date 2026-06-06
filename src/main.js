/**
 * Composition root: resolves DOM dependencies, constructs the components, and
 * wires them together. This is the only module that reaches into the global
 * document — everything else receives what it needs via its constructor
 * (dependency injection), which keeps the components decoupled and testable.
 *
 * @module main
 */

import { EXAMPLE_SOURCES } from "./config/defaults.js";
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

  // i18n first so every component can be built with the right language. The
  // onChange callback pushes non-DOM text (placeholders, console empty-state)
  // into the components that own it. `editors`/`consolePanel` are referenced
  // lazily here and only invoked from apply() below, after they exist.
  const i18n = new I18n({
    onChange: (_lang, dict) => {
      editors.setPlaceholders({
        html: dict["placeholder.html"],
        css: dict["placeholder.css"],
        js: dict["placeholder.js"],
      });
      consolePanel.setEmptyText(dict["console.empty"]);
    },
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

  // Editors — start empty with translated placeholders; a doc edit schedules a
  // debounced re-render of the preview.
  const editors = new EditorManager({
    mounts: { html: byId("editor-html"), css: byId("editor-css"), js: byId("editor-js") },
    sources: { html: "", css: "", js: "" },
    placeholders: {
      html: dict["placeholder.html"],
      css: dict["placeholder.css"],
      js: dict["placeholder.js"],
    },
    onChange: debounce(() => preview.render(editors.getSources()), PREVIEW_DEBOUNCE_MS),
  });

  wireLanguageSwitcher(byId("lang-select"), i18n);
  wireEditorActions(editors, i18n);

  // Toolbar: load the demo into the editors.
  byId("load-example").addEventListener("click", () => {
    editors.setSources(EXAMPLE_SOURCES);
    preview.render(editors.getSources());
  });

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
function wireEditorActions(editors, i18n) {
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
