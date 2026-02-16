import { describe, expect, it } from 'vitest'
import { createHoverProvider } from '../hover-provider'
import { ProjectIndex } from '../project-index'

function mockModel(lines: string[]): any {
  return {
    getLineContent(lineNumber: number) {
      return lines[lineNumber - 1] ?? ''
    },
  }
}

function pos(lineNumber: number, column: number): any {
  return { lineNumber, column }
}

describe('createHoverProvider', () => {
  it('shows arg count for macros with args', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['myfrac\t113\t2'])
    const provider = createHoverProvider(index)
    const hover = provider.provideHover!(mockModel(['\\myfrac']), pos(1, 2), undefined as any)
    expect(hover).not.toBeNull()
    const contents = (hover as any).contents.map((c: any) => c.value)
    expect(contents[0]).toContain('Package macro')
    expect(contents[1]).toBe('Arguments: 2')
  })

  it('shows "Arguments: none" for 0-arg macros', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['mypar\t113\t0'])
    const provider = createHoverProvider(index)
    const hover = provider.provideHover!(mockModel(['\\mypar']), pos(1, 2), undefined as any)
    expect(hover).not.toBeNull()
    const contents = (hover as any).contents.map((c: any) => c.value)
    expect(contents[0]).toContain('Package macro')
    expect(contents[1]).toBe('Arguments: none')
  })

  it('does not show arg info for primitives', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['myprim\t21\t-1'])
    const provider = createHoverProvider(index)
    const hover = provider.provideHover!(mockModel(['\\myprim']), pos(1, 2), undefined as any)
    expect(hover).not.toBeNull()
    const contents = (hover as any).contents.map((c: any) => c.value)
    expect(contents[0]).toContain('TeX primitive')
    expect(contents).toHaveLength(1)
  })

  it('shows arg count for engine environments', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['mytab\t113\t1', 'endmytab\t113\t0'])
    const provider = createHoverProvider(index)
    const hover = provider.provideHover!(mockModel(['\\begin{mytab}']), pos(1, 9), undefined as any)
    expect(hover).not.toBeNull()
    const contents = (hover as any).contents.map((c: any) => c.value)
    expect(contents[0]).toContain('Package environment')
    expect(contents[1]).toBe('Arguments: 1')
  })

  it('no arg line for engine env with unknown arg count', () => {
    const index = new ProjectIndex()
    index.updateEngineCommands(['myenv', 'endmyenv'])
    const provider = createHoverProvider(index)
    const hover = provider.provideHover!(mockModel(['\\begin{myenv}']), pos(1, 9), undefined as any)
    expect(hover).not.toBeNull()
    const contents = (hover as any).contents.map((c: any) => c.value)
    expect(contents[0]).toContain('Package environment')
    expect(contents).toHaveLength(1)
  })
})
