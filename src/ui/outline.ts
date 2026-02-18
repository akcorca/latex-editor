import type { ProjectIndex } from '../lsp/project-index'
import type { SectionDef } from '../lsp/types'

const LEVEL_MAP: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
}

export class Outline {
  private container: HTMLElement

  private index: ProjectIndex

  private onSelect: (line: number) => void

  private currentFile: string = ''

  private activeLine: number = -1

  constructor(container: HTMLElement, index: ProjectIndex, onSelect: (line: number) => void) {
    this.container = container

    this.index = index

    this.onSelect = onSelect
  }

  update(filePath: string): void {
    this.currentFile = filePath

    this.render()
  }

  setActiveLine(line: number): void {
    this.activeLine = line

    this.highlightActive()
  }

  private render(): void {
    this.container.innerHTML = ''

    // Header

    const header = document.createElement('div')

    header.className = 'outline-header'

    header.textContent = 'Outline'

    this.container.appendChild(header)

    const symbols = this.index.getFileSymbols(this.currentFile)

    if (!symbols || symbols.sections.length === 0) {
      const empty = document.createElement('div')

      empty.className = 'outline-empty'

      empty.textContent = 'No sections found'

      this.container.appendChild(empty)

      return
    }

    const list = document.createElement('div')

    list.className = 'outline-list'

    for (const section of symbols.sections) {
      const item = this.createItem(section)

      list.appendChild(item)
    }

    this.container.appendChild(list)

    this.highlightActive()
  }

  private createItem(section: SectionDef): HTMLElement {
    const item = document.createElement('div')

    item.className = 'outline-item'

    item.dataset.line = section.location.line.toString()

    const level = LEVEL_MAP[section.level] ?? 2

    item.style.paddingLeft = `${level * 0.5}rem`

    const title = document.createElement('span')

    title.className = 'outline-title'

    title.textContent = section.title

    item.appendChild(title)

    item.onclick = () => {
      this.onSelect(section.location.line)
    }

    return item
  }

  private highlightActive(): void {
    const items = this.container.querySelectorAll('.outline-item')

    let activeItem: HTMLElement | null = null

    // Sections are sorted by line number by the parser

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement

      const line = parseInt(item.dataset.line || '0', 10)

      const nextItem = items[i + 1] as HTMLElement | undefined

      const nextLine = nextItem ? parseInt(nextItem.dataset.line || 'Infinity', 10) : Infinity

      if (this.activeLine >= line && this.activeLine < nextLine) {
        activeItem = item

        break
      }
    }

    for (const item of items) {
      item.classList.remove('active')
    }

    if (activeItem) {
      activeItem.classList.add('active')

      // Optional: scroll active item into view if it's not visible

      // activeItem.scrollIntoView({ block: 'nearest' })
    }
  }
}
