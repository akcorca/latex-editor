import { parseAuxFile } from './aux-parser'
import { parseLatexFile } from './latex-parser'
import type {
  AuxData,
  BibEntry,
  CitationRef,
  CommandDef,
  FileSymbols,
  IncludeDef,
  LabelDef,
  LabelRef,
  SectionDef,
} from './types'

export class ProjectIndex {
  private files = new Map<string, FileSymbols>()
  private auxData: AuxData = { labels: new Map(), citations: new Set() }
  private bibEntries: BibEntry[] = []

  updateFile(filePath: string, content: string): void {
    this.files.set(filePath, parseLatexFile(content, filePath))
  }

  removeFile(filePath: string): void {
    this.files.delete(filePath)
  }

  updateAux(content: string): void {
    this.auxData = parseAuxFile(content)
  }

  updateBib(entries: BibEntry[]): void {
    this.bibEntries = entries
  }

  // --- Queries ---

  getAllLabels(): LabelDef[] {
    const result: LabelDef[] = []
    for (const symbols of this.files.values()) {
      result.push(...symbols.labels)
    }
    return result
  }

  getAllLabelRefs(name: string): LabelRef[] {
    const result: LabelRef[] = []
    for (const symbols of this.files.values()) {
      for (const ref of symbols.labelRefs) {
        if (ref.name === name) result.push(ref)
      }
    }
    return result
  }

  getAllCitations(): CitationRef[] {
    const result: CitationRef[] = []
    for (const symbols of this.files.values()) {
      result.push(...symbols.citations)
    }
    return result
  }

  getAllSections(): SectionDef[] {
    const result: SectionDef[] = []
    for (const symbols of this.files.values()) {
      result.push(...symbols.sections)
    }
    return result
  }

  getFileSymbols(filePath: string): FileSymbols | undefined {
    return this.files.get(filePath)
  }

  getCommandDefs(): CommandDef[] {
    const result: CommandDef[] = []
    for (const symbols of this.files.values()) {
      result.push(...symbols.commands)
    }
    return result
  }

  getIncludes(): IncludeDef[] {
    const result: IncludeDef[] = []
    for (const symbols of this.files.values()) {
      result.push(...symbols.includes)
    }
    return result
  }

  getAllEnvironments(): string[] {
    const names = new Set<string>()
    for (const symbols of this.files.values()) {
      for (const env of symbols.environments) {
        names.add(env.name)
      }
    }
    return [...names]
  }

  getBibEntries(): BibEntry[] {
    return this.bibEntries
  }

  getAuxLabels(): Map<string, string> {
    return this.auxData.labels
  }

  getAuxCitations(): Set<string> {
    return this.auxData.citations
  }

  resolveLabel(name: string): string | undefined {
    return this.auxData.labels.get(name)
  }

  /** Find the LabelDef for a given label name */
  findLabelDef(name: string): LabelDef | undefined {
    for (const symbols of this.files.values()) {
      for (const label of symbols.labels) {
        if (label.name === name) return label
      }
    }
    return undefined
  }

  /** Find the CommandDef for a given command name */
  findCommandDef(name: string): CommandDef | undefined {
    for (const symbols of this.files.values()) {
      for (const cmd of symbols.commands) {
        if (cmd.name === name) return cmd
      }
    }
    return undefined
  }

  /** Find all usages of a command name across all files */
  findCommandUsages(_name: string): { file: string; line: number; column: number }[] {
    // This would require scanning raw content for \name occurrences.
    // For now, return empty - reference provider will do its own regex scan.
    return []
  }
}
