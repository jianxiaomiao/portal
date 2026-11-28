import { Vector3 } from 'three'
import { fromBlender, Registry, type Layout } from './model'
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n))
  return t * t * (3 - 2 * t)
}
export class Studio {
  private parts
  progress = 0
  goal = 0
  inside = false
  constructor(layout: Layout, index: Registry) {
    this.parts = ['Roof', 'SouthWall', 'EastWall'].map((name, i) => {
      const id = 'ST.Move.' + name,
        node = index.get(id),
        path = layout.studioOpening[id]
      if (!Array.isArray(path)) throw Error('缺少工作室展开路径')
      return {
        node,
        closed: node.position.clone(),
        up: new Vector3(0, path[0], 0),
        slide: fromBlender([path[1], path[2], 0]),
        roof: i === 0,
      }
    })
  }
  set(open: boolean) {
    this.inside = false
    this.goal = open ? 1 : 0
    this.apply()
  }
  observe() {
    if (this.progress === 1) {
      this.inside = true
      this.apply()
    }
  }
  step(dt: number) {
    const old = this.progress
    const d =
      dt /
      (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.02 : 1.35)
    this.progress =
      this.goal > old
        ? Math.min(this.goal, old + d)
        : Math.max(this.goal, old - d)
    if (old !== this.progress) this.apply()
    return old !== this.progress
  }
  private apply() {
    for (const p of this.parts) {
      const lift = p.roof
        ? smooth(this.progress / 0.24)
        : smooth((this.progress - 0.54) / 0.18)
      const slide = p.roof
        ? smooth((this.progress - 0.24) / 0.3)
        : smooth((this.progress - 0.72) / 0.28)
      p.node.position
        .copy(p.closed)
        .addScaledVector(p.up, lift)
        .addScaledVector(p.slide, slide)
      p.node.visible = !this.inside
    }
  }
  snapshot() {
    return {
      progress: this.progress,
      inside: this.inside,
      offsets: this.parts.map((p) =>
        p.node.position.clone().sub(p.closed).toArray(),
      ),
    }
  }
}
