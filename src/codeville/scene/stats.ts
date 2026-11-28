import type { WebGLRenderer } from 'three'
type Timing = {
  bytes: number
  downloadMs: number
  parseMs: number
  readyMs: number
  cloudInitMs: number
  firstRenderMs: number
  transferBytes: number
  encodedBytes: number
}
export class Stats {
  timing: Timing = {
    bytes: 0,
    downloadMs: 0,
    parseMs: 0,
    readyMs: 0,
    cloudInitMs: 0,
    firstRenderMs: 0,
    transferBytes: 0,
    encodedBytes: 0,
  }
  private recent: number[] = []
  private capture?: {
    depthCalls: number[]
    depthTriangles: number[]
    values: number[]
    calls: number[]
    triangles: number[]
    start: number
    until: number
    resolve: (v: object) => void
    reject: (e: Error) => void
  }
  gpu: string
  constructor(
    private renderer: WebGLRenderer,
    private shadowsEnabled: () => boolean,
  ) {
    const gl = renderer.getContext(),
      e = gl.getExtension('WEBGL_debug_renderer_info')
    this.gpu = e
      ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
  }
  record(ms: number, now: number, depthCalls: number, depthTriangles: number) {
    if (ms <= 0) return
    this.recent.push(ms)
    if (this.recent.length > 60) this.recent.shift()
    const c = this.capture
    if (!c) return
    c.depthCalls.push(depthCalls)
    c.depthTriangles.push(depthTriangles)
    c.values.push(ms)
    c.calls.push(this.renderer.info.render.calls)
    c.triangles.push(this.renderer.info.render.triangles)
    if (now >= c.until) {
      this.capture = undefined
      const sorted = [...c.values].sort((a, b) => a - b),
        mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
      c.resolve({
        ...this.snapshot(),
        durationMs: now - c.start,
        frames: sorted.length,
        fps: 1000 / mean,
        meanFrameMs: mean,
        p95FrameMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
        callsRange: [Math.min(...c.calls), Math.max(...c.calls)],
        trianglesRange: [Math.min(...c.triangles), Math.max(...c.triangles)],
        shadowUpdates: c.depthCalls.filter((n) => n > 0).length,
        shadowCallsPerFrame:
          c.depthCalls.reduce((a, b) => a + b, 0) / sorted.length,
        shadowPeakCalls: Math.max(...c.depthCalls),
        shadowTrianglesPerFrame:
          c.depthTriangles.reduce((a, b) => a + b, 0) / sorted.length,
        shadowPeakTriangles: Math.max(...c.depthTriangles),
        frameIntervalsMs: c.values,
      })
    }
  }
  sample(duration = 4000) {
    if (this.capture) return Promise.reject(Error('正在采样'))
    return new Promise<object>((resolve, reject) => {
      const now = performance.now()
      this.capture = {
        depthCalls: [],
        depthTriangles: [],
        values: [],
        calls: [],
        triangles: [],
        start: now,
        until: now + duration,
        resolve,
        reject,
      }
    })
  }
  snapshot() {
    const r = this.renderer,
      mem = (
        performance as Performance & { memory?: { usedJSHeapSize: number } }
      ).memory
    return {
      gpu: this.gpu,
      fps: this.recent.length
        ? (1000 * this.recent.length) / this.recent.reduce((a, b) => a + b, 0)
        : 0,
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
      textures: r.info.memory.textures,
      geometries: r.info.memory.geometries,
      jsHeapBytes: mem?.usedJSHeapSize ?? null,
      dpr: r.getPixelRatio(),
      shadows: this.shadowsEnabled(),
      buffer: [r.domElement.width, r.domElement.height],
      ...this.timing,
    }
  }
  dispose() {
    this.capture?.reject(Error('场景已关闭'))
    this.capture = undefined
  }
}
