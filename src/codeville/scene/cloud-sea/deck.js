import * as T from 'three'
import {shoreDistance} from './shore.js'

// Periodic relief, in metres. Each wind-row owns a few broad updrafts and
// smaller shoulders. Bake once; every view samples the same landscape.
const side=512, span=544
function bakeRelief(){
  const height=new Float32Array(side*side),rgba=new Uint8Array(side*side*4)
  let seed=7983
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
  const sample=(x,z)=>height[(x&511)+side*(z&511)]
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
    const x=i*2*Math.PI/side,z=j*2*Math.PI/side
    height[i+side*j]=-7+.9*Math.sin(x*3+z)+1.25*Math.cos(z*3-x*2+.7*Math.sin(x))
  }
  function mound(x,z,rx,rz,h,floor,angle){
    const c=Math.cos(angle),s=Math.sin(angle),r=Math.ceil(Math.max(rx,rz))+1
    for(let j=Math.floor(z-r);j<=z+r;j++)for(let i=Math.floor(x-r);i<=x+r;i++){
      const dx=i-x,dz=j-z,a=(dx*c+dz*s)/rx,b=(dz*c-dx*s)/rz
      const rr=a*a+b*b
      if(rr>=1)continue
      const crown=floor+h*Math.pow(1-rr,.59),k=(i&511)+side*(j&511)
      const feather=Math.max(0,1.9-Math.abs(height[k]-crown))
      height[k]=Math.max(height[k],crown)+feather*feather/7.6
    }
  }
  for(let n=0;n<225;n++){
    const x=random()*side,z=random()*side
    const lane=.5+.5*Math.sin((z*3+x)*2*Math.PI/side+1.8*Math.sin(x*4*Math.PI/side))
    const r=9+random()*16+lane*8,h=4+r*(.27+.16*random()),floor=-9+2*lane
    const angle=-.29+.65*(random()-.5)
    mound(x,z,r*1.44,r,h,floor,angle)
    for(let k=0;k<8;k++){
      const dx=(random()-.5)*r*1.7,dz=(random()-.5)*r*1.15
      const child=r*(.23+.39*random())
      mound(x+dx,z+dz,child*1.13,child,h*(.38+.36*random()),floor+h*.38,angle+.7*random())
    }
  }
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
    const id=side*j+i,h=height[id],dx=(sample(i+1,j)-sample(i-1,j))*.5,dz=(sample(i,j+1)-sample(i,j-1))*.5
    let blocking=0
    for(const r of [3,7,14,26]){
      const rise=sample(i-Math.round(r*.67),j+Math.round(r*.74))-h
      blocking=Math.max(blocking,rise/r)
    }
    rgba[4*id]=Math.round(T.MathUtils.clamp((h+10)/32,0,1)*255)
    rgba[4*id+1]=Math.round((.5+.5*dx/Math.hypot(dx,1))*255)
    rgba[4*id+2]=Math.round((.5+.5*dz/Math.hypot(dz,1))*255)
    rgba[4*id+3]=Math.round(255*(1-T.MathUtils.clamp(blocking*.85,0,.9)))
  }
  const tex=new T.DataTexture(rgba,side,side)
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter
  tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true
  return tex
}
export const deckField=`
uniform sampler2D relief,coast;
uniform float t,night,angleFade,cloudExposure;
// C3 colors were authored in display-linear space. Lift them into scene
// radiance before the host applies ACES once to the full frame.
vec3 cloudRadiance(vec3 rgb){
  const mat3 inputMat=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777);
  const mat3 outputMat=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);
  vec3 y=clamp(inverse(outputMat)*rgb,0.,.97);
  vec3 a=1.-.983729*y,b=.0245786-.432951*y,c=-.000090537-.238081*y;
  return max(vec3(0.),inverse(inputMat)*((-b+sqrt(b*b-4.*a*c))/(2.*a)))*(.6/cloudExposure);
}
const float strata=.83;
uniform vec2 heading;
float distanceToTown(vec2 p){
  vec2 excess=max(abs(p)-35.,0.);
  return (texture2D(coast,p/72.+.5).r-.5)*16.+length(excess);
}
vec4 deckAt(vec2 p){
  vec2 coord=(p+vec2(-12.8,43.5)+vec2(.059,-.025)*t)/544.;
  coord+=.009*vec2(sin(p.y*.028+p.x*.009),sin(p.x*.033));
  coord+=smoothstep(58.,310.,length(p))*.038*vec2(sin(p.y*.011+p.x*.005),sin(p.x*.008-p.y*.006));
  coord=coord*.82+vec2(-.09,.15);
  vec4 large=texture2D(relief,coord);
  vec4 small=texture2D(relief,vec2(.94*coord.x+.34*coord.y,-.34*coord.x+.94*coord.y)*2.83+vec2(.57,.27));
  float detail=(1.-.76*smoothstep(55.,250.,length(p)))*mix(.45,1.,smoothstep(.5,1.,strata));
  return vec4(large.r+.22*detail*(small.r-.37),mix(large.gb,small.gb,.35*detail),mix(large.a,small.a,.26*detail));
}
float inlet(vec2 p){return .5+.5*sin(.19*p.x+.6*sin(.18*p.y)+.105*p.y);}
float crest(vec2 p,vec4 bank){
  float d=distanceToTown(p);
  float moist=inlet(p);
  float reliefY=(-10.+bank.r*32.)*strata-1.7;
  // Lower the whole deck beneath the island; an uneven lip meets the actual
  // coast before the far banks are allowed to rise.
  float shelf=.22+.56*moist+.13*sin(p.x*.43+p.y*.27);
  float y=mix(-2.4,shelf,smoothstep(-2.55+.80*moist,-.30+.26*moist,d));
  float outside=smoothstep(.5,15.+9.*moist,d);
  float foreground=smoothstep(8.,43.,dot(p,heading))*angleFade;
  return mix(y,mix(reliefY,min(reliefY,-2.4+.76*sin(p.y*.051+p.x*.027)+.42*sin(p.x*.097-p.y*.034)),foreground),outside);
}
vec3 cloudColor(vec2 p,vec4 a){
  vec2 slopes=(2.*a.gb-1.)*mix(.42,1.,smoothstep(.48,1.,strata));
  vec3 n=normalize(vec3(-slopes.x,1.,-slopes.y)*vec3(2.2,1.,2.2));
  float beam=dot(n,normalize(vec3(-.59,.86,.62)));
  float k=clamp(.23+.36*beam+.23*a.a+.29*(a.r-.28),0.,1.);
  vec3 cool=mix(vec3(.50,.645,.745),vec3(.09,.16,.27),night);
  vec3 middle=mix(vec3(.79,.835,.855),vec3(.24,.34,.485),night);
  vec3 lit=mix(vec3(.984,.947,.843),vec3(.51,.63,.735),night);
  vec3 rgb=mix(cool,middle,smoothstep(.12,.73,k));
  rgb=mix(rgb,lit,smoothstep(.57,.97,k));
  float depth=length(p);
  rgb=mix(rgb,mix(vec3(.955,.911,.799),vec3(.465,.59,.71),night),.145);
  float air=.11+.52*smoothstep(75.,365.,depth)+.21*(1.-smoothstep(.48,.82,strata));
  air+=.18*angleFade*smoothstep(50.,200.,depth);
  return cloudRadiance(pow(mix(rgb,mix(vec3(.80,.855,.878),vec3(.205,.30,.42),night),air),vec3(2.2)));
}`
function radialGrid(){
  const rings=155,arcs=220,xyz=[],index=[]
  for(let i=0;i<=rings;i++){
    const u=i/rings,r=55*u+1120*u**4.8
    for(let j=0;j<=arcs;j++){
      const a=j*2*Math.PI/arcs
      xyz.push(r*Math.sin(a),0,r*Math.cos(a))
      if(i&&j){const d=i*(arcs+1)+j,b=d-arcs-1;index.push(b-1,b,d,b-1,d,d-1)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setIndex(index);return g
}
export function environment(env){
  const relief=bakeRelief(),bounds=shoreDistance()
  const u={cloudExposure:{value:1},relief:{value:relief},coast:{value:bounds},night:{value:0},t:{value:0},angleFade:{value:0},heading:{value:new T.Vector2()},inv:{value:new T.Matrix4()},camWorld:{value:new T.Matrix4()}}
  const sky=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3)),new T.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 screen;void main(){screen=position.xy;gl_Position=vec4(screen,.999,1.);}',
    fragmentShader:deckField+`
      uniform mat4 inv,camWorld;varying vec2 screen;
      void main(){vec3 start=(camWorld*inv*vec4(screen,-1.,1.)).xyz,ray=-camWorld[2].xyz;
        vec3 sky=mix(vec3(.68,.785,.86),vec3(.105,.18,.30),night);
        float travel=clamp((-5.-start.y)/min(-.0001,ray.y),0.,9000.);
        vec2 p=(start+ray*travel).xz;
        vec3 color=mix(cloudRadiance(pow(sky,vec3(2.2))),cloudColor(p,deckAt(p)),smoothstep(.015,.28,-ray.y));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`}))
  sky.frustumCulled=false;sky.renderOrder=-100
  sky.onBeforeRender=(_,__,cam)=>{
    u.inv.value.copy(cam.projectionMatrixInverse);u.camWorld.value.copy(cam.matrixWorld)
    u.t.value=env.clock;u.night.value=env.night
    const e=cam.matrixWorld.elements;u.heading.value.set(e[8],e[10]).normalize()
    u.angleFade.value=1-T.MathUtils.smoothstep(e[9],.04,.26)
  }
  const deck=new T.Mesh(radialGrid(),new T.ShaderMaterial({uniforms:u,side:T.DoubleSide,
    vertexShader:deckField+`varying vec2 xz;void main(){xz=position.xz;vec3 p=vec3(xz.x,crest(xz,deckAt(xz)),xz.y);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:deckField+`varying vec2 xz;void main(){gl_FragColor=vec4(cloudColor(xz,deckAt(xz)),1.);
    #include <colorspace_fragment>
    }`}))
  deck.frustumCulled=false
  const veil=new T.Mesh(new T.PlaneGeometry(77,77),new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,
    vertexShader:'varying vec2 xz;void main(){vec4 w=modelMatrix*vec4(position,1.);xz=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:deckField+`varying vec2 xz;void main(){float d=distanceToTown(xz),wet=inlet(xz);
      float water=exp(-.025*dot(xz-vec2(-23.,8.),xz-vec2(-23.,8.)));
      float reach=.48+1.0*wet+1.8*water;
      float a=smoothstep(-reach,-.03,d+.15*sin(xz.y*1.8+.015*t))*(1.-smoothstep(1.,4.,d));
      gl_FragColor=vec4(cloudColor(xz,deckAt(xz)),a*.91);
      #include <colorspace_fragment>
      }`}))
  veil.rotation.x=-Math.PI/2;veil.position.y=.26;veil.renderOrder=-2
  return {sky,deck,veil,uniforms:u,dispose(){bounds.dispose();relief.dispose()}}
}

// The original GLB has several adjoining road and river slabs. Fade just the
// low coast surfaces over a varying distance measured in the town's X/Z frame.
export function blendCoast(meshes,uniforms){
  const materials=new Set(meshes.flatMap(mesh=>[].concat(mesh.material)))
  for(const mat of materials){
    if(!mat.isMeshStandardMaterial)continue
    const compile=mat.onBeforeCompile,key=mat.customProgramCacheKey()
    mat.customProgramCacheKey=()=>key+'-c3-coast'
    mat.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms)
      shader.vertexShader='varying vec3 shoreWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nshoreWorld=(modelMatrix*vec4(transformed,1.)).xyz;')
      shader.fragmentShader='varying vec3 shoreWorld;\n'+deckField+'\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
        if(shoreWorld.y<.6){
          vec2 p=shoreWorld.xz;
          float d=distanceToTown(p);
          if(d>-5.2){
            float mist=inlet(p);
            float river=exp(-.016*dot(p-vec2(-22.,9.),p-vec2(-22.,9.)));
            float width=.85+1.75*mist+1.85*river;
            float edge=smoothstep(-width,-.04,d+.2*sin(p.x*1.14+.16*p.y))* (1.-smoothstep(.26,.59,shoreWorld.y));
            outgoingLight=mix(outgoingLight,cloudColor(p,deckAt(p)),edge);
          }
        }
        #include <opaque_fragment>`)
    }
    mat.needsUpdate=true
  }
}
