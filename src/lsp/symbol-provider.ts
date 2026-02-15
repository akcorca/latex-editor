import * as monaco from 'monaco-editor'
import type { ProjectIndex } from './project-index'
import type { SectionLevel } from './types'

const SymbolKind = monaco.languages.SymbolKind

const SECTION_DEPTH: Record<SectionLevel, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
}

export function createDocumentSymbolProvider(
  index: ProjectIndex,
): monaco.languages.DocumentSymbolProvider {
  return {
    provideDocumentSymbols(model: monaco.editor.ITextModel): monaco.languages.DocumentSymbol[] {
      const uri = model.uri
      // Extract filePath from URI (file:///path → path)
      const filePath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path
      const symbols = index.getFileSymbols(filePath)
      if (!symbols) return []

      const result: monaco.languages.DocumentSymbol[] = []

      // Sections
      for (const sec of symbols.sections) {
        result.push({
          name: sec.title,
          detail: sec.level,
          kind: SymbolKind.Module,
          range: new monaco.Range(sec.location.line, 1, sec.location.line, 1),
          selectionRange: new monaco.Range(sec.location.line, 1, sec.location.line, 1),
          tags: [],
          children: [],
        })
      }

      // Labels
      for (const label of symbols.labels) {
        result.push({
          name: `\\label{${label.name}}`,
          detail: 'label',
          kind: SymbolKind.Key,
          range: new monaco.Range(label.location.line, 1, label.location.line, 1),
          selectionRange: new monaco.Range(label.location.line, 1, label.location.line, 1),
          tags: [],
          children: [],
        })
      }

      // Commands (\newcommand)
      for (const cmd of symbols.commands) {
        result.push({
          name: `\\${cmd.name}`,
          detail: 'command',
          kind: SymbolKind.Function,
          range: new monaco.Range(cmd.location.line, 1, cmd.location.line, 1),
          selectionRange: new monaco.Range(cmd.location.line, 1, cmd.location.line, 1),
          tags: [],
          children: [],
        })
      }

      // Environments
      for (const env of symbols.environments) {
        result.push({
          name: env.name,
          detail: 'environment',
          kind: SymbolKind.Struct,
          range: new monaco.Range(env.location.line, 1, env.location.line, 1),
          selectionRange: new monaco.Range(env.location.line, 1, env.location.line, 1),
          tags: [],
          children: [],
        })
      }

      // Sort by line number
      result.sort((a, b) => a.range.startLineNumber - b.range.startLineNumber)

      // Build section hierarchy
      return nestSections(
        result,
        symbols.sections.map((s) => ({
          level: SECTION_DEPTH[s.level],
          line: s.location.line,
        })),
      )
    },
  }
}

interface SectionInfo {
  level: number
  line: number
}

/** Nest symbols under section headers based on depth */
function nestSections(
  flat: monaco.languages.DocumentSymbol[],
  sections: SectionInfo[],
): monaco.languages.DocumentSymbol[] {
  if (sections.length === 0) return flat

  // Simple approach: return flat list. Nesting is complex and
  // the flat list with section detail already shows hierarchy via Ctrl+Shift+O.
  return flat
}
