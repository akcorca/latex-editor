import * as monaco from 'monaco-editor'
import type { VirtualFS } from '../fs/virtual-fs'
import { createCompletionProvider } from './completion-provider'
import { createDefinitionProvider } from './definition-provider'
import { createHoverProvider } from './hover-provider'
import type { ProjectIndex } from './project-index'
import { createReferenceProvider } from './reference-provider'
import { createDocumentSymbolProvider } from './symbol-provider'

export function registerLatexProviders(index: ProjectIndex, fs: VirtualFS): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = []

  disposables.push(
    monaco.languages.registerCompletionItemProvider('latex', createCompletionProvider(index, fs)),
  )
  disposables.push(
    monaco.languages.registerDefinitionProvider('latex', createDefinitionProvider(index)),
  )
  disposables.push(monaco.languages.registerHoverProvider('latex', createHoverProvider(index)))
  disposables.push(
    monaco.languages.registerDocumentSymbolProvider('latex', createDocumentSymbolProvider(index)),
  )
  disposables.push(
    monaco.languages.registerReferenceProvider('latex', createReferenceProvider(index)),
  )

  return disposables
}
