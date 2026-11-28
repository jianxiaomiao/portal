<script setup lang="ts">
import {computed} from 'vue'
import type {ApiRequest} from './director'
import {outcomes,digest} from './story'
const props = defineProps<{state:ReturnType<ApiRequest['snapshot']>}>()
defineEmits<{toggle:[];next:[];replay:[];cancel:[]}>()
const facts = computed(() => {
  const s=props.state
  return [['请求',s.request],['认证',s.auth],['应用限流',s.rate],['参数',s.validation],
    ['配额 · 教学示例',s.quota+' · '+s.used+'/'+s.limit],['业务',s.business],
    ['HTTP',s.status ? String(s.status)+' '+s.body?.code : '未返回'],['用量',s.usage]]
})
</script>
<template>
  <div class="api-panel journey-panel">
    <div class="journey-kicker">NEXUS / HASH <span>浏览器本地模拟</span></div>
    <h2>{{ outcomes[state.options.outcome] }}</h2>
    <div class="journey-scenario"><span>{{ state.stageName }}</span><span>{{ state.stage }} / 9</span></div>
    <progress aria-label="请求进度" :value="state.finished ? state.total : state.index + state.fraction" :max="state.total"/>
    <h3>{{ state.title }}</h3>
    <code class="api-location">{{ state.location }}</code>
    <p class="journey-copy">{{ state.detail }}</p>
    <p v-if="state.stopAt" class="api-stop">停止位置 · {{ state.stopAt }}</p>
    <div class="journey-buttons">
      <button v-if="!state.finished" class="primary" @click="$emit('toggle')">{{ state.playing ? '暂停剧情' : '继续播放' }}</button>
      <button v-if="!state.finished" class="secondary" @click="$emit('next')">下一步</button>
      <button class="secondary" @click="$emit('replay')">从头重播</button>
      <button class="back" @click="$emit('cancel')">{{ state.finished ? '返回总览' : '取消演示' }}</button>
    </div>
    <dl class="api-facts"><div v-for="[key,value] in facts" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div></dl>
    <div v-if="state.step==='hash'" class="api-digest"><small>SHA256</small><code>{{ digest }}</code></div>
    <details class="journey-fields" :open="state.step==='response'"><summary>请求与响应</summary>
      <pre>POST /v1/utils/hash
Authorization: ApiKey ••••
{{ JSON.stringify(state.input,null,2) }}</pre>
      <p v-if="state.status">HTTP {{state.status}} <span v-if="state.options.outcome==='rate'"> · Retry-After: 1</span></p>
      <pre>{{ state.body ? JSON.stringify(state.body,null,2) : '等待响应' }}</pre>
    </details>
    <details class="journey-fields" :open="state.stage===9"><summary>用量事件 · usage_events</summary>
      <dl><dt>api_code / http_status_code</dt><dd>{{ state.eventId ? 'utils.hash / '+state.status : '—' }}</dd>
      <dt>duration_ms（教学示例）</dt><dd>{{ state.durationMs ?? '—' }}</dd>
      <dt>event_id</dt><dd>{{ state.eventId || '—' }}</dd><dt>写入状态</dt><dd>{{ state.usage }}</dd></dl>
    </details>
  </div>
</template>
