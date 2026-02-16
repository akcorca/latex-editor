import type { TexError } from '../types'

function formatPrefix(err: TexError): string {
  if (err.file && err.line > 0) return `${err.file}:${err.line}: `
  if (err.file) return `${err.file}: `
  if (err.line > 0) return `L${err.line}: `
  return ''
}

function createErrorEntry(
  err: TexError,
  onClick: (file: string, line: number) => void,
): HTMLElement {
  const entry = document.createElement('div')
  entry.className = `log-entry ${err.severity}`
  entry.textContent = `${formatPrefix(err)}${err.message}`

  if (err.line > 0) {
    entry.classList.add('clickable')
    const file = err.file ?? ''
    const line = err.line
    entry.onclick = () => onClick(file, line)
    entry.title = err.file
      ? `Click to jump to ${err.file}:${err.line}`
      : `Click to jump to line ${err.line}`
  }

  return entry
}

export class ErrorLog {
  private container: HTMLElement
  private onClickError: (file: string, line: number) => void

  constructor(container: HTMLElement, onClickError: (file: string, line: number) => void) {
    this.container = container
    this.onClickError = onClickError
  }

  update(errors: TexError[]): void {
    this.container.innerHTML = ''

    // Header
    const header = document.createElement('div')
    header.className = 'log-header'

    const label = document.createElement('span')
    label.textContent = 'Problems'

    if (errors.length > 0) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = String(errors.length)
      label.appendChild(badge)
    }

    header.appendChild(label)

    const toggleBtn = document.createElement('button')
    toggleBtn.textContent = this.container.classList.contains('open') ? 'Hide' : 'Show'
    toggleBtn.style.cssText =
      'background:none;border:none;color:#999;cursor:pointer;font-size:12px;'
    toggleBtn.onclick = () => this.toggle()
    header.appendChild(toggleBtn)

    header.onclick = (e) => {
      if (e.target === header || e.target === label) this.toggle()
    }

    this.container.appendChild(header)

    // Show errors
    if (errors.length > 0) {
      this.container.classList.add('open')
      for (const err of errors) {
        this.container.appendChild(createErrorEntry(err, this.onClickError))
      }
    }
  }

  private toggle(): void {
    this.container.classList.toggle('open')
  }

  clear(): void {
    this.container.innerHTML = ''
    this.container.classList.remove('open')
  }
}
