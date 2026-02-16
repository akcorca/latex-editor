import * as monaco from 'monaco-editor'
import { getCommandByName, getEnvironmentByName } from './latex-commands'
import { CITE_CMDS, findMatchAtCol, REF_CMDS } from './latex-patterns'
import type { EngineCommandInfo, ProjectIndex } from './project-index'

type Hover = monaco.languages.Hover

function engineCategoryLabel(category: EngineCommandInfo['category']): string {
  if (category === 'macro') return 'Package macro'
  if (category === 'primitive') return 'TeX primitive'
  return 'Package command'
}

function appendArgInfo(contents: string[], info: EngineCommandInfo): void {
  if (info.category !== 'macro') return
  if (info.argCount > 0) contents.push(`Arguments: ${info.argCount}`)
  else if (info.argCount === 0) contents.push('Arguments: none')
}

function makeHover(contents: string[], lineNum: number, start: number, end: number): Hover {
  return {
    contents: contents.map((value) => ({ value })),
    range: new monaco.Range(lineNum, start + 1, lineNum, end + 1),
  }
}

function hoverEnv(m: RegExpMatchArray, lineNum: number, index: ProjectIndex): Hover {
  const envName = m[1]!
  const start = m.index!
  const envInfo = getEnvironmentByName(envName)
  if (envInfo) {
    const contents: string[] = [`**${envName}** environment`]
    if (envInfo.detail) contents.push(envInfo.detail)
    if (envInfo.package) contents.push(`Package: \`${envInfo.package}\``)
    return makeHover(contents, lineNum, start, start + m[0].length)
  }
  if (index.getEngineEnvironments().has(envName)) {
    const info = index.getEngineCommands().get(envName)
    const contents = [`**${envName}** — Package environment`]
    if (info && info.argCount > 0) {
      contents.push(`Arguments: ${info.argCount}`)
    }
    return makeHover(contents, lineNum, start, start + m[0].length)
  }
  return makeHover([`**${envName}** environment`], lineNum, start, start + m[0].length)
}

function hoverRef(m: RegExpMatchArray, lineNum: number, index: ProjectIndex): Hover {
  const name = m[1]!
  const start = m.index!
  const resolved = index.resolveLabel(name)
  const labelDef = index.findLabelDef(name)
  const contents: string[] = []
  contents.push(resolved ? `**\\ref{${name}}** = ${resolved}` : `**\\ref{${name}}**`)
  if (labelDef) contents.push(`Defined at ${labelDef.location.file}:${labelDef.location.line}`)
  return makeHover(contents, lineNum, start, start + m[0].length)
}

function hoverCite(m: RegExpMatchArray, lineNum: number, index: ProjectIndex): Hover {
  const keys = m[1]!
  const contents: string[] = []
  for (const key of keys.split(',')) {
    const trimmed = key.trim()
    const bibEntry = index.getBibEntries().find((e) => e.key === trimmed)
    if (bibEntry) {
      let text = `**[${trimmed}]** ${bibEntry.type}`
      if (bibEntry.title) text += `\n\n${bibEntry.title}`
      if (bibEntry.author) text += `\n\n*${bibEntry.author}*`
      contents.push(text)
    } else {
      contents.push(`**[${trimmed}]**`)
    }
  }
  const start = m.index!
  return makeHover(contents, lineNum, start, start + m[0].length)
}

function hoverCommand(m: RegExpMatchArray, lineNum: number, index: ProjectIndex): Hover | null {
  const name = m[1]!
  const start = m.index!
  const end = start + m[0].length
  const cmdInfo = getCommandByName(name)
  if (cmdInfo) {
    const contents: string[] = []
    contents.push(`**\\${name}**${cmdInfo.detail ? ` — ${cmdInfo.detail}` : ''}`)
    if (cmdInfo.documentation) contents.push(cmdInfo.documentation)
    if (cmdInfo.package) contents.push(`Package: \`${cmdInfo.package}\``)
    return makeHover(contents, lineNum, start, end)
  }
  const userCmd = index.findCommandDef(name)
  if (userCmd) {
    return makeHover(
      [
        `**\\${name}** — User-defined command`,
        `Defined at ${userCmd.location.file}:${userCmd.location.line}`,
      ],
      lineNum,
      start,
      end,
    )
  }
  const engineCmd = index.getEngineCommands().get(name)
  if (engineCmd) {
    const contents = [`**\\${name}** — ${engineCategoryLabel(engineCmd.category)}`]
    appendArgInfo(contents, engineCmd)
    return makeHover(contents, lineNum, start, end)
  }
  return null
}

export function createHoverProvider(index: ProjectIndex): monaco.languages.HoverProvider {
  return {
    provideHover(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
    ): monaco.languages.Hover | null {
      const line = model.getLineContent(position.lineNumber)
      const col = position.column - 1
      const lineNum = position.lineNumber

      const envMatch = findMatchAtCol(line, /\\(?:begin|end)\{(\w+\*?)\}/g, col)
      if (envMatch) return hoverEnv(envMatch, lineNum, index)

      const refMatch = findMatchAtCol(
        line,
        new RegExp(`\\\\(?:${REF_CMDS})\\{([^}]+)\\}`, 'g'),
        col,
      )
      if (refMatch) return hoverRef(refMatch, lineNum, index)

      const citeMatch = findMatchAtCol(
        line,
        new RegExp(`\\\\(?:${CITE_CMDS})\\{([^}]+)\\}`, 'g'),
        col,
      )
      if (citeMatch) return hoverCite(citeMatch, lineNum, index)

      const cmdMatch = findMatchAtCol(line, /\\(\w+)/g, col)
      if (cmdMatch) return hoverCommand(cmdMatch, lineNum, index)

      return null
    },
  }
}
