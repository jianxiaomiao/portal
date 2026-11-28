import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Path,
  SphereGeometry,
  Vector2,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// X/Z in the exported town. These strips follow Streets.NorthEast, outside the service van network.
function lane(x: number, z: number, half: number, radius: number, eastWest: boolean) {
  const path = new Path()
  path.moveTo(radius, -half)
  path.lineTo(radius, half)
  path.absarc(0, half, radius, 0, Math.PI, false)
  path.lineTo(-radius, -half)
  path.absarc(0, -half, radius, Math.PI, 2 * Math.PI, false)
  return { x, z, eastWest, path }
}
const lanes = [lane(-9.5, -15, 6.6, 0.65, true), lane(19.62, 1, 5.2, 0.68, false)]

type Pose = 'stock' | 'wave' | 'walk' | 'sit' | 'talk'
type Resident = [x: number, z: number, ground: number, yaw: number, pose: Pose, coat: string]
// prettier-ignore
const residents: Resident[] = [
  [24.55, -2.78, .15, Math.PI, 'stock', '#a46c48'],
  [24.10, 3.31, .15, Math.PI, 'wave', '#637e70'],
  [-18.64, 4.7, .13, 0, 'walk', '#c08e57'],
  [-25.12, 3.45, .16, Math.PI / 2, 'sit', '#678b99'],
  [-8.4, -17.07, .145, Math.PI / 2, 'walk', '#897991'],
  [22.28, -8.7, .14, .20, 'talk', '#b57b65'],
  [22.50, -7.82, .14, Math.PI+.2, 'talk', '#728875'],
]

export class Neighborhood {
  readonly group = new Group()
  private boxes = new InstancedMesh(
    new RoundedBoxGeometry(1, 1, 1, 1, 0.13),
    new MeshStandardMaterial({ roughness: 0.82 }),
    80,
  )
  private rounds = new InstancedMesh(new SphereGeometry(0.5, 8, 4), this.boxes.material, 112)
  private body = new Object3D()
  private part = new Object3D()
  private matrix = new Matrix4()
  private color = new Color()
  private point = new Vector2()
  private direction = new Vector2()
  private boxIndex = 0
  private roundIndex = 0
  private painted = false
  private elapsed = 0
  private pending = 0

  constructor() {
    this.group.name = 'Neighborhood'
    for (const mesh of [this.boxes, this.rounds]) {
      mesh.layers.set(1) // Camera-only layer; absent from both custom shadow passes and the model pick registry.
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      this.group.add(mesh)
    }
    this.pose()
  }

  update(dt: number, active: boolean) {
    if (!this.group.visible || !active) return
    this.pending += Math.min(dt, 0.1)
    if (this.pending < 1 / 15) return
    this.elapsed += this.pending
    this.pending = 0
    this.pose()
  }

  private anchor(x: number, y: number, z: number, yaw: number) {
    this.body.position.set(x, y, z)
    this.body.rotation.y = yaw
    this.body.updateMatrix()
  }

  private shape(
    round: boolean,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    paint: string,
    tilt = 0,
    lean = 0,
  ) {
    const mesh = round ? this.rounds : this.boxes
    const index = round ? this.roundIndex++ : this.boxIndex++
    this.part.position.set(x, y, z)
    this.part.scale.set(w, h, d)
    this.part.rotation.set(tilt, 0, lean)
    this.part.updateMatrix()
    mesh.setMatrixAt(index, this.matrix.multiplyMatrices(this.body.matrix, this.part.matrix))
    if (!this.painted) mesh.setColorAt(index, this.color.set(paint))
  }

