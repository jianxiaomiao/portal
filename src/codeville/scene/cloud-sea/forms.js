import * as T from 'three'
import { deckField } from './deck.js'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'

// Each entry is an ellipsoid in a local 2 × 2 × 2 box. The broad base, vertical
// updraft and side lobes are asymmetric in all three axes.
// Positions and radii describe a buoyant crown, secondary turrets and a flatter
// base. Off-axis lobes make the same silhouette different from its reverse.
const profiles = [
  [[-.12,-.20,0,.69,.29,.56],[-.52,-.04,.12,.33,.29,.34],[-.18,.10,-.10,.39,.36,.40],
   [.18,.04,.16,.31,.32,.36],[.49,-.12,-.03,.34,.23,.32],[.72,-.20,.07,.17,.15,.19],[-.41,-.03,-.29,.28,.27,.24]],
  [[-.07,-.29,.01,.56,.36,.49],[-.32,-.04,.13,.34,.34,.36],[.18,-.03,-.14,.38,.49,.39],
   [-.11,.30,-.05,.36,.40,.38],[-.19,.54,-.12,.27,.28,.29],[.08,.42,.14,.23,.26,.27],
   [.33,.08,.15,.23,.30,.24],[-.24,.12,.32,.23,.26,.21],[-.05,-.17,-.32,.37,.26,.24]],
  [[-.09,-.27,.04,.75,.28,.46],[-.50,.02,.15,.29,.39,.32],[-.47,.23,.12,.20,.26,.23],
   [-.06,.07,-.12,.32,.42,.34],[-.01,.40,-.16,.27,.32,.28],[.40,.07,.07,.31,.37,.34],
   [.50,.23,.04,.22,.24,.24],[.15,-.10,.30,.29,.30,.23],[-.32,-.11,-.33,.27,.29,.22]],
  [[-.06,-.13,.03,.72,.48,.64],[-.49,-.12,.15,.32,.37,.40],[-.24,.17,-.21,.43,.35,.40],
   [.15,.18,.13,.38,.31,.39],[.46,-.12,-.13,.35,.37,.39],[.04,-.28,.34,.36,.29,.29],[-.37,.06,.30,.24,.24,.25]],

]
// Rounded side turrets project in depth, so backlighting separates the ridges.
profiles[0].push([-.53,.12,.22,.22,.19,.21],[.06,.18,.23,.20,.22,.24],[.35,.01,.31,.21,.19,.19])
profiles[1].push([-.53,-.02,.06,.265,.30,.29],[.46,.01,.08,.25,.26,.27],[.14,.42,-.15,.23,.32,.25],[.06,.20,.34,.25,.23,.20],[-.39,.13,.18,.22,.25,.23],[-.21,.34,.26,.25,.23,.21],[.17,.22,.25,.21,.23,.21],[-.13,.56,.04,.19,.21,.23])
profiles[2].push([-.43,.09,.29,.20,.22,.22],[.03,.24,.12,.21,.23,.19],[.25,.06,.29,.26,.23,.21])
profiles[3].push([-.43,.18,.19,.28,.22,.25],[.22,.18,-.21,.30,.27,.30])
const N = 56
// Seeded 3-D value noise, sampled only during volume construction.
const side=32, lattice=new Float32Array(side**3)
let seed=3029
for(let i=0;i<lattice.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0
  lattice[i]=seed/4294967296-.5
}
function noise3(x,y,z){
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z)
  x-=a;y-=b;z-=c;x=x*x*(3-2*x);y=y*y*(3-2*y);z=z*z*(3-2*z)
  const at=(i,j,k)=>lattice[((i&31)+32*((j&31)+32*(k&31)))]
  const lerp=(u,v,s)=>u+(v-u)*s
  const row=(j,k)=>lerp(at(a,j,k),at(a+1,j,k),x)
  return lerp(lerp(row(b,c),row(b+1,c),y),lerp(row(b,c+1),row(b+1,c+1),y),z)
}
function field(x,y,z,form) {
  // Domain warp gently folds the joined surfaces. Suppress ridges on the flat underside.
  const px=x+.042*Math.sin(6.8*y+3.1*z+form)*Math.sin(4.7*z-x)
  const py=y+.039*Math.sin(6*x+1.6*z)*Math.cos(5*z+form)
  const pz=z+.040*Math.sin(4.1*x+3*y+form)*Math.cos(5*y)
  let d=2
  for (const [cx,cy,cz,a,b,c] of profiles[form]) {
    const r=(Math.sqrt(((px-cx)/a)**2+((py-cy)/b)**2+((pz-cz)/c)**2)-1)*Math.min(a,b,c)
    const blend=Math.max(.076-Math.abs(d-r),0)
    d=Math.min(d,r)-blend*blend/.304
  }
  const folds=Math.sin(px*16+py*6)*Math.sin(py*14-pz*6)*Math.cos(pz*13+px*3)
  return d+.0025*folds+.040*noise3(px*4.0+form*3.3,py*4.1+1.2,pz*4.3)
}
function makeForm(form) {
  const mc=new MarchingCubes(N,undefined,false,false,32000)
  const data=new Uint8Array(N**3*4)
  for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const index=i+N*(j+N*k)
    mc.field[index]=-field(2*i/N-1,2*j/N-1,2*k/N-1,form)
  }
  for(let i=0;i<data.length;i+=4)data[i]=255
  for(let k=1;k<N-1;k++)for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){
    const index=i+N*(j+N*k), f=mc.field
    const nx=f[index-1]-f[index+1],ny=f[index-N]-f[index+N],nz=f[index-N*N]-f[index+N*N]
    const len=Math.hypot(nx,ny,nz)||1
    data[4*index]=Math.round(255*T.MathUtils.clamp(.5-f[index],0,1))
    data[4*index+1]=Math.round(127.5*(1+nx/len))
    data[4*index+2]=Math.round(127.5*(1+ny/len))
    data[4*index+3]=Math.round(127.5*(1+nz/len))
  }
  const volume=new T.Data3DTexture(data,N,N,N)
  volume.format=T.RGBAFormat
  volume.minFilter=volume.magFilter=T.LinearFilter
  volume.unpackAlignment=1
  volume.needsUpdate=true
  function shell(isolation, surface=mc){
    surface.isolation=isolation
    surface.update()
    const g=new T.BufferGeometry()
    for(const key of ['position','normal']){
      const a=surface.geometry.getAttribute(key)
      g.setAttribute(key,new T.BufferAttribute(a.array.slice(0,surface.count*3),3))
    }
    g.computeBoundingSphere()
    return g
  }
  const coarse=new MarchingCubes(N/2,undefined,false,false,6500)
  for(let z=0;z<N/2;z++)for(let y=0;y<N/2;y++)for(let x=0;x<N/2;x++)
    coarse.field[x+N/2*(y+N/2*z)]=mc.field[2*x+N*(2*y+N*2*z)]
  const skin=shell(.001),low=shell(.001,coarse)
  coarse.geometry.dispose();coarse.material?.dispose()
  mc.geometry.dispose()
  mc.material?.dispose()
  return {volume,skin,low}
}
export function createForms(){ return profiles.map((_,i)=>makeForm(i)) }
const lighting=`
  uniform highp sampler3D density;
  uniform vec3 sunLocal, sunView;
  uniform float air;
  uniform mat4 localToWorld;
  vec3 coord(vec3 p){return p*.5 + vec3(.5+.5/56.);}
  vec3 paint(float direct,float sky,float transmission){
    vec3 shade=mix(vec3(.47,.59,.705),vec3(.13,.22,.355),night);
    vec3 middle=mix(vec3(.78,.825,.85),vec3(.31,.425,.57),night);
    vec3 top=mix(vec3(.985,.955,.878),vec3(.64,.74,.83),night);
    float key=clamp(.17+.41*direct+.245*sky+.245*transmission,0.,1.);
    vec3 tint=mix(shade,middle,smoothstep(-.10,.69,key));
    tint=mix(tint,top,smoothstep(.49,.97,key));
    tint=mix(tint,top,.19);
    tint+=night*(sky-.46)*vec3(.024,.016,.010);
    vec3 distant=mix(vec3(.79,.84,.86),vec3(.22,.33,.46),night);
    return pow(mix(tint,distant,air),vec3(2.2));
  }
  float depthAt(vec3 p){return texture(density,coord(p)).r-.5;}
  float shadowAt(vec3 p){
    float mass=0.;
    for(int j=1;j<=4;j++){
      float dist=(float(j)*float(j)+1.)*.034;
      mass+=smoothstep(-.065,.045,-depthAt(p+sunLocal*dist))*(.55+.15*float(j));
    }
    return exp(-mass*.75);
  }
  vec3 shoreBlend(vec3 color,vec3 world){

    vec4 bank=deckAt(world.xz);
    float above=world.y-crest(world.xz,bank);
    return mix(cloudColor(world.xz,bank),cloudRadiance(color),smoothstep(-.25,2.65,above));
  }
`
const vertex=`
  varying vec3 p;
  void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`

