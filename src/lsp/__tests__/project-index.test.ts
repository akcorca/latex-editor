import { describe, expect, it } from 'vitest'
import { ProjectIndex } from '../project-index'

describe('ProjectIndex', () => {
  it('indexes a file and retrieves labels', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\label{sec:intro}\n\\label{eq:1}')
    expect(index.getAllLabels()).toHaveLength(2)
    expect(index.getAllLabels().map((l) => l.name)).toEqual(['sec:intro', 'eq:1'])
  })

  it('retrieves file symbols', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\section{Hello}\n\\label{sec:hello}')
    const symbols = index.getFileSymbols('main.tex')
    expect(symbols).toBeDefined()
    expect(symbols!.sections).toHaveLength(1)
    expect(symbols!.labels).toHaveLength(1)
  })

  it('returns undefined for unknown file', () => {
    const index = new ProjectIndex()
    expect(index.getFileSymbols('nope.tex')).toBeUndefined()
  })

  it('removes a file', () => {
    const index = new ProjectIndex()
    index.updateFile('a.tex', '\\label{a}')
    index.removeFile('a.tex')
    expect(index.getAllLabels()).toHaveLength(0)
    expect(index.getFileSymbols('a.tex')).toBeUndefined()
  })

  it('updates a file (re-parse)', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\label{old}')
    expect(index.getAllLabels()[0]!.name).toBe('old')

    index.updateFile('main.tex', '\\label{new}')
    expect(index.getAllLabels()).toHaveLength(1)
    expect(index.getAllLabels()[0]!.name).toBe('new')
  })

  it('aggregates labels across files', () => {
    const index = new ProjectIndex()
    index.updateFile('a.tex', '\\label{a}')
    index.updateFile('b.tex', '\\label{b}')
    expect(index.getAllLabels()).toHaveLength(2)
  })

  it('finds label refs for a given name', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\ref{foo}\n\\ref{bar}\n\\ref{foo}')
    const refs = index.getAllLabelRefs('foo')
    expect(refs).toHaveLength(2)
  })

  it('aggregates citations', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\cite{a,b}\n\\cite{c}')
    expect(index.getAllCitations()).toHaveLength(3)
  })

  it('aggregates sections', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\section{Intro}\n\\subsection{Detail}')
    expect(index.getAllSections()).toHaveLength(2)
  })

  it('aggregates command defs', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\newcommand{\\foo}{bar}')
    index.updateFile('macros.tex', '\\def\\baz{qux}')
    expect(index.getCommandDefs()).toHaveLength(2)
  })

  it('gets all unique environment names', () => {
    const index = new ProjectIndex()
    index.updateFile('main.tex', '\\begin{equation}\n\\end{equation}\n\\begin{equation}')
    expect(index.getAllEnvironments()).toEqual(['equation'])
  })

  // --- .aux integration ---
  it('updates aux data and resolves labels', () => {
    const index = new ProjectIndex()
    index.updateAux('\\newlabel{sec:intro}{{1}{1}}\n\\newlabel{eq:1}{{2.3}{5}}')
    expect(index.resolveLabel('sec:intro')).toBe('1')
    expect(index.resolveLabel('eq:1')).toBe('2.3')
    expect(index.resolveLabel('unknown')).toBeUndefined()
  })

  it('gets aux citations', () => {
    const index = new ProjectIndex()
    index.updateAux('\\bibcite{knuth84}{1}\n\\bibcite{lamport94}{2}')
    expect(index.getAuxCitations().size).toBe(2)
  })

  // --- find helpers ---
  it('findLabelDef returns the definition', () => {
    const index = new ProjectIndex()
    index.updateFile('ch1.tex', '\\label{sec:one}')
    const def = index.findLabelDef('sec:one')
    expect(def).toBeDefined()
    expect(def!.location.file).toBe('ch1.tex')
  })

  it('findLabelDef returns undefined for missing label', () => {
    const index = new ProjectIndex()
    expect(index.findLabelDef('nope')).toBeUndefined()
  })

  it('findCommandDef returns the definition', () => {
    const index = new ProjectIndex()
    index.updateFile('defs.tex', '\\newcommand{\\hello}[1]{Hi #1}')
    const def = index.findCommandDef('hello')
    expect(def).toBeDefined()
    expect(def!.location.file).toBe('defs.tex')
    expect(def!.argCount).toBe(1)
  })

  it('bib entries can be set and retrieved', () => {
    const index = new ProjectIndex()
    index.updateBib([{ key: 'knuth84', type: 'book', title: 'TeXbook', author: 'Knuth' }])
    expect(index.getBibEntries()).toHaveLength(1)
    expect(index.getBibEntries()[0]!.key).toBe('knuth84')
  })
})
