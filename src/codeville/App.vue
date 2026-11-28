<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Town, type Quality } from './scene/town'
import {
  assets,
  buildings,
  keys,
  hotspots,
  spots,
  demos,
  type Place,
  type Hotspot,
} from './content'
import { districtNames, type TownView } from './scene/townViews'
import Icon from './Icon.vue'
import MapCompass from './MapCompass.vue'
import SupportChatPanel from './support-chat/SupportChatPanel.vue'
import {
  scenarios as chatScenarios,
  type Scenario as ChatScenario,
} from './support-chat/story'
import type { ChatSnapshot } from './support-chat/director'
import JourneyPanel from './journey/JourneyPanel.vue'
import { scenarios, shots, type Scenario } from './journey/story'
import ApiRequestPanel from './api-request/ApiRequestPanel.vue'
import { outcomes, type Outcome } from './api-request/story'
import type { ApiRequest } from './api-request/director'
import { media, href } from '../catalog'
import {
  persistTheme,
  readCamera,
  readIntent,
  saveCamera,
  themePreference,
  type Intent,
} from './navigation'
import type { LoadStage } from './scene/model'
const props = defineProps<{ compact: boolean; navigation: number }>()
const poster = computed(() =>
  media(theme.value === 'night' ? 'night.webp' : 'day-1280.webp'),
)
const phase = ref<LoadStage>('正在接收模型')
const controlling = ref(false)
let intentEpoch = 0
let manualSelection = false
const theme = ref<'day' | 'night'>(themePreference())
function toggleTheme() {
  theme.value = theme.value === 'day' ? 'night' : 'day'
  persistTheme(theme.value)
  if (new URLSearchParams(location.search).has('theme')) {
    const url = new URL(location.href)
    url.searchParams.set('theme', theme.value)
    history.replaceState(history.state, '', url)
  }
  town?.setTheme(theme.value)
}
const rawModel = new URLSearchParams(location.search).get('model') === 'raw'
function modelSwitch() {
  const params = new URLSearchParams(location.search)
  params.set('model', rawModel ? 'meshopt' : 'raw')
  return params.toString()
}
let entrySeen = false
function firstVisit() {
  if (entrySeen) return false
  entrySeen = true
  try {
    if (localStorage.getItem('codeville-entry-v1')) return false
    localStorage.setItem('codeville-entry-v1', 'seen')
  } catch {
    /* Storage is optional. */
  }
  return !matchMedia('(prefers-reduced-motion: reduce)').matches
}
const outcome = ref<Outcome>('success')
const wait = ref(false),
  timeout = ref(false),
  failWrite = ref(false)
const api = computed(
  () => status.value.api as ReturnType<ApiRequest['snapshot']> | undefined,
)
function startApi(auto: boolean) {
  town?.startApi(
    {
      outcome: outcome.value,
      wait: wait.value,
      timeout: timeout.value,
      failWrite: failWrite.value,
    },
    auto,
  )
  refresh()
}
const chatScenario = ref<ChatScenario>('normal')
const chat = computed(() => status.value.chat as ChatSnapshot | undefined)
function startChat(auto: boolean) {
  town?.startChat(chatScenario.value, auto)
  refresh()
}
function retryChat() {
  town?.chat?.retry()
  refresh()
}
const scenario = ref<Scenario>('lost')
const canvas = ref<HTMLCanvasElement>(),
  epoch = ref(0),
  stage = ref<'loading' | 'ready' | 'error' | 'unsupported'>('loading'),
  message = ref(''),
  loaded = ref(0),
  total = ref(0)
const selected = ref<Place | null>(null),
  hot = ref<Hotspot | null>(null),
  quality = ref<Quality>('auto'),
  performanceOpen = ref(false),
  demo = ref(''),
  status = ref<any>({})
const hover = ref<{ label: string; x: number; y: number } | null>(null),
  pins = ref<{ key: Hotspot; x: number; y: number }[]>([])
let town: Town | undefined,
  revision = 0
const project = computed(() =>
  selected.value && selected.value !== 'hub'
    ? buildings[selected.value]
    : undefined,
)
const label = (id: Place) =>
  id === 'hub' ? '中央双环' : buildings[id].name + ' ' + buildings[id].type
