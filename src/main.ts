import './style.css'
import { NEWCRISP_WIDGET } from './config/projects'
import type { mountTown } from './codeville/mount'

const base = import.meta.env.BASE_URL
const route = () =>
  document.querySelector<HTMLElement>('[data-route]')?.dataset.route
let owner: ReturnType<typeof mountTown> | undefined
let container: HTMLElement | undefined
let generation = 0
let starting = false
let pending: AbortController | undefined
let widget: HTMLScriptElement | undefined

function slot() {
  return document.querySelector<HTMLElement>('[data-runtime-slot]')
}
function revealSlot(show: boolean) {
  const target = slot()
  if (!target) return
  for (const child of target.children)
    if (child !== container && child instanceof HTMLElement)
      child.hidden = !show
}
function buttons() {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-enable],[data-copy]',
  ))
    button.hidden = false
  const homeButton = document.querySelector<HTMLButtonElement>(
    '.world [data-enable]',
  )
  if (homeButton)
    homeButton.textContent = owner
      ? '结束预览'
      : starting
        ? '正在启用…'
        : '启用三维预览 ↗'
}
function release() {
  generation++
  starting = false
  owner?.dispose()
  owner = undefined
  container?.remove()
  container = undefined
  revealSlot(true)
  buttons()
}
async function enable() {
  if (starting || owner || !slot()) return
  const token = ++generation
  starting = true
  buttons()
  try {
    const { mountTown } = await import('./codeville/mount')
    if (generation !== token || !slot()) return
    container = document.createElement('div')
    container.className = 'cv-root'
    revealSlot(false)
    slot()!.append(container)
    owner = mountTown(container, route() === '/')
  } catch {
    if (token !== generation) return
    release()
    const info = document.createElement('p')
    info.setAttribute('role', 'status')
    info.textContent = '三维模块暂时无法打开，可以继续浏览作品或重新启用。'
    slot()?.append(info)
  } finally {
    if (generation === token) {
      starting = false
      buttons()
    }
  }
}
function syncWidget() {
  if (
    route() === '/explore/' ||
    !NEWCRISP_WIDGET.enabled ||
    !NEWCRISP_WIDGET.origin ||
    !NEWCRISP_WIDGET.siteId
  ) {
    widget?.remove()
    widget = undefined
    document.getElementById('newcrisp-widget-root')?.remove()
    return
  }
  if (!widget) {
    widget = document.createElement('script')
    widget.async = true
    widget.src = NEWCRISP_WIDGET.origin.replace(/\/$/, '') + '/widget.js'
    widget.dataset.siteId = NEWCRISP_WIDGET.siteId
    document.body.append(widget)
  }
}
function enhanced(allowAuto = true) {
  buttons()
  syncWidget()
  const limited = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection?.saveData
  if (allowAuto && route() === '/explore/' && !limited) void enable()
}
async function navigate(url: URL, push: boolean) {
  pending?.abort()
  const controller = new AbortController()
  pending = controller
  const nextRoute = '/' + url.pathname.slice(base.length)
  try {
    if (nextRoute !== route()) {
      const response = await fetch(url.pathname, { signal: controller.signal })
      if (!response.ok) throw Error()
      const doc = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
      )
      const source = doc.querySelector<HTMLElement>('[data-route]')
      const current = document.querySelector('[data-route]')
      if (!source || !current || source.dataset.route !== nextRoute)
        throw Error()
      if (controller.signal.aborted) return
      if (nextRoute === '/') release()
      current.replaceWith(source)
      document.title = doc.title
      if (container && slot()) {
        revealSlot(false)
        slot()!.append(container)
      }
    }
    if (controller.signal.aborted) return
    if (push) history.pushState({}, '', url)
    if (owner) owner.navigate(nextRoute === '/')
    enhanced()
    if (url.hash)
      document
        .getElementById(decodeURIComponent(url.hash.slice(1)))
        ?.scrollIntoView()
    else window.scrollTo({ top: 0, behavior: 'instant' })
  } catch {
    if (!controller.signal.aborted) location.assign(url)
  } finally {
    if (pending === controller) pending = undefined
  }
}
document.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) return
  const activate = event.target.closest('[data-enable]')
  if (activate) {
    if (owner && route() === '/') release()
    else void enable()
    return
  }
  const copy = event.target.closest<HTMLElement>('[data-copy]')
  if (copy?.dataset.url) {
    const result = copy.parentElement?.querySelector('output')
    try {
      await navigator.clipboard.writeText(copy.dataset.url)
      if (result) result.textContent = '仓库地址已复制'
    } catch {
      if (result) result.textContent = copy.dataset.url
    }
    return
  }
  const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
  if (
    !anchor ||
    anchor.target ||
    event.defaultPrevented ||
    event.button ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.metaKey
  )
    return
  const url = new URL(anchor.href)
  if (url.origin !== location.origin || (!owner && !starting)) return
  if (
    url.pathname === base + 'explore/' &&
    anchor.classList.contains('model-choice')
  )
    return
  if (
    url.pathname === base + 'explore/' ||
    (url.pathname === base && route() === '/explore/')
  ) {
    event.preventDefault()
    void navigate(url, true)
  }
})
addEventListener('popstate', () => {
  const current = '/' + location.pathname.slice(base.length)
  if (current !== route() || current === '/explore/')
    void navigate(new URL(location.href), false)
})
addEventListener('pagehide', () => {
  pending?.abort()
  release()
})
addEventListener('pageshow', (event) => {
  if (event.persisted) enhanced()
})
enhanced()
