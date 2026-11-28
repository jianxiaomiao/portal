<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { scenarios, question, reply } from './story'
import type { ChatSnapshot } from './director'
const props = defineProps<{state:ChatSnapshot}>()
defineEmits(['toggle','next','retry','replay','cancel'])
const side = ref('customer')
const agent = ref('A'), room = ref('S1')
watch(()=>props.state.owner, owner=>{agent.value = owner || 'A'; room.value = 'S1'})
watch(()=>props.state.step, step=>{if(step==='launch') {agent.value='A';room.value='S1'}})
const otherRoom = computed(()=>agent.value==='A'?'S2':'S3')
const staffReady = computed(()=>props.state.staffWs==='ready')
const viewing = computed(()=>props.state.selected==='S1' && props.state.owner===agent.value && room.value==='S1')
const clientPending = computed(()=>props.state.key==='m1' && props.state.pending)
const staffPending = computed(()=>props.state.key==='m2' && props.state.pending && viewing.value)
</script>
<template>
  <section class="chat-panel" :data-side="side" data-chat-panel aria-label="一条客服消息演示">
    <header class="chat-heading"><div><small>CHAPTER 03 · {{ scenarios[state.scenario] }}</small><h2>{{ state.title }}</h2></div><span>{{ state.index+1 }}/{{ state.total }}</span></header>
    <progress :value="state.index+1" :max="state.total" aria-label="章节进度"/>
    <p class="chat-narrative">{{ state.detail }}</p>
    <div class="journey-buttons chat-controls">
      <button v-if="state.waitingForRetry" class="primary" @click="$emit('retry')">客户重试原消息</button>
      <template v-else-if="!state.finished"><button class="primary" @click="$emit('toggle')">{{ state.playing?'暂停':'继续' }}</button>
      <button class="secondary" @click="$emit('next')">下一步</button></template>
      <button class="secondary" @click="$emit('replay')">重播</button><button class="secondary" @click="$emit('cancel')">取消演示</button>
    </div>
    <div class="side-switch" aria-label="会话侧别"><button :aria-pressed="side==='customer'" @click="side='customer'">客户窗口</button><button :aria-pressed="side==='staff'" @click="side='staff'">坐席工作台</button></div>
    <section class="chat-end customer" data-client><header><b>客户窗口 <i>C1</i></b><span>{{ state.clientWs }}</span></header>
      <div class="chat-transcript">
        <p v-if="!state.clientSeq && !clientPending" class="empty">{{ state.session ? '客服页面已打开，等待咨询' : '等待 Nexus 身份接入' }}</p>
        <p v-if="state.clientSeq || clientPending" class="bubble own">{{ question }}<small>{{ clientPending || (state.staffRead>=1 ? '已读' : '已保存') }}</small></p>
        <p v-if="state.clientSeq>=2" class="bubble">{{ reply }}<small>客服 {{ state.owner }} · seq 2</small></p>
        <p v-if="state.draft" class="chat-draft">恢复草稿 · {{ state.draft }}</p>
      </div>
    </section>
    <section class="chat-end staff" data-staff><header><b>客服工作台 <i>{{ agent }}</i></b><span>{{ state.staffWs }}</span></header>
      <div v-if="state.scenario==='transfer' && staffReady" class="chat-tabs" aria-label="观察坐席">
        <button v-for="id in ['A','B']" :aria-pressed="agent===id" @click="agent=id;room='S1'">坐席 {{id}}</button>
      </div>
      <div v-if="staffReady" class="room-index">
        <template v-if="state.status==='WAITING'">部门待领取 · S1 <span>请问在哪里查看…</span></template>
        <template v-else>我的会话
          <button v-if="state.owner===agent" :aria-pressed="room==='S1'" @click="room='S1'">S1</button>
          <button :aria-pressed="room===otherRoom" @click="room=otherRoom">{{otherRoom}}</button>
        </template>
      </div>
      <div class="chat-transcript">
        <p v-if="viewing && state.staffSeq" class="bubble">{{ question }}<small>客户 C1 · seq 1</small></p>
        <p v-if="viewing && (state.staffSeq>=2 || staffPending)" class="bubble own">{{ reply }}<small>{{ staffPending || (state.counterpartRead>=2 ? '已读' : '已保存') }}</small></p>
        <p v-if="!viewing || !state.staffSeq" class="empty">{{ !staffReady?'等待坐席上线':room===otherRoom?otherRoom+' · 另一条独立会话':state.owner && state.owner!==agent?'S1 不在我的会话中':state.status==='WAITING'?'领取后可打开全文':'等待加载会话详情' }}</p>
      </div>
    </section>
    <div class="chat-ledger"><span>会话 <b>{{ state.status==='—'?'—':'S1' }}</b></span><span>{{state.status}}</span><span>负责人 <b>{{state.owner||'空'}}</b></span><span>seq <b>{{state.rows.length}}</b></span></div>
    <details class="journey-fields"><summary>协议与事务详情</summary><dl class="chat-data">
      <dt>当前交接</dt><dd>{{ state.protocol }}</dd>
      <dt>userId / sessionId</dt><dd>101 / 201（示意）</dd>
      <dt>tenantId / integrationId</dt><dd>{{ state.grant==='—'?'—':'T1 / I1' }}</dd>
      <dt>action / grant</dt><dd>{{ state.grant==='—'?'—':'/launch/nexus · '+state.grant }}</dd>
      <dt>customer_session / access JWT</dt><dd>{{state.session?'已绑定':'—'}} / {{state.access?'已签发':'—'}}</dd>
      <dt>客户 WS ticket 次数</dt><dd>{{state.clientTicket}}</dd>
      <dt>requestId / clientMessageId</dt><dd>{{state.requestId||'—'}} / {{state.key||'—'}}</dd>
      <dt>conversationId / stateVersion</dt><dd>{{state.status==='—'?'—':'S1 / '+state.version}}</dd>
      <dt>actionId</dt><dd>{{state.action||'—'}}</dd>
      <dt>最新 message.ack / 重放</dt><dd>{{state.ack||'—'}} / {{state.ack==='r2' && state.replayed}}</dd>
      <dt>消息 Outbox 累计 / 处理</dt><dd>{{state.messageEvents}} / {{state.outbox}}</dd>
      <dt>customerReadSeq / staffReadSeq</dt><dd>{{state.clientRead}} / {{state.staffRead}}</dd>
      <dt>客服侧 counterpartReadSeq</dt><dd>{{state.counterpartRead}}</dd>
      <dt>本次可见行 / upToSeq</dt><dd>{{state.visibleRead ? '页面可见 · seq '+state.visibleRead.seq : '—'}} / {{state.upToSeq ?? '—'}}</dd>
    </dl></details>
  </section>
