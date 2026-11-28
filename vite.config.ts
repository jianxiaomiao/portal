import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

function resources(folder: string, name: string) {
  const files = readdirSync(folder).sort()
  const hash = createHash('sha256')
  for (const file of files)
    hash.update(file).update(readFileSync(join(folder, file)))
  return { folder, files, prefix: name + '-' + hash.digest('hex').slice(0, 12) }
}
const inspect = process.env.PORTAL_INSPECT === '1'
if (inspect && basename(process.env.PORTAL_OUT || 'dist') !== 'dist-check')
  throw new Error('PORTAL_INSPECT=1 requires a separate dist-check output directory.')

const media = resources('src/media', 'media')
const town = resources('src/codeville/resources', 'town')
const base =
  process.env.PORTAL_BASE ||
  (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY
    ? '/' + process.env.GITHUB_REPOSITORY.split('/')[1] + '/'
    : '/')
function staticPortal(): Plugin {
  return {
    name: 'portal-static-pages',
    generateBundle() {
      if (this.environment.config.build.ssr) return
      for (const group of [media, town])
        for (const file of group.files)
          this.emitFile({
            type: 'asset',
            fileName: group.prefix + '/' + file,
            source: readFileSync(join(group.folder, file)),
          })
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url || '/', 'http://localhost').pathname
        for (const group of [media, town])
          if (path.startsWith(base + group.prefix + '/')) {
            const file = basename(path)
            if (!group.files.includes(file)) return next()
            const types: Record<string, string> = {
              webp: 'image/webp',
              jpg: 'image/jpeg',
              json: 'application/json',
              glb: 'model/gltf-binary',
            }
            const data = readFileSync(join(group.folder, file))
            res.setHeader(
              'Content-Type',
              types[file.split('.').pop()!] || 'application/octet-stream',
            )
            res.setHeader('Content-Length', data.length)
            return res.end(data)
          }
        if (
          !path.startsWith(base) ||
          !req.headers.accept?.includes('text/html')
        )
          return next()
        try {
          const { routes, render } =
            await server.ssrLoadModule('/src/render.ts')
          const route =
            '/' + path.slice(base.length).replace(/index\.html$/, '')
          const key = routes.includes(route) ? route : '/404.html'
          res.statusCode = key === '/404.html' ? 404 : 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(
            await render(
              key,
              await server.transformIndexHtml(
                path,
                readFileSync('index.html', 'utf8'),
              ),
            ),
          )
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
export default defineConfig({
  base,
  plugins: [vue(), staticPortal()],
  define: {
    __MEDIA_DIR__: JSON.stringify(media.prefix),
    __TOWN_DIR__: JSON.stringify(town.prefix),
    __CV_INSPECT__: inspect,
    __PORTAL_DOMESTIC__: process.env.PORTAL_SITE === 'cn',
  },
  build: {
    outDir: process.env.PORTAL_OUT || 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/build/')) return 'three'
        },
      },
    },
  },
})