  private vehicle(i: number) {
    const truck = i === 1,
      road = lanes[i]
    const phase = (this.elapsed + (truck ? 11 : 6)) % (truck ? 34 : 42)
    // Dwell at the kerb, then ease through departure and arrival.
    const u = Math.min(1, phase / (truck ? 28 : 39))
    const distance = u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)
    const p = road.path.getPointAt(distance, this.point)
    const t = road.path.getTangentAt(distance, this.direction)
    const yaw = Math.atan2(t.x, t.y)
    this.anchor(
      road.x + (road.eastWest ? p.y : p.x),
      0.083,
      road.z + (road.eastWest ? -p.x : p.y),
      yaw + (road.eastWest ? Math.PI / 2 : 0),
    )
    const paint = truck ? '#ac7554' : '#789c92'
    this.shape(false, 0, 0.3, 0, 0.88, 0.32, 1.78, paint)
    this.shape(false, 0, 0.54, truck ? 0.49 : -0.08, 0.76, 0.37, truck ? 0.63 : 0.96, '#465f64')
    this.shape(false, 0, 0.74, truck ? 0.49 : -0.08, 0.77, 0.09, truck ? 0.66 : 0.98, truck ? '#e7cfac' : '#dedac1')
    if (truck) {
      this.shape(false, 0, 0.59, -0.31, 0.87, 0.59, 0.88, '#cbb78d')
      this.shape(false, 0, 0.62, -0.31, 0.88, 0.075, 0.87, '#7f9178')
    } else this.shape(false, 0, 0.57, -0.05, 0.77, 0.33, 0.07, paint)
    for (const side of [-1, 1]) {
      for (const axle of [-0.55, 0.55]) this.shape(true, side * 0.423, 0.16, axle, 0.14, 0.32, 0.32, '#3d4947')
      this.shape(false, side * 0.28, 0.36, 0.89, 0.17, 0.08, 0.04, '#f1d3a2')
    }
  }

  private resident(i: number) {
    const [x, z, y, heading, pose, coat] = residents[i]
    const t = this.elapsed + i * 2.7
    const walking = pose === 'walk',
      seated = pose === 'sit'
    // Short patrol with soft turnarounds and a pause at each end.
    const phase = t * 0.28
    const travel = walking ? Math.max(-1, Math.min(1, Math.sin(phase) * 1.13)) : 0
    const pace = walking ? Math.min(1, 5 * (1 - Math.abs(travel))) : 0
    const turn = walking ? Math.PI * 0.5 * (1 - Math.tanh(6 * Math.cos(phase))) : 0
    const yaw = heading + turn + (pose === 'talk' ? 0.08 * Math.sin(t * 0.9) : 0)
    // At the quay the feet stay in front of the bench while the hips move back onto the seat.
    const rise = seated ? Math.max(0, Math.min(1, 3 * Math.sin(t * 0.22))) : 0
    const offset = travel + 0.29 * rise
    this.anchor(x + Math.sin(heading) * offset, y, z + Math.cos(heading) * offset, yaw)
    const stride = Math.sin(t * 4.0) * pace
    const bend = seated ? 1 - rise : 0
    const hip = 0.57 - 0.1 * bend
    const lift = walking ? 0.018 * Math.abs(stride) : 0.011 * Math.sin(t * 1.6)
    const skin = i % 2 ? '#b88968' : '#cfa481'
    this.shape(true, 0, hip + 0.2 + lift, 0, 0.4, 0.55, 0.29, coat)
    this.shape(true, 0, hip + 0.6 + lift, 0.012, 0.265, 0.32, 0.25, skin)
    this.shape(true, 0, hip + 0.7 + lift, -0.018, 0.28, 0.18, 0.26, i % 2 ? '#554c42' : '#705c4a')
    if (pose === 'stock' || walking) this.shape(true, 0, hip + 0.72 + lift, 0.013, 0.34, 0.065, 0.32, '#baa175')
    for (const side of [-1, 1]) {
      const swing = side * stride
      this.shape(
        true,
        side * 0.093,
        0.35 + 0.09 * bend,
        0.13 * bend + swing * 0.076,
        0.14,
        0.46 - 0.16 * bend,
        0.15,
        '#53615e',
        1.24 * bend + swing * 0.38,
      )
      this.shape(true, side * 0.096, 0.15 + 0.08 * bend, 0.26 * bend + swing * 0.15, 0.12, 0.32, 0.13, '#53615e')
      this.shape(true, side * 0.096, 0.063, 0.05 + 0.25 * bend + swing * 0.15, 0.14, 0.105, 0.2, '#514a42')
      const greeting = pose === 'wave' && side === 1 ? Math.pow(0.5 + 0.5 * Math.sin(t * 0.74), 2) : 0
      const reach = pose === 'stock' ? 0.5 + 0.5 * Math.sin(t * 1.7 + side) : 0
      const gest = pose === 'talk' ? 0.08 * (1 + Math.sin(t * 1.5 + side)) : 0
      const handY = hip + 0.08 + lift + 0.45 * greeting + 0.17 * reach + gest
      const handZ = 0.11 - swing * 0.1 + 0.15 * reach + (seated ? 0.08 : 0)
      const handX = side * (0.21 + 0.12 * greeting)
      // Orient the sleeve between shoulder and hand, with both ends anchored.
      const dx = handX - side * 0.15,
        dy = handY - (hip + 0.35 + lift)
      const len = Math.hypot(dx, dy, handZ)
      this.shape(
        true,
        (handX + side * 0.15) / 2,
        handY - dy / 2,
        handZ / 2,
        0.12,
        len,
        0.12,
        coat,
        Math.atan2(handZ, dy),
        -Math.asin(dx / len),
      )
      this.shape(true, handX, handY, handZ, 0.1, 0.11, 0.1, skin)
    }
    if (pose === 'stock') this.shape(false, 0, hip + 0.19 + lift, 0.24, 0.27, 0.18, 0.22, '#a78a59')
  }

  private pose() {
    this.boxIndex = 0
    this.roundIndex = 0
    lanes.forEach((_, i) => this.vehicle(i))
    residents.forEach((_, i) => this.resident(i))
    this.boxes.count = this.boxIndex
    this.rounds.count = this.roundIndex
    this.boxes.instanceMatrix.needsUpdate = true
    this.rounds.instanceMatrix.needsUpdate = true
    this.painted = true

  }

  dispose() {
    this.group.removeFromParent()
    for (const mesh of [this.boxes, this.rounds]) {
      mesh.dispose()
      mesh.geometry.dispose()
    }
    this.boxes.material.dispose()
  }
}
