import { BufferGeometry, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Vector3 } from 'three'
import type { Town } from '../scene/town'
import { fromBlender } from '../scene/model'
import { Playback } from '../journey/playback'
import { ChatState, cues, sequence, type Scenario, type Step } from './story'

export class SupportChat extends Playback<Step> {
  private state: ChatState
  private effects = new Group()
  private route: Vector3[]
  private tower = new Vector3()
  private desk = new Vector3()
  private intake = new Vector3()
  private packet = new Group()
  private paper = new Mesh(new PlaneGeometry(.44,.30), new MeshBasicMaterial({color:0xffdf8d,side:DoubleSide,toneMapped:false}))
  private fold = new Line(new BufferGeometry().setFromPoints([
    new Vector3(-.22,.14,.003),new Vector3(0,-.015,.003),new Vector3(.22,.14,.003)
  ]),new LineBasicMaterial({color:0x805623}))
  private wire: Line<BufferGeometry,LineBasicMaterial>
  private wave = new Mesh(new RingGeometry(.47,.50,40),new MeshBasicMaterial({color:0x257e87,transparent:true,depthWrite:false,side:DoubleSide}))
  private released = false
  waitingForRetry = false
  private resumeOnRetry = false
  constructor(private town: Town, scenario: Scenario, auto: boolean) {
    super(sequence(scenario),auto)
    this.state = new ChatState(scenario)
    this.route = town.layout!.routes.NC_NX.data.map(fromBlender)
    // Stop the visible stroke just short of each antenna tip. The envelope still
    // reaches both exact DataPort anchors.
    const stroke = this.route.map(point => point.clone())
    stroke[0].lerp(stroke[1],.5)
    stroke[stroke.length-1].lerp(stroke[stroke.length-2],.5)
    this.wire = new Line(new BufferGeometry().setFromPoints(stroke),new LineBasicMaterial({color:0x368783,transparent:true,opacity:.76}))
    try {
      const anchor = (id:string, target:Vector3) => town.registry!.get(id).getWorldPosition(target)
      if (this.route[0].distanceTo(anchor('NC.Anchor.DataPort',new Vector3())) > .002 ||
          this.route.at(-1)!.distanceTo(anchor('NX.Anchor.DataPort',new Vector3())) > .002) throw Error('城际路线端点不匹配')
      anchor('NC.Anchor.Tower',this.tower)
      anchor('NC.Anchor.SupportDesk',this.desk)
      anchor('NC.Anchor.MessageIntake',this.intake)
      this.wave.rotation.x = -Math.PI/2
      this.packet.add(this.paper,this.fold)
      this.effects.name = 'Chapter03.Effects'
      this.packet.name = 'Chapter03.Envelope'
      this.wire.name = 'Chapter03.IdentityRoute'
      this.effects.add(this.packet,this.wire,this.wave)
      this.effects.traverse(o=>o.layers.set(1))
      town.scene.add(this.effects)
      this.enter()
    } catch (error) { this.release(); throw error }
  }
  protected duration() { return cues[this.step][4] }
  protected enter() {
    this.state.enter(this.step)
    if (this.step === 'lost') {
      this.resumeOnRetry = this.playing
      this.playing = false
      this.waitingForRetry = true
    }
    const path = cues[this.step][3]
    const view = path === 'nx' ? 'NX' : path === 'outbound' || path === 'inbound' ? 'chat-link'
      : path === 'tower' ? 'NC' : path === 'desk' ? 'chat-desk' : 'chat-intake'
    if (this.town.rig!.view !== view) this.town.rig!.go(view)
    this.paint()
  }
  next(manual=true) { if (!this.waitingForRetry) super.next(manual) }
  retry() {
    if (!this.waitingForRetry || this.released) return
    this.waitingForRetry = false
    this.playing = this.resumeOnRetry
    this.next(!this.playing)
  }
  protected paint() {
    const path = cues[this.step][3], u=this.fraction
    const intercity = path === 'inbound' || path === 'outbound'
    this.wire.visible = intercity
    this.packet.visible = intercity || ['send','answer','display','merge','ack','answerAck','retry','replay'].includes(this.step)
    if (intercity) {
      const index = (path === 'outbound' ? 1-u : u)*(this.route.length-1)
      const i = Math.min(this.route.length-2,Math.floor(index))
      this.packet.position.lerpVectors(this.route[i],this.route[i+1],index-i)
      this.packet.scale.setScalar(.065+.935*Math.min(1,Math.min(u,1-u)*12))
      this.paper.material.color.setHex(path === 'outbound' ? 0xffda8a : 0xa2ebdd)
    } else {
      const towardDesk = ['send','retry','answerAck'].includes(this.step)
      this.packet.position.lerpVectors(this.intake,this.desk,towardDesk ? u : 1-u)
      this.packet.position.y += .5 + Math.sin(Math.PI*u)*1.2
      this.packet.position.z += .8
      this.packet.scale.setScalar(.9)
      this.paper.material.color.setHex(0xffda8a)
    }
    this.faceCamera()
    this.wave.visible = path === 'tower' || this.step === 'dispatch'
    this.wave.position.copy(this.tower)
    this.wave.position.y += .80
    this.wave.scale.setScalar(.25+1.7*u)
    this.wave.material.opacity = .8*(1-u)
  }
  faceCamera() {
    if (!this.released && this.packet.visible) this.packet.quaternion.copy(this.town.rig!.camera.quaternion)
  }
  snapshot() {
    const [title,protocol,detail,path] = cues[this.step]
    return {...this.state,rows:this.state.rows.map(row=>({...row})),step:this.step,title,protocol,detail,path,
      fraction:this.fraction,index:this.index,total:this.steps.length,playing:this.playing,finished:this.finished,waitingForRetry:this.waitingForRetry,
      marker:path === 'nx' ? 'NX.Anchor.DataPort' : path === 'desk' ? 'NC.Anchor.SupportDesk' : path === 'intake' ? 'NC.Anchor.MessageIntake' : 'NC.Anchor.Tower'}
  }
  protected complete() { this.release(); this.town.rig!.go('home') }
  release() {
    if (this.released) return
    this.released = true
    this.stopClock()
    this.effects.removeFromParent()
    for (const object of [this.paper,this.fold,this.wave,this.wire]) {
      object.geometry.dispose()
      object.material.dispose()
    }
  }
}
export type ChatSnapshot = ReturnType<SupportChat['snapshot']>
