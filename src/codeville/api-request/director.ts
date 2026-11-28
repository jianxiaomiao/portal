import { BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'
import { Playback } from '../journey/playback'
import type { Town } from '../scene/town'
import { cues, RequestState, sequence, stages, type CueId, type Options } from './story'

export class ApiRequest extends Playback<CueId> {
  private readonly state: RequestState
  private readonly effects = new Group()
  private readonly dot = new Mesh(new SphereGeometry(.13,16,12), new MeshBasicMaterial({color:0xf1ba56,toneMapped:false}))
  private readonly wire = new Line(new BufferGeometry(),new LineBasicMaterial({color:0x247b70}))
  private readonly port = new Vector3()
  private readonly client = new Vector3()
  private released = false
  constructor(private town: Town, options: Options, auto: boolean) {
    super(sequence(options),auto)
    this.state = new RequestState(options)
    try {
      town.registry!.get('NX.Anchor.DataPort').getWorldPosition(this.port)
      this.client.copy(this.port).add(new Vector3(-2.6,1.05,1.2))
      this.wire.geometry.setFromPoints([this.client,this.port])
      this.dot.layers.set(1)
      this.wire.layers.set(1)
      this.effects.add(this.dot,this.wire)
      town.scene.add(this.effects)
      this.enter()
    } catch (error) { this.release(); throw error }
  }
  protected duration() { return cues[this.step][4] }
  protected enter() {
    this.state.enter(this.step)
    const stage = cues[this.step][0]
    const view = stage === 1 || stage === 3 || stage === 8 ? 'NX' : 'nx-window'
    if (this.town.rig!.view !== view) this.town.rig!.go(view)
    this.paint()
  }
  protected paint() {
    const returning = this.step === 'response'
    const gate = cues[this.step][0] === 3
    this.effects.visible = this.step === 'send' || returning || this.step === 'log' || gate
    this.dot.material.color.setHex((returning && this.state.status >= 400) || this.step === 'rateFull' || this.step === 'rateTimeout' ? 0xc46547 : 0xe8ae46)
    let u = this.fraction
    if (this.step === 'log') u = 1
    if (gate) u = this.step === 'permit' ? .86 + .14 * this.fraction : .86
    if (returning) u = (this.state.options.outcome === 'rate' ? .86 : 1) * (1-this.fraction)
    this.dot.position.lerpVectors(this.client,this.port,u)
    this.town.motion!.tracks.buildings.setRackAccent(this.step === 'hash' ? 1.8 + Math.sin(Math.PI*this.fraction) : 0)
  }
  snapshot() {
    const [stage,title,source,detail] = cues[this.step]
    const marker = stage === 6 ? 'NX.Anchor.Server' : stage === 7 ? 'NX.Device.Rack1'
      : stage === 1 || stage === 3 || stage === 8 ? 'NX.Anchor.DataPort' : 'NX.Device.Control'
    const location = this.step === 'response' && this.state.status === 200 ? 'HashOpenApiController → MVC'
      : this.step === 'response' ? this.state.stopAt : source
    return {...this.state,step:this.step,stage,stageName:stages[stage-1],title,location,detail,marker,
      index:this.index,total:this.steps.length,playing:this.playing,finished:this.finished,fraction:this.fraction}
  }
  protected complete() {
    this.release()
    this.town.rig!.go('home')
  }
  release() {
    if (this.released) return
    this.released = true
    this.stopClock()
    this.effects.removeFromParent()
    this.dot.geometry.dispose(); this.dot.material.dispose()
    this.wire.geometry.dispose(); this.wire.material.dispose()
    this.town.motion?.tracks.buildings.setRackAccent(0)
  }
}
