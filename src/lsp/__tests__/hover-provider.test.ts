import { describe, expect, it } from 'vitest'
import { createHoverProvider } from '../hover-provider'
import { ProjectIndex } from '../project-index'

interface MockModel {
  getLineContent(lineNumber: number): string
}

interface HoverResult {
  contents: Array<{ value: string }>
}

function mockModel(lines: string[]): MockModel {
  return {
    getLineContent(lineNumber: number) {
      return lines[lineNumber - 1] ?? ''
    },
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Monaco types too complex to fully mock
function getHover(
  provider: ReturnType<typeof createHoverProvider>,
  model: MockModel,
  line: number,
  col: number,
): HoverResult | null {
  return provider.provideHover!(
    model as any,
    { lineNumber: line, column: col } as any,
    undefined as any,
  ) as HoverResult | null
}

describe('createHoverProvider', () => {
  it('shows arg count for macros with args', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['myfrac\t113\t2'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\myfrac']), 1, 2)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('Package macro')
    expect(values[1]).toBe('Arguments: 2')
  })

  it('shows "Arguments: none" for 0-arg macros', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['mypar\t113\t0'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\mypar']), 1, 2)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('Package macro')
    expect(values[1]).toBe('Arguments: none')
  })

  it('does not show arg info for primitives', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['myprim\t21\t-1'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\myprim']), 1, 2)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('TeX primitive')
    expect(values).toHaveLength(1)
  })

  it('shows arg count for engine environments', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['mytab\t113\t1', 'endmytab\t113\t0'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\begin{mytab}']), 1, 9)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('Package environment')
    expect(values[1]).toBe('Arguments: 1')
  })

  it('enriches static DB command hover with engine arg count', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['frac\t113\t2'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\frac']), 1, 2)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('frac')
    expect(values.some((c) => c === 'Arguments: 2')).toBe(true)
  })

  it('enriches static DB environment hover with engine arg count', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['tabular\t113\t1', 'endtabular\t113\t0'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\begin{tabular}']), 1, 9)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('tabular')
    expect(values.some((c) => c === 'Arguments: 1')).toBe(true)
  })

  it('no arg line for engine env with unknown arg count', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['myenv', 'endmyenv'])
    const provider = createHoverProvider(index)
    const hover = getHover(provider, mockModel(['\\begin{myenv}']), 1, 9)
    expect(hover).not.toBeNull()
    const values = hover!.contents.map((c) => c.value)
    expect(values[0]).toContain('Package environment')
    expect(values).toHaveLength(1)
  })
})
