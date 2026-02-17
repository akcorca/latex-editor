import type * as Monaco from 'monaco-editor'
import * as monaco from 'monaco-editor'
import type { Diagnostic } from '../lsp/diagnostic-provider'
import type { TexError } from '../types'

/** Group items by file, then set markers on each Monaco model. */
function applyMarkers<T>(
  items: T[],
  getFile: (item: T) => string | undefined,
  owner: string,
  toMarker: (item: T, model: Monaco.editor.ITextModel) => Monaco.editor.IMarkerData,
): void {
  const byFile = new Map<string, T[]>()
  for (const item of items) {
    const file = getFile(item)
    if (!file) continue
    const list = byFile.get(file) ?? []
    list.push(item)
    byFile.set(file, list)
  }

  for (const model of monaco.editor.getModels()) {
    const filePath = model.uri.path.startsWith('/') ? model.uri.path.slice(1) : model.uri.path
    const fileItems = byFile.get(filePath) ?? []
    const markers = fileItems.map((item) => toMarker(item, model))
    monaco.editor.setModelMarkers(model, owner, markers)
  }
}

/** Update Monaco editor markers from TeX compile errors, routed to each file's model. */
export function setErrorMarkers(errors: TexError[]): void {
  applyMarkers(
    errors,
    (e) => (e.file && e.line > 0 ? e.file : undefined),
    'tex',
    (e, model) => ({
      severity:
        e.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      startLineNumber: e.line,
      startColumn: 1,
      endLineNumber: e.line,
      endColumn: model.getLineMaxColumn(e.line),
      message: e.message,
      source: 'TeX',
    }),
  )
}

const DIAG_SEVERITY: Record<Diagnostic['severity'], Monaco.MarkerSeverity> = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
}

/** Update Monaco markers from static analysis diagnostics for all models. */
export function setDiagnosticMarkers(diagnostics: Diagnostic[]): void {
  applyMarkers(
    diagnostics,
    (d) => d.file,
    'latex-diagnostics',
    (d, model) => ({
      severity: DIAG_SEVERITY[d.severity],
      startLineNumber: d.line,
      startColumn: d.column,
      endLineNumber: d.line,
      endColumn: Math.min(d.endColumn, model.getLineMaxColumn(d.line)),
      message: d.message,
      source: 'LaTeX',
      code: d.code,
    }),
  )
}
