import * as T from 'three'
import { createForms, sculpture, vapor } from './forms.js'
import { environment, blendCoast } from './deck.js'
import { cloudLayout } from './layout.js'

const priorities = [0, 3, 6, 9, 4, 10]
const tiers = [
  { volumes: 1, scale: .60, steps: 20 },
  { volumes: 3, scale: .85, steps: 30 },
  { volumes: 6, scale: 1, steps: 36 },
]

/** Owned by one Town. The camera, renderer and clock are supplied by the host. */
export class CloudSea {
  group = new T.Group()
  gas = new T.Scene()
  composite = new T.Scene()
  box = new T.BoxGeometry(2,2,2)
  opaque = new T.WebGLRenderTarget(1,1,{
    depthTexture: new T.DepthTexture(1,1,T.UnsignedIntType),
  })
  mist = new T.WebGLRenderTarget(1,1,{depthBuffer:false})
  clearColor = new T.Color()
  renderCamera = new T.OrthographicCamera()
  banks = cloudLayout()
  linked = []
  level = -1
  constructor(theme, sun, meshes, renderer) {
    // HDR retains the town's highlights until the shared final ACES transform.
    if (renderer.extensions.has('EXT_color_buffer_float')) {
      this.opaque.texture.type = T.HalfFloatType
      this.mist.texture.type = T.HalfFloatType
    }
    this.targetNight = Number(theme === 'night')
    this.state = { night:this.targetNight, clock:0, sunlight:sun.clone().normalize(), forms:createForms() }
    this.sea = environment(this.state)
    this.state.seaUniforms = this.sea.uniforms
    const {sky,deck,veil} = this.sea
    this.group.name = 'CloudSea'
    for (const [mesh, name] of [[sky,'Distance'],[deck,'Shoals'],[veil,'Shore']]) {
      mesh.name = 'CloudSea.'+name
      mesh.layers.set(1)
      this.group.add(mesh)
    }
    blendCoast(meshes,this.sea.uniforms)
    this.screen = new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
      uniforms:{base:{value:this.opaque.texture},gas:{value:this.mist.texture}},
      depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 at;void main(){at=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 at;uniform sampler2D base,gas;
        void main(){vec4 fog=texture2D(gas,at);
          gl_FragColor=vec4(texture2D(base,at).rgb*(1.-fog.a)+fog.rgb,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }))
    this.screen.frustumCulled = false
    this.composite.add(this.screen)
  }
  setDetail(level) {
    if (level === this.level) return
    this.level = level
    const {volumes,steps} = tiers[level]
    this.state.steps = steps
    for (const mesh of this.linked) { mesh.removeFromParent(); mesh.material.dispose() }
    this.linked = this.banks.map(([x,y,z,w,h,d,angle,form],i) => {
      const near = priorities.indexOf(i) >= 0 && priorities.indexOf(i) < volumes
      const far = Math.hypot(x,z)>60
      const mesh = near ? vapor(form,this.state,this.box,this.opaque.depthTexture,1.25)
        : sculpture(form,this.state,far || level<2)
      mesh.material.uniforms.air.value = far ? .47 : near ? .035 : .15
      mesh.position.set(x,y,z)
      mesh.rotation.y = angle
      mesh.scale.set(w,h,d)
      mesh.layers.set(1)
      ;(near ? this.gas : this.group).add(mesh)
      return mesh
    })
  }
  setTheme(theme) { this.targetNight = Number(theme === 'night') }
  step(dt,active) {
    const seconds = Math.min(dt,.08)
    if (active) this.state.clock += seconds
    this.state.night = active ? T.MathUtils.damp(this.state.night,this.targetNight,8,seconds) : this.targetNight
  }
  render(renderer,scene,rigCamera) {
    // An orthographic ray has the same projection anywhere along its axis.
    // Pull the near plane behind the foreground deck when the user looks
    // across the horizon or zooms out. Keep bookmarked interior shots intact.
    rigCamera.updateMatrixWorld()
    const camera = this.renderCamera.copy(rigCamera,false)
    const wide = T.MathUtils.smoothstep((camera.top-camera.bottom)/camera.zoom,24,43)
    const horizon = 1-T.MathUtils.smoothstep(rigCamera.matrixWorld.elements[9],.13,.36)
    const retreat = Math.max(wide*horizon,1-T.MathUtils.smoothstep(camera.zoom,.18,.60))
    camera.translateZ(850*retreat)
    this.sea.uniforms.cloudExposure.value = renderer.toneMappingExposure
    camera.updateMatrixWorld()
    const e = camera.matrixWorld.elements, horizontal = Math.hypot(e[8],e[10]) || 1
    const shallow = 1-T.MathUtils.smoothstep(e[9],.045,.25), t = this.state.clock*.045
    this.banks.forEach(([x,y,z,w],i) => {
      const front = T.MathUtils.smoothstep((e[8]*x+e[10]*z)/horizontal,8,48)
      this.linked[i].position.set(x+.085*w*(Math.sin(t*(.47+i%5*.09)+i)-Math.sin(i)),
        y-shallow*front*(Math.max(0,y)+w*.77)+.024*w*Math.sin(t*.7+i*.44),
        z+.035*w*Math.sin(t*.56+i*.61))
    })
    const {width,height} = renderer.domElement
    this.opaque.setSize(width,height)
    const scale = tiers[this.level].scale
    this.state.volumeWidth = Math.max(1,Math.round(width*scale))
    this.state.volumeHeight = Math.max(1,Math.round(height*scale))
    this.mist.setSize(this.state.volumeWidth,this.state.volumeHeight)
    const previous = renderer.getRenderTarget(), reset = renderer.info.autoReset
    const alpha = renderer.getClearAlpha()
    renderer.getClearColor(this.clearColor)
    renderer.info.reset()
    renderer.info.autoReset = false
    try {
      renderer.setRenderTarget(this.opaque)
      renderer.render(scene,camera)
      renderer.setRenderTarget(this.mist)
      renderer.setClearColor(0,0)
      renderer.render(this.gas,camera)
      renderer.setRenderTarget(previous)
      renderer.render(this.composite,camera)
    } finally {
      renderer.setClearColor(this.clearColor,alpha)
      renderer.setRenderTarget(previous)
      renderer.info.autoReset = reset
    }
  }
  dispose() {
    this.group.removeFromParent()
    for (const mesh of this.linked) { mesh.removeFromParent(); mesh.material.dispose() }
    this.linked.length = 0
    for (const mesh of [this.sea.sky,this.sea.deck,this.sea.veil,this.screen]) {
      mesh.removeFromParent(); mesh.material.dispose(); mesh.geometry.dispose()
    }
    for (const form of this.state.forms) { form.skin.dispose(); form.low.dispose(); form.volume.dispose() }
    this.state.forms.length = 0
    this.box.dispose(); this.sea.dispose(); this.opaque.dispose(); this.mist.dispose()
  }
}
