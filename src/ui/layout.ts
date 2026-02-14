export function setupDividers(): void {
  setupDivider('divider-left', 'file-tree-panel', 'editor-panel', 120, 400)
  setupDivider('divider-right', 'editor-panel', 'viewer-panel', 200, undefined)
}

function setupDivider(
  dividerId: string,
  leftId: string,
  _rightId: string,
  minLeft: number,
  maxLeft: number | undefined,
): void {
  const divider = document.getElementById(dividerId)!
  const leftPanel = document.getElementById(leftId)!
  const container = document.getElementById('main-container')!

  let dragging = false
  let startX = 0
  let startWidth = 0

  divider.addEventListener('mousedown', (e) => {
    dragging = true
    startX = e.clientX
    startWidth = leftPanel.getBoundingClientRect().width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const dx = e.clientX - startX
    let newWidth = startWidth + dx

    if (newWidth < minLeft) newWidth = minLeft
    if (maxLeft && newWidth > maxLeft) newWidth = maxLeft

    const containerWidth = container.getBoundingClientRect().width
    if (newWidth > containerWidth - 200) newWidth = containerWidth - 200

    leftPanel.style.width = `${newWidth}px`
    leftPanel.style.flex = 'none'

    // Trigger Monaco layout recalc
    window.dispatchEvent(new Event('resize'))
  })

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  })
}
