import type { TexEngine } from './tex-engine'
import type { CompileResult, EngineStatus, TexError } from '../types'

const ENGINE_PATH = '/swiftlatex/swiftlatexpdftex.js'

export class SwiftLatexEngine implements TexEngine {
  private worker: Worker | null = null
  private status: EngineStatus = 'unloaded'
  private texliveUrl: string | null = null

  /** Set a custom TexLive endpoint before init(). Default is baked into the worker. */
  setTexliveUrl(url: string): void {
    this.texliveUrl = url
  }

  async init(): Promise<void> {
    if (this.worker) {
      throw new Error('Engine already initialized')
    }

    this.status = 'loading'

    await new Promise<void>((resolve, reject) => {
      this.worker = new Worker(ENGINE_PATH)

      this.worker.onmessage = (ev) => {
        const data = ev.data
        if (data.result === 'ok') {
          this.status = 'ready'
          resolve()
        } else {
          this.status = 'error'
          reject(new Error('Engine failed to initialize'))
        }
      }

      this.worker.onerror = (err) => {
        this.status = 'error'
        reject(err)
      }
    })

    // Clear handlers after init
    this.worker!.onmessage = () => {}
    this.worker!.onerror = () => {}

    // Set TexLive endpoint — proxied through Vite dev server (/texlive/ → texlive:5001)
    // Note: do NOT use PdfTeXEngine's setTexliveEndpoint() — it has a bug
    // that nullifies the worker reference after posting the message
    const texliveUrl = this.texliveUrl ?? `${location.origin}/texlive/`
    this.worker!.postMessage({ cmd: 'settexliveurl', url: texliveUrl })
  }

  writeFile(path: string, content: string | Uint8Array): void {
    this.checkReady()
    this.worker!.postMessage({ cmd: 'writefile', url: path, src: content })
  }

  mkdir(path: string): void {
    this.checkReady()
    if (!path || path === '/') return
    this.worker!.postMessage({ cmd: 'mkdir', url: path })
  }

  setMainFile(path: string): void {
    this.checkReady()
    this.worker!.postMessage({ cmd: 'setmainfile', url: path })
  }

  async compile(): Promise<CompileResult> {
    this.checkReady()
    this.status = 'compiling'

    const start = performance.now()

    const result = await new Promise<CompileResult>((resolve) => {
      this.worker!.onmessage = (ev) => {
        const data = ev.data
        if (data.cmd !== 'compile') return

        this.status = 'ready'
        const compileTime = performance.now() - start
        const log: string = data.log || ''
        const success = data.result === 'ok'
        const pdf = success ? new Uint8Array(data.pdf) : null
        const errors = parseTexErrors(log)

        resolve({ success, pdf, log, errors, compileTime })
      }

      this.worker!.postMessage({ cmd: 'compilelatex' })
    })

    this.worker!.onmessage = () => {}
    return result
  }

  isReady(): boolean {
    return this.status === 'ready'
  }

  getStatus(): EngineStatus {
    return this.status
  }

  flushCache(): void {
    this.checkReady()
    this.worker!.postMessage({ cmd: 'flushcache' })
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.status = 'unloaded'
    }
  }

  private checkReady(): void {
    if (this.status !== 'ready') {
      throw new Error(`Engine not ready (status: ${this.status})`)
    }
  }
}

function parseTexErrors(log: string): TexError[] {
  const errors: TexError[] = []
  const lines = log.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match "! Error message" pattern
    const errorMatch = line.match(/^! (.+)/)
    if (errorMatch) {
      // Look for line number in nearby lines: "l.42 ..."
      let lineNum = 0
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const lineMatch = lines[j].match(/^l\.(\d+)\s/)
        if (lineMatch) {
          lineNum = parseInt(lineMatch[1], 10)
          break
        }
      }
      errors.push({ line: lineNum, message: errorMatch[1], severity: 'error' })
    }

    // Match "LaTeX Warning:" pattern
    const warnMatch = line.match(/LaTeX Warning:\s*(.+)/)
    if (warnMatch) {
      const lineMatch = line.match(/on input line (\d+)/)
      const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : 0
      errors.push({ line: lineNum, message: warnMatch[1], severity: 'warning' })
    }
  }

  return errors
}
