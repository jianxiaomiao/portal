export const scenarios = {
  normal: '双向消息',
  lost: '保存后 ACK 丢失',
  offline: '断线与消息补拉',
  transfer: '领取竞争与主管转派',
} as const
export type Scenario = keyof typeof scenarios
export const question = '请问在哪里查看订单进度？'
export const reply = '可以在订单详情查看。'

type Path = 'nx' | 'outbound' | 'inbound' | 'tower' | 'intake' | 'desk'
type Cue = readonly [title: string, protocol: string, explanation: string, path: Path, seconds: number]
export const cues = {
  launch: ['点击在线客服','POST /api/support/chat/launch','Nexus 验证用户 access JWT、账号状态和当前登录会话。','nx',2.6],
  issue: ['签发一次性入场券','POST /integrations/nexus/launch-grants','集成机器凭证确定租户和接入绑定。本例同步用户画像快照；另一版本的画像开关默认关闭。','outbound',2.8],
  grant: ['把入场地址交给浏览器','201 → data.action / data.grant','NewCrisp 把 grant 返回 Nexus；Nexus 将表单目的地址和一次性 grant 交给浏览器。','inbound',2.4],
  form: ['浏览器提交入场表单','POST /launch/nexus','浏览器向 action 提交隐藏 grant 字段，NewCrisp 核对来源和有效期。','tower',1.8],
  verify: ['回查 Nexus 登录会话','POST /api/internal/support/chat/session-status','NewCrisp 使用独立回查机器凭证，携带外部用户和登录会话编号。','inbound',2.1],
  bind: ['绑定客户身份','204 → COMMIT → 303','Nexus 确认有效。NewCrisp 在事务中消费 grant，绑定客户、创建 customer_session 和启动刷新凭证；浏览器跳转客服页。','outbound',2.6],
  refresh: ['换取客服访问身份','POST /api/v1/customer/session/refresh','浏览器提交启动刷新 Cookie 与 CSRF；NewCrisp 再次回查 Nexus 登录状态。','inbound',2],
  jwt: ['进入客户页面','204 → NewCrisp access JWT','回查通过，NewCrisp 轮换刷新凭证并签发客户侧 access JWT。此时尚无业务会话。','outbound',2],
  ticket: ['领取客户接线票','POST /api/v1/customer/ws-ticket','用客服访问 JWT 换一次性 ticket，票据只用于当前侧别的接线。','tower',1.7],
  upgrade: ['连接已升级','/ws/customer → auth','WebSocket 已打开，浏览器以 ticket 发送 auth 首帧，等待认证。','tower',1.5],
  ready: ['客户通道就绪','ready','服务端消费票据并确认 actor；浏览器核对身份后可以发送。','tower',1.5],
  send: ['客户发出第一条提问','conversation.start','尝试生成 requestId，用 clientMessageId 标识这条提问。客户先看到本地发送中。','intake',2],
  receive: ['收件口收到命令','ChatWebSocket.handleTextMessage','解析请求、刷新身份，进入写事务；尚未向发送者确认保存。','intake',1.8],
  commit: ['首问与通知一同提交','COMMIT · seq 1','锁定客户，创建 WAITING 会话，写入 seq 1、更新游标、追加通知 Outbox，一次提交。样例关闭欢迎语。','intake',2.7],
  ack: ['客户拿到保存回执','message.ack','ACK 关联本次请求并带回已存的 seq 1。此刻没有负责坐席。','tower',1.8],
  lost: ['保存回执在途中丢失','SEND_RESULT_UNKNOWN','库中保留 seq 1，客户恢复原草稿。是否再次尝试由客户决定。','intake',2.5],
  retry: ['客户重试原提问','conversation.start','新 requestId，保留原 clientMessageId、原内容及首发操作。','intake',2.2],
  replay: ['返回第一次的保存结果','message.ack · replayed=true','服务端匹配原记录并返回 seq 1，本次重放新增消息 0 条、通知 0 条。','intake',2.5],
  staffTicket: ['客服上线领票','POST /api/v1/staff/ws-ticket','同部门的客服用各自员工身份领票。队列补分配在本例中关闭。','desk',1.8],
  staffAuth: ['员工连接已升级','/ws/staff → auth','员工浏览器独立升级连接，以一次性员工票据发送认证首帧。','tower',1.5],
  queue: ['待领取队列出现摘要','ready · GET ?view=PENDING','同部门坐席可看到排队摘要。会话全文在领取后读取。','desk',2.1],
  claim: ['A 领取这条咨询','CLAIM · stateVersion 0 → 1','锁内检查部门及版本，WAITING 转为 ACTIVE，唯一负责人是 A。','desk',2.4],
  race: ['两名坐席同时领取','CLAIM × 2 · expected version 0','A 和 B 分别带着自己的 actionId，观察到同一旧版本。','desk',2.2],
  winner: ['领取结果分开返回','A 200 · B 409','A 领取成功，B 的旧版本冲突。S1 只出现在 A 的负责列表。','desk',2.2],
  history: ['负责人打开 S1','GET detail / messages','工作台在同一员工连接上选择 S1，通过详情和消息接口读取 seq 1。列表可同时有其他独立会话。','desk',2.1],
  staffRead: ['客服看到了提问','PUT read-position · upToSeq 1','负责人的可见消息行推进 staffReadSeq，客户可按对方阅读位置显示已读。','desk',1.4],
  transfer: ['主管把会话转派给 B','TRANSFER · stateVersion 1 → 2','另一个有测试依据的交接场景：B 取得处理权，原普通坐席 A 的连接继续 ready。','desk',2.6],
  revoke: ['旧负责人的视图更新','sync.required → GET detail','A 失去 S1 全文及回复权限，B 打开历史。后续正文只发给仍可读的连接。','desk',2],
  offline: ['客户网络中断','WebSocket close','客户连接离线，页面暂时保留 seq 1；A 可以在有效权限下回复。','tower',2.1],
  answer: ['客服回复客户','message.send','带 S1、当前版本、新 requestId 和新 clientMessageId。先校验员工仍是负责人。','desk',2.2],
  answerCommit: ['保存客服回复','COMMIT · seq 2','同事务写入回复、游标与通知。本次示例选择一种 ACK 和派发顺序；两者在提交后可交错。','intake',2.4],
  answerAck: ['客服拿到保存回执','message.ack','回复发送者取得 seq 2 的保存结果，客户页面是否出现正文仍需另行观察。','desk',1.6],
  dispatch: ['处理回复通知','chat_outbox → publish','调度器筛选租户与可读身份。完成本次通知处理不会产生逐设备送达回执。','tower',1.7],
  display: ['客户窗口出现回复','message.created · sync.required','当前客户收到正文，按 seq 合并并同步；原文已经显示，阅读位置尚未推进。','intake',2],
  reconnect: ['客户恢复网络','POST /api/v1/customer/ws-ticket','使用仍然有效的客服身份重新领票；没有自动重发草稿。','tower',2],
  reauth: ['重新打开客户连接','upgrade → auth','新票据用于新连接的首帧认证。','tower',1.5],
  reready: ['连接重新就绪','ready','已重建连接，客户屏幕此刻仍只有 seq 1。','tower',1.6],
  pull: ['查询本会话缺失消息','GET messages?afterSeq=1','HTTP 返回当前 S1 的 seq 2。此例只覆盖一次离线期间的单条回复。','intake',2],
  merge: ['按序号合并回复','S1 · merge(seq 2)','以 seq 为键去重，客户页面现在显示回复正文。','intake',1.9],
  read: ['客户可见行推进水位','PUT read-position','页面与消息行可见，客户提交 upToSeq=2 及当前 stateVersion，保存 customerReadSeq。','desk',2.2],
  seen: ['客服看到已读','GET detail · counterpartReadSeq=2','工作台刷新详情，按对方水位将回复标为已读。这段对话继续保持 ACTIVE。','desk',2.6],
} as const satisfies Record<string,Cue>
export type Step = keyof typeof cues
export function sequence(s: Scenario): Step[] {
  return ['launch','issue','grant','form','verify','bind','refresh','jwt','ticket','upgrade','ready','send','receive','commit',
    ...(s === 'lost' ? ['lost','retry','replay'] as const : ['ack'] as const),
    'staffTicket','staffAuth','queue',...(s === 'transfer' ? ['race','winner'] as const : ['claim'] as const),'history','staffRead',
    ...(s === 'transfer' ? ['transfer','revoke'] as const : []), ...(s === 'offline' ? ['offline'] as const : []),
    'answer','answerCommit','answerAck','dispatch',...(s === 'offline' ? ['reconnect','reauth','reready','pull','merge'] as const : ['display'] as const),
    'read','seen']
}

