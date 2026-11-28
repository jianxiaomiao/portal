import { Mesh, Object3D, Texture, Vector3, type Material } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { assets, keys, spots, type Place } from '../content'
type Triple = [number, number, number]
export type Layout = {
  routes: Record<string, { drive: Triple[]; data: Triple[] }>
  anchors: Record<string, Triple>
  studioOpening: Record<string, Triple | string>
}
export const fromBlender = ([x, y, z]: Triple) => new Vector3(x, z, -y)
export function disposeModel(root: Object3D) {
  const geometries = new Set<Mesh['geometry']>(),
    materials = new Set<Material>(),
    textures = new Set<Texture>(),
    images = new Set<ImageBitmap>()
  root.traverse((o) => {
    if (o instanceof Mesh) {
      geometries.add(o.geometry)
      for (const m of ([] as Material[]).concat(o.material)) materials.add(m)
    }
  })
  for (const m of materials)
    for (const value of Object.values(m))
      if (value instanceof Texture) textures.add(value)
  for (const t of textures) {
    if (
      typeof ImageBitmap !== 'undefined' &&
      t.source.data instanceof ImageBitmap
    )
      images.add(t.source.data)
    t.dispose()
  }
  for (const im of images) im.close()
  for (const g of geometries) g.dispose()
  for (const m of materials) m.dispose()
}
export class Registry {
  readonly ids = new Map<string, Object3D>()
  readonly surfaces: Mesh[] = []
  readonly places = new WeakMap<Object3D, Place>()
  constructor(
    readonly model: Object3D,
    layout: Layout,
  ) {
    model.traverse((o) => {
      const id = o.userData.codeville_id
      if (typeof id === 'string') {
        if (this.ids.has(id)) throw Error('重复对象标识 ' + id)
        this.ids.set(id, o)
      }
      if (o instanceof Mesh) this.surfaces.push(o)
    })
    for (const k of keys)
      this.get(k + '.Root').traverse((o) => this.places.set(o, k))
    for (const k of ['ENV.ControlHub', 'ENV.ControlConsole'])
      this.get(k).traverse((o) => this.places.set(o, 'hub'))
    for (const k of spots) this.get('ST.Anchor.' + k)
    model.updateMatrixWorld(true)
    for (const [id, pos] of Object.entries(layout.anchors)) {
      // The plaza focus and console markers exist only in the external layout.
      if (
        !this.ids.has(id) &&
        ['ENV.Anchor.Focus', 'ENV.Anchor.Control'].includes(id)
      ) {
        const marker = new Object3D()
        marker.position.copy(model.worldToLocal(fromBlender(pos)))
        marker.userData.codeville_id = id
        marker.userData.source = 'layout'
        model.add(marker)
        this.ids.set(id, marker)
      }
      if (
        this.get(id)
          .getWorldPosition(new Vector3())
          .distanceTo(fromBlender(pos)) > 0.002
      )
        throw Error('锚点位置不匹配 ' + id)
    }
  }
  get(id: string) {
    const o = this.ids.get(id)
    if (!o) throw Error('缺少对象 ' + id)
    return o
  }
}
export type LoadStage =
  | '正在接收模型'
  | '正在准备解码器'
  | '正在解析场景'
  | '正在准备首帧'
  | '正在启用选取'
  | '正在尝试普通模型'
class LayoutError extends Error {}
export async function loadTown(
  signal: AbortSignal,
  progress: (received: number, total: number) => void,
  stage: (label: LoadStage) => void,
) {
  const preferredModel =
    new URLSearchParams(location.search).get('model') === 'raw'
      ? 'Town.glb'
      : 'Town.meshopt.glb'
  const start = performance.now()
  stage('正在接收模型')
  const layoutRequest = fetch(assets + 'layout.json', { signal })
    .then(async (r) => {
      if (!r.ok) throw Error('布局文件 HTTP ' + r.status)
      return (await r.json()) as Layout
    })
    .catch((error) => {
      throw new LayoutError(String(error))
    })
  const modelRequest = async (modelFile: string) => {
    const response = await fetch(assets + modelFile, { signal })
    if (!response.ok) throw Error('模型文件 HTTP ' + response.status)
    const total = response.headers.has('content-encoding')
      ? 0
      : Number(response.headers.get('content-length')) || 0
    if (!response.body) {
      const b = await response.arrayBuffer()
      progress(b.byteLength, total)
      return b
    }
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        size += value.byteLength
        progress(size, total)
      }
    } finally {
      reader.releaseLock()
    }
    const data = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      data.set(chunk, offset)
      offset += chunk.length
    }
    return data.buffer
  }
  async function decode(modelFile: string) {
    const [bytes, layout] = await Promise.all([
      modelRequest(modelFile),
      layoutRequest,
    ])
    const parseStart = performance.now()
    const loader = new GLTFLoader()
    if (modelFile === 'Town.meshopt.glb') {
      stage('正在准备解码器')
      const { MeshoptDecoder } = await import(
        'three/addons/libs/meshopt_decoder.module.js'
      )
      await MeshoptDecoder.ready
      loader.setMeshoptDecoder(MeshoptDecoder)
    }
    signal.throwIfAborted()
    stage('正在解析场景')
    const { scene } = await loader.parseAsync(bytes, assets)
    try {
      signal.throwIfAborted()
      let registry: Registry
      try {
        registry = new Registry(scene, layout)
      } catch (error) {
        throw new LayoutError(String(error))
      }
      const parseEnd = performance.now()
      return {
        scene,
        modelFile,
        layout,
        registry,
        timing: {
          bytes: bytes.byteLength,
          downloadMs: parseStart - start,
          parseMs: parseEnd - parseStart,
        },
      }
    } catch (e) {
      disposeModel(scene)
      throw e
    }
  }
  try {
    return await decode(preferredModel)
  } catch (error) {
    if (
      signal.aborted ||
      error instanceof LayoutError ||
      preferredModel === 'Town.glb'
    )
      throw error
    stage('正在尝试普通模型')
    progress(0, 0)
    return decode('Town.glb')
  }
}
