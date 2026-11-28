import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import {json} from './common.mjs'
const source=await readFile(new URL('../../src/codeville/support-chat/story.ts',import.meta.url),'utf8')
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}})
const {ChatState,sequence,cues}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'))
function at(scenario,step) {
  const s=new ChatState(scenario)
  for(const event of sequence(scenario)){s.enter(event);if(event===step)return s}
  throw Error('缺少步骤 '+step)
}
const bound=at('normal','bind')
assert.throws(()=>bound.enter('bind'),/入场券/)
const replay=at('lost','replay')
assert.deepEqual([replay.clientLog.length,replay.rows.length,replay.messageEvents],[1,1,1])
assert.equal(replay.replayed,true)
assert.deepEqual([replay.requestId,replay.key,replay.rows[0].key],['r2','m1','m1'])
const recovered=at('offline','pull')
assert.deepEqual(recovered.fetched.map(m=>m.seq),[2])
for(let i=0;i<2;i++) recovered.enter('merge')
assert.deepEqual(recovered.clientLog.map(m=>m.seq),[1,2])
assert.equal(recovered.clientRead,0)
const switched=at('transfer','answer')
assert.deepEqual(switched.claimResponses,[200,409])
switched.requestActor='A'
assert.throws(()=>switched.enter('answerCommit'),/负责人/)
switched.requestActor='B';switched.requestVersion=1
assert.throws(()=>switched.enter('answerCommit'),/版本/)
assert.equal(switched.rows.length,1)
switched.requestVersion=2;switched.enter('answerCommit')
assert.equal(switched.rows.length,2)
await json('chat-state.json',{passed:true,normalSeconds:sequence('normal').reduce((sum,id)=>sum+cues[id][4],0),
  checks:['同一个 grant 的二次消费被拒绝','首发重放仍为一行一条消息通知','重复合并同一 HTTP 页仅保留 seq 1、2',
  '同版本领取只成功一次','已转出的 A 与旧版本的 B 均无法追加正文，当前 B 可以']})
