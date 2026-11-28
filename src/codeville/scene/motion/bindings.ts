import {
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
export const up = new Vector3(0, 1, 0),
  forward = new Vector3(0, 0, 1),
  tau = 2 * Math.PI
export class RestPose {
  readonly position
  readonly rotation
  readonly scale
  readonly visible
  private delta = new Quaternion()
  constructor(readonly node: Object3D) {
    this.position = node.position.clone()
    this.rotation = node.quaternion.clone()
    this.scale = node.scale.clone()
    this.visible = node.visible
  }
  turn(axis: Vector3, angle: number, local = false) {
    this.delta.setFromAxisAngle(axis, angle)
    this.node.quaternion.copy(this.rotation)
    if (local) this.node.quaternion.multiply(this.delta)
    else this.node.quaternion.premultiply(this.delta)
  }
  reset() {
    this.node.position.copy(this.position)
    this.node.quaternion.copy(this.rotation)
    this.node.scale.copy(this.scale)
    this.node.visible = this.visible
  }
}
// Clone only matching primitives; exported shared atlases and textures remain borrowed.
export class LocalMaterials {
  private entries: {
    mesh: Mesh
    source: MeshStandardMaterial
    copy: MeshStandardMaterial
  }[] = []
  take(
    root: Object3D,
    name: string,
    accept: (m: Mesh) => boolean = () => true,
  ) {
    const found: MeshStandardMaterial[] = []
    root.traverse((o) => {
      if (
        o instanceof Mesh &&
        o.material instanceof MeshStandardMaterial &&
        o.material.name === name &&
        accept(o)
      ) {
        const source = o.material,
          copy = source.clone()
        o.material = copy
        found.push(copy)
        this.entries.push({ mesh: o, source, copy })
      }
    })
    if (!found.length) throw Error('缺少材质 ' + root.name + ' / ' + name)
    return found
  }
  reset() {
    for (const e of this.entries)
      e.copy.emissiveIntensity = e.source.emissiveIntensity
  }
  dispose() {
    for (const e of this.entries) {
      e.mesh.material = e.source
      e.copy.dispose()
    }
    this.entries.length = 0
  }
}
export interface Track {
  apply(t: number): void
  reset(): void
  dispose(): void
}
