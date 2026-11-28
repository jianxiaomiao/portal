import type { Registry, Layout } from '../model'
import { Buildings, Plaza } from './ambient'
import { Mechanics } from './mechanics'
import { Vehicle } from './vehicle'
export const groups = ['plaza', 'vehicle', 'mechanics', 'buildings'] as const
export type Group = (typeof groups)[number]
export class MotionDirector {
  tracks
  mode: 'running' | 'paused' | 'stopped' = 'running'
  level = 4
  dirty = true
  private times = [0, 0, 0, 0]
  private owners = new Map<Group, symbol>()
  private media = matchMedia('(prefers-reduced-motion: reduce)')
  private skip = true
  private events = new AbortController()
  constructor(index: Registry, layout: Layout) {
    this.tracks = {
      plaza: new Plaza(index),
      vehicle: new Vehicle(index, layout),
      mechanics: new Mechanics(index),
      buildings: new Buildings(index),
    }
    const opts = { signal: this.events.signal }
    document.addEventListener(
      'visibilitychange',
      () => {
        this.skip = true
      },
      opts,
    )
    this.media.addEventListener(
      'change',
      () => {
        this.skip = true
      },
      opts,
    )
  }
  get active() {
    return this.mode === 'running' && !this.media.matches && !document.hidden
  }
  finishShaders() {
    this.tracks.mechanics.finishShaders()
    this.tracks.buildings.finishShaders()
  }
  step(dt: number) {
    if (this.skip) {
      this.skip = false
      return false
    }
    if (!this.active) return false
    let changed = false
    groups.slice(0, this.level).forEach((key, i) => {
      if (this.owners.has(key)) return
      this.times[i] += Math.min(0.1, Math.max(0, dt))
      this.tracks[key].apply(this.times[i])
      changed = true
    })
    return changed
  }
  setLevel(level: number) {
    if (!Number.isInteger(level) || level < 0 || level > 4)
      throw Error('未知动画组合')
    this.level = level
    this.stop()
    this.start()
  }
  start() {
    this.mode = 'running'
    this.skip = true
  }
  pause() {
    if (this.mode === 'running') this.mode = 'paused'
  }
  stop() {
    this.mode = 'stopped'
    this.times.fill(0)
    for (const k of groups) if (!this.owners.has(k)) this.tracks[k].reset()
    this.dirty = true
  }
  // One owner per track. Its release callback cannot unlock a subsequent owner's track.
  claim(key: Group, resumePhase = false) {
    if (this.owners.has(key)) throw Error('动画组已被占用')
    const token = Symbol(key)
    this.owners.set(key, token)
    this.tracks[key].reset()
    this.dirty = true
    return () => {
      if (this.owners.get(key) !== token) return
      this.owners.delete(key)
      const i = groups.indexOf(key)
      if (!resumePhase) this.times[i] = 0
      this.tracks[key].reset()
      if (resumePhase && this.times[i] > 0) this.tracks[key].apply(this.times[i])
      this.dirty = true
    }
  }
  snapshot() {
    const v = this.tracks.vehicle
    return {
      mode: this.mode,
      active: this.active,
      reduced: this.media.matches,
      level: this.level,
      times: [...this.times],
      owners: [...this.owners.keys()],
      van: v.rest.node.position.toArray(),
      leg: v.leg,
      parked: v.parked,
      distance: v.distance,
      period: v.period,
    }
  }
  dispose() {
    this.events.abort()
    this.owners.clear()
    for (const k of groups) this.tracks[k].dispose()
  }
}
