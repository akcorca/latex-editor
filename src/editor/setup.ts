import * as monaco from 'monaco-editor'
import { latexLanguage, latexLanguageConfig } from './latex-language'

let monacoConfigured = false

function ensureMonacoConfigured(): void {
  if (monacoConfigured) return
  monacoConfigured = true

  // Configure Monaco workers via Vite
  ;(self as any).MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
          { type: 'module' },
        )
      }
      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
        type: 'module',
      })
    },
  }

  // Register LaTeX language
  monaco.languages.register({ id: 'latex' })
  monaco.languages.setMonarchTokensProvider('latex', latexLanguage)
  monaco.languages.setLanguageConfiguration('latex', latexLanguageConfig)
}

export function createEditor(
  container: HTMLElement,
  initialContent: string,
  onChange: (content: string) => void,
  filePath?: string,
): monaco.editor.IStandaloneCodeEditor {
  ensureMonacoConfigured()
  const uri = filePath ? monaco.Uri.file(filePath) : undefined
  const model = monaco.editor.createModel(initialContent, 'latex', uri)
  const editor = monaco.editor.create(container, {
    model,
    theme: 'vs-dark',
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false },
    wordWrap: 'on',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderWhitespace: 'none',
    tabSize: 2,
  })

  editor.onDidChangeModelContent(() => {
    onChange(editor.getValue())
  })

  return editor
}

export function setEditorContent(
  editor: monaco.editor.IStandaloneCodeEditor,
  content: string,
  language = 'latex',
  filePath?: string,
): void {
  const oldModel = editor.getModel()
  const uri = filePath ? monaco.Uri.file(filePath) : undefined
  // Reuse existing model for this URI if it exists, otherwise create new
  const existing = uri ? monaco.editor.getModel(uri) : null
  if (existing) {
    existing.setValue(content)
    editor.setModel(existing)
  } else {
    const newModel = monaco.editor.createModel(content, language, uri)
    editor.setModel(newModel)
  }
  if (oldModel && oldModel !== editor.getModel()) {
    oldModel.dispose()
  }
}

export function revealLine(editor: monaco.editor.IStandaloneCodeEditor, line: number): void {
  editor.revealLineInCenter(line)
  editor.setPosition({ lineNumber: line, column: 1 })
  editor.focus()
}
