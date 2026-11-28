import {
  Mesh,
  MeshBasicMaterial,
  BufferGeometry,
  RingGeometry,
  DoubleSide,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Registry } from '../model'
import { LocalMaterials, RestPose, up, tau } from './bindings'
export class Plaza {
  rings
  private lights = new LocalMaterials()
  private core
  private inlays
  hover = false
  private goldAxis = new Vector3(Math.sin(1.66), 0, Math.cos(1.66))
  constructor(index: Registry) {
    this.rings = ['Teal', 'Gold'].map(
      (k) => new RestPose(index.get('ENV.Control.Orbit' + k)),
    )
    this.inlays = ['Teal', 'Gold'].map((k, i) => {
      const o = index.get('ENV.Glow.' + k)
      if (o.parent !== this.rings[i].node) throw Error('镶段层级异常')
      return this.lights.take(o, 'MAT.Orbit' + k + 'Light')[0]
    })
    this.core = this.lights.take(index.get('ENV.Glow.Core'), 'MAT.CoreLight')[0]
  }
  apply(t: number) {
    this.rings[0].turn(up, (t * tau) / 28)
    this.rings[1].turn(this.goldAxis, (-t * tau) / 22)
    this.core.emissiveIntensity =
      1.38 + 0.32 * Math.sin((t * tau) / 4) + (this.hover ? 0.42 : 0)
    this.inlays.forEach(
      (m, i) => (m.emissiveIntensity = (i ? 1.5 : 1) * (this.hover ? 1.35 : 1)),
    )
  }
  reset() {
    this.rings.forEach((p) => p.reset())
    this.lights.reset()
  }
  dispose() {
    this.reset()
    this.lights.dispose()
  }
}
export class Buildings {
  dish
  private local = new LocalMaterials()
  private rackBase = 1
  private rackAccent = 0
  setRackAccent(accent: number) {
    this.rackAccent = accent
    this.leds[0].emissiveIntensity = this.rackBase + accent
  }
  private leds
  private fan
  private angle = { value: 0 }
  private waveMaterial = new MeshBasicMaterial({
    color: 0x84b4d6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  })
  private wave = new Mesh(new RingGeometry(0.955, 1, 64), this.waveMaterial)
  private display = new Mesh(
    new BufferGeometry(),
    new MeshBasicMaterial({
      color: 0x92c0c6,
      transparent: true,
      depthWrite: false,
    }),
  )
  constructor(index: Registry) {
    this.dish = new RestPose(index.get('NX.Array.Dish'))
    this.leds = [1, 2, 3].map(
      (i) => this.local.take(index.get('NX.Device.Rack' + i), 'MAT.led')[0],
    )
    const nx = index.get('NX.Root')
    this.fan = this.local.take(
      nx,
      'MAT.zinc',
      (m) => m.parent?.parent === nx,
    )[0]
    const tower = index.get('NC.Anchor.Tower')
    tower.add(this.wave)
    this.wave.position.y = 0.71
    this.wave.rotation.x = -Math.PI / 2
    // Status LED on the lower right of the existing service monitor, in building-local metres.
    index.get('NC.Root').add(this.display)
    const screen = new RingGeometry(.013,.022,12).translate(.90,1.44,1.901)
    const sign = new RingGeometry(.024,.039,16).translate(1.90,3.04,2.79)
    this.display.geometry.dispose()
    this.display.geometry=mergeGeometries([screen,sign])
    screen.dispose();sign.dispose()
    this.reset()
  }
  finishShaders() {
    const m = this.fan,
      base = m.onBeforeCompile,
      cache = m.customProgramCacheKey(),
      angle = this.angle
    m.customProgramCacheKey = () => cache + '-nx-fans'
    m.onBeforeCompile = function (s, r) {
      base.call(this, s, r)
      s.uniforms.cvFanAngle = angle
      s.vertexShader =
        `uniform float cvFanAngle;
 float cvFanCenter(vec3 p){
  if(abs(p.y-4.14)>.016)return 99.;
  float z=.5-.88*clamp(floor((.5-p.z)/.88+.5),0.,2.);
  return distance(p.xz,vec2(2.54,z))<.24?z:99.;
 }
 mat2 cvSpin(){float a=cvFanAngle;return mat2(cos(a),sin(a),-sin(a),cos(a));}
 ` +
        s.vertexShader
          .replace(
            '#include <beginnormal_vertex>',
            '#include <beginnormal_vertex>\nif(cvFanCenter(position)<5.)objectNormal.xz=cvSpin()*objectNormal.xz;',
          )
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nfloat center=cvFanCenter(position);if(center<5.)transformed.xz=vec2(2.54,center)+cvSpin()*(position.xz-vec2(2.54,center));',
          )
    }
  }
  apply(t: number) {
    this.dish.turn(up, 0.82 * Math.sin((t * tau) / 44))
    this.angle.value = (t * tau * 0.72) % tau
    this.leds.forEach((m, i) => {
      const f = (t + i * 0.88) % (2.4 + i * 0.37)
      const base = 0.85 + 0.9 * Math.exp(-((f - 0.4) ** 2) / 0.012)
      if (i === 0) this.rackBase = base
      m.emissiveIntensity = base + (i === 0 ? this.rackAccent : 0)
    })
    const p = (t % 6.8) / 2.4
    this.wave.visible = p < 1
    this.wave.scale.setScalar(0.19 + Math.min(1, p) * 1.08)
    this.waveMaterial.opacity = p < 1 ? 0.42 * Math.sin(p * Math.PI) ** 1.5 : 0
    this.display.visible = true
    this.display.material.opacity = 0.5 + 0.2 * Math.sin((t * tau) / 5)
  }
  reset() {
    this.dish.reset()
    this.angle.value = 0
    this.local.reset()
    this.rackBase = this.leds[0].emissiveIntensity
    this.setRackAccent(this.rackAccent)
    this.wave.scale.setScalar(1);this.waveMaterial.opacity=0;this.display.material.opacity=1
    this.wave.visible = false
    this.display.visible = false
  }
  dispose() {
    this.reset()
    this.local.dispose()
    for (const m of [this.wave, this.display]) {
      m.removeFromParent()
      m.geometry.dispose()
      m.material.dispose()
    }
  }
}
