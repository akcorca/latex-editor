import type { TexError } from '../types'

const FILE_EXT_RE = /\.(tex|sty|cls|aux|fd|def|cfg|clo|bbl|bst|ltx|dtx|ldf|map|enc|tfm|fmt)$/

/** Check if a string extracted after '(' looks like a file path */
function looksLikeFile(s: string): boolean {
  if (s.startsWith('./') || s.startsWith('/')) return true
  return FILE_EXT_RE.test(s)
}

/** Normalize a pdfTeX log path to a project-relative path */
function normalizePath(p: string): string {
  const dotSlashIdx = p.indexOf('/./')
  if (dotSlashIdx !== -1) return p.slice(dotSlashIdx + 3)
  if (p.startsWith('./')) return p.slice(2)
  if (p.startsWith('/work/')) return p.slice(6)
  return p
}

/** Try to extract a file path after '(' at position i in line. Returns chars consumed or 0. */
function tryFileOpen(line: string, i: number, stack: string[]): number {
  const rest = line.slice(i + 1)
  const m = rest.match(/^([^()\s]+)/)
  if (m && looksLikeFile(m[1]!)) {
    stack.push(normalizePath(m[1]!))
    return 1 + m[1]!.length
  }
  return 0
}

/**
 * Build an array mapping each log line to the current file from pdfTeX's
 * parenthesized file open/close markers: `(./file.tex ... )`
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: paren-matching scanner has inherent nesting
export function buildFileContext(lines: string[]): string[] {
  const stack: string[] = []
  const fileAtLine: string[] = []
  let skipDepth = 0

  for (const line of lines) {
    let i = 0
    while (i < line.length) {
      if (line[i] === '(') {
        const consumed = tryFileOpen(line, i, stack)
        if (consumed > 0) {
          i += consumed
          continue
        }
        skipDepth++
      } else if (line[i] === ')') {
        if (skipDepth > 0) skipDepth--
        else if (stack.length > 0) stack.pop()
      }
      i++
    }
    fileAtLine.push(stack.length > 0 ? stack[stack.length - 1]! : '')
  }

  return fileAtLine
}

/** Search up to 5 lines ahead for "l.42 ..." pattern */
function findLineNumber(lines: string[], start: number): number {
  const end = Math.min(start + 5, lines.length)
  for (let j = start; j < end; j++) {
    const m = lines[j]!.match(/^l\.(\d+)\s/)
    if (m) return parseInt(m[1]!, 10)
  }
  return 0
}

/** Extract line number from "at lines? N" on current or next line */
function findBoxLineNumber(line: string, nextLine: string): number {
  const m = line.match(/at lines? (\d+)/) ?? nextLine.match(/at lines? (\d+)/)
  return m ? parseInt(m[1]!, 10) : 0
}

/** Extract "on input line N" from a log line, or 0 */
function extractInputLine(line: string): number {
  const m = line.match(/on input line (\d+)/)
  return m ? parseInt(m[1]!, 10) : 0
}

function tryTexError(line: string, lines: string[], i: number, out: TexError[]): boolean {
  const m = line.match(/^! (.+)/)
  if (!m) return false
  out.push({ line: findLineNumber(lines, i + 1), message: m[1]!, severity: 'error' })
  return true
}

function tryLatexWarning(line: string, out: TexError[]): boolean {
  const m = line.match(/LaTeX Warning:\s*(.+)/)
  if (!m) return false
  out.push({ line: extractInputLine(line), message: m[1]!, severity: 'warning' })
  return true
}

function tryPackageError(line: string, lines: string[], i: number, out: TexError[]): boolean {
  const m = line.match(/^Package (\S+) Error:\s*(.+)/)
  if (!m) return false
  const lineNum = extractInputLine(line) || findLineNumber(lines, i + 1)
  out.push({ line: lineNum, message: `[${m[1]}] ${m[2]}`, severity: 'error' })
  return true
}

function tryPackageWarning(line: string, out: TexError[]): boolean {
  const m = line.match(/^Package (\S+) Warning:\s*(.+)/)
  if (!m) return false
  out.push({ line: extractInputLine(line), message: `[${m[1]}] ${m[2]}`, severity: 'warning' })
  return true
}

function tryBoxWarning(line: string, nextLine: string, out: TexError[]): boolean {
  if (!/^Overfull \\[hv]box .+/.test(line)) return false
  out.push({ line: findBoxLineNumber(line, nextLine), message: line, severity: 'warning' })
  return true
}

export function parseTexErrors(log: string): TexError[] {
  const errors: TexError[] = []
  const lines = log.split('\n')
  const fileContext = buildFileContext(lines)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const prevLen = errors.length
    if (tryTexError(line, lines, i, errors)) {
      // matched
    } else if (tryLatexWarning(line, errors)) {
      // matched
    } else if (tryPackageError(line, lines, i, errors)) {
      // matched
    } else if (tryPackageWarning(line, errors)) {
      // matched
    } else {
      tryBoxWarning(line, lines[i + 1] ?? '', errors)
    }
    // Set file on any newly added errors
    const file = fileContext[i]
    if (file) {
      for (let j = prevLen; j < errors.length; j++) {
        errors[j]!.file = file
      }
    }
  }

  return errors
}
