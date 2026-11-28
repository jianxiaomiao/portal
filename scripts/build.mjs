import { build } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

await build()
const output = process.env.PORTAL_OUT || 'dist'
const template = await readFile(join(output, 'index.html'), 'utf8')
const temporary = await mkdtemp(resolve('node_modules/.portal-render-'))
try {
  await build({
    build: {
      ssr: 'src/render.ts',
      outDir: temporary,
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: 'render.mjs' } },
    },
  })
  const { routes, render } = await import(
    pathToFileURL(join(temporary, 'render.mjs')).href
  )
  for (const route of routes) {
    const file = join(
      output,
      route.endsWith('/') ? route + 'index.html' : route,
    )
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, await render(route, template))
  }
  console.log('Static HTML:', routes.join(' '))
} finally {
  await rm(temporary, { recursive: true, force: true })
}
