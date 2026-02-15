import type * as monaco from 'monaco-editor'
import { findMatchAtCol, NEWCMD_CMDS, REF_CMDS, sourceLocationToMonaco } from './latex-patterns'
import type { ProjectIndex } from './project-index'

type Location = monaco.languages.Location

function refsForLabel(name: string, index: ProjectIndex): Location[] {
  return index.getAllLabelRefs(name).map((ref) => sourceLocationToMonaco(ref.location))
}

function refsForRefCommand(name: string, index: ProjectIndex): Location[] {
  const locations: Location[] = []
  const def = index.findLabelDef(name)
  if (def) locations.push(sourceLocationToMonaco(def.location))
  for (const ref of index.getAllLabelRefs(name)) {
    locations.push(sourceLocationToMonaco(ref.location))
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
        new RegExp(`\\\\(?:${NEWCMD_CMDS})\\*?\\{\\\\(\\w+)\\}`, 'g'),
        col,
      )
      if (cmdDefMatch) return []

      // Check \ref{name} -> find definition + all other refs
      const refMatch = findMatchAtCol(
        line,
        new RegExp(`\\\\(?:${REF_CMDS})\\{([^}]+)\\}`, 'g'),
        col,
      )
      if (refMatch) return refsForRefCommand(refMatch[1]!, index)

      return []
    },
  }
}
