# API Reference

Full reference for the `FastLatex` SDK.

## Constructor

```typescript
new FastLatex(
  editorContainer: HTMLElement | string,
  previewContainer: HTMLElement | string,
  options?: FastLatexOptions,
)
```

## Styling

`FastLatex` does not inject the optional "batteries-included" stylesheet from the JS entrypoint anymore.
When you use built-in editor/viewer containers (preview panel, binary overlays, loading bar, controls), import:

```ts
import 'fastlatex/style.css'
```

### Split-container mode

Pass both an editor container and a preview container to render the editor (Monaco)
and the PDF viewer in any layout you want. Each container can be an `HTMLElement`
or a CSS selector string.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `editor` | `IStandaloneCodeEditor` | - | External Monaco editor instance. FastLaTeX will use it instead of creating one and will **not** dispose it on cleanup. |
| `texliveUrl` | `string` | Public CDN | TexLive server endpoint. Defaults to `https://d1jectpaw0dlvl.cloudfront.net/{version}/` |
| `mainFile` | `string` | `'main.tex'` | Main TeX file name |
| `files` | `Record<string, string \| Uint8Array>` | `{}` | Initial project files (path → content) |
| `serviceWorker`| `boolean`| `true` | Cache texlive packages via SW |
| `assetBaseUrl` | `string` | `auto` | Base URL for WASM/Worker assets |
| `skipFormatPreload` | `boolean` | `false` | Skip initial `.fmt` preload during engine bootstrap |
| `editorContainerClassName` | `string` | `''` | Extra class name(s) for the editor container |
| `previewContainerClassName` | `string` | `''` | Extra class name(s) for the preview container |
| `runtimeScopeAttribute` | `string` | `data-fastlatex-runtime` | Attribute used to scope runtime UI styles |
| `collaboration` | `boolean` | `false` | Enable collaborative editing. When `true`, FastLaTeX never calls `model.setValue()` on Monaco models, leaving content ownership to an external CRDT/OT system (e.g. Yjs). Listen for `modelCreate`/`modelDispose` events to bind your provider. |

## Methods

- `init(): Promise<void>` — Initializes the WASM engines and runs the first compilation.
- `loadProject(files: Record<string, string | Uint8Array>): void` — Replaces the entire project with new files.
- `setFile(path: string, content: string | Uint8Array): void` — Adds or updates a single file.
- `deleteFile(path: string): boolean` — Deletes a file from the virtual filesystem.
- `listFiles(): string[]` — Returns a list of all files in the project.
- `compile(): void` — Triggers an immediate compilation (bypassing the auto-compile debounce).
- `getPdf(): Uint8Array | null` — Returns the last successfully generated PDF.
- `revealLine(line: number, file?: string): void` — Navigates the editor to a specific line/file.
- `flushCache(): Promise<void>` — Clears the internal engine cache.
- `dispose(): void` — Cleans up the editor, workers, and DOM.

## Escape Hatches

These methods expose the underlying Monaco editor and PDF viewer for advanced use cases (custom keybindings, viewer manipulation, collaboration bindings, etc.).

- `getMonacoEditor(): IStandaloneCodeEditor` — Returns the raw Monaco editor instance.
- `getModel(path: string): ITextModel | undefined` — Returns the Monaco model for a project file. Useful for attaching external bindings (e.g. y-monaco).
- `getViewer(): PdfViewer | undefined` — Returns the built-in PDF viewer instance. See [PdfViewer API](#pdfviewer-api) below.

## Events

Use `editor.on(event, handler)` / `editor.off(event, handler)` to subscribe/unsubscribe.

| Event | Payload | Description |
|-------|---------|-------------|
| `compile` | `{ result: CompileResult }` | A compilation cycle finished. |
| `status` | `{ status: string, message?: string, preambleSnapshot?: boolean }` | Editor lifecycle state changed (e.g. `'compiling'`, `'ready'`, `'error'`). `message` provides human-readable progress text; `preambleSnapshot` is `true` when a cached `.fmt` was reused. |
| `filechange` | `{ path: string, content: string \| Uint8Array }` | File content was modified. |
| `filesUpdate` | `{ files: string[] }` | Files were added or deleted. `files` is the full list of current paths. |
| `cursorChange` | `{ path: string, line: number, column: number }` | Cursor moved in the editor. |
| `diagnostics` | `{ diagnostics: TexError[] }` | LSP diagnostics (errors/warnings) were updated. |
| `outlineUpdate` | `{ sections: SectionDef[] }` | Document structure (sections/subsections) changed. |
| `modelCreate` | `{ path: string, model: ITextModel }` | A Monaco model was created for a project file. Use this to attach collaboration bindings. |
| `modelDispose` | `{ path: string }` | A Monaco model is about to be disposed. Use this to clean up collaboration bindings. |

### Example: forwarding diagnostics to an external panel

```ts
const editor = new FastLatex('#editor', '#preview')
await editor.init()

editor.on('diagnostics', ({ diagnostics }) => {
  for (const d of diagnostics) {
    console.log(`[${d.severity}] line ${d.line}: ${d.message}`)
  }
  // render into your own UI…
  renderDiagnosticsPanel(diagnostics)
})
```

## PdfViewer API

Accessed via `editor.getViewer()`. These methods let you control the PDF preview programmatically.

| Method | Description |
|--------|-------------|
| `setScale(scale: number): void` | Set the absolute zoom level (clamped to 0.25–5). |
| `fitToWidth(): void` | Zoom so the page fills the container width. |
| `setToolbarVisible(visible: boolean): void` | Show or hide the toolbar (zoom controls, page info, download button). The setting persists across re-renders. |
| `setInverseSearchHandler(handler): void` | Register a callback for inverse search (Ctrl/Cmd+click on PDF → source location). |
| `setSourceContent(file, content): void` | Provide source text for text-based inverse search fallback. |
| `setSynctexData(data): void` | Provide parsed SyncTeX data for precise PDF↔source sync. |
| `getLastPdf(): Uint8Array \| null` | Get the last rendered PDF bytes (for download). |
| `forwardSearch(file, line): void` | Highlight a source location in the PDF. |

### Example: fit-to-width + hide toolbar

```ts
const viewer = editor.getViewer()
if (viewer) {
  viewer.setToolbarVisible(false)
  viewer.fitToWidth()
}
```

## Collaboration

When `collaboration: true` is set, FastLaTeX delegates all content ownership to your CRDT/OT layer. It will never call `model.setValue()`, so your binding stays authoritative.

### Example: Yjs + y-monaco

```ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { MonacoBinding } from 'y-monaco'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('wss://your-server', 'room-id', ydoc)

const editor = new FastLatex('#editor', '#preview', { collaboration: true })
await editor.init()

const bindings = new Map()

editor.on('modelCreate', ({ path, model }) => {
  const ytext = ydoc.getText(path)
  const binding = new MonacoBinding(
    ytext,
    model,
    new Set([editor.getMonacoEditor()]),
    provider.awareness,
  )
  bindings.set(path, binding)
})

editor.on('modelDispose', ({ path }) => {
  bindings.get(path)?.destroy()
  bindings.delete(path)
})
```
