import { Color, type HemisphereLight, type DirectionalLight, type Scene, type MeshStandardMaterial, type WebGLRenderer } from 'three'
import type { Registry } from './model'
export type Theme = 'day' | 'night'

// These uniforms belong to one loaded town. Both themes share the compiled programs.
export class Atmosphere {
  readonly night = { value: 0 }
  readonly time = { value: 0 }
  theme: Theme = 'day'
  constructor(private scene: Scene, private sky: HemisphereLight, private sun: DirectionalLight,
    private renderer: WebGLRenderer) {}

  apply(theme: Theme) {
    this.theme = theme
    const night = theme === 'night'
    this.night.value = night ? 1 : 0
    const background = this.scene.background as Color
    background.set(night ? '#192b3c' : '#e9e7dc')
    this.sky.color.set(night ? '#a9c3ee' : '#fffbef')
    this.sky.groundColor.set(night ? '#596d7a' : '#9b9883')
    this.sky.intensity = night ? .50 : .82
    this.sun.color.set(night ? '#bad2ff' : '#ffedcf')
    this.sun.intensity = night ? .52 : 2.85
    this.scene.environmentIntensity = night ? .10 : .34
    this.renderer.toneMappingExposure = night ? .81 : .91
  }

  finish(index: Registry) {
    const materials = new Set<MeshStandardMaterial>()
    for (const mesh of index.surfaces)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        if ('isMeshStandardMaterial' in material) materials.add(material as MeshStandardMaterial)
    const roughness: Record<string,number> = {
      'MAT.wood':.69,'MAT.walnut':.57,'MAT.chalk':.84,'MAT.road':.94,
      'MAT.zinc':.32,'MAT.glass':.24,'MAT.paleglass':.28
    }
    for (const material of materials) {
      if (roughness[material.name]) material.roughness = roughness[material.name]
      const garden = material.name === 'Garden • painted enamel and foliage'
      const pane = ['MAT.glass','MAT.paleglass','MAT.clear','MAT.windowlit'].includes(material.name)
      // MotionDirector owns emissive intensities on racks, scan gates and plaza rings.
      if (!garden && !pane && !['MAT.wood','MAT.walnut','MAT.chalk','MAT.lamp','MAT.steel','MAT.paper','MAT.pavement','MAT.brass','MAT.post','MAT.zinc'].includes(material.name)) continue
      const base = material.onBeforeCompile
      const key = material.customProgramCacheKey()
      const { night, time } = this
      material.customProgramCacheKey = () => key + '-atmosphere-' + (garden?'garden':pane?'pane':'surface')
      material.onBeforeCompile = function(shader,renderer) {
        base.call(this,shader,renderer)
        Object.assign(shader.uniforms,{cvNight:night,cvTime:time})
        shader.vertexShader = 'varying vec3 cvWorld; uniform float cvTime;\n' + shader.vertexShader.replace('#include <project_vertex>', `
          cvWorld=(modelMatrix*vec4(transformed,1.)).xyz;
          ${garden ? `if(cvWorld.x < -15. && cvWorld.y > 1.1 && color.g > 1.12*color.r && color.g > 1.45*color.b) {
            transformed.x+=.022*smoothstep(1.1,3.1,cvWorld.y)*sin(cvTime*.81+cvWorld.z*.72);
          }` : ''}
          #include <project_vertex>`)
        shader.fragmentShader = 'varying vec3 cvWorld; uniform float cvNight; uniform float cvTime;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
          ${garden ? `
            if(cvWorld.x < -18. && cvWorld.x > -24.1 && abs(cvWorld.y+.22)<.016) {
              float streak=pow(.5+.5*sin(cvWorld.z*9.+1.4*sin(cvWorld.x*3.+cvTime*.36)+cvTime*.65),15.);
              streak*=smoothstep(-.16,.83,sin(cvWorld.z*2.4-cvWorld.x*2.+cvTime*.22))*.60;
              outgoingLight=mix(outgoingLight,vec3(.04,.16,.16),.20)+vec3(.032,.063,.066)*streak;
              float reflection=exp(-.6*abs(cvWorld.z+7.14)-.28*abs(cvWorld.x+18.54));
              outgoingLight+=cvNight*streak*reflection*vec3(.55,.26,.066);
            }
            if(cvNight>.5) {
            if(cvWorld.z < -17.9 && cvWorld.z > -18.3 && cvWorld.y>.78 && cvWorld.y<1.61 && distance(vColor.rgb,vec3(.133,.205,.202))<.013){
              float lit=.55+.35*cos(floor(cvWorld.x*1.1)*2.);
              outgoingLight+=cvNight*lit*vec3(1.1,.55,.17);
            }
            if(cvWorld.y>1.84 && cvWorld.y<2.26 && distance(vColor.rgb,vec3(.776,.578,.283))<.018)
              outgoingLight+=cvNight*vec3(1.35,.71,.24);
            float pool=exp(-.70*distance(cvWorld.xz,vec2(24.72,-3.46)))+exp(-.70*distance(cvWorld.xz,vec2(24.34,2.64)))+
              exp(-1.1*distance(cvWorld.xz,vec2(-18.54,-7.14)))+exp(-1.1*distance(cvWorld.xz,vec2(21.86,5.90)))+
              exp(-1.1*distance(cvWorld.xz,vec2(5.07,-17.02)));
            outgoingLight+=pool*diffuseColor.rgb*vec3(.95,.45,.14);
            }
          ` : `
            // The interior pools follow actual studio, post office and workshop locations.
            if(cvNight>.5) {
            float interior=exp(-.24*dot(cvWorld.xz-vec2(11.3,5.7),cvWorld.xz-vec2(11.3,5.7)))+
              exp(-.18*dot(cvWorld.xz-vec2(10.5,-6.4),cvWorld.xz-vec2(10.5,-6.4)))+
              exp(-.31*dot(cvWorld.xz-vec2(-10.6,7.45),cvWorld.xz-vec2(-10.6,7.45)));
            outgoingLight+=cvNight*interior*diffuseColor.rgb*vec3(1.08,.49,.15);
            if(cvWorld.y>5.85 && distance(cvWorld.xz,vec2(-13.42,4.75))<.25)
              outgoingLight+=cvNight*vec3(.12,.54,.65);
            ${pane ? `if(abs(cvWorld.x)>5. && abs(cvWorld.x)<18. && cvWorld.y>.75 && cvWorld.y<5.) {
              outgoingLight+=cvNight*mix(vec3(.96,.49,.17),vec3(.32,.20,.09),smoothstep(3.35,4.8,cvWorld.y));
              diffuseColor.a=mix(diffuseColor.a,max(diffuseColor.a,.46),cvNight);
            }` : ''}
            }
          `}
          #include <opaque_fragment>`)
      }
      material.needsUpdate = true
    }
  }

  step(seconds: number, active: boolean) {
    if(active) this.time.value += Math.min(seconds,.06)
  }
}
