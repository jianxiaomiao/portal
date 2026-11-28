import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { finished } from 'node:stream/promises'
import { base, file, out } from './common.mjs'

const cases = [
  'support-chat-state', 'phase8-entry', 'render-contracts', 'town-views',
  'api-request', 'journey-branches', 'support-chat-lifecycle', 'support-chat', 'visibility',
]
const selected = process.argv.slice(2)
if (selected.some(name => !cases.includes(name))) throw Error('未知回归用例')
const work = selected.length ? selected : cases
await mkdir(out, { recursive: true })
const results = []
for (const name of work) {
  const started = Date.now()
  console.log('开始', name, new Date(started).toISOString())
  const log = createWriteStream(file(name + '.log'))
  const proc = spawn(process.execPath, [fileURLToPath(new URL(name + '.mjs', import.meta.url))], {
    env: { ...process.env, CHAT_VISIBILITY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.pipe(log, { end: false })
  proc.stderr.pipe(log, { end: false })
  const code = await new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', resolve)
  })
  log.end()
  await finished(log)
  const item = { name, exitCode: code, seconds: (Date.now() - started) / 1000 }
  results.push(item)
  console.log(code === 0 ? '通过' : '未通过', name, item.seconds)
  await writeFile(file('suite-' + (selected.length ? work.join('_') : 'all') + '.json'), JSON.stringify({ base, node: process.version, results }, null, 2) + '\n')
}
if (results.some(item => item.exitCode !== 0)) process.exitCode = 1
