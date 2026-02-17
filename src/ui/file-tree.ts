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

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children?: TreeNode[]
}

function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const filePath of files) {
    const parts = filePath.split('/')
    let currentLevel = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLast = i === parts.length - 1

      if (isLast) {
        currentLevel.push({ name: part, path: currentPath, isDir: false })
      } else {
        const existing = currentLevel.find((n) => n.isDir && n.name === part)
        if (existing) {
          currentLevel = existing.children!
        } else {
          const newDir: TreeNode = { name: part, path: currentPath, isDir: true, children: [] }
          currentLevel.push(newDir)
          currentLevel = newDir.children!
        }
      }
    }
  }

  function sortNodes(nodes: TreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.children) sortNodes(n.children)
    }
  }
  sortNodes(root)

  return root
}

export class FileTree {
  private container: HTMLElement
  private activeFile: string = 'main.tex'
  private onSelect: (path: string) => void
  private fs: VirtualFS
  private collapsedDirs = new Set<string>()

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

    const folderBtn = document.createElement('button')
    folderBtn.textContent = '\u{1F4C1}'
    folderBtn.title = 'New folder'
    folderBtn.onclick = () => this.createFolder()

    const addBtn = document.createElement('button')
    addBtn.textContent = '+'
    addBtn.title = 'New file'
    addBtn.onclick = () => this.createFile()

    btnGroup.append(uploadBtn, folderBtn, addBtn)
    header.append(title, btnGroup)
    this.container.appendChild(header)

    // Build and render tree
    const files = this.fs.listFiles()
    const tree = buildTree(files)
    this.renderTree(tree, 0)
  }

  private renderTree(nodes: TreeNode[], depth: number): void {
    for (const node of nodes) {
      if (node.isDir) {
        this.renderFolder(node, depth)
      } else if (node.name !== '.gitkeep') {
        this.renderFile(node, depth)
      }
    }
  }

  private renderFolder(node: TreeNode, depth: number): void {
    const collapsed = this.collapsedDirs.has(node.path)

    const item = document.createElement('div')
    item.className = 'folder-item'
    item.style.paddingLeft = `${12 + depth * 16}px`

    const toggle = document.createElement('span')
    toggle.className = 'folder-toggle'
    toggle.textContent = collapsed ? '\u25B6' : '\u25BC'

    const name = document.createElement('span')
    name.className = 'folder-name'
    name.textContent = node.name

    item.append(toggle, name)
    item.onclick = () => {
      if (collapsed) {
        this.collapsedDirs.delete(node.path)
      } else {
        this.collapsedDirs.add(node.path)
      }
      this.render()
    }

    // Drag & drop onto folder
    item.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      item.classList.add('drag-over')
    })
    item.addEventListener('dragleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      item.classList.remove('drag-over')
    })
    item.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
      item.classList.remove('drag-over')
      this.container.classList.remove('drag-over')
      if (e.dataTransfer?.files) {
        this.uploadFiles(e.dataTransfer.files, node.path)
      }
    })

    this.container.appendChild(item)

    if (!collapsed && node.children) {
      this.renderTree(node.children, depth + 1)
    }
  }

  private renderFile(node: TreeNode, depth: number): void {
    const item = document.createElement('div')
    item.className = `file-item${node.path === this.activeFile ? ' active' : ''}`
    item.style.paddingLeft = `${20 + depth * 16}px`
    item.textContent = node.name

    item.onclick = () => {
      this.activeFile = node.path
      this.onSelect(node.path)
      this.render()
    }

    if (node.path !== 'main.tex') {
      const del = document.createElement('button')
      del.className = 'delete-btn'
      del.textContent = 'x'
      del.onclick = (e) => {
        e.stopPropagation()
        if (confirm(`Delete ${node.path}?`)) {
          this.fs.deleteFile(node.path)
          if (this.activeFile === node.path) {
            this.activeFile = 'main.tex'
            this.onSelect('main.tex')
          }
        }
      }
      item.appendChild(del)
    }

    this.container.appendChild(item)
  }

  private createFile(): void {
    const name = prompt('File name (e.g. chapter1.tex or images/fig.png):')
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

  private createFolder(): void {
    const name = prompt('Folder name:')
    if (!name || !name.trim()) return
    const folderPath = name.trim().replace(/\/+$/, '')
    this.fs.writeFile(`${folderPath}/.gitkeep`, '')
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

  private uploadFiles(files: FileList, folderPrefix?: string): void {
    for (const file of files) {
      const path = folderPrefix ? `${folderPrefix}/${file.name}` : file.name
      if (isTextFile(file.name)) {
        const reader = new FileReader()
        reader.onload = () => {
          this.fs.writeFile(path, reader.result as string)
          this.activeFile = path
          this.onSelect(path)
        }
        reader.readAsText(file)
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          this.fs.writeFile(path, new Uint8Array(reader.result as ArrayBuffer))
          this.activeFile = path
          this.onSelect(path)
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
