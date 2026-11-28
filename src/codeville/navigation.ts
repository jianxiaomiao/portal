import { keys, spots, type Hotspot, type Place } from './content'
import { districtNames, type TownView } from './scene/townViews'
import type { Town } from './scene/town'

const bookmarkKey = 'portal-camera:' + __TOWN_DIR__
const views: string[] = [
  'home',
  'plan',
  'reverse',
  ...Object.keys(districtNames),
]
export type Intent = {
  place?: Place
  hotspot?: Hotspot
  view?: TownView
  chapter?: 'api' | 'ticket' | 'chat'
  scenario?: string
}
export function readIntent(params: URLSearchParams): Intent | undefined {
  const chapter = params.get('chapter')
  if (chapter === 'api' || chapter === 'ticket' || chapter === 'chat')
    return { chapter, scenario: params.get('scenario') || undefined }
  const hotspot = spots.find((k) => k === params.get('hotspot'))
  if (hotspot) return { place: 'ST', hotspot }
  const place = [...keys, 'hub' as const].find((k) => k === params.get('place'))
  if (place) return { place }
  const view = params.get('view') || ''
  if (views.includes(view)) return { view: view as TownView }
  if (['place', 'chapter', 'hotspot', 'view'].some((k) => params.has(k)))
    return { view: 'home' }
}
export function themePreference() {
  const query = new URLSearchParams(location.search).get('theme')
  if (query === 'night' || query === 'day') return query
  try {
    if (localStorage.getItem('portal-theme') === 'night') return 'night'
  } catch {}
  return 'day'
}
export function persistTheme(value: string) {
  try {
    localStorage.setItem('portal-theme', value)
  } catch {}
}
type Bookmark = {
  intent: Intent
  pose?: number[]
  target?: number[]
  zoom?: number
  portrait?: boolean
  interior?: boolean
  open?: boolean
}
export function saveCamera(
  town: Town | undefined,
  hotspot: Hotspot | null,
  chapter?: Intent,
) {
  if (chapter) {
    try {
      sessionStorage.setItem(bookmarkKey, JSON.stringify({ intent: chapter }))
    } catch {}
    return
  }
  const rig = town?.rig
  if (!town || !rig || town.chat || town.api || town.journey || rig.moving)
    return
  const intent: Intent = town.selected
    ? { place: town.selected, hotspot: hotspot || undefined }
    : { view: views.includes(rig.view) ? (rig.view as TownView) : 'home' }
  const state: Bookmark = {
    intent,
    pose: rig.camera.position.toArray(),
    target: rig.controls.target.toArray(),
    zoom: rig.camera.zoom,
    portrait: rig.aspect < 1.18,
    interior: !!town.studio?.inside,
    open: town.studio?.progress === 1,
  }
  try {
    sessionStorage.setItem(bookmarkKey, JSON.stringify(state))
  } catch {}
}
export function readCamera(): Bookmark | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(bookmarkKey) || 'null')
    if (value?.intent?.chapter) {
      const intent = readIntent(new URLSearchParams(value.intent))
      if (intent?.chapter) return { intent }
    }
    const triple = (a: unknown) =>
      Array.isArray(a) &&
      a.length === 3 &&
      a.every(
        (n) =>
          typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000,
      )
    if (
      value &&
      value.intent &&
      triple(value.pose) &&
      triple(value.target) &&
      Number.isFinite(value.zoom)
    ) {
      const intent = readIntent(new URLSearchParams(value.intent))
      if (intent) return { ...value, intent }
    }
  } catch {}
}
