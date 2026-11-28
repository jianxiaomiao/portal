import { BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'
import type { Town } from '../scene/town'
import { fromBlender } from '../scene/model'
import { Ledger, enact, script, shots, type Scenario, type Step } from './story'

import { Playback } from './playback'

export class Journey extends Playback<Step> {
  db: Ledger
  private released = false
  private leases: (() => void)[] = []
  private effects = new Group()
  private route: Vector3[]
  private line: Line<BufferGeometry, LineBasicMaterial>
  private dot = new Mesh(new SphereGeometry(.24, 16, 12), new MeshBasicMaterial({color:0xffca58, toneMapped:false}))
  private at = new Vector3()
  private car = new Vector3()
  private lastView = ''
  private returnClock = 0
  constructor(private town: Town, readonly scenario: Scenario, auto: boolean) {
    super(script(scenario), auto)
    this.db = new Ledger(town.digests!)
    this.route = town.layout!.routes.NX_FO.data.map(fromBlender)
    this.line = new Line(new BufferGeometry().setFromPoints(this.route),
      new LineBasicMaterial({color:0x368a78, transparent:true, opacity:.55}))
    this.effects.add(this.line,this.dot)
    try {
      for (const group of ['vehicle','mechanics'] as const)
        this.leases.push(town.motion!.claim(group, true))
      town.scene.add(this.effects)
      this.enter()
    } catch (error) { this.release(); throw error }
  }
  protected duration() { return shots[this.step][2] }
  protected enter() {
    enact(this.step,this.db)
    const view = shots[this.step][3]
    if (view !== this.lastView) {
      this.town.rig!.go(view === 'belt' ? 'conveyor' : view === 'road' ? 'route' : view)
      this.lastView = view
    }
    this.paint()
  }
  protected paint() {
    const tracks = this.town.motion!.tracks, van = tracks.vehicle, belt = tracks.mechanics
    const s = this.step, u = this.fraction, layout = this.town.layout!
    const duration = van.legs[0].travel + 2.6
    const onRoad = s === 'drive' || s === 'retry'
    if (onRoad) { van.apply(2.6 + u * van.legs[0].travel); this.returnClock = duration }
    else if (s === 'reclaim' || s === 'claim' || (!this.db.imports && this.db.attempt === 0)) van.apply(0)
    else if (['lost','bad','expire'].includes(s)) {
      // The return uses the remaining one-way legs; carriage is independent of acknowledgement.
      this.returnClock = duration + (van.period - duration) * u
      van.apply(this.returnClock)
    } else if (['wait','badwait','stale'].includes(s)) van.apply(0)
    else if (this.db.attempt) van.apply(duration)
    const key = s === 'open' ? 'Dispatch' : s === 'assign' || s === 'queue' ? 'Process' : 'Receive'
    const pos = (key: string) => fromBlender(layout.anchors[key])
    const receive = pos('FO.Anchor.Receive')
    const dest = pos('FO.Anchor.' + key)
    const parcel = belt.parcels[0].node
    van.rest.node.updateWorldMatrix(true,false)
    this.car.set(0,1.18,0).applyMatrix4(van.rest.node.matrixWorld)
    this.at.copy(receive)
    if (['draft','inserts','local','claim','reclaim','stale'].includes(s)) {
      this.at.copy(pos('NX.Anchor.Server'))
      if (s === 'claim' || s === 'reclaim') this.at.lerp(this.car,u)
      if (s === 'stale') this.at.copy(this.car)
    } else if (onRoad) this.at.copy(this.car)
    else if (s === 'auth') this.at.lerpVectors(this.car,receive,u)
    else if (s === 'open' || s === 'assign') {
      const prev = s === 'open' ? receive : pos('FO.Anchor.Dispatch')
      this.at.lerpVectors(prev,dest,u)
    } else if (this.db.imports && !['match','mismatch'].includes(s)) this.at.copy(pos('FO.Anchor.Process'))
    if (!onRoad && !['claim','reclaim','stale'].includes(s)) this.at.y += .27
    belt.present(this.at, this.index + u, ['auth','inspect','match','mismatch'].includes(s), s === 'assign')
    parcel.visible = this.db.outbox !== '—'
    const returnAck = s === 'lost' || s === 'ack'
    this.line.visible = this.dot.visible = onRoad || returnAck
    if (this.line.visible) {
      const t = (returnAck ? 1-u : u) * (this.route.length-1), i = Math.floor(t)
      this.dot.position.lerpVectors(this.route[i],this.route[Math.min(i+1,this.route.length-1)],t-i)
      this.dot.visible = s !== 'lost' || u < .55
      this.line.material.color.setHex(returnAck ? 0xab802b : 0x398a78)
      this.dot.material.color.setHex(returnAck ? 0xffbe44 : 0x309e8e)
    }
  }
  snapshot() {
    return {scenario:this.scenario, step:this.step,index:this.index,total:this.steps.length,
      playing:this.playing,finished:this.finished, fraction:this.fraction, ...this.db,
      parcelUuid:this.town.motion!.tracks.mechanics.parcels[0].node.uuid}
  }
  release() {
    if (this.released) return
    this.released = true
    this.stopClock()
    this.effects.removeFromParent()
    this.line.geometry.dispose(); this.line.material.dispose()
    this.dot.geometry.dispose(); this.dot.material.dispose()
    for (const release of this.leases.reverse()) release()
    this.leases.length = 0
  }
}
