import type { VirtualFile } from '../types'

const DEFAULT_TEX = `\\documentclass{article}

\\title{Hello, \\LaTeX!}
\\author{Browser LaTeX Editor}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Welcome to the browser-based \\LaTeX{} editor.
This document verifies the compilation pipeline works.

\\subsection{Math}
The quadratic formula:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Inline math: $e^{i\\pi} + 1 = 0$.

\\subsection{Lists}
\\begin{itemize}
  \\item First item
  \\item Second item
  \\item Third item
\\end{itemize}

\\section{Conclusion}
If you can see this PDF, the engine is working!

\\end{document}
`

export class VirtualFS {
  private files = new Map<string, VirtualFile>()
  private listeners: Array<() => void> = []

  constructor() {
    this.writeFile('main.tex', DEFAULT_TEX)
  }

  writeFile(path: string, content: string | Uint8Array): void {
    this.files.set(path, { path, content, modified: true })
    this.notify()
  }

  readFile(path: string): string | Uint8Array | null {
    return this.files.get(path)?.content ?? null
  }

  deleteFile(path: string): boolean {
    const deleted = this.files.delete(path)
    if (deleted) this.notify()
    return deleted
  }

  listFiles(): string[] {
    return Array.from(this.files.keys()).sort()
  }

  getFile(path: string): VirtualFile | undefined {
    return this.files.get(path)
  }

  /** Get files that have been modified since last sync */
  getModifiedFiles(): VirtualFile[] {
    return Array.from(this.files.values()).filter((f) => f.modified)
  }

  /** Mark all files as synced */
  markSynced(): void {
    for (const file of this.files.values()) {
      file.modified = false
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
