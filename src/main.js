/**
 * Composition root: resolves DOM dependencies, constructs the components, and
 * wires them together. This is the only module that reaches into the global
 * document — everything else receives what it needs via its constructor
 * (dependency injection), which keeps the components decoupled and testable.
 *
 * @module main
 */

import { STARTER_SOURCES } from "./config/defaults.js";
import { PREVIEW_DEBOUNCE_MS } from "./config/constants.js";
import { debounce } from "./utils/debounce.js";
import { EditorManager } from "./editors/EditorManager.js";
import { PreviewRenderer } from "./preview/PreviewRenderer.js";
import { ConsolePanel } from "./console/ConsolePanel.js";
import { ResizableGrid } from "./layout/ResizableGrid.js";

function bootstrap() {
  const byId = (id) => document.getElementById(id);

  // Console panel — renders messages forwarded from the preview.
  const consolePanel = new ConsolePanel({
    output: byId("console-output"),
    clearButton: byId("clear-console"),
  });

  // Preview — owns the sandboxed iframe; clears the console before each run and
  // streams captured messages into the panel.
  const preview = new PreviewRenderer({
    frame: byId("preview"),
    onBeforeRender: () => consolePanel.clear(),
    onConsoleMessage: (message) => consolePanel.append(message),
  });

  // Editors — a doc edit schedules a debounced re-render of the preview.
  const editors = new EditorManager({
    mounts: { html: byId("editor-html"), css: byId("editor-css"), js: byId("editor-js") },
    sources: STARTER_SOURCES,
    onChange: debounce(() => preview.render(editors.getSources()), PREVIEW_DEBOUNCE_MS),
  });

  // Toolbar.
  byId("reset-btn").addEventListener("click", () => {
    editors.setSources(STARTER_SOURCES);
    preview.render(editors.getSources());
  });

  setupResizableLayout();

  // First paint.
  preview.render(editors.getSources());
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
