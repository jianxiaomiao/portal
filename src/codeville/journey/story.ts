// Deterministic local fixtures. Neither the submission key nor the claim token travels in the POST.
export const submissionKey = '0ff9c91a-0100-4000-8000-000000000001'
export const payload = Object.freeze({
  schemaVersion: 1, eventId: 'bd404a14-2000-4000-8000-000000000002',
  externalTicketId: 'aa74b10c-1000-4000-8000-000000000001',
  title: '导出记录缺少一行', description: '请核对今天的导出记录。',
  submittedAt: '2026-11-27T02:00:00Z', applicationId: null,
})
export const changedPayload = Object.freeze({...payload, title:'被改写的标题'})
export async function prepareDigests() {
  async function digest(value: object) {
    const bytes = new TextEncoder().encode(JSON.stringify(value))
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return Array.from(hash, n => n.toString(16).padStart(2,'0')).join('')
  }
  return {original: await digest(payload), altered: await digest(changedPayload)}
}
const binding = 'tenant-01 / nexus-a'
const tokens = ['c13a1000-0000-4000-8000-000000000001', 'c13a2000-0000-4000-8000-000000000002']
export const scenarios = {
  lost: '首次回执丢失', normal: '首次投递成功', conflict: '重放内容冲突',
  invalid: '回执校验失败', stale: '旧 Worker 租约过期',
}
export type Scenario = keyof typeof scenarios
type Ack = { eventId: string; externalTicketId: string; flowOpsTicketId: string; ticketNo: string }
export class Ledger {
  constructor(private digests: Awaited<ReturnType<typeof prepareDigests>>) {}
  requestDigest = ''
  deliveredAt = ''
  ticketId = ''
  outbox = '—'
  flow = '—'
  attempt = 0
  token = ''
  previousToken = ''
  request = payload
  http = 0
  failure = ''
  checked = false
  leased = false
  written: number | null = null
  imports = 0
  assignments = 0
  ack: Ack | null = null
  confirmedNo = ''
  expiredReply: { token: string; ack: Ack } | null = null
  private link?: { binding: string; digest: string; ack: Ack }
  inspect() { this.requestDigest = this.digests.original }
  commitLocal() { this.ticketId = payload.externalTicketId; this.outbox = 'PENDING' }
  claim() {
    if (this.outbox !== 'PENDING' && !(this.outbox === 'PROCESSING' && !this.leased)) throw Error('事件不可认领')
    this.previousToken = this.token || (this.attempt ? tokens[this.attempt - 1] : '')
    this.attempt++
    this.token = tokens[this.attempt - 1]
    this.leased = true
    this.outbox = 'PROCESSING'
    this.request = payload
    this.http = 0
    this.ack = null
    this.checked = false
    this.written = null
    this.failure = ''
  }
  commitImport() {
    if (this.link) throw Error('重复首次导入')
    const ack = { eventId: payload.eventId, externalTicketId: payload.externalTicketId, flowOpsTicketId: '12345', ticketNo: 'OPS-20261127-0001' }
    this.link = { binding, digest:this.digests.original, ack }
    this.imports++
    this.assignments++
    this.flow = 'ASSIGNED'
    this.ack = {...ack}
    this.http = 201
  }
  replay(alter: boolean) {
    const incoming = alter ? changedPayload : this.request
    this.requestDigest = alter ? this.digests.altered : this.digests.original
    if (!this.link || this.link.binding !== binding) throw Error('找不到绑定记录')
    if (this.link.ack.eventId !== incoming.eventId || this.link.ack.externalTicketId !== incoming.externalTicketId || this.link.digest !== this.requestDigest) { this.http = 409; this.ack = null; return }
    this.ack = {...this.link.ack}
    this.http = 200
  }
  fail(reason: string, permanent = false) {
    if (!this.leased) throw Error('失效令牌不能写失败状态')
    this.outbox = permanent || this.attempt >= 12 ? 'BLOCKED' : 'PENDING'
    this.failure = reason
    this.leased = false
    this.token = ''
    this.checked = false
  }
  validate(ack = this.ack) {
    return (this.http === 200 || this.http === 201) && !!ack &&
      new TextEncoder().encode(JSON.stringify(ack)).length <= 4096 &&
      ack.eventId === payload.eventId && ack.externalTicketId === this.ticketId &&
      /^[1-9][0-9]{0,19}$/.test(ack.flowOpsTicketId) && /^[A-Za-z0-9_-]{1,40}$/.test(ack.ticketNo)
  }
  confirm(worker: string) {
    this.written = 0
    if (this.outbox !== 'PROCESSING' || !this.leased || worker !== this.token || !this.validate()) return
    this.written = 1
    this.confirmedNo = this.ack!.ticketNo
    this.deliveredAt = this.attempt === 1 ? '2026-11-27T02:00:02Z' : '2026-11-27T02:01:03Z'
    this.outbox = 'DELIVERED'
    this.leased = false
    this.token = ''
  }
  staff() {
    if (this.flow === 'ASSIGNED') this.flow = 'ACCEPTED'
    else if (this.flow === 'ACCEPTED') this.flow = 'PROCESSING'
  }
}

