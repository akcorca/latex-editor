import type { VirtualFS } from '../fs/virtual-fs'

const TEXT_EXTENSIONS = new Set([
  '.tex',
  '.bib',
  '.bst',
  '.cls',
  '.sty',
  '.txt',
  '.md',
  '.cfg',
  '.def',
  '.fd',
  '.dtx',
  '.ins',
  '.ltx',
  '.log',
  '.aux',
  '.bbl',
  '.blg',
])

function isTextFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return true
  return TEXT_EXTENSIONS.has(name.substring(dot).toLowerCase())
}

export class FileTree {
  private container: HTMLElement
  private activeFile: string = 'main.tex'
  private onSelect: (path: string) => void
  private fs: VirtualFS

  constructor(container: HTMLElement, fs: VirtualFS, onSelect: (path: string) => void) {
    this.container = container
    this.fs = fs
    this.onSelect = onSelect
    this.render()
    this.setupDragDrop()

    fs.onChange(() => this.render())
  }

  private render(): void {
    this.container.innerHTML = ''

    // Header
    const header = document.createElement('div')
    header.className = 'file-tree-header'

    const title = document.createElement('span')
    title.textContent = 'Files'

    const btnGroup = document.createElement('div')
    btnGroup.className = 'file-tree-btns'

    const uploadBtn = document.createElement('button')
    uploadBtn.textContent = '\u2191'
    uploadBtn.title = 'Upload files'
    uploadBtn.onclick = () => this.triggerUpload()

    const addBtn = document.createElement('button')
    addBtn.textContent = '+'
    addBtn.title = 'New file'
    addBtn.onclick = () => this.createFile()

    btnGroup.append(uploadBtn, addBtn)
    header.append(title, btnGroup)
    this.container.appendChild(header)

    // File list
    const files = this.fs.listFiles()
    for (const path of files) {
      const item = document.createElement('div')
      item.className = `file-item${path === this.activeFile ? ' active' : ''}`
      item.textContent = path

      item.onclick = () => {
        this.activeFile = path
        this.onSelect(path)
        this.render()
      }

      // Delete button (not for main.tex)
      if (path !== 'main.tex') {
        const del = document.createElement('button')
        del.className = 'delete-btn'
        del.textContent = 'x'
        del.onclick = (e) => {
          e.stopPropagation()
          if (confirm(`Delete ${path}?`)) {
            this.fs.deleteFile(path)
            if (this.activeFile === path) {
              this.activeFile = 'main.tex'
              this.onSelect('main.tex')
            }
          }
        }
        item.appendChild(del)
      }

      this.container.appendChild(item)
    }
  }

  private createFile(): void {
    const name = prompt('File name (e.g. chapter1.tex):')
    if (!name || !name.trim()) return

    const path = name.trim()
    if (this.fs.getFile(path)) {
      alert('File already exists')
      return
    }

    this.fs.writeFile(path, '')
    this.activeFile = path
    this.onSelect(path)
  }

  private setupDragDrop(): void {
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.container.classList.add('drag-over')
    })

    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.container.classList.remove('drag-over')
    })

    this.container.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.container.classList.remove('drag-over')
      if (e.dataTransfer?.files) {
        this.uploadFiles(e.dataTransfer.files)
      }
    })
  }

  private uploadFiles(files: FileList): void {
    for (const file of files) {
      if (isTextFile(file.name)) {
        const reader = new FileReader()
        reader.onload = () => {
          this.fs.writeFile(file.name, reader.result as string)
          this.activeFile = file.name
          this.onSelect(file.name)
        }
        reader.readAsText(file)
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          this.fs.writeFile(file.name, new Uint8Array(reader.result as ArrayBuffer))
          this.activeFile = file.name
          this.onSelect(file.name)
        }
        reader.readAsArrayBuffer(file)
      }
    }
  }

  private triggerUpload(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => {
      if (input.files) this.uploadFiles(input.files)
    }
    input.click()
  }

  setActive(path: string): void {
    this.activeFile = path
    this.render()
  }
}
