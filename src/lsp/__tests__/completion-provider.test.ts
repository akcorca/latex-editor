import { describe, expect, it } from 'vitest'
import { VirtualFS } from '../../fs/virtual-fs'
import { createCompletionProvider } from '../completion-provider'
import { ProjectIndex } from '../project-index'

// Minimal mock of monaco.editor.ITextModel
function mockModel(lines: string[]): any {
  return {
    getLineContent(lineNumber: number) {
      return lines[lineNumber - 1] ?? ''
    },
    uri: { path: '/main.tex' },
  }
}

function pos(lineNumber: number, column: number): any {
  return { lineNumber, column }
}

describe('createCompletionProvider', () => {
  const index = new ProjectIndex()
  const fs = new VirtualFS({ empty: true })
  fs.writeFile('main.tex', '')
  fs.writeFile('chapters/intro.tex', '')
  const provider = createCompletionProvider(index, fs)

  it('provides command completions after backslash', () => {
    const model = mockModel(['\\fra'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 5),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((s: any) => s.label === '\\frac')).toBe(true)
  })

  it('provides only matching commands', () => {
    const model = mockModel(['\\sec'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 5),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    for (const s of suggestions) {
      expect((s.label as string).startsWith('\\sec')).toBe(true)
    }
  })

  it('provides label completions after \\ref{', () => {
    index.updateFile('main.tex', '\\label{fig:arch}\n\\label{eq:euler}')
    const model = mockModel(['\\ref{'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 6),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions).toHaveLength(2)
    expect(suggestions.map((s: any) => s.label).sort()).toEqual(['eq:euler', 'fig:arch'])
  })

  it('filters label completions by prefix', () => {
    index.updateFile('main.tex', '\\label{fig:one}\n\\label{fig:two}\n\\label{eq:three}')
    const model = mockModel(['\\ref{fig:'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 10),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions).toHaveLength(2)
  })

  it('provides resolved label info from .aux', () => {
    index.updateFile('main.tex', '\\label{sec:intro}')
    index.updateAux('\\newlabel{sec:intro}{{1}{1}}')
    const model = mockModel(['\\ref{'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 6),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    const s = suggestions.find((s: any) => s.label === 'sec:intro')
    expect(s).toBeDefined()
    expect(s.detail).toContain('[1]')
  })

  it('provides citation completions after \\cite{', () => {
    index.updateAux('\\bibcite{knuth84}{1}\n\\bibcite{lamport94}{2}')
    const model = mockModel(['\\cite{'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 7),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
  })

  it('provides environment completions after \\begin{', () => {
    const model = mockModel(['\\begin{eq'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 10),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.some((s: any) => s.label === 'equation')).toBe(true)
  })

  it('provides package completions after \\usepackage{', () => {
    const model = mockModel(['\\usepackage{ams'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 16),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.some((s: any) => s.label === 'amsmath')).toBe(true)
    expect(suggestions.some((s: any) => s.label === 'amssymb')).toBe(true)
  })

  it('provides file completions after \\input{', () => {
    const model = mockModel(['\\input{'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 8),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.length).toBeGreaterThanOrEqual(1)
  })

  it('provides user-defined command completions', () => {
    index.updateFile('macros.tex', '\\newcommand{\\myop}{\\operatorname{myop}}')
    const model = mockModel(['\\my'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 4),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.some((s: any) => s.label === '\\myop')).toBe(true)
  })

  it('returns empty for no context', () => {
    const model = mockModel(['just plain text'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 10),
      undefined as any,
      undefined as any,
    )
    expect((result as any).suggestions).toHaveLength(0)
  })

  it('handles \\cite with optional arg', () => {
    index.updateAux('\\bibcite{ref1}{1}')
    const model = mockModel(['\\cite[p.~5]{'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 13),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.some((s: any) => s.label === 'ref1')).toBe(true)
  })

  it('handles comma in \\cite{a,', () => {
    index.updateAux('\\bibcite{alpha}{1}\n\\bibcite{beta}{2}')
    const model = mockModel(['\\cite{alpha,'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 13),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
  })

  it('shows categorized engine commands', () => {
    index.updateEngineCommands(['mymacro\t113\t0', 'hbox\t21\t-1', 'oldcmd'])
    const model = mockModel(['\\'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 2),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    const macro = suggestions.find((s: any) => s.label === '\\mymacro')
    const prim = suggestions.find((s: any) => s.label === '\\hbox')
    const unknown = suggestions.find((s: any) => s.label === '\\oldcmd')
    expect(macro?.detail).toBe('Package macro')
    expect(prim?.detail).toBe('TeX primitive')
    expect(unknown?.detail).toBe('Package command')
  })

  it('generates snippet completions for macros with args', () => {
    index.updateEngineCommands(['myfrac\t113\t2', 'mysqrt\t113\t1', 'mypar\t113\t0'])
    const model = mockModel(['\\my'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 4),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    const frac = suggestions.find((s: any) => s.label === '\\myfrac')
    expect(frac).toBeDefined()
    expect(frac.insertText).toBe('myfrac{$1}{$2}')
    expect(frac.insertTextRules).toBe(4) // InsertAsSnippet
    expect(frac.detail).toBe('Package macro (2 args)')

    const sqrt = suggestions.find((s: any) => s.label === '\\mysqrt')
    expect(sqrt).toBeDefined()
    expect(sqrt.insertText).toBe('mysqrt{$1}')
    expect(sqrt.insertTextRules).toBe(4)
    expect(sqrt.detail).toBe('Package macro (1 arg)')

    const par = suggestions.find((s: any) => s.label === '\\mypar')
    expect(par).toBeDefined()
    expect(par.insertText).toBe('mypar')
    expect(par.insertTextRules).toBeUndefined()
    expect(par.detail).toBe('Package macro')
  })

  it('shows arg count in engine environment detail', () => {
    index.updateEngineCommands(['mytab\t113\t1', 'endmytab\t113\t0'])
    const model = mockModel(['\\begin{my'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 10),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    const mytab = suggestions.find(
      (s: any) => s.label === 'mytab' && s.detail?.includes('Package environment'),
    )
    expect(mytab).toBeDefined()
    expect(mytab.detail).toBe('Package environment (1 arg)')
  })

  it('provides engine environment completions in \\begin{', () => {
    index.updateEngineCommands(['myenv', 'endmyenv', 'myother', 'endmyother'])
    const model = mockModel(['\\begin{my'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 10),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    const myenv = suggestions.find(
      (s: any) => s.label === 'myenv' && s.detail === 'Package environment',
    )
    expect(myenv).toBeDefined()
    expect(myenv.sortText).toBe('2_myenv')
  })

  it('deduplicates engine environments with static environments', () => {
    index.updateEngineCommands(['equation', 'endequation'])
    const model = mockModel(['\\begin{eq'])
    const result = provider.provideCompletionItems(
      model,
      pos(1, 10),
      undefined as any,
      undefined as any,
    )
    const suggestions = (result as any).suggestions as any[]
    const equations = suggestions.filter((s: any) => s.label === 'equation')
    // Should only appear once (from static DB, not duplicated by engine)
    expect(equations).toHaveLength(1)
  })
})
