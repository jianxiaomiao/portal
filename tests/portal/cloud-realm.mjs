// Run against a PORTAL_INSPECT=1 build. This exercises the actual framebuffer, including its depth-tested local volume pass.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const root = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
const browser = await chromium.launch({ channel: 'chrome' })
try {
  for (const theme of ["day","night"]) {
    const page = await browser.newPage({ viewport: { width: 1240, height: 800 }, reducedMotion: 'reduce' })
    const failures = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text())) failures.push(message.text())
    })
    await page.goto(new URL('explore/?inspect', root).href)
    await page.waitForFunction(() => window.__cv?.snapshot().fps > 0 && !window.__cv.snapshot().moving)
    await page.evaluate(theme=>window.__cv.owner().setTheme(theme),theme)
    for (const quality of ['high', 'low']) {
      await page.getByLabel('画质', { exact: true }).selectOption(quality)
      const result = await page.evaluate(async () => {
        const town = window.__cv.owner()
        const {renderer,scene} = town, camera = town.rig.camera
        const target = camera.position.clone().fromArray(window.__cv.snapshot().target)
        const originalColor = scene.background.clone()
        const position = camera.position.clone(), quaternion = camera.quaternion.clone(), zoom = camera.zoom
        const sample = document.createElement('canvas')
        sample.width = 96
        sample.height = 60
        const ctx = sample.getContext('2d', { willReadFrequently: true })
        let missing = 0
        // Pink clear colour remains visible wherever the renderer leaves a hole.
        try {
          scene.background.set(0xff00ff)
          // Measure the clear colour after the same HDR and output transform.
          const visible = scene.children.filter(object => object.visible)
          const gas = town.clouds.gas
          let sentinel
          try {
            for (const object of visible) object.visible = false
            gas.visible = false
            town.clouds.render(renderer,scene,camera)
            ctx.drawImage(renderer.domElement, 0, 0, sample.width, sample.height)
            sentinel = ctx.getImageData(0,0,1,1).data
          } finally {
            for (const object of visible) object.visible = true
            gas.visible = true
          }
          if (sentinel[0]-sentinel[1]<40 || sentinel[2]-sentinel[1]<40)
            throw Error('Invalid clear-colour control '+Array.from(sentinel))
          for (const z of [.12, 3.1]) {
            camera.zoom = z
            camera.updateProjectionMatrix()
            for (const tilt of [.00002, .16, .64, 1.12, 1.49]) {
              for (let angle = 0; angle < 360; angle += 45) {
                camera.position.setFromSphericalCoords(66, tilt, angle * Math.PI / 180).add(target)
                camera.lookAt(target)
                camera.updateMatrixWorld()
                town.clouds.render(renderer,scene,camera)
                ctx.drawImage(renderer.domElement, 0, 0, sample.width, sample.height)
                const data = ctx.getImageData(0, 0, sample.width, sample.height).data
                for (let i = 0; i < data.length; i += 4) {
                  if ([0,1,2].every(channel => Math.abs(data[i+channel]-sentinel[channel]) < 4)) missing++
                }
              }
            }
          }
        } finally {
          scene.background.copy(originalColor)
          camera.position.copy(position)
          camera.quaternion.copy(quaternion)
          camera.zoom = zoom
          camera.updateProjectionMatrix()
          camera.updateMatrixWorld()
        }
        return { missing, volumes: town.clouds.gas.children.length }
      })
      assert.equal(result.missing, 0, quality)
      assert.equal(result.volumes, quality === "low" ? 1 : 6)
    }
    assert.deepEqual(failures, [])
    await page.close()
  }
  console.log('Cloud sea covers the framebuffer at both zoom limits in day and night, at both quality extremes.')
} finally {
  await browser.close()
}
