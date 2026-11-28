import { BufferGeometry, Color, DodecahedronGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// The exporter batches the canal, banks, benches and bridge into one indexed
// mesh. Separate only the four jade surface triangles; the masonry stays opaque.
export function prepareWaterway(meshes: Mesh[], time: {value: number}, night: {value: number}) {
  const quay = meshes.find(m => m.name.includes('DistrictQuayEN'))
  if (!quay) return
  const geometry = quay.geometry, index = geometry.index
  const pos = geometry.getAttribute('position'), color = geometry.getAttribute('color')
  if (!index || !color) return
  const skin: number[] = [], land: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [index.getX(i), index.getX(i+1), index.getX(i+2)]
    const surface = vertices.every(v => Math.abs(pos.getY(v)+.22)<.018 &&
      Math.abs(color.getX(v)-.227)<.012 && Math.abs(color.getZ(v)-.352)<.012)
    if (surface) {
      for (const v of vertices) skin.push(pos.getX(v), pos.getY(v), pos.getZ(v))
    } else land.push(...vertices)
  }
  if (!skin.length) return
  geometry.setIndex(land)
  const patch = new BufferGeometry()
  patch.setAttribute('position', new Float32BufferAttribute(skin,3))
  patch.computeVertexNormals()
  const water = new Mesh(patch, new MeshStandardMaterial({
    color: new Color('#48b6af'), transparent: true, opacity: .40, depthWrite: false,
    roughness: .28, metalness: .05,
  }))
  water.material.onBeforeCompile = shader => {
    shader.uniforms.waterTime = time
    shader.uniforms.waterNight = night
    shader.vertexShader = 'varying vec2 channel;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nchannel=position.xz;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec2 slope=vec2(.070*cos(1.9*channel.x+.78*channel.y+waterTime*.39),
        .065*cos(3.1*channel.y+.76*sin(channel.x*1.5)-waterTime*.54));
      normal=normalize(normal+mat3(viewMatrix)*vec3(slope.x,0.,slope.y));`)
    shader.fragmentShader = 'varying vec2 channel; uniform float waterTime,waterNight;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
      float crest=pow(.5+.5*sin(channel.y*7.3+.96*sin(channel.x*2.7+waterTime*.26)+waterTime*.48),14.);
      float glintMask=.5+.5*sin(1.8*channel.y-2.*channel.x+waterTime*.17);
      float grazing=pow(1.-clamp(abs(normal.z),0.,1.),3.);
      float depth=smoothstep(.05,2.15,min(abs(channel.x+18.),abs(channel.x+24.)));
      diffuseColor.a=clamp(.22+.24*depth+.39*grazing,.22,.85);
      outgoingLight+=grazing*mix(vec3(.44,.62,.67),vec3(.07,.15,.22),waterNight);
      outgoingLight+=crest*glintMask*mix(vec3(.045,.074,.072),vec3(.018,.032,.046),waterNight);
      #include <opaque_fragment>`)
  }
  water.name = 'Quay.Water'
  water.layers.set(1)
  const bed = new Mesh(patch,new MeshStandardMaterial({color: '#d6d6ad', roughness: .95}))
  bed.name = 'Quay.Riverbed'
  bed.layers.set(2)
  bed.position.y = -.35
  bed.material.onBeforeCompile = shader => {
    shader.uniforms.waterTime = time
    shader.uniforms.waterNight = night
    shader.vertexShader = 'varying vec2 sediment;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nsediment=position.xz;')
    shader.fragmentShader = 'uniform float waterTime,waterNight; varying vec2 sediment;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float bank=smoothstep(.1,2.6,min(abs(sediment.x+18.),abs(sediment.x+24.)));
      float sand=.5+.5*sin(5.*sediment.x+.65*sin(2.*sediment.y)+.8*sediment.y);
      diffuseColor.rgb*=mix(vec3(1.07,1.03,.94),vec3(.16,.66,.61),bank)*(.90+.10*sand);
      vec2 q=sediment*vec2(4.2,5.1)+.17*vec2(sin(waterTime*.42),cos(waterTime*.53));
      q+=.67*sin(q.yx*.74+waterTime*.19);
      float focus=abs(sin(q.x+.8*sin(q.y))-cos(q.y+.55*sin(q.x*.9)));
      float caustic=(1.-smoothstep(.025,.16+fwidth(focus),focus))*(.52+.32*sin(1.41*sediment.x+1.03*sediment.y));
      diffuseColor.rgb+=caustic*mix(vec3(.13,.17,.12),vec3(.014,.032,.036),waterNight);`)
  }
  // Low submerged gravel breaks up the bed and gives the moving highlights
  // a stationary depth cue. Bake the handful of stones into one static draw.
  const pebbles: DodecahedronGeometry[] = []
  const clusters = [[-19.1,-8.2],[-22.8,-4.6],[-19.0,3.2],[-21.9,9.4],[-20.2,-11.8]]
  for (const [i,[x,z]] of clusters.entries()) {
    for (let j=0; j<4; j++) {
      const phase=i*2.7+j*2.39, size=.12+.055*((i+j)%4)
      const stone=new DodecahedronGeometry(1)
      stone.scale(size*1.36,size*.56,size)
      stone.rotateY(phase)
      stone.translate(x+Math.cos(phase)*j*.20,-.53,z+Math.sin(phase)*j*.25)
      pebbles.push(stone)
    }
  }
  const gravel = new Mesh(mergeGeometries(pebbles),new MeshStandardMaterial({color:'#72948b',roughness:.95}))
  for (const stone of pebbles) stone.dispose()
  gravel.layers.set(2)
  gravel.name = 'Quay.SubmergedGravel'
  quay.add(bed,gravel,water)
}
