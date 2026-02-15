import * as monaco from 'monaco-editor'
import type { ProjectIndex } from './project-index'

type Location = monaco.languages.Location

function toLocation(loc: { file: string; line: number; column: number }): Location {
  return {
    uri: monaco.Uri.file(loc.file),
    range: new monaco.Range(loc.line, loc.column, loc.line, loc.column),
  }
}

/** Find a regex match that spans the given column */
function findMatchAtCol(line: string, re: RegExp, col: number): RegExpMatchArray | null {
  for (const m of line.matchAll(re)) {
    if (col >= m.index && col < m.index + m[0].length) return m
  }
  return null
}

function refsForLabel(name: string, index: ProjectIndex): Location[] {
  return index.getAllLabelRefs(name).map((ref) => toLocation(ref.location))
}

function refsForRefCommand(name: string, index: ProjectIndex): Location[] {
  const locations: Location[] = []
  const def = index.findLabelDef(name)
  if (def) locations.push(toLocation(def.location))
  for (const ref of index.getAllLabelRefs(name)) {
    locations.push(toLocation(ref.location))
  }
  return locations
}

export function createReferenceProvider(index: ProjectIndex): monaco.languages.ReferenceProvider {
  return {
    provideReferences(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
    ): monaco.languages.Location[] {
      const line = model.getLineContent(position.lineNumber)
      const col = position.column - 1

      // Check if cursor is on \label{name}
      const labelMatch = findMatchAtCol(line, /\\label\{([^}]+)\}/g, col)
      if (labelMatch) return refsForLabel(labelMatch[1]!, index)

      // Check if cursor is on \newcommand{\name} or \renewcommand{\name}
      const cmdDefMatch = findMatchAtCol(
        line,
        /\\(?:newcommand|renewcommand|providecommand)\*?\{\\(\w+)\}/g,
        col,
      )
      if (cmdDefMatch) return []

      // Check \ref{name} -> find definition + all other refs
      const refMatch = findMatchAtCol(
        line,
        /\\(?:ref|eqref|pageref|autoref|cref|Cref|nameref)\{([^}]+)\}/g,
        col,
      )
      if (refMatch) return refsForRefCommand(refMatch[1]!, index)

      return []
    },
  }
}
