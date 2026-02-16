import type { VirtualFile } from '../types'
import { DEFAULT_ALGEBRA, DEFAULT_ANALYSIS, DEFAULT_LINALG, DEFAULT_TEX } from './default-project'

interface VirtualFSOptions {
  /** If true, start with no files (skip default main.tex template). */
  empty?: boolean
}

export class VirtualFS {
  private files = new Map<string, VirtualFile>()
  private listeners: Array<() => void> = []

  constructor(options?: VirtualFSOptions) {
    if (!options?.empty) {
      this.writeFile('main.tex', DEFAULT_TEX)
      this.writeFile('algebra.tex', DEFAULT_ALGEBRA)
      this.writeFile('analysis.tex', DEFAULT_ANALYSIS)
      this.writeFile('linalg.tex', DEFAULT_LINALG)
    }
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
