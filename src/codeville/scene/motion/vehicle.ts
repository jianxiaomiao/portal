import { Vector3 } from 'three'
import { fromBlender, type Layout, type Registry } from '../model'
import { RestPose, up } from './bindings'
const speed = 1.85,
  ramp = 1.15,
  hold = 2.6
class Leg {
  points: Vector3[]
  cum = [0]
  length: number
  travel: number
  constructor(
    readonly name: string,
    points: Vector3[],
  ) {
    this.points = points.filter(
      (p, i) => !i || p.distanceToSquared(points[i - 1]) > 1e-12,
    )
    for (let i = 1; i < this.points.length; i++)
      this.cum.push(
        this.cum[i - 1] + this.points[i].distanceTo(this.points[i - 1]),
      )
    this.length = this.cum.at(-1)!
    this.travel = this.length / speed + ramp
  }
  at(s: number, out: Vector3) {
    s = Math.max(0, Math.min(this.length, s))
    let lo = 0,
      hi = this.cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.cum[mid] <= s) lo = mid
      else hi = mid
    }
    return out.lerpVectors(
      this.points[lo],
      this.points[hi],
      (s - this.cum[lo]) / (this.cum[hi] - this.cum[lo]),
    )
  }
  distance(t: number) {
    if (t < ramp) return (0.5 * speed * t * t) / ramp
    if (t > this.travel - ramp)
      return this.length - (0.5 * speed * (this.travel - t) ** 2) / ramp
    return speed * (t - ramp / 2)
  }
}
export class Vehicle {
  rest: RestPose
  legs: Leg[]
  period: number
  leg = 0
  distance = 0
  parked = true
  private a = new Vector3()
  private b = new Vector3()
  constructor(index: Registry, layout: Layout) {
    this.rest = new RestPose(index.get('VAN.Root'))
    this.legs = ['NX_FO', 'FO_NC', 'NC_NX'].map(
      (k) => new Leg(k, layout.routes[k].drive.map(fromBlender)),
    )
    this.period = this.legs.reduce((n, l) => n + l.travel + hold, 0)
    for (let i = 0; i < 3; i++) {
      if (
        this.legs[i].points
          .at(-1)!
          .distanceTo(this.legs[(i + 1) % 3].points[0]) > 0.001
      )
        throw Error('车辆路线断开')
    }
  }
  apply(t: number) {
    let phase = t % this.period
    this.leg = 0
    while (this.leg < 2 && phase >= this.legs[this.leg].travel + hold) {
      phase -= this.legs[this.leg].travel + hold
      this.leg++
    }
    const leg = this.legs[this.leg],
      before = this.legs[(this.leg + 2) % 3],
      after = this.legs[(this.leg + 1) % 3]
    this.parked = phase <= hold
    const d = (this.distance = leg.distance(Math.max(0, phase - hold)))
    leg.at(d, this.rest.node.position)
    // The authored tyre bottom is +0.045 m above the pivot. Lower it to the 0.211–0.215 m road surface.
    this.rest.node.position.y -= 0.06
    const span = 0.3
    if (d < span) before.at(before.length + d - span, this.a)
    else leg.at(d - span, this.a)
    if (d + span > leg.length) after.at(d + span - leg.length, this.b)
    else leg.at(d + span, this.b)
    const tangent = this.b.sub(this.a)
    this.rest.turn(up, Math.atan2(tangent.x, tangent.z))
  }
  reset() {
    this.rest.reset()
    this.leg = 0
    this.distance = 0
    this.parked = true
  }
  dispose() {
    this.reset()
  }
}