type Shot = [title: string, description: string, seconds: number, view: 'NX'|'FO'|'road'|'belt']
export const shots = {
  draft: ['填写工单', '导出记录缺少一行。控制台为这次用户提交保留一个 Idempotency-Key。', 4, 'NX'],
  inserts: ['写入同一事务', '工单与 Outbox 已分别执行 INSERT，两条记录都在等待同一次提交。', 4, 'NX'],
  local: ['本地提交成功', '同一次 COMMIT 保存申请与待投递事件，现在可以向提交人返回 201。', 4, 'NX'],
  claim: ['Worker 认领事件', '行锁保护这次认领。写入次数、令牌与 60 秒租约，认领事务提交后才发请求。', 4, 'NX'],
  drive: ['向 FlowOps 投递', '服务车携带原事件。同步 HTTP POST 发送冻结的 JSON，X-Trace-Id 使用 eventId。', 6, 'road'],
  auth: ['核验机器身份', '扫描门读取机器凭据对应的启用绑定。租户、部门和技术账号来自接收端。', 3, 'belt'],
  inspect: ['查找外部关联', '请求通过字段校验。同一租户与绑定下未找到外部单号或事件号，插入关联占位。', 4, 'belt'],
  open: ['创建 OPEN 工单', '在导入事务内生成编号、SLA 快照与 CREATE 历史。外部仍看不到这张工单。', 3, 'belt'],
  assign: ['分派到绑定部门', '写入部门分派、ASSIGN 历史、内部 Outbox，回填关联 ID。负责人仍为空。', 3, 'belt'],
  imported: ['FlowOps 提交成功', '这张工单现在可在部门队列领取。FlowOps 返回 HTTP 201 和四字段回执。', 4, 'FO'],
  lost: ['回执在途中丢失', 'FlowOps 已经提交。Nexus 尚未得到有效回执，无法从网络错误推断远端结果。', 4, 'road'],
  wait: ['原事件等待重试', 'Worker 在有效租约内写回 NETWORK_ERROR。事件回到 PENDING，本例退避 3 秒。', 3, 'NX'],
  reclaim: ['重新认领原事件', 'attempt_count 变为 2，认领令牌换新。工单 ID、事件 ID 和已存载荷保持原值。', 4, 'NX'],
  retry: ['再次发送原包裹', '沿同一路径再次 POST。此包裹仍对应之前的 Nexus 工单与 Outbox 事件。', 5, 'road'],
  match: ['幂等命中', '两个标识及内容摘要与同绑定的关联记录一致。读取原工单，返回同一份 ACK，HTTP 200。', 4, 'belt'],
  ack: ['回执抵达 Nexus', '回程光点带回四字段 ACK，Nexus 仍需校验并写回。', 4, 'road'],
  valid: ['校验回执', '核对 HTTP、回执长度、事件和外部单号，以及 FlowOps ID 和编号格式。', 4, 'NX'],
  done: ['Nexus 确认送达', '当前令牌、PROCESSING 状态及有效租约均匹配，条件 UPDATE 命中 1 行，保存回执与送达时间。', 4, 'NX'],
  queue: ['查看部门工单', '送达流程结束。客服可独立领取工单，再执行“开始处理”。', 4, 'FO'],
  mismatch: ['内容与原件冲突', '故障注入仅改写重放请求的标题。同一标识的摘要不一致，FlowOps 返回 409 / 30015。', 4, 'belt'],
  blocked: ['冲突需要人工核对', 'Nexus 收到 HTTP 409，写入 BLOCKED。原工单仍在，自动扫描跳过该事件。', 5, 'NX'],
  bad: ['回执校验失败', '故障注入改写响应的 eventId。虽然 HTTP 为 201，校验仍得到 INVALID_ACK。', 4, 'NX'],
  badwait: ['无效回执等待重投', '本轮还有认领预算。有效租约下写回 PENDING，随后用原始载荷重试。', 3, 'NX'],
  expire: ['第一份租约到期', '时间跳至数据库租约期限。旧 Worker 的响应延迟，Outbox 仍为 PROCESSING。', 4, 'NX'],
  stale: ['旧 Worker 写回被拒', '旧回执与工单匹配，但使用第一次的令牌。条件 UPDATE 命中 0 行，第二次认领仍有效。', 5, 'NX'],
} satisfies Record<string, Shot>
export type Step = keyof typeof shots
export function script(s: Scenario): Step[] {
  const start: Step[] = ['draft','inserts','local','claim','drive','auth','inspect','open','assign','imported']
  const finish: Step[] = ['ack','valid','done','queue']
  if (s === 'normal') return [...start,...finish]
  const fault: Step[] = s === 'invalid' ? ['bad','badwait'] : s === 'stale' ? ['expire'] : ['lost','wait']
  return [...start,...fault,'reclaim',...(s === 'stale' ? ['stale'] as Step[] : []),'retry',
    ...(s === 'conflict' ? ['mismatch','blocked'] as Step[] : ['match' as Step,...finish])]
}
export function enact(step: Step, db: Ledger) {
  switch (step) {
    case 'inspect': db.inspect(); break
    case 'local': db.commitLocal(); break
    case 'claim': case 'reclaim': db.claim(); break
    case 'imported': db.commitImport(); break
    case 'lost': db.ack = null; break
    case 'wait': db.fail('NETWORK_ERROR'); break
    case 'expire': db.expiredReply = {token:db.token, ack:{...db.ack!}}; db.leased = false; break
    case 'stale': {
      // The first worker kept its own valid 201 response while the second acquired the row.
      const reply = db.expiredReply!
      db.http = 201; db.ack = reply.ack
      db.confirm(reply.token)
      break
    }
    case 'match': case 'mismatch': db.replay(step === 'mismatch'); break
    case 'blocked': db.fail('HTTP_409', true); break
    case 'bad': db.ack = {...db.ack!, eventId:submissionKey}; db.checked = db.validate(); break
    case 'badwait': db.fail('INVALID_ACK'); break
    case 'valid': db.checked = db.validate(); break
    case 'done':
      if (!db.checked) throw Error('尚未取得有效回执')
      db.confirm(db.token)
      if (db.written !== 1) throw Error('当前认领无法确认送达')
      break
  }
}