const ready = computed(() => stage.value === 'ready')
const state = computed(
  () => status.value.studio ?? { progress: 0, inside: false },
)
const labelView = computed(() =>
  selected.value === 'ST'
    ? status.value.view === 'globe'
      ? '收藏品特写'
      : state.value.inside
        ? '室内观察'
        : opening.value
          ? '工作室展开'
          : '建筑特写'
    : selected.value === 'hub'
      ? '中央广场'
      : selected.value
        ? '建筑特写'
        : (districtNames[status.value.view as keyof typeof districtNames] ??
          (
            { plan: '正上方鸟瞰', reverse: '反向总览' } as Record<
              string,
              string
            >
          )[status.value.view] ??
          '全镇总览'),
)
const opening = ref(false)
function refresh() {
  if (town?.rig) status.value = town.diagnostics()
}
const journey = computed(
  () =>
    status.value.journey as
      | ReturnType<import('./journey/director').Journey['snapshot']>
      | undefined,
)
function startJourney(auto: boolean) {
  town?.startJourney(scenario.value, auto)
  refresh()
}
function anchorStyle(id: string) {
  const p = town?.project(id)
  return p ? { left: p.x + 'px', top: p.y + 'px' } : {}
}
function skipEntry() {
  town?.rig?.skipEntry()
  refresh()
}
function toggleStory() {
  town?.togglePlayback()
}
function nextStep() {
  town?.nextJourneyStep()
  refresh()
}
function staffAction() {
  town?.journey?.db.staff()
  refresh()
}
function toggleMotion() {
  if (town?.motion?.mode === 'running') town.motion.pause()
  else town?.motion?.start()
  refresh()
}
function stopMotion() {
  town?.motion?.stop()
  refresh()
}
function select(p: Place | null) {
  intentEpoch++
  manualSelection = true
  if (
    p !== null &&
    p === selected.value &&
    !town?.journey &&
    !town?.api &&
    !town?.chat
  )
    return
  selected.value = p
  opening.value = false
  hot.value = null
  demo.value = ''
  hover.value = null
  town?.select(p)
  refresh()
}
function observe(view: TownView) {
  intentEpoch++
  if (!ready.value || selected.value) return
  hover.value = null
  town?.rig?.go(view)
  refresh()
}
function chooseHot(k: Hotspot) {
  intentEpoch++
  hot.value = k
  if (status.value.view === 'globe') town?.interior()
}
function moveStudio(open: boolean) {
  intentEpoch++
  opening.value = open
  hot.value = null
  town?.openStudio(open)
  refresh()
}
function currentChapter(): Intent | undefined {
  if (town?.api) return { chapter: 'api', scenario: outcome.value }
  if (town?.journey) return { chapter: 'ticket', scenario: scenario.value }
  if (town?.chat) return { chapter: 'chat', scenario: chatScenario.value }
}
let retryTarget: Intent | undefined
async function navigate(restore = false, target?: Intent) {
  if (!town?.rig || !ready.value || props.compact) return
  const params = new URLSearchParams(location.search)
  if (params.has('theme')) {
    theme.value = themePreference()
    town.setTheme(theme.value)
  }
  const explicit = target || readIntent(params)
  const book = restore && !explicit ? readCamera() : undefined
  const intent: Intent | undefined = explicit || book?.intent
  if (!intent) return
  const active = town
  const rig = active.rig!
  const seq = ++intentEpoch
  const current = () => seq === intentEpoch && active === town
  async function until(test: () => boolean) {
    while (current() && !test())
      await new Promise((resolve) => setTimeout(resolve, 32))
    return current()
  }
  selected.value = intent.chapter ? 'hub' : intent.place || null
  active.select(selected.value)
  opening.value = false
  hot.value = null
  demo.value = ''
  if (intent.chapter) {
    demo.value = {
      api: 'API 请求',
      ticket: '可靠工单投递',
      chat: '实时客服通信',
    }[intent.chapter]
    const option = intent.scenario || ''
    if (intent.chapter === 'ticket' && Object.hasOwn(scenarios, option))
      scenario.value = option as Scenario
    if (intent.chapter === 'chat' && Object.hasOwn(chatScenarios, option))
      chatScenario.value = option as ChatScenario
    if (intent.chapter === 'api') {
      if (Object.hasOwn(outcomes, option)) outcome.value = option as Outcome
      wait.value = params.get('wait') === '1'
      timeout.value = params.get('timeout') === '1'
      failWrite.value = params.get('failWrite') === '1'
    }
  } else if (selected.value === 'ST' && (intent.hotspot || book?.open)) {
    opening.value = true
    active.openStudio(true)
    if (!(await until(() => active.studio?.progress === 1))) return
    if (intent.hotspot || book?.interior) active.interior()
    hot.value = intent.hotspot || null
    if (intent.hotspot === 'Frostwick') active.globe()
  } else if (intent.view) rig.go(intent.view)
  if (
    book?.pose &&
    book.target &&
    typeof book.zoom === 'number' &&
    book.portrait === rig.aspect < 1.18 &&
    (await until(() => !rig.moving))
  ) {
    rig.camera.position.fromArray(book.pose)
    rig.controls.target.fromArray(book.target)
    rig.camera.zoom = Math.max(
      rig.controls.minZoom,
      Math.min(rig.controls.maxZoom, book.zoom),
    )
    rig.camera.updateProjectionMatrix()
    rig.controls.update()
  }
  refresh()
}
watch(
  () => props.navigation,
  () => {
    manualSelection = false
    void navigate()
  },
)
function fail(reason: string, unsupported = false) {
  status.value = {}
  demo.value = ''
  stage.value = unsupported ? 'unsupported' : 'error'
  message.value = reason
  town?.dispose()
  town = undefined
  if (__CV_INSPECT__) delete (window as any).__cv
}
async function boot() {
  const seq = ++revision
  intentEpoch++
  manualSelection = false
  controlling.value = false
  phase.value = '正在接收模型'
  town?.dispose()
  town = undefined
  stage.value = 'loading'
  demo.value = ''
  message.value = ''
  loaded.value = 0
  total.value = 0
  selected.value = null
  opening.value = false
  hot.value = null
  pins.value = []
  const intent = props.compact
    ? undefined
    : retryTarget || readIntent(new URLSearchParams(location.search))
  selected.value = intent?.chapter ? 'hub' : intent?.place || null
  status.value = {}
  epoch.value++
  await nextTick()
  if (seq !== revision || !canvas.value) return
  try {
    town = new Town(canvas.value, {
      stage: (label) => {
        if (seq === revision) phase.value = label
      },
      progress: (n, t) => {
        if (seq === revision) {
          loaded.value = n
          total.value = t
        }
      },
      pick: (id) => {
        if (!props.compact) select(id)
      },
      hover: (id, x, y) => {
        hover.value = id
          ? {
              label: label(id),
              x: Math.min(x + 14, (canvas.value?.clientWidth ?? 600) - 160),
              y: Math.max(7, y - 38),
            }
          : null
      },
      status: refresh,
      pins: (v) => {
        pins.value = v
      },
      lost: () => {
        if (seq === revision) {
          const chapter = currentChapter()
          saveCamera(town, hot.value, chapter)
          retryTarget =
            chapter ||
            (selected.value
              ? { place: selected.value, hotspot: hot.value || undefined }
              : undefined)
          revision++
          fail('图形上下文已中断，可重新加载场景。')
        }
      },
    })
  } catch (e) {
    console.warn('Codeville renderer initialization failed', String(e))
    fail(
      '当前浏览器未能创建 WebGL 2 场景。可查看下方静态总览，或在支持 WebGL 2 的浏览器中重试。',
      true,
    )
    return
  }
  try {
    town.setTheme(theme.value)
    town.setQuality(quality.value)
    await town.load()
    if (seq !== revision) return
    stage.value = 'ready'
    if (manualSelection) town.select(selected.value)
    else if (!props.compact) {
      if (
        retryTarget ||
        readIntent(new URLSearchParams(location.search)) ||
        readCamera()
      )
        void navigate(true, retryTarget)
      else if (firstVisit()) town.rig!.enter()
    }
    retryTarget = undefined
    refresh()
    if (__CV_INSPECT__ && new URLSearchParams(location.search).has('inspect'))
      (window as any).__cv = {
        snapshot: () => town?.diagnostics(),
        owner: () => town,
        rig: () => town?.rig,
        project: (id: string) => town?.project(id),
        hit: (x: number, y: number) => town?.hit(x, y),
        motion: () => town?.motion,
        materialCount: () => town?.materialCount(),
        restart: boot,
        shadowCadence: (ms: number) => {
          if (town) town.shadowInterval = ms
        },
        inspectObject: (id: string) => town?.registry?.get(id),
        sample: (ms: number) => town?.stats.sample(ms),
      }
  } catch (e) {
    if (seq === revision) fail(e instanceof Error ? e.message : '资源加载中断')
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (controlling.value) controlling.value = false
    else if (performanceOpen.value) performanceOpen.value = false
    else if (hot.value) hot.value = null
    else select(null)
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  void boot()
})
onBeforeUnmount(() => {
  if (!props.compact) saveCamera(town, hot.value, currentChapter())
  intentEpoch++
  revision++
  window.removeEventListener('keydown', onKey)
  if (__CV_INSPECT__) delete (window as any).__cv
  town?.dispose()
})
</script>
<template>
  <div class="app" :class="{ compact }" :data-theme="theme" :data-stage="stage">
    <header>
      <div class="brand">
        <span class="brand-icon"><Icon name="town" /></span
        ><span>Codeville</span>
      </div>
      <div class="header-line"></div>
      <span class="header-sub">开发者小镇</span>
      <a class="model-choice" :href="'?' + modelSwitch()">{{
        rawModel ? '使用压缩模型' : '使用普通模型'
      }}</a>
      <div class="header-actions">
        <button
          class="theme-switch"
          @click="toggleTheme"
          aria-label="切换昼夜"
          :aria-pressed="theme === 'night'"
        >
          <span class="theme-glyph" aria-hidden="true">{{
            theme === 'day' ? '☀' : '☾'
          }}</span
          >{{ theme === 'day' ? '日光' : '夜色' }}
        </button>
        <button
          v-if="ready && !journey && !api && !chat"
          class="perf-btn motion-button"
          :disabled="status.motion?.reduced"
          @click="toggleMotion"
        >
          {{
            status.motion?.reduced
              ? '减少动态'
              : status.motion?.mode === 'running'
                ? '暂停动画'
                : '开启动画'
          }}
        </button>
        <label class="quality"
          ><Icon name="sun" /><select
            aria-label="画质"
            v-model="quality"
            @change="town?.setQuality(quality)"
          >
            <option value="auto">自动画质</option>
            <option value="high">高画质</option>
            <option value="low">轻量画质</option>
          </select></label
        >
        <button
          class="perf-btn"
          :aria-expanded="performanceOpen"
          @click="performanceOpen = !performanceOpen"
        >
          <Icon name="stats" />性能
        </button>
      </div>
    </header>
    <main>
      <div class="page-title">
        <div>
          <div class="crumb">
            <Icon name="map" />{{
              chat
                ? '系统演示 / 03'
                : api
                  ? '系统演示 / 01'
                  : journey
                    ? '系统演示 / 02'
                    : '交互地图'
            }}
          </div>
          <h1>
            {{
              chat
                ? '一条客服消息'
                : api
                  ? '一次 Nexus API 请求'
                  : journey
                    ? '一张工单的旅程'
                    : '小镇漫游'
            }}<span class="title-dot">.</span>
          </h1>
        </div>
        <div class="heading-note">
          <span class="desktop-hint">拖动旋转 · 滚轮缩放</span
          ><span class="touch-hint">单指旋转 · 双指缩放</span>
        </div>
      </div>
      <p v-if="status.journeyError" role="alert">
        演示已结束 · {{ status.journeyError }}
      </p>
      <div class="workspace" :class="{ storytelling: journey || api || chat }">
        <section
          class="map-stage"
          :class="{ 'touch-enabled': controlling }"
          aria-label="三维小镇地图"
        >
          <canvas
            :key="epoch"
            ref="canvas"
            data-map
            aria-label="拖动旋转地图，点击建筑查看详情"
          ></canvas>
          <div v-if="!controlling && ready" class="touch-shield"></div>
          <button
            v-if="ready"
            class="touch-toggle"
            @click="controlling = !controlling"
          >
            {{ controlling ? '结束操控' : '开始操控' }}
          </button>
          <template v-if="ready">
            <button
              v-if="status.entering"
              class="skip-entry"
              @click="skipEntry"
            >
              跳过入场
            </button>
            <div class="view-chip">
              <i></i
              >{{
                chat
                  ? '实时客服通信'
                  : api
                    ? api.stageName
                    : journey
                      ? shots[journey.step][0]
                      : status.view === 'vehicle'
                        ? '服务车随行'
                        : status.view === 'conveyor'
                          ? '传送带特写'
                          : labelView
              }}
            </div>
            <button
              v-if="!selected && status.view !== 'vehicle'"
              class="vehicle-view"
              @click="town?.observeVehicle()"
            >
              观察服务车
            </button>
            <div
              v-if="chat && !chat.finished && !status.moving"
              class="chat-marker"
              :style="anchorStyle(chat.marker)"
            >
              {{
                chat.path === 'nx'
                  ? 'Nexus'
                  : chat.path === 'outbound' || chat.path === 'inbound'
                    ? '身份通道'
                    : chat.path === 'desk'
                      ? '客服柜台'
                      : chat.path === 'intake'
                        ? '消息收件口'
                        : '通信塔'
              }}
            </div>
            <div
              v-if="chat && !chat.finished"
              class="scene-caption chat-caption"
            >
              <small>NEWCRISP · 本地模拟</small
              ><strong>{{ chat.protocol }}</strong>
            </div>
            <div
              v-if="api && !api.finished && !status.moving"
              class="api-marker"
              :class="{ reject: api.stopAt }"
              :style="anchorStyle(api.marker)"
            >
              {{
                api.stage === 6
                  ? '教学配额 · ' + api.used + ' / ' + api.limit
                  : api.stage === 7
                    ? 'RACK 01 · SHA256'
                    : api.title
              }}
            </div>
            <div v-if="api && !api.finished" class="scene-caption api-caption">
              <small>{{ api.location }}</small
              ><strong>{{
                api.step === 'response'
                  ? 'HTTP ' + api.status + ' · ' + api.body?.code
                  : api.title
              }}</strong>
            </div>
            <div
              v-if="journey && ['inserts', 'local'].includes(journey.step)"
              class="tx-marker"
              :class="{ saved: journey.ticketId }"
              :style="anchorStyle('NX.Anchor.Server')"
            >
              <span>support_ticket</span><span>support_ticket_outbox</span>
            </div>
            <div
              v-if="
                journey &&
                journey.imports &&
                ['road', 'FO', 'belt'].includes(shots[journey.step][3])
              "
              class="fo-marker"
              :style="anchorStyle('FO.Anchor.Dispatch')"
            >
              {{ journey.flow }} · 1 张
            </div>
            <div v-if="journey" class="scene-caption" aria-hidden="true">
              <template
                v-if="['draft', 'inserts', 'local'].includes(journey.step)"
              >
                <small>NEXUS · 本地事务</small>
                <div class="tx-pair" :class="{ committed: journey.ticketId }">
                  <b>工单记录</b><b>Outbox 事件</b>
                </div>
                <strong>{{
                  journey.ticketId
                    ? 'COMMIT · 同时生效'
                    : journey.step === 'inserts'
                      ? '两条 INSERT · 尚未提交'
                      : '等待提交'
                }}</strong>
              </template>
              <template v-else
                ><small>{{
                  journey.step === 'stale'
                    ? '旧 Worker'
                    : shots[journey.step][3] === 'road'
                      ? '跨系统传输'
                      : shots[journey.step][3] === 'NX'
                        ? 'NEXUS'
                        : 'FLOWOPS'
                }}</small>
                <strong>{{
                  journey.step === 'lost'
                    ? '201 回执丢失'
                    : journey.step === 'wait'
                      ? 'NETWORK_ERROR'
                      : journey.step === 'done'
                        ? 'UPDATE × 1 · DELIVERED'
                        : journey.step === 'stale'
                          ? 'UPDATE × 0'
                          : journey.step === 'open'
                            ? 'OPEN · 事务内'
                            : journey.step === 'assign'
                              ? 'ASSIGNED · 事务内'
                              : journey.step === 'queue'
                                ? journey.flow
                                : shots[journey.step][0]
                }}</strong>
              </template>
            </div>
            <MapCompass v-if="!compact && town?.rig" :key="epoch" :controls="town.rig.controls" />
            <div v-if="!selected" class="map-angles" aria-label="总览角度">
              <button
                @click="observe('plan')"
                :aria-pressed="status.view === 'plan'"
              >
                鸟瞰
              </button>
              <button
                @click="observe('reverse')"
                :aria-pressed="status.view === 'reverse'"
              >
                反向
              </button>
            </div>
            <div class="controls">
              <button
                title="放大"
                aria-label="放大"
                @click="town?.rig?.zoom(1.24)"
              >
                <Icon name="plus" /></button
              ><button
                title="缩小"
                aria-label="缩小"
                @click="town?.rig?.zoom(1 / 1.24)"
              >
                <Icon name="minus" /></button
              ><b></b
              ><button
                aria-label="返回总览"
                title="返回总览"
                @click="select(null)"
              >
                <Icon name="home" />
              </button>
            </div>
            <div
              v-if="hover"
              class="tooltip"
              :style="{ left: hover.x + 'px', top: hover.y + 'px' }"
            >
              {{ hover.label }}
            </div>
            <template v-if="state.inside"
              ><button
                v-for="p in pins"
                :key="p.key"
                class="pin"
                :class="{ active: hot === p.key }"
                :style="{ left: p.x + 'px', top: p.y + 'px' }"
                :aria-label="hotspots[p.key][0] + '热点'"
                :title="hotspots[p.key][0]"
                @click="chooseHot(p.key)"
              >
                {{ spots.indexOf(p.key) + 1 }}
              </button></template
            >
          </template>
          <div
            v-else
            class="loading"
            :style="{ backgroundImage: 'url(' + poster + ')' }"
          >
            <div class="loading-card" role="status">
              <strong>{{
                stage === 'loading'
                  ? phase
                  : stage === 'unsupported'
                    ? '静态总览'
                    : '场景加载失败'
              }}</strong
              ><template v-if="stage === 'loading'"
                ><progress
                  :value="total ? loaded : undefined"
                  :max="total || 1"
                ></progress
                ><small
                  >{{
                    loaded
                      ? (loaded / 1048576).toFixed(1) + ' MiB'
                      : '正在读取资源'
                  }}{{
                    total ? ' / ' + (total / 1048576).toFixed(1) + ' MiB' : ''
                  }}</small
                ></template
              ><template v-else
                ><p>{{ message }}</p>
                <button class="primary" @click="boot">
                  重新加载
                </button></template
              >
            </div>
          </div>
        </section>
        <aside :class="{ detail: selected }" aria-label="地点信息">
          <SupportChatPanel
            v-if="chat"
            :state="chat"
            @toggle="toggleStory"
            @next="nextStep"
            @replay="startChat(true)"
            @retry="retryChat"
            @cancel="select(null)"
          />
          <ApiRequestPanel
            v-else-if="api"
            :state="api"
            @toggle="toggleStory"
            @next="nextStep"
            @replay="startApi(true)"
            @cancel="select(null)"
          />
          <JourneyPanel
            v-else-if="journey"
            :state="journey"
            @toggle="toggleStory"
            @next="nextStep"
            @staff="staffAction"
            @replay="startJourney(true)"
            @cancel="select(null)"
          />
          <template v-else-if="!selected"
            ><div class="aside-title">
              <span class="section-mark"></span>
              <h2>建筑索引</h2>
            </div>
            <p class="muted intro">选择地点，走近项目与工作室。</p>
            <nav class="places">
              <button
                v-for="k in keys"
                :key="k"
                :data-place="k"
                @click="select(k)"
              >
                <img :src="assets + k + '.jpg'" alt="" /><span
                  ><strong>{{ buildings[k].name }}</strong
                  ><small>{{ buildings[k].type }}</small></span
                ><Icon name="chev" />
              </button>
            </nav>
            <button class="hub-link" data-place="hub" @click="select('hub')">
              <span class="orbit-icon"><Icon name="orbit" /></span
              ><span><strong>中央双环</strong><small>系统演示入口</small></span
              ><Icon name="arrow" />
            </button>
            <section class="districts" v-if="ready" aria-label="环境观察">
              <h3>环境观察</h3>
              <nav>
                <button
                  v-for="(name, key) in districtNames"
                  :key="key"
                  :data-view="key"
                  :aria-pressed="status.view === key"
                  @click="observe(key)"
                >
                  {{ name }}
                </button>
              </nav>
            </section>
          </template>
          <template v-else
            ><button class="back" @click="select(null)">
              <Icon name="back" />建筑索引
            </button>
            <template v-if="project"
              ><h2 class="place-name">{{ project.name }}</h2>
              <div class="type">
                <i :style="{ background: project.color }"></i>{{ project.type }}
              </div>
              <p class="description">{{ project.description }}</p>
              <a
                v-if="selected && selected !== 'hub'"
                class="portfolio-detail"
                :href="
                  href(
                    selected === 'ST'
                      ? '/studio/'
                      : '/projects/' +
                          { NX: 'nexus', FO: 'flowops', NC: 'newcrisp' }[
                            selected
                          ] +
                          '/',
                  )
                "
                >{{
                  selected === 'ST' ? '阅读工作室资料' : '阅读项目详情'
                }}
                →</a
              >
              <button
                v-if="ready && selected === 'FO'"
                class="secondary"
                @click="town?.observeConveyor()"
              >
                {{ status.view === 'conveyor' ? '建筑全貌' : '观察传送带' }}
              </button>
              <template v-if="selected !== 'ST'"
                ><h3>核心功能</h3>
                <ul>
                  <li v-for="item in project.features" :key="item">
                    {{ item }}
                  </li>
                </ul>
                <h3>技术栈</h3>
                <div class="stack">
                  <span v-for="s in project.stack" :key="s">{{ s }}</span>
                </div>
                <a
                  class="primary"
                  :href="project.url"
                  target="_blank"
                  rel="noopener"
                  >查看 GitHub <Icon name="out" /></a
              ></template>
              <template v-else>
                <a
                  v-if="!ready"
                  class="primary"
                  :href="project.url"
                  target="_blank"
                  rel="noopener"
                  >查看 GitHub ↗</a
                >
                <div v-if="ready" class="studio-actions">
                  <button
                    v-if="!opening"
                    class="primary"
                    @click="moveStudio(true)"
                  >
                    展开工作室 <Icon name="arrow" /></button
                  ><template v-else
                    ><button
                      v-if="!state.inside"
                      class="primary"
                      :disabled="state.progress !== 1"
                      @click="town?.interior()"
                    >
                      观察室内 <Icon name="target" /></button
                    ><button class="secondary" @click="moveStudio(false)">
                      收拢工作室
                    </button></template
                  >
                </div>
                <template v-if="state.inside"
                  ><h3>室内陈设</h3>
                  <div class="spots">
                    <button
                      v-for="(k, i) in spots"
                      :key="k"
                      :class="{ active: hot === k }"
                      @click="chooseHot(k)"
                    >
                      {{ i + 1 }} · {{ hotspots[k][0] }}
                    </button>
                  </div>
                  <div v-if="hot" class="hot-info">
                    <b>{{ hotspots[hot][1] }}</b>
                    <p>{{ hotspots[hot][2] }}</p>
                    <a
                      v-if="hot === 'Computer'"
                      href="https://github.com/jianxiaomiao"
                      target="_blank"
                      rel="noopener"
                      >GitHub ↗</a
                    ><button
                      v-if="hot === 'Frostwick'"
                      class="secondary"
                      @click="
                        status.view === 'globe'
                          ? town?.interior()
                          : town?.globe()
                      "
                    >
                      {{ status.view === 'globe' ? '返回室内' : '收藏品特写' }}
                    </button>
                  </div></template
                >
              </template></template
            >
            <template v-else
              ><div class="feature-orbit"><Icon name="orbit" /></div>
              <h2 class="place-name cn">中央双环</h2>
              <p class="description">选择要查看的系统演示。</p>
              <div class="demo-list">
                <button v-for="d in demos" :key="d" @click="demo = d">
                  {{ d }}<Icon name="chev" />
                </button>
              </div>
              <div
                v-if="demo === '可靠工单投递' && ready"
                class="journey-launch hot-info"
              >
                <small>可靠工单投递 · 本地模拟</small>
                <h3>一张工单的旅程</h3>
                <p>
                  跟随同一张工单，从 Nexus 的提交事务走到 FlowOps 的部门队列。
                </p>
                <label
                  >剧情<select v-model="scenario" aria-label="选择剧情">
                    <option
                      v-for="(name, key) in scenarios"
                      :value="key"
                      :key="key"
                    >
                      {{ name }}
                    </option>
                  </select></label
                >
                <button class="primary" @click="startJourney(true)">
                  自动播放
                </button>
                <button class="secondary" @click="startJourney(false)">
                  分步播放
                </button>
              </div>
              <div
                v-else-if="demo === 'API 请求' && ready"
                class="journey-launch hot-info api-launch"
              >
                <small>Chapter 01 · The Life of an API Request</small>
                <h3>一次 Nexus API 请求</h3>
                <p>
                  跟随 hello 进入机房，观察请求在哪一步返回，以及用量何时写入。
                </p>
                <label
                  >剧情<select v-model="outcome" aria-label="请求结果">
                    <option
                      v-for="(name, key) in outcomes"
                      :key="key"
                      :value="key"
                    >
                      {{ name }}
                    </option>
                  </select></label
                >
                <label v-if="outcome === 'rate'"
                  ><input type="checkbox" v-model="timeout" />
                  排队后超时（默认立即队满）</label
                >
                <template v-else
                  ><label
                    ><input type="checkbox" v-model="wait" />
                    等待后获得许可</label
                  >
                  <label
                    ><input type="checkbox" v-model="failWrite" />
                    模拟用量写入失败</label
                  ></template
                >
                <button class="primary" @click="startApi(true)">
                  自动播放
                </button>
                <button class="secondary" @click="startApi(false)">
                  分步播放
                </button>
              </div>
              <div
                v-else-if="demo === '实时客服通信' && ready"
                class="journey-launch hot-info"
              >
                <small>Chapter 03 · The Journey of a Message</small>
                <h3>一条客服消息</h3>
                <p>从 Nexus 进入通信邮局，跟随一条咨询直到客户读到回复。</p>
                <label
                  >剧情<select v-model="chatScenario" aria-label="客服剧情">
                    <option
                      v-for="(name, key) in chatScenarios"
                      :key="key"
                      :value="key"
                    >
                      {{ name }}
                    </option>
                  </select></label
                >
                <button class="primary" @click="startChat(true)">
                  自动播放
                </button>
                <button class="secondary" @click="startChat(false)">
                  分步播放
                </button>
              </div>
              <p v-else-if="demo" class="hot-info">
                {{ demo }} · 演示入口已预留。
              </p></template
            >
            <label class="switcher"
              >前往<select
                aria-label="切换地点"
                :value="selected"
                @change="
                  select(($event.target as HTMLSelectElement).value as Place)
                "
              >
                <option v-for="k in keys" :key="k" :value="k">
                  {{ buildings[k].name }}
                </option>
                <option value="hub">中央双环</option>
              </select></label
            >
          </template>
        </aside>
      </div>
    </main>
    <div
      class="perf"
      v-if="performanceOpen"
      role="dialog"
      aria-label="渲染性能"
    >
      <div class="aside-title">
        <h2>渲染性能</h2>
        <button aria-label="关闭性能面板" @click="performanceOpen = false">
          <Icon name="close" />
        </button>
      </div>
      <template v-if="ready"
        ><button
          class="secondary"
          :disabled="!!journey || !!api || !!chat"
          @click="stopMotion"
        >
          停止并复位
        </button>
        <p class="gpu">{{ status.gpu }}</p>
        <dl>
          <template
            v-for="[k, v] in [
              ['帧率', Math.round(status.fps) + ' FPS'],
              ['绘制调用', status.calls],
              ['提交三角面', Number(status.triangles).toLocaleString()],
              ['渲染器纹理', status.textures],
              ['实时阴影', status.shadows ? '开启' : '关闭'],
              ['像素比', status.dpr],
              ['首次可交互', Math.round(status.readyMs) + ' ms'],
            ]"
            :key="k"
            ><dt>{{ k }}</dt>
            <dd>{{ v }}</dd></template
          >
        </dl></template
      >
      <p v-else>等待场景就绪。</p>
    </div>
  </div>
</template>
