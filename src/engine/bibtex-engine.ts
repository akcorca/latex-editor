import type { TexliveVersion } from '../types'
import { BaseWorkerEngine, resolveTexliveUrl } from './base-worker-engine'

interface WorkerMessage {
  result?: string
  cmd?: string
  file?: string
  log?: string
  data?: string
}

export class BibtexEngine extends BaseWorkerEngine<WorkerMessage> {
  private version: TexliveVersion
  public onFileDownload?: (filename: string) => void

  constructor(options?: {
    assetBaseUrl?: string
    texliveUrl?: string
    texliveVersion?: TexliveVersion
  }) {
    const base = options?.assetBaseUrl ?? import.meta.env.BASE_URL
    const version = options?.texliveVersion ?? '2025'
    super(`${base}swiftlatex/${version}/swiftlatexbibtex.js`, options?.texliveUrl ?? null)
    this.version = version
  }

  async init(): Promise<void> {
    if (this.worker) return
    this.status = 'loading'

    await new Promise<void>((resolve, reject) => {
      this.worker = new Worker(this.enginePath)
      this.worker.onmessage = (ev) => {
        const data: WorkerMessage = ev.data
        // Init message (no cmd)
        if (!data.cmd) {
          if (data.result === 'ok') {
            this.status = 'ready'
            resolve()
          } else {
            this.status = 'error'
            reject(new Error('BibTeX engine failed to initialize'))
          }
          return
        }

        if (data.cmd === 'downloading' && data.file) {
          this.onFileDownload?.(data.file)
          return
        }

        // Dispatch by cmd
        const key = `cmd:${data.cmd}`
        const cb = this.pendingResponses.get(key)
        if (cb) {
          this.pendingResponses.delete(key)
          cb(data)
        }
      }
      this.worker.onerror = (err) => {
        this.status = 'error'
        reject(err)
      }
    })

    this.worker!.postMessage({
      cmd: 'settexliveurl',
      url: resolveTexliveUrl(this.texliveUrl, this.version),
    })
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    if (!this.worker) return
    await this.postMessageWithResponse(
      { cmd: 'writefile', url: path, src: content },
      'cmd:writefile',
    )
  }

  mkdir(path: string): void {
    if (!this.worker) return
    this.worker.postMessage({ cmd: 'mkdir', url: path })
  }

  async compile(auxBaseName: string): Promise<{ success: boolean; log: string }> {
    if (this.status !== 'ready' || !this.worker) {
      return { success: false, log: 'BibTeX engine not ready' }
    }
    this.status = 'compiling'

    const data = await this.postMessageWithResponse(
      { cmd: 'compilebibtex', url: auxBaseName },
      'cmd:compile',
    )

    this.status = 'ready'
    return {
      success: data.result === 'ok',
      log: data.log || '',
    }
  }

  async readFile(path: string): Promise<string | null> {
    if (!this.worker) return null
    const data = await this.postMessageWithResponse({ cmd: 'readfile', url: path }, 'cmd:readfile')
    return data.result === 'ok' ? (data.data ?? null) : null
  }
}
