import { OrthographicCamera, Raycaster, Vector2, type Object3D } from 'three'
import type { Registry } from './model'
import type { Place } from '../content'
export class Picking {
  private ray = new Raycaster()
  private ndc = new Vector2()
  private active = new Set<number>()
  private press?: { x: number; y: number; id: number }
  private abort = new AbortController()
  constructor(
    private canvas: HTMLCanvasElement,
    private camera: OrthographicCamera,
    private index: Registry,
    pick: (v: Place) => void,
    hover: (v: Place | undefined, x: number, y: number) => void,
    locked: () => boolean,
  ) {
    this.ray.layers.enable(2) // Street scenery occludes picks and has no project mapping.
    const opts = { signal: this.abort.signal }
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        this.active.add(e.pointerId)
        this.press =
          this.active.size === 1
            ? { x: e.clientX, y: e.clientY, id: e.pointerId }
            : undefined
        hover(undefined, 0, 0)
      },
      opts,
    )
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (
          this.press &&
          Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 5
        )
          this.press = undefined
        if (e.pointerType === 'mouse' && !this.active.size && !locked()) {
          const r = canvas.getBoundingClientRect()
          const v = this.at(e.clientX - r.left, e.clientY - r.top)
          hover(v, e.clientX - r.left, e.clientY - r.top)
          canvas.style.cursor = v ? 'pointer' : 'grab'
        }
      },
      opts,
    )
    canvas.addEventListener(
      'pointerup',
      (e) => {
        const press = this.press
        this.press = undefined
        this.active.delete(e.pointerId)
        if (
          press?.id !== e.pointerId ||
          locked() ||
          e.button !== 0 ||
          Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5
        )
          return
        const r = canvas.getBoundingClientRect(),
          v = this.at(e.clientX - r.left, e.clientY - r.top)
        if (v) pick(v)
      },
      opts,
    )
    canvas.addEventListener(
      'pointercancel',
      (e) => {
        this.active.delete(e.pointerId)
        this.press = undefined
      },
      opts,
    )
    canvas.addEventListener('pointerleave', () => hover(undefined, 0, 0), opts)
  }
  at(x: number, y: number) {
    this.ndc.set(
      (x / this.canvas.clientWidth) * 2 - 1,
      1 - (y / this.canvas.clientHeight) * 2,
    )
    this.ray.setFromCamera(this.ndc, this.camera)
    for (const hit of this.ray.intersectObjects(this.index.surfaces, false)) {
      let visible = true
      for (let o: Object3D | null = hit.object; o; o = o.parent)
        if (!o.visible) {
          visible = false
          break
        }
      if (visible) return this.index.places.get(hit.object)
    }
  }
  dispose() {
    this.abort.abort()
  }
}
