import { describe, expect, it } from 'vitest'
import { TextMapper } from './text-mapper'

// Mock PDFPageProxy with minimal getTextContent + getViewport
function mockPage(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
) {
  return {
    getTextContent: async () => ({ items }),
    getViewport: (_opts: { scale: number }) => ({
      height: 800,
      width: 600,
      // Standard non-rotated page: flip Y from bottom-left to top-left origin
      convertToViewportPoint: (x: number, y: number) => [x, 800 - y],
    }),
  } as any
}

describe('TextMapper', () => {
  it('indexes a page and finds text by position', async () => {
    const mapper = new TextMapper()
    mapper.setSource('main.tex', 'line one\nHello World\nline three')

    const page = mockPage([
      { str: 'Hello World', transform: [1, 0, 0, 1, 100, 700], width: 80, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    const result = mapper.lookup(1, 140, 100) // y=800-700=100
    expect(result).toEqual({ file: 'main.tex', line: 2 })
  })

  it('returns null for empty page', () => {
    const mapper = new TextMapper()
    expect(mapper.lookup(1, 0, 0)).toBeNull()
  })

  it('returns null when text not found in source', async () => {
    const mapper = new TextMapper()
    mapper.setSource('main.tex', 'completely different content')

    const page = mockPage([
      { str: 'XYZ not in source', transform: [1, 0, 0, 1, 100, 700], width: 80, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    expect(mapper.lookup(1, 140, 100)).toBeNull()
  })

  it('finds closest block when multiple exist', async () => {
    const mapper = new TextMapper()
    mapper.setSource('main.tex', 'First line\nSecond line\nThird line')

    const page = mockPage([
      { str: 'First line', transform: [1, 0, 0, 1, 100, 750], width: 70, height: 12 },
      { str: 'Second line', transform: [1, 0, 0, 1, 100, 700], width: 80, height: 12 },
      { str: 'Third line', transform: [1, 0, 0, 1, 100, 650], width: 75, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    // Click near "Second line" (y=800-700=100)
    const result = mapper.lookup(1, 140, 100)
    expect(result).toEqual({ file: 'main.tex', line: 2 })
  })

  it('uses partial match for long text', async () => {
    const mapper = new TextMapper()
    mapper.setSource('main.tex', 'short\nThe quick brown fox jumps over the lazy dog\nend')

    const page = mockPage([
      { str: 'The quick brown', transform: [1, 0, 0, 1, 100, 700], width: 100, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    const result = mapper.lookup(1, 150, 100)
    expect(result).toEqual({ file: 'main.tex', line: 2 })
  })

  it('clears indexed data', async () => {
    const mapper = new TextMapper()
    mapper.setSource('main.tex', 'Hello')

    const page = mockPage([
      { str: 'Hello', transform: [1, 0, 0, 1, 100, 700], width: 40, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    mapper.clear()
    expect(mapper.lookup(1, 140, 100)).toBeNull()
  })

  it('searches multiple source files', async () => {
    const mapper = new TextMapper()
    mapper.setSource('main.tex', 'Main content')
    mapper.setSource('chapter1.tex', 'Chapter one text here')

    const page = mockPage([
      { str: 'Chapter one text here', transform: [1, 0, 0, 1, 100, 700], width: 120, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    const result = mapper.lookup(1, 160, 100)
    expect(result).toEqual({ file: 'chapter1.tex', line: 1 })
  })

  it('forward lookup finds PDF position for a source line', async () => {
    const mapper = new TextMapper()
    mapper.setSource(
      'main.tex',
      '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}',
    )

    const page = mockPage([
      { str: 'Hello World', transform: [1, 0, 0, 1, 100, 700], width: 80, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    const result = mapper.forwardLookup('main.tex', 3) // "Hello World" is line 3
    // y = (800 - 700) - 12 = 88 (top of text, not baseline)
    expect(result).toEqual({ page: 1, x: 100, y: 88, width: 80, height: 12 })
  })

  it('forward lookup returns null for TeX-only lines', async () => {
    const mapper = new TextMapper()
    mapper.setSource(
      'main.tex',
      '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}',
    )

    const page = mockPage([
      { str: 'Hello', transform: [1, 0, 0, 1, 100, 700], width: 40, height: 12 },
    ])
    await mapper.indexPage(page, 1)

    // Line 1 is "\\documentclass{article}" — no meaningful text fragments (< 3 chars after stripping)
    const result = mapper.forwardLookup('main.tex', 1)
    expect(result).toBeNull()
  })

  it('forward lookup returns null for unknown file', () => {
    const mapper = new TextMapper()
    expect(mapper.forwardLookup('unknown.tex', 1)).toBeNull()
  })
})