</template>
<style scoped>
.chat-panel{color:#243d42;font-size:13px}
.chat-heading,.chat-end header,.chat-ledger,.room-index,.chat-tabs{display:flex;align-items:center;gap:8px}
.chat-heading,.chat-end header{justify-content:space-between;height:auto;min-height:0;border-bottom:none}
.chat-heading{padding:0;background:transparent}
.chat-heading small,.chat-heading>span,.chat-ledger,.room-index{font:600 11px/1.4 ui-monospace,monospace}
.chat-heading small{color:#486c78;letter-spacing:.06em}
.chat-heading h2{font:600 23px/1.3 'PingFang SC',sans-serif;margin:3px 0}
.chat-panel progress{accent-color:#537e93;width:100%;height:4px}
.chat-narrative{line-height:1.55;margin:5px 0;color:#475a57}
.chat-controls{margin:5px 0 9px}
.chat-end{border:1px solid #ccdcd6;border-radius:9px;overflow:hidden;margin-bottom:8px}
.chat-end header{background:#dfebe5;padding:6px 10px}
.staff header{background:#dfe9ed}
.chat-end header span,.bubble small,.chat-end i{font:11px ui-monospace,monospace}
.chat-end header span{color:#34594e}.chat-end i{margin-left:4px}
.chat-transcript{background:#f8faf6;padding:7px 9px;display:grid;gap:5px}
.staff .chat-transcript{background:#f6f8f8}
.empty{color:#64716e;font-size:12px;margin:2px 0}
.bubble{padding:5px 9px;margin:0;background:white;border:1px solid #dae3de;border-radius:8px;justify-self:start;max-width:94%;line-height:1.45}
.bubble.own{justify-self:end;background:#e5f0e7}
.staff .own{background:#e0ecf1}
.bubble small{display:block;color:#586c65;margin-top:2px}
.chat-draft{font-size:11px;margin:0;color:#905c26}
.room-index,.chat-tabs{background:#f1f5f4;padding:5px 9px;flex-wrap:wrap}
.room-index span{color:#5d706b}
.room-index button,.chat-tabs button{background:white;padding:2px 8px;min-height:24px;border:1px solid #c6d4d3;border-radius:5px;color:#335553;cursor:pointer}
button[aria-pressed=true]{background:#335955;color:white}
.chat-ledger{justify-content:space-between;flex-wrap:wrap;padding:5px 0 8px;color:#405952}
.chat-data{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px 8px}
.chat-data dd{text-align:right}
.side-switch{display:none}@media(max-width:700px){.side-switch{display:flex;gap:8px;margin:8px 0}.side-switch button{min-height:44px;padding:6px 12px;border:1px solid #aabab0;border-radius:5px}.chat-panel[data-side=customer] [data-staff],.chat-panel[data-side=staff] [data-client]{display:none}}
</style>