type Message = {seq:number; text:string; key:string}
type Connection = '离线' | '已领票' | '已升级 · 待认证' | 'ready'
export class ChatState {
  grant = '—'
  session = false
  access = false
  clientWs: Connection = '离线'
  staffWs: Connection = '离线'
  clientTicket = 0
  status: '—' | 'WAITING' | 'ACTIVE' = '—'
  owner = ''
  version = 0
  rows: Message[] = []
  clientLog: Message[] = []
  staffLog: Message[] = []
  fetched: Message[] = []
  claimResponses: number[] = []
  requestVersion: number | null = null
  requestActor = ''
  upToSeq: number | null = null
  visibleRead: {side:'client'|'staff'; seq:number} | null = null
  clientSeq = 0
  staffSeq = 0
  clientRead = 0
  staffRead = 0
  counterpartRead = 0
  requestId = ''
  key = ''
  action = ''
  pending = ''
  draft = ''
  ack = ''
  outbox = '—'
  messageEvents = 0
  selected = ''
  replayed = false
  constructor(readonly scenario: Scenario) {}
  private save(text: string) {
    const previous = this.rows.find(row => row.key === this.key)
    if (previous) {
      if (previous.text !== text) throw Error('消息标识冲突')
      this.replayed = true
      return previous
    }
    const row = {seq:this.rows.length+1,text,key:this.key}
    this.rows.push(row)
    this.messageEvents++
    this.outbox = '消息通知已入库'
    return row
  }
  private merge(side: 'client'|'staff', items: Message[]) {
    const log=side==='client' ? this.clientLog : this.staffLog
    const merged=new Map(log.map(row=>[row.seq,row]))
    for (const row of items) merged.set(row.seq,row)
    const sorted=[...merged.values()].sort((a,b)=>a.seq-b.seq)
    if(side==='client') { this.clientLog=sorted; this.clientSeq=sorted.at(-1)?.seq ?? 0 }
    else { this.staffLog=sorted; this.staffSeq=sorted.at(-1)?.seq ?? 0 }
  }
  private claim(actor:string, expected:number) {
    if(this.version!==expected || this.status!=='WAITING') return 409
    this.owner=actor
    this.version++
    this.status='ACTIVE'
    return 200
  }
  private advanceRead(side:'client'|'staff', visibleSeq:number, version:number) {
    const log=side==='client' ? this.clientLog : this.staffLog
    if(this.visibleRead?.side!==side || this.visibleRead.seq!==visibleSeq) return
    if(!log.some(row=>row.seq===visibleSeq) || version!==this.version) return
    this.upToSeq=visibleSeq
    if(side==='client') this.clientRead=Math.max(this.clientRead,visibleSeq)
    else if(this.selected==='S1') this.staffRead=Math.max(this.staffRead,visibleSeq)
  }
  enter(step: Step) {
    this.upToSeq = null
    this.visibleRead = null
    switch (step) {
      case 'issue': this.grant = '已签发 · ••••'; break
      case 'bind':
        if(this.grant!=='已签发 · ••••') throw Error('无法消费入场券')
        this.grant = '已消费'; this.session = true; break
      case 'jwt': this.access = true; break
      case 'ticket': case 'reconnect':
        if(!this.access) throw Error('客户访问身份尚未建立')
        this.clientTicket++; this.clientWs = '已领票'; break
      case 'upgrade': case 'reauth': this.clientWs = '已升级 · 待认证'; break
      case 'ready': case 'reready': this.clientWs = 'ready'; break
      case 'send':
        if(this.clientWs!=='ready') throw Error('客户端尚未认证')
        this.requestId = 'r1'; this.key = 'm1'; this.pending = '发送中'; break
      case 'commit': this.save(question); this.status = 'WAITING'; break
      case 'ack': case 'replay':
        if (step === 'replay') this.save(question)
        this.ack = this.requestId
        this.pending = ''; this.merge('client',[this.rows[0]]); break
      case 'lost': this.pending = '结果未知'; this.draft = question; break
      case 'retry': this.requestId = 'r2'; this.pending = '发送中'; this.draft = ''; break
      case 'staffTicket': this.staffWs = '已领票'; break
      case 'staffAuth': this.staffWs = '已升级 · 待认证'; break
      case 'queue': this.staffWs = 'ready'; break
      case 'race': this.action = 'claim-A / claim-B'; break
      case 'winner': case 'claim':
        {
          const expected = this.version
          this.claimResponses = (step==='winner' ? ['A','B'] : ['A']).map(actor=>this.claim(actor,expected))
          this.action = step==='winner' ? 'claim-A '+this.claimResponses[0]+' / claim-B '+this.claimResponses[1] : 'claim-A'
          break
        }
      case 'history': this.selected = 'S1'; this.merge('staff',this.rows); break
      case 'staffRead': this.visibleRead={side:'staff',seq:1}; this.advanceRead('staff',1,this.version); break
      case 'transfer': this.action = 'transfer-B'; this.version++; this.owner = 'B'; this.staffRead = 0; this.staffSeq = 0; this.staffLog=[]; this.selected = ''; break
      case 'revoke': this.selected = 'S1'; this.merge('staff',this.rows); break
      case 'offline': this.clientWs = '离线'; break
      case 'answer':
        this.requestActor=this.scenario==='transfer'?'B':'A'; this.requestVersion=this.version
        this.requestId = 'r3'; this.key = 'm2'; this.replayed = false; this.pending = '发送中'; break
      case 'answerCommit':
        if(this.status!=='ACTIVE' || this.requestActor!==this.owner || this.requestVersion!==this.version) throw Error('负责人或会话版本不匹配')
        this.save(reply); break
      case 'answerAck': this.ack = this.requestId; this.pending = ''; this.merge('staff',[this.rows[1]]); break
      case 'dispatch': this.outbox = '回复通知已处理'; break
      case 'display':
        if(this.clientWs==='ready') this.merge('client',[this.rows[1]])
        break
      case 'pull': this.fetched=this.rows.filter(row=>row.seq>this.clientSeq); break
      case 'merge': this.merge('client',this.fetched); break
      case 'read': this.visibleRead={side:'client',seq:2}; this.advanceRead('client',2,this.version); break
      case 'seen': this.counterpartRead = this.clientRead; break
    }
  }
}