const uniforms=(form,env)=>({...env.seaUniforms,
  density:{value:env.forms[form].volume},sunLocal:{value:new T.Vector3()},sunView:{value:new T.Vector3()},
  localToWorld:{value:new T.Matrix4()}, air:{value:0}, ray:{value:new T.Vector3()},
})
const inverse=new T.Matrix4(),direction=new T.Vector3(),linear=new T.Matrix3()
function bind(mesh,env) {
  mesh.onBeforeRender=(_,__,cam)=>{
    const u=mesh.material.uniforms
    inverse.copy(mesh.matrixWorld).invert()
    linear.setFromMatrix4(inverse)
    u.ray.value.copy(cam.getWorldDirection(direction)).applyMatrix3(linear)
    u.sunLocal.value.copy(env.sunlight).transformDirection(inverse)
    u.sunView.value.copy(env.sunlight).transformDirection(cam.matrixWorldInverse)
    u.localToWorld.value.copy(mesh.matrixWorld);u.night.value=env.night
  }
  return mesh
}
export function sculpture(form,env,low=false) {
  const material=new T.ShaderMaterial({
    uniforms:uniforms(form,env),transparent:true,depthWrite:true,
    vertexShader:'varying vec3 objectNormal;\n'+vertex.replace('p=position;','p=position;objectNormal=normal;'),
    fragmentShader:deckField+lighting+`
      varying vec3 p,objectNormal;
      uniform vec3 ray;
      uniform mat3 normalMatrix;
      void main(){
        vec3 n=normalize(normalMatrix*objectNormal);
        float light=shadowAt(p);
        float direct=dot(n,sunView)*.73+.24+.17*light;
        float feather=smoothstep(.0,.23,abs(dot(n,vec3(0,0,1))));
        vec3 color=paint(direct,clamp(.52+p.y*.83,0.,1.),light);
        gl_FragColor=vec4(shoreBlend(color,(localToWorld*vec4(p,1.)).xyz),.74+.26*feather);
        #include <colorspace_fragment>
      }`,
  })
  return bind(new T.Mesh(low?env.forms[form].low:env.forms[form].skin,material),env)
}
export function vapor(form,env,box,depth,opacity=1) {
  const u=Object.assign(uniforms(form,env),{
    opaqueDepth:{value:depth}, targetSize:{value:new T.Vector2()}, clipSpan:{value:1},
    steps:{value:24}, strength:{value:opacity},
  })
  const material=new T.ShaderMaterial({
    uniforms:u,vertexShader:vertex,transparent:true,depthTest:false,depthWrite:false,
    blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
    fragmentShader:deckField+lighting+`
      varying vec3 p;
      uniform sampler2D opaqueDepth;
      uniform mat3 normalMatrix;
      uniform vec3 ray;
      uniform vec2 targetSize;
      uniform float clipSpan,strength;
      uniform int steps;
      void main(){
        vec3 rd=normalize(ray);
        vec3 nonzero=mix(vec3(.00001),rd,greaterThan(abs(rd),vec3(.00001)));
        vec3 exitDistance=(sign(nonzero)-p)/nonzero;
        float end=min(exitDistance.x,min(exitDistance.y,exitDistance.z));
        float back=texture2D(opaqueDepth,gl_FragCoord.xy/targetSize).r;
        end=min(end,(back-gl_FragCoord.z)*clipSpan*length(ray));
        if(end<=.001)discard;
        float travel=0.,transmission=1.;
        vec3 sum=vec3(0.),weightedPos=vec3(0.);
        for(int i=0;i<40;i++){
          if(i>=steps||travel>=end||transmission<.012)break;
          vec3 pos=p+rd*travel;
          vec4 voxel=texture(density,coord(pos));
          float sd=voxel.r-.5;
          float increment=min(end-travel,clamp(sd*.87,.027,.39));
          if(sd<.052){
            float rho=smoothstep(-.050,.046,-sd);
            vec3 norm=normalize(normalMatrix*(voxel.gba*2.-1.)+vec3(.00001));
            float light=shadowAt(pos);
            float direct=.24+.73*dot(norm,sunView)+.17*light;
            float alpha=1.-exp(-rho*increment*51.*strength);
            float weight=transmission*alpha;
            sum+=weight*paint(direct,clamp(.52+pos.y*.83,0.,1.),light);
            weightedPos+=weight*pos;
            transmission*=1.-alpha;
          }
          travel+=increment;
        }
        if(transmission<.998){
          float opacity=1.-transmission;
          sum=opacity*shoreBlend(sum/opacity,(localToWorld*vec4(weightedPos/opacity,1.)).xyz);
        }
        if(transmission>.998)discard;
        gl_FragColor=vec4(sum,1.-transmission);
      }`,
  })
  const mesh=bind(new T.Mesh(box,material),env), common=mesh.onBeforeRender
  mesh.onBeforeRender=(renderer,scene,camera)=>{
    common(renderer,scene,camera)
    u.targetSize.value.set(env.volumeWidth,env.volumeHeight)
    u.clipSpan.value=camera.far-camera.near
    u.steps.value=env.steps
  }
  return mesh
}
