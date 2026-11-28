import {
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  NearestFilter,
  OrthographicCamera,
  RGBADepthPacking,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type MeshStandardMaterial,
  type Scene,
  type WebGLRenderer,
} from 'three'

// Store light-space depth as RGBA. Sampling the colour texture directly avoids
// a Metal driver failure involving nested sampler arguments in Three's PCF shader.
const vertex = 'varying vec4 cvLightPosition; uniform mat4 cvLightMatrix;'
const fragment = `
 uniform sampler2D cvShadowMap;
 uniform sampler2D cvStreetMap;
 uniform float cvShadowOn;
 varying vec4 cvLightPosition;
 float cvShade(){
  if(cvShadowOn<0.5)return 0.0;
  vec3 q=cvLightPosition.xyz/cvLightPosition.w*0.5+0.5;
  if(any(lessThan(q,vec3(0.0)))||any(greaterThan(q,vec3(1.0))))return 0.0;
  float amount=0.0;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    vec4 packedDepth=texture2D(cvShadowMap,q.xy+vec2(float(x),float(y))*(1.72/2048.0));
    float depth=min(unpackRGBAToDepth(packedDepth),unpackRGBAToDepth(texture2D(cvStreetMap,q.xy+vec2(float(x),float(y))*(1.72/2048.0))));
    amount+=step(depth+0.00075,q.z);
  }
  return amount/9.0;
 }`
export class TownShadows {
  calls = 0
  triangles = 0
  enabled = true
  dirty = true
  private target = new WebGLRenderTarget(2048, 2048, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  })
  private streets = this.target.clone()
  streetBakes = 0
  private depth = new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
    side: DoubleSide,
  })
  private camera = new OrthographicCamera(-32, 32, 24, -24, 0.1, 85)
  private matrix = new Matrix4()
  private uniforms = {
    cvLightMatrix: { value: this.matrix },
    cvStreetMap: { value: this.streets.texture },
    cvShadowMap: { value: this.target.texture },
    cvShadowOn: { value: 1 },
  }
  private excluded: Mesh[] = []
  ground = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: this.uniforms,
    vertexShader:
      vertex +
      'void main(){cvLightPosition=cvLightMatrix*modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      '#include <packing>\n' +
      fragment +
      'void main(){gl_FragColor=vec4(0.19,0.23,0.18,cvShade()*0.24);\n#include <colorspace_fragment>\n}',
  })
  constructor() {
    this.camera.position.set(-18, 30, 20)
    this.camera.lookAt(new Vector3())
    this.camera.updateMatrixWorld()
    this.matrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    )
  }
  attach(meshes: Mesh[]) {
    const materials = new Set<MeshStandardMaterial>()
    for (const mesh of meshes) {
      const list = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      // Only articulated parts need recurring depth draws. Moving walls carry their windows.
      let moving = false
      for (let p: import('three').Object3D | null = mesh; p; p = p.parent) {
        const id = p.userData.codeville_id
        if (typeof id === 'string' && /^(VAN\.|ENV\.Control\.Orbit|NX\.Array\.Dish|ST\.Move\.|FO\.(Roller|Joint|Move)\.)/.test(id)) {
          moving = true
          break
        }
      }
      if (!moving) mesh.layers.set(2)
      if (list.every((m) => m.transparent)) this.excluded.push(mesh)
      for (const m of list)
        if ((m as MeshStandardMaterial).isMeshStandardMaterial)
          materials.add(m as MeshStandardMaterial)
    }
    for (const m of materials) {
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.uniforms)
        shader.vertexShader =
          vertex +
          '\n' +
          shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\ncvLightPosition=cvLightMatrix*modelMatrix*vec4(transformed,1.0);',
          )
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <packing>', '#include <packing>\n' + fragment)
          .replace(
            '#include <lights_fragment_end>',
            '#include <lights_fragment_end>\nfloat cvOccluded=cvShade();reflectedLight.directDiffuse*=1.0-cvOccluded*0.72;reflectedLight.directSpecular*=1.0-cvOccluded*0.72;reflectedLight.indirectDiffuse*=1.0-cvOccluded*0.20;',
          )
        // Lift the grazing-angle reflection of the exported clearcoat glass without changing its centre opacity.
        if (m.name === 'MAT.clear')
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            'float cvRim=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),3.0);diffuseColor.a=min(0.65,diffuseColor.a+cvRim*0.46);outgoingLight=mix(outgoingLight,vec3(0.68,0.89,0.91),cvRim*0.8);\n#include <opaque_fragment>',
          )
      }
      m.customProgramCacheKey = () =>
        m.name === 'MAT.clear' ? 'codeville-glass-1' : 'codeville-shadow-1'
      m.needsUpdate = true
    }
  }
  render(renderer: WebGLRenderer, scene: Scene, floor: Mesh) {
    this.uniforms.cvShadowOn.value = this.enabled ? 1 : 0
    this.calls = 0
    this.triangles = 0
    floor.visible = this.enabled
    if (!this.enabled || !this.dirty) return
    const background = scene.background,
      override = scene.overrideMaterial,
      previous = renderer.getRenderTarget()
    const visible = this.excluded.filter((m) => m.visible)
    try {
      for (const m of visible) m.visible = false
      floor.visible = false
      scene.background = new Color(0xffffff)
      scene.overrideMaterial = this.depth
      if (this.streetBakes === 0) {
        this.camera.layers.set(2)
        renderer.setRenderTarget(this.streets)
        renderer.render(scene, this.camera)
        this.streetBakes++
      }
      this.camera.layers.set(0)
      renderer.setRenderTarget(this.target)
      renderer.render(scene, this.camera)
      this.calls = renderer.info.render.calls
      this.triangles = renderer.info.render.triangles
      this.dirty = false
    } finally {
      this.camera.layers.set(0)
      renderer.setRenderTarget(previous)
      scene.background = background
      scene.overrideMaterial = override
      floor.visible = true
      for (const m of visible) m.visible = true
    }
  }
  dispose() {
    this.depth.dispose()
    this.ground.dispose()
    this.streets.dispose()
    this.target.dispose()
  }
}
