import type * as Monaco from 'monaco-editor'
import * as monaco from 'monaco-editor'
import type { Diagnostic } from '../lsp/diagnostic-provider'
import type { TexError } from '../types'

/** Update Monaco editor markers from TeX compile errors, routed to each file's model. */
export function setErrorMarkers(errors: TexError[]): void {
  // Group errors by file
  const byFile = new Map<string, TexError[]>()
  for (const e of errors) {
    if (!e.file || e.line <= 0) continue
    const list = byFile.get(e.file) ?? []
    list.push(e)
    byFile.set(e.file, list)
  }

  // Set markers on each model
  for (const model of monaco.editor.getModels()) {
    const filePath = model.uri.path.startsWith('/') ? model.uri.path.slice(1) : model.uri.path
    const fileErrors = byFile.get(filePath) ?? []
    const markers: Monaco.editor.IMarkerData[] = fileErrors.map((e) => ({
      severity:
        e.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      startLineNumber: e.line,
      startColumn: 1,
      endLineNumber: e.line,
      endColumn: model.getLineMaxColumn(e.line),
      message: e.message,
      source: 'TeX',
    }))
    monaco.editor.setModelMarkers(model, 'tex', markers)
  }
}

const DIAG_SEVERITY: Record<Diagnostic['severity'], Monaco.MarkerSeverity> = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
}

/** Update Monaco markers from static analysis diagnostics for all models. */
export function setDiagnosticMarkers(diagnostics: Diagnostic[]): void {
  // Group by file
  const byFile = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const list = byFile.get(d.file) ?? []
    list.push(d)
    byFile.set(d.file, list)
  }

  // Set markers on each model (models are kept alive for the project lifetime)
  for (const model of monaco.editor.getModels()) {
    const filePath = model.uri.path.startsWith('/') ? model.uri.path.slice(1) : model.uri.path
    const fileDiags = byFile.get(filePath) ?? []
    const markers: Monaco.editor.IMarkerData[] = fileDiags.map((d) => ({
      severity: DIAG_SEVERITY[d.severity],
      startLineNumber: d.line,
      startColumn: d.column,
      endLineNumber: d.line,
      endColumn: Math.min(d.endColumn, model.getLineMaxColumn(d.line)),
      message: d.message,
      source: 'LaTeX',
      code: d.code,
    }))
    monaco.editor.setModelMarkers(model, 'latex-diagnostics', markers)
  }
}
