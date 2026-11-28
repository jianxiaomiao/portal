/** A chapter shares Town.draw's clock. A manual advance always leaves the chapter paused. */
export abstract class Playback<S extends string> {
  index = 0
  playing: boolean
  finished = false
  private elapsed = 0
  private skip = true
  private listeners = new AbortController()
  protected constructor(readonly steps: readonly S[], auto: boolean) {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    this.playing = auto && !preference.matches
    const options = { signal: this.listeners.signal }
    document.addEventListener('visibilitychange', () => { this.skip = true }, options)
    preference.addEventListener('change', () => {
      if (preference.matches) this.playing = false
      this.skip = true
    }, options)
  }
  get step() { return this.steps[this.index] }
  get fraction() { return Math.min(1, this.elapsed / this.duration()) }
  protected abstract duration(): number
  protected abstract enter(): void
  protected abstract paint(): void
  protected complete() { this.release() }
  abstract release(): void
  protected stopClock() {
    this.playing = false
    this.listeners.abort()
  }
  next(manual = true) {
    if (this.finished) return
    if (manual) this.playing = false
    if (this.index + 1 === this.steps.length) {
      this.finished = true
      this.complete()
      return
    }
    this.index++
    this.elapsed = 0
    this.enter()
    if (manual) { this.elapsed = this.duration() * .7; this.paint() }
  }
  tick(dt: number) {
    if (this.skip) { this.skip = false; return false }
    if (!this.playing || document.hidden || this.finished) return false
    this.elapsed += Math.min(.1, dt)
    if (this.fraction >= 1) this.next(false)
    else this.paint()
    return true
  }
}
