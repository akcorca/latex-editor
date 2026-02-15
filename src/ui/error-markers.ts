import type * as Monaco from 'monaco-editor'
import * as monaco from 'monaco-editor'
import type { TexError } from '../types'

/** Update Monaco editor markers from TeX compile errors. */
export function setErrorMarkers(
  editor: Monaco.editor.IStandaloneCodeEditor,
  errors: TexError[],
): void {
  const model = editor.getModel()
  if (!model) return

  const markers: Monaco.editor.IMarkerData[] = errors
    .filter((e) => e.line > 0)
    .map((e) => ({
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
