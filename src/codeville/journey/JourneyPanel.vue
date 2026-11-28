<script setup lang="ts">
import { payload, submissionKey, scenarios, shots } from './story'
import type { Journey } from './director'
defineProps<{ state: ReturnType<Journey['snapshot']> }>()
defineEmits<{ toggle: []; next: []; replay: []; cancel: []; staff: [] }>()
</script>
<template>
  <div class="journey-panel">
    <div class="journey-kicker">NEXUS → FLOWOPS <span>本地模拟</span></div>
    <h2>一张工单的旅程</h2>
    <div class="journey-scenario">{{ scenarios[state.scenario] }} <span>{{ state.index + 1 }} / {{ state.total }}</span></div>
    <progress aria-label="剧情进度" :value="state.finished ? state.total : state.index + state.fraction" :max="state.total"></progress>
    <h3>{{ shots[state.step][0] }}</h3>
    <p class="journey-copy">{{ shots[state.step][1] }}</p>
    <div class="journey-states">
      <div><small>NEXUS · 投递</small><strong>{{ state.outbox }}</strong></div>
      <div><small>FLOWOPS · 工单</small><strong>{{ state.flow }}</strong></div>
    </div>
    <dl class="journey-facts">
      <dt>认领次数</dt><dd>{{ state.attempt }} / 12</dd>
      <dt>当前租约</dt><dd>{{ state.leased ? '60 秒租期' : state.step === 'expire' ? '已过期' : '—' }}</dd>
      <dt>接收端响应</dt><dd>{{ state.http ? 'HTTP ' + state.http : '—' }}{{ state.http === 409 ? ' / 30015' : '' }}</dd>
      <dt>已提交工单</dt><dd>{{ state.imports }} 张</dd>
      <dt v-if="state.failure">失败记录</dt><dd v-if="state.failure">{{ state.failure }}</dd>
      <dt v-if="state.written !== null">条件更新</dt><dd v-if="state.written !== null">{{ state.written }} 行</dd>
    </dl>
    <div class="journey-buttons">
      <button v-if="!state.finished" class="primary" @click="$emit('toggle')">{{ state.playing ? '暂停剧情' : '继续播放' }}</button>
      <button v-if="!state.finished" class="secondary" @click="$emit('next')">下一步</button>
      <button class="secondary" @click="$emit('replay')">从头重播</button>
      <button class="back" @click="$emit('cancel')">{{ state.finished ? '返回总览' : '取消演示' }}</button>
    </div>
    <div v-if="state.imports" class="staff-action">
      <span>部门工作台 · {{ state.flow === 'ASSIGNED' ? '待领取' : state.flow === 'ACCEPTED' ? '林舟已领取' : '林舟处理中' }}</span>
      <button v-if="state.flow !== 'PROCESSING'" @click="$emit('staff')">{{ state.flow === 'ASSIGNED' ? '客服领取' : '开始处理' }}</button>
    </div>
    <details class="journey-fields" open><summary>工单标识与回执</summary>
      <dl>
        <dt>用户提交 · Idempotency-Key</dt><dd>{{ submissionKey }}</dd>
        <dt>Nexus ticketId / externalTicketId</dt><dd>{{ state.ticketId || '等待本地提交' }}</dd>
        <dt>Outbox · eventId</dt><dd>{{ state.ticketId ? payload.eventId : '—' }}</dd>
        <dt>Worker · claimToken</dt><dd>{{ state.token || '—' }}</dd>
        <template v-if="state.previousToken"><dt>上次认领令牌</dt><dd>{{ state.previousToken }}</dd></template>
        <dt>FlowOps ticketId / ticketNo</dt><dd>{{ state.imports ? '12345 · OPS-20261127-0001' : '—' }}</dd>
        <template v-if="state.confirmedNo"><dt>Nexus 已确认单号 / delivered_at（模拟）</dt><dd>{{ state.confirmedNo }} · {{ state.deliveredAt }}</dd></template>
        <template v-if="state.requestDigest"><dt>FlowOps · request_digest（SHA-256）</dt><dd>{{ state.requestDigest }}</dd></template>
      </dl>
    </details>
    <details class="journey-fields"><summary>HTTP 请求与当前回执</summary>
      <p>POST /integration/v1/tickets<br>Authorization · 机器凭据<br>X-Trace-Id · eventId</p>
      <pre>{{ JSON.stringify(state.step === 'mismatch' || state.step === 'blocked' ? {...payload,title:'被改写的标题'} : payload,null,2) }}</pre>
      <p>回执</p><pre>{{ state.ack ? JSON.stringify(state.ack,null,2) : '—' }}</pre>
    </details>
  </div>
</template>
