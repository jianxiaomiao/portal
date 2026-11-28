import { SupportChat } from '../support-chat/director'
import type { Scenario as ChatScenario } from '../support-chat/story'
import { ApiRequest } from '../api-request/director'
import type { Options } from '../api-request/story'
import { Journey } from '../journey/director'
import { prepareDigests, type Scenario } from '../journey/story'
import { MotionDirector } from './motion/director'
import { Atmosphere, type Theme } from './atmosphere'
import {
  Scene,
  WebGLRenderer,
  Color,
  HemisphereLight,
  DirectionalLight,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  PMREMGenerator,
  Vector3,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  loadTown,
  disposeModel,
  type Registry,
  type Layout,
} from './model'
import { CameraRig } from './camera'
import { TownShadows } from './shadows'
import { Studio } from './studio'
import { Picking } from './picking'
import { Stats } from './stats'
import { spots, assets, type Place, type Hotspot } from '../content'
export type Quality = 'auto' | 'high' | 'low'
type Events = {
  stage: (label: import('./model').LoadStage) => void
  progress: (v: number, total: number) => void
  pick: (v: Place | null) => void
  hover: (v: Place | undefined, x: number, y: number) => void
  status: () => void
  lost: () => void
  pins: (v: { key: Hotspot; x: number; y: number }[]) => void
}
export class Town {
  digests?: Awaited<ReturnType<typeof prepareDigests>>
  journeyError = ''
  private chapter?: Journey | ApiRequest | SupportChat
  get chat() { return this.chapter instanceof SupportChat ? this.chapter : undefined }
  startChat(scenario: ChatScenario, auto: boolean) {
    this.startChapter(() => new SupportChat(this,scenario,auto))
  }
  get journey() { return this.chapter instanceof Journey ? this.chapter : undefined }
  get api() { return this.chapter instanceof ApiRequest ? this.chapter : undefined }
  togglePlayback() {
    if (this.chapter && !this.chapter.finished) this.chapter.playing = !this.chapter.playing
    this.events.status()
  }
  startApi(options: Options, auto: boolean) {
    this.startChapter(() => new ApiRequest(this,options,auto))
  }
  startJourney(s: Scenario, auto: boolean) {
    this.startChapter(() => new Journey(this,s,auto))
  }
  private startChapter(create: () => Journey | ApiRequest | SupportChat) {
    this.endJourney()
    this.journeyError = ''
    try { if (this.ready) this.chapter = create() }
    catch (error) { this.abortJourney(error) }
    this.events.status()
  }
  private abortJourney(error: unknown) {
    this.select(null)
    this.journeyError = error instanceof Error ? error.message : '剧情中断'
    this.events.pick(null)
  }
  nextJourneyStep() {
    try { this.chapter?.next() } catch (error) { this.abortJourney(error) }
  }
  endJourney() {
    this.chapter?.release()
    this.chapter = undefined
  }
  motion?: MotionDirector
  shadowInterval: number | undefined =
    __CV_INSPECT__ && new URLSearchParams(location.search).get('shadow') === 'frame' ? 0 : undefined
  private modelFile = ''
  private sky = new HemisphereLight()
  atmosphere: Atmosphere
  private lastShadow = 0
  scene = new Scene()
  renderer: WebGLRenderer
  stats: Stats
  rig?: CameraRig
  studio?: Studio
  registry?: Registry
  layout?: Layout
  selected: Place | null = null
  quality: Quality = 'auto'
  private picker?: Picking
  private stop = new AbortController()
  private frame = 0
  private last = 0
  private env?: WebGLRenderTarget
  private shadow = new TownShadows()
  private sun = new DirectionalLight(0xffefd9, 2.65)
  private floor: Mesh<PlaneGeometry, ShaderMaterial>
  private resize: ResizeObserver
  private ready = false
  private closed = false
  private lastStats = 0
  private modelCount = 0
  constructor(
    readonly canvas: HTMLCanvasElement,
    private events: Events,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.94
    this.stats = new Stats(this.renderer, () => this.shadow.enabled)
    this.scene.background = new Color('#f1efe6')
    this.scene.add(this.sky)
    this.atmosphere = new Atmosphere(this.scene,this.sky,this.sun,this.renderer)
    this.atmosphere.apply('day')
    this.sun.position.set(-18, 30, 20)
    this.sun.castShadow = false
    this.scene.add(this.sun, this.sun.target)
    this.floor = new Mesh(new PlaneGeometry(200, 200), this.shadow.ground)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -1.16
    this.floor.receiveShadow = true
    this.scene.add(this.floor)
    this.resize = new ResizeObserver(() => this.resizeToCanvas())
    this.resize.observe(canvas)
    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault()
        if (!this.closed) this.events.lost()
      },
      { signal: this.stop.signal },
    )
    this.resizeToCanvas()
  }
  private resizeToCanvas() {
    if (this.closed) return
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight
    if (!w || !h) return
    const low =
      this.quality === 'low' ||
      (this.quality === 'auto' &&
        (w < 660 || matchMedia('(pointer:coarse)').matches))
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.65))
    this.renderer.setSize(w, h, false)
    this.shadow.enabled = !low
    this.shadow.dirty = true
    this.rig?.resize(w, h)
  }
  setTheme(theme: Theme) {
    this.atmosphere.apply(theme)
    this.events.status()
  }
  setQuality(q: Quality) {
    this.quality = q
    this.resizeToCanvas()
    this.events.status()
  }
  async load() {
    this.digests = await prepareDigests()
    const data = await loadTown(this.stop.signal, this.events.progress, this.events.stage)
    if (this.closed) {
      disposeModel(data.scene)
      return
    }
    this.events.stage('正在准备首帧')
    this.registry = data.registry
    this.layout = data.layout
    this.scene.add(data.scene)
    // Let the loading panel paint after ownership transfers to this Town.
    await new Promise(resolve => setTimeout(resolve, 0))
    if (this.closed) return
    this.modelFile = data.modelFile
    this.modelCount = 1
    for (const m of data.registry.surfaces) {
      const materials = Array.isArray(m.material) ? m.material : [m.material]
      m.castShadow = materials.some((v) => !v.transparent)
      m.receiveShadow = true
    }
    this.motion = new MotionDirector(data.registry, data.layout)
    const meshes: Mesh[] = []
    data.scene.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o)
    })
    this.shadow.attach(meshes)
    this.motion.finishShaders()
    this.atmosphere.finish(data.registry)
    const pm = new PMREMGenerator(this.renderer),
      room = new RoomEnvironment()
    try {
      this.env = pm.fromScene(room, 0.04)
      this.scene.environment = this.env.texture
      this.atmosphere.apply(this.atmosphere.theme)
    } finally {
      room.dispose()
      pm.dispose()
    }
    this.rig = new CameraRig(this.canvas, data.layout)
    this.studio = new Studio(data.layout, data.registry)
    this.resizeToCanvas()
    const first = performance.now()
    this.shadow.render(this.renderer, this.scene, this.floor)
    this.renderer.render(this.scene, this.rig.camera)
    const entry = performance
      .getEntriesByName(new URL(assets + this.modelFile, location.href).href)
      .at(-1) as PerformanceResourceTiming | undefined
    Object.assign(this.stats.timing, data.timing, {
      firstRenderMs: performance.now() - first,
      transferBytes: entry?.transferSize ?? 0,
      encodedBytes: entry?.encodedBodySize ?? 0,
    })
    this.events.stage('正在启用选取')
    await Promise.resolve()
    if (this.closed) return
    this.picker = new Picking(
      this.canvas,
      this.rig.camera,
      data.registry,
      this.events.pick,
      (id, x, y) => {
        this.motion!.tracks.plaza.hover = id === 'hub'
        this.events.hover(id, x, y)
      },
      () => !!this.rig?.moving && !this.rig.entering,
    )
    this.ready = true
    this.stats.timing.readyMs = performance.now()
    this.last = performance.now()
    this.frame = requestAnimationFrame(this.draw)
  }
  observeVehicle() {
    if (!this.selected && this.motion)
      this.rig?.go('vehicle', this.motion.tracks.vehicle.rest.node.position)
  }
  observeConveyor() {
    if (this.selected === 'FO')
      this.rig?.go(this.rig.view === 'conveyor' ? 'FO' : 'conveyor')
  }
  select(place: Place | null) {
    if (!this.ready) return
    this.endJourney()
    this.selected = place
    this.studio!.set(false)
    this.rig!.go(place ?? 'home')
    this.shadow.dirty = true
    this.events.pins([])
    this.events.status()
  }
  openStudio(open: boolean) {
    if (this.selected !== 'ST') return
    this.studio!.set(open)
    this.rig!.go(open ? 'exploded' : 'ST')
    this.events.pins([])
    this.shadow.dirty = true
    this.events.status()
  }
  interior() {
    if (this.selected !== 'ST' || this.studio!.progress !== 1) return
    this.studio!.observe()
    this.rig!.go('inside')
    this.shadow.dirty = true
    this.events.status()
  }
  globe() {
    if (this.selected === 'ST' && this.studio?.inside) {
      this.rig!.go('globe')
      this.events.pins([])
      this.events.status()
    }
  }
  private draw = (now: number) => {
    if (this.closed || !this.rig || !this.studio) return
    this.frame = requestAnimationFrame(this.draw)
    // The first RAF timestamp can precede completion of the initial render.
    const dt = Math.max(0, now - this.last)
    this.last = now
    const motion = this.motion!
    let storyMoved = false
    try { storyMoved = !!this.chapter?.tick(dt / 1000) && !!this.journey }
    catch (error) { this.abortJourney(error) }
    const wide = !this.chapter && !this.rig.moving && ['home','plan','reverse'].includes(this.rig.view)
    const depthInterval = this.shadowInterval ?? (wide ? 250 : 125)
    if (
      ((motion.step(dt / 1000) || storyMoved) &&
        now - this.lastShadow >= depthInterval) ||
      motion.dirty
    ) {
      this.shadow.dirty = true
      motion.dirty = false
      this.lastShadow = now
    }
    this.atmosphere.step(dt/1000,motion.active)
    this.rig.follow(motion.tracks.vehicle.rest.node.position)
    this.rig.update(now)
    this.chat?.faceCamera()
    if (this.studio.step(Math.min(0.15, dt / 1000))) this.shadow.dirty = true
    this.shadow.render(this.renderer, this.scene, this.floor)
    this.renderer.render(this.scene, this.rig.camera)
    this.stats.record(dt, now, this.shadow.calls, this.shadow.triangles)
    if (this.studio.inside && this.rig.view !== 'globe')
      this.events.pins(
        spots.map((key) => ({ key, ...this.project('ST.Anchor.' + key) })),
      )
    if (now - this.lastStats > 160) {
      this.lastStats = now
      this.events.status()
    }
  }
  project(id: string) {
    const p = this.registry!.get(id)
      .getWorldPosition(new Vector3())
      .project(this.rig!.camera)
    return {
      x: ((p.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - p.y) / 2) * this.canvas.clientHeight,
    }
  }
  materialCount() {
    const materials = new Set()
    this.scene.traverse(node => {
      if (node instanceof Mesh || 'material' in node) {
        const value = node.material
        for (const m of Array.isArray(value) ? value : [value]) materials.add(m)
      }
    })
    return materials.size
  }
  diagnostics() {
    const cam = this.rig!.camera
    return {
      ...this.stats.snapshot(),
      motion: this.motion?.snapshot(),
      journey: this.journey?.snapshot(),
      api: this.api?.snapshot(),
      chat: this.chat?.snapshot(),
      journeyError: this.journeyError,
      streetShadowBakes: this.shadow.streetBakes,
      modelFile: this.modelFile,
      theme: this.atmosphere.theme,
      entering: this.rig!.entering,
      selected: this.selected,
      view: this.rig!.view,
      moving: this.rig!.moving,
      zoom: cam.zoom,
      modelCount: this.modelCount,
      ids: this.registry!.ids.size,
      camera: cam.position.toArray(),
      target: this.rig!.controls.target.toArray(),
      angle: this.rig!.controls.getPolarAngle(),
      studio: this.studio!.snapshot(),
    }
  }
  // Test probe in canvas-local CSS pixels. It runs the same frontmost-hit rule used by pointer input.
  hit(x: number, y: number) {
    return this.picker?.at(x, y)
  }
  dispose() {
    if (this.closed) return
    this.closed = true
    cancelAnimationFrame(this.frame)
    this.stop.abort()
    this.resize.disconnect()
    this.picker?.dispose()
    this.rig?.dispose()
    this.stats.dispose()
    this.endJourney()
    this.motion?.dispose()
    if (this.registry) disposeModel(this.registry.model)
    this.floor.geometry.dispose()
    this.shadow.dispose()
    this.env?.dispose()
    this.sun.shadow.dispose()
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
