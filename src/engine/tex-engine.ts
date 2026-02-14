import type { CompileResult, EngineStatus } from '../types'

export interface TexEngine {
  init(): Promise<void>
  writeFile(path: string, content: string | Uint8Array): void
  mkdir(path: string): void
  setMainFile(path: string): void
  compile(): Promise<CompileResult>
  readFile(path: string): Promise<string | null>
  isReady(): boolean
  getStatus(): EngineStatus
  flushCache(): void
  terminate(): void
}
