import type { Group, Mesh, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three'
import type { Theme } from '../atmosphere'
export class CloudSea {
  readonly group: Group
  constructor(theme: Theme, sun: Vector3, meshes: Mesh[], renderer: WebGLRenderer)
  setDetail(level: number): void
  setTheme(theme: Theme): void
  step(dt: number, active: boolean): void
  render(renderer: WebGLRenderer, scene: Scene, camera: OrthographicCamera): void
  dispose(): void
}
