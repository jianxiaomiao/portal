import { OrthographicCamera, Vector3, TOUCH } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { fromBlender, type Layout } from './model'
import type { Place } from '../content'
import { townViews, type TownView } from './townViews'
export type View =
  Place | TownView | 'route' | 'exploded' | 'inside' | 'globe' | 'vehicle' | 'conveyor' | 'nx-window' | 'chat-link' | 'chat-intake' | 'chat-desk'
const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
export class CameraRig {
  camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 3400)
  controls: OrbitControls
  view: View = 'home'
  aspect = 1
  width: number = townViews.home.width
  height: number = townViews.home.height
  private portrait = false
  private flight?: {
    from: Vector3
    to: Vector3
    target: Vector3
    old: Vector3
    zoom: number
    newZoom: number
    time: number
    duration: number
  }
  constructor(
    canvas: HTMLCanvasElement,
    private layout: Layout,
  ) {
    this.camera.layers.enable(2) // Static street scenery.
    this.camera.layers.enable(1) // Chapter overlays are visible to the viewer, outside the depth pass.
    this.controls = new OrbitControls(this.camera, canvas)
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.1,
      enablePan: false,
      minPolarAngle: 0.16,
      maxPolarAngle: 1.49,
      minZoom: 0.12,
      maxZoom: 3.1,
      rotateSpeed: 0.62,
      zoomSpeed: 0.9,
    })
    this.controls.touches.TWO = TOUCH.DOLLY_ROTATE
    this.setInitial(canvas.clientWidth / Math.max(1, canvas.clientHeight) < 1.18)
    this.controls.update()
  }
  private setInitial(portrait: boolean) {
    this.portrait = portrait
    const shot = portrait ? townViews.portrait : townViews.home
    this.controls.target.fromArray(shot.target)
    this.camera.position.copy(this.controls.target).add(v(...shot.offset))
    this.width = shot.width
    this.height = shot.height
  }
  resize(w: number, h: number) {
    this.aspect = w / Math.max(h, 1)
    const portrait = this.aspect < 1.18
    if (this.portrait !== portrait && this.view === 'home') {
      this.flight = undefined
      this.entering = false
      this.controls.enabled = true
      this.controls.enableDamping = true
      this.camera.zoom = 1
      this.setInitial(portrait)
      this.controls.update()
    }
    this.portrait = portrait
    this.frustum()
  }
  private frustum() {
    this.camera.top = Math.max(this.height, this.width / this.aspect) / 2
    this.camera.bottom = -this.camera.top
    this.camera.right = this.camera.top * this.aspect
    this.camera.left = -this.camera.right
    this.camera.updateProjectionMatrix()
  }
  entering = false
  private entryTime = 0
  private entryLast = 0
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
  enter() {
    this.camera.zoom = .73
    this.camera.position.add(v(-8,5,4))
    this.go('home')
    this.entering = true
    this.entryTime = 0
    this.entryLast = performance.now()
    this.flight!.duration = 2650
  }
  skipEntry() {
    if (this.entering && this.flight) {
      this.entering = false
      this.update(this.flight.time + this.flight.duration)
    }
  }
  go(view: View, tracked?: Vector3) {
    this.entering = false
    this.view = view
    this.controls.minPolarAngle = view === 'plan' ? 0.00001 : 0.16
    let target: Vector3, eye: Vector3, width: number, height: number
    if (view === 'home' || view === 'plan' || view === 'reverse' ||
        view === 'residential' || view === 'market' || view === 'quay') {
      const shot = townViews[view === 'home' && this.portrait ? 'portrait' : view]
      target = v(...shot.target)
      eye = target.clone().add(v(...shot.offset))
      width = shot.width
      height = shot.height
    } else if (view === 'chat-link') {
      target = v(-12,5,-.7)
      eye = target.clone().add(v(25,13,7))
      width = 23
      height = 14
    } else if (view === 'chat-intake' || view === 'chat-desk') {
      const point = view === 'chat-desk' ? 'SupportDesk' : 'MessageIntake'
      target = fromBlender(this.layout.anchors['NC.Anchor.' + point])
      target.x -= .65
      target.y += 2.1
      eye = target.clone().add(v(1.6,2.8,13))
      width = 12
      height = 10
    } else if (view === 'nx-window') {
      target = v(-12.4, 1.8, -3.65)
      eye = target.clone().add(v(.42, .72, 3.9))
      width = 9.6
      height = 6.4
    } else if (view === 'route') {
      target = v(0, 3.5, -5)
      eye = target.clone().add(v(2, 22, 32))
      width = 36
      height = 20
    } else if (view === 'vehicle') {
      target = tracked!.clone().add(v(0, 0.52, 0))
      eye = target.clone().add(v(3, 18, 10))
      width = 8.6
      height = 6.1
    } else if (view === 'conveyor') {
      target = fromBlender(this.layout.anchors['FO.Anchor.Dispatch']).add(
        v(0, 0.46, 0),
      )
      eye = target.clone().add(v(3, 8, 12))
      width = 8.7
      height = 4.4
    } else if (view === 'hub') {
      target = fromBlender(this.layout.anchors['ENV.Anchor.Focus'])
      eye = target.clone().add(v(8, 12, 17))
      width = 10
      height = 8
    } else if (view === 'globe') {
      target = fromBlender(this.layout.anchors['ST.Anchor.Frostwick'])
      eye = target.clone().add(v(3, 7, 15))
      width = 1.65
      height = 1.3
    } else if (view === 'inside' || view === 'exploded') {
      target = view === 'inside' ? v(11.4, 1.4, 5.6) : v(10.6, 3.2, 4.5)
      eye = target.clone().add(v(8, 17, 17))
      width = view === 'inside' ? 9.3 : 22.8
      height = view === 'inside' ? 7.3 : 16.2
    } else {
      const focus = fromBlender(this.layout.anchors[view + '.Anchor.Focus'])
      eye = fromBlender(this.layout.anchors[view + '.Anchor.CameraEye'])
      // Keep the validated viewing direction and frame the whole facade, including its roof.
      target = focus
        .clone()
        .lerp(fromBlender(this.layout.anchors[view + '.Anchor.Pick']), 0.68)
      eye.add(target.clone().sub(focus))
      width = 13.9
      height = 10.6
    }
    // Preserve apparent scale at the first frame when changing orthographic bounds.
    const prev = this.camera.top
    this.width = width
    this.height = height
    this.frustum()
    this.camera.zoom *= this.camera.top / prev
    this.camera.updateProjectionMatrix()
    this.controls.enableDamping = false
    this.controls.update()
    this.controls.enabled = false
    this.flight = {
      from: this.camera.position.clone(),
      old: this.controls.target.clone(),
      to: eye,
      target,
      zoom: this.camera.zoom,
      newZoom: 1,
      time: performance.now(),
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 1
        : 780,
    }
  }
  private followDelta = new Vector3()
  follow(position: Vector3) {
    if (this.view !== 'vehicle') return
    const target = this.flight?.target ?? this.controls.target
    this.followDelta.copy(position)
    this.followDelta.y += 0.52
    this.followDelta.sub(target)
    if (this.flight) {
      this.flight.to.add(this.followDelta)
      this.flight.target.add(this.followDelta)
    } else {
      this.camera.position.add(this.followDelta)
      this.controls.target.add(this.followDelta)
    }
  }
  update(now: number) {
    const f = this.flight
    if (!f) {
      this.controls.update()
      return
    }
    if (this.entering) {
      if (this.reduceMotion.matches) this.entryTime = f.duration
      if (!document.hidden) this.entryTime += Math.max(0, Math.min(now-this.entryLast,60))
      this.entryLast = now
      now = f.time + this.entryTime
    }
    const u = Math.max(0, Math.min(1, (now - f.time) / f.duration)),
      t = u * u * (3 - 2 * u)
    this.controls.target.lerpVectors(f.old, f.target, t)
    this.camera.position.lerpVectors(f.from, f.to, t)
    this.camera.zoom = Math.exp(Math.log(f.zoom) * (1 - t))
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.controls.target)
    this.camera.updateMatrixWorld()
    // Flights move the camera directly while OrbitControls input is disabled.
    this.controls.dispatchEvent({ type: 'change' })
    if (u >= 1) {
      this.entering = false
      this.flight = undefined
      this.controls.enabled = true
      this.controls.enableDamping = true
      this.controls.update()
    }
  }
  zoom(by: number) {
    if (!this.flight) {
      this.camera.zoom = Math.max(
        this.controls.minZoom,
        Math.min(this.controls.maxZoom, this.camera.zoom * by),
      )
      this.camera.updateProjectionMatrix()
    }
  }
  get moving() {
    return !!this.flight
  }
  dispose() {
    this.controls.dispose()
  }
}
