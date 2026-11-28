import { Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { Registry } from '../model'
import { RestPose, LocalMaterials, up, forward, tau } from './bindings'
const beltSpeed = 0.41,
  start = -3.09,
  end = 3.09,
  deck = 0.72 + 0.135 + 0.062
export class Mechanics {
  rollers: RestPose[]
  parcels: RestPose[]
  joints: RestPose[]
  private local = new LocalMaterials()
  private scanner
  private rollerMaterial
  private original: MeshStandardMaterial
  private drums: Mesh[] = []
  constructor(index: Registry) {
    this.rollers = Array.from(
      { length: 23 },
      (_, i) =>
        new RestPose(index.get('FO.Roller.' + String(i + 1).padStart(2, '0'))),
    )
    this.parcels = [1, 2, 3].map(
      (i) => new RestPose(index.get('FO.Move.Parcel' + i)),
    )
    this.joints = ['Shoulder', 'Elbow', 'Wrist'].map(
      (k) => new RestPose(index.get('FO.Joint.' + k)),
    )
    this.scanner = this.local.take(index.get('FO.Device.ScanGate'), 'MAT.led')
    for (const r of this.rollers)
      r.node.traverse((o) => {
        if (o instanceof Mesh) this.drums.push(o)
      })
    this.original = this.drums[0].material as MeshStandardMaterial
    this.rollerMaterial = this.original.clone()
    for (const m of this.drums) m.material = this.rollerMaterial
  }
  finishShaders() {
    const material = this.rollerMaterial,
      base = material.onBeforeCompile,
      cache = material.customProgramCacheKey()
    material.customProgramCacheKey = () => cache + '-roller-witness'
    material.onBeforeCompile = function (s, r) {
      base.call(this, s, r)
      s.vertexShader =
        'varying vec3 cvDrum;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ncvDrum=position;',
        )
      s.fragmentShader =
        'varying vec3 cvDrum;\n' +
        s.fragmentShader.replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nfloat stamp=smoothstep(0.80,0.92,normalize(cvDrum.xz).x)*smoothstep(.20,.215,abs(cvDrum.y));diffuseColor.rgb*=1.0-stamp*.42;',
        )
    }
  }
  apply(t: number) {
    for (const r of this.rollers) r.turn(up, (t * beltSpeed) / 0.062, true)
    let scan = 0,
      reach = 0
    for (const p of this.parcels) {
      const x = start + ((p.position.x - start + t * beltSpeed) % (end - start))
      // The receiving and discharge ends taper the parcel away before its hidden loop seam.
      const u = Math.min(1, (x - start) / 0.34, (end - x) / 0.34),
        size = u * u * (3 - 2 * u)
      p.node.position.set(x, deck + 0.24 * size, p.position.z + 0.07)
      p.node.scale.copy(p.scale).multiplyScalar(size)
      p.node.visible = size > 0.002
      scan = Math.max(scan, Math.exp(-((x + 2.42) ** 2) / 0.02))
      reach = Math.max(reach, Math.exp(-((x - 2.28) ** 2) / 0.25))
    }
    for (const m of this.scanner) m.emissiveIntensity = 0.65 + 2.1 * scan
    this.joints[0].turn(up, -0.69 + 0.18 * reach)
    this.joints[1].turn(forward, -0.85 + 0.2 * reach)
    this.joints[2].turn(forward, 0.28 - 0.18 * reach)
  }
  present(world: Vector3, phase: number, scanning: boolean, sorting: boolean) {
    const parcel = this.parcels[0].node
    parcel.position.copy(parcel.parent!.worldToLocal(world.clone()))
    this.parcels.slice(1).forEach(p => { p.node.visible = false })
    for (const r of this.rollers) r.turn(up, phase * tau, true)
    for (const m of this.scanner) m.emissiveIntensity = scanning ? 2.8 : .65
    const reach = sorting ? Math.sin((phase % 1) * Math.PI) : 0
    this.joints[0].turn(up, -.69 + .18 * reach)
    this.joints[1].turn(forward, -.85 + .2 * reach)
    this.joints[2].turn(forward, .28 - .18 * reach)
  }
  reset() {
    for (const p of [...this.rollers, ...this.parcels, ...this.joints])
      p.reset()
    this.local.reset()
  }
  dispose() {
    this.reset()
    this.local.dispose()
    for (const m of this.drums) m.material = this.original
    this.rollerMaterial.dispose()
  }
}
