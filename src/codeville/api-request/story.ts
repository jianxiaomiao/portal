export const outcomes = {
  success: '正常成功', rate: '限流 429', quota: '配额耗尽 429', invalid: '缺少 algorithm · 400',
}
export type Outcome = keyof typeof outcomes
export interface Options { outcome: Outcome; wait: boolean; timeout: boolean; failWrite: boolean }
export const digest = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
export const stages = ['请求进入','机器身份','应用限流','参数校验','字节检查','配额事务','同步摘要','HTTP 响应','用量旁路']
type Cue = [stage: number, title: string, source: string, detail: string, seconds: number]
export const cues = {
  send:[1,'客户端发出请求','POST /v1/utils/hash','开发者将 JSON 送入屋顶数据端口，Authorization 使用隐藏的 ApiKey。',2],
  log:[1,'进入请求日志过滤器','RequestFailureLoggingFilter','过滤器包住下游请求，记录失败；此时尚未开始用量计时。',1.4],
  header:[2,'提取机器凭证','MachineApiKeyFilter','读取唯一 Authorization 头，将完整凭证交给认证器。',1.4],
  key:[2,'Key 已核验','ApiKeyAuthenticator.authenticate','按 publicId 查询 api_keys，核对 secret 摘要和删除状态。',1.4],
  app:[2,'Application 有效','ApiKeyAuthenticator.authenticate','按 Key 的归属读取 applications，检查应用是否存在及删除状态。',1.4],
  owner:[2,'Owner 有效','ApiKeyAuthenticator.authenticate','读取 users，完成删除与禁用检查；请求携带 apiKeyId、applicationId。',1.5],
  wait:[3,'等待速率许可','ApplicationRateLimiter.acquire','同一应用的等待者在当前 JVM 排队；尚未进入 MVC。',2],
  permit:[3,'取得速率许可','ApplicationRateFilter','本应用获得一个时隙，过滤器放行同一请求。',1.6],
  rateFull:[3,'队列已满','ApplicationRateFilter.handleRejected','应用已有十个等待者，本次立即拒绝，未加入队列。',3],
  rateTimeout:[3,'等待许可超时','ApplicationRateFilter.handleQueueDecision','本次已进入等待队列，期限内没有得到许可。',3],
  pre:[4,'开始 MVC 计时','UsageInterceptor.preHandle','记录 UTC 起点和单调时钟；此时还没有用量事件。',1.5],
  bind:[4,'绑定 JSON 并校验字段','HashRequest · Bean Validation','SHA256 映射为算法枚举，algorithm 与 value 均已提供。',1.7],
  invalid:[4,'缺少必填字段','Bean Validation','JSON 可读，但缺少 algorithm。MVC 返回字段错误，尚未调用 HashService。',3],
  bytes:[5,'检查输入长度','HashService.computeHash','hello 的 UTF-8 编码为 5 字节，通过 4096 字节上限。',1.9],
  locks:[6,'锁定准入记录','ApplicationQuotaService.consumeOnce','短事务先锁 Application，再锁属于该应用的 API Key，复核状态。',1.8],
  period:[6,'检查本期余额','ApplicationQuotaMapper.consumeOne','按应用创建时刻定位 720 小时周期；仅当 used_count < quota_limit 时更新。',1.8],
  commit:[6,'配额事务已提交','TransactionTemplate.execute','条件更新命中一行，事务提交；现在才能把已用次数从 7 改为 8。',2],
  exhausted:[6,'余额耗尽，事务回滚','ApplicationQuotaService.consumeOnce','条件更新命中零行，已用次数保持 8。摘要计算没有开始。',3],
  hash:[7,'在请求线程计算 SHA256','HashService · JCA MessageDigest','依照真实 HTTP 测试展示 hello 的小写十六进制摘要。仅第一台机柜突出显示。',2.6],
  response:[8,'返回 HTTP 结果','HTTP','客户端收到当前请求的结果。配额状态已确定。',2.4],
  complete:[9,'MVC 完成回调','UsageInterceptor.afterCompletion','读取最终 HTTP 状态与耗时。用量走独立旁路。',1.5],
  event:[9,'创建用量事件','UsageInterceptor.afterCompletion','为本次调用分配独立 eventId。',1.5],
  submit:[9,'提交后台任务','UsageRecordService.record','向 usageExecutor 提交本次统计。',1.5],
  queued:[9,'用量事件已入队','usageExecutor','后台写入尚未完成，HTTP 结果已可读取。',1.7],
  saved:[9,'用量已持久化','UsageEventWriter.insertWithRetry','独立 MySQL 事务完成，usage_events 新增一行。',2.5],
  failed:[9,'用量写入失败','UsageRecordService.record','模拟后台写入终态失败，原 HTTP 及已提交配额保持原值。',2.5],
} satisfies Record<string,Cue>
export type CueId = keyof typeof cues
export function sequence(o: Options): CueId[] {
  const path: CueId[] = ['send','log','header','key','app','owner']
  if (o.outcome === 'rate') {
    if (o.timeout) path.push('wait','rateTimeout')
    else path.push('rateFull')
    return [...path,'response']
  }
  if (o.wait) path.push('wait')
  path.push('permit','pre')
  if (o.outcome === 'invalid') path.push('invalid')
  else {
    path.push('bind','bytes','locks','period')
    if (o.outcome === 'quota') path.push('exhausted')
    else path.push('commit','hash')
  }
  return [...path,'response','complete','event','submit','queued',o.failWrite ? 'failed' : 'saved']
}
type ResponseBody = {code:string; message:string; data:Record<string,string> | null}
export class RequestState {
  readonly input
  used: number
  readonly limit = 8
  request = '准备发送'
  auth = '待核验'
  rate = '待准入'
  validation = '未进入 MVC'
  quota = '未扣额'
  business = '未执行'
  usage = '尚未创建事件'
  eventId = ''
  durationMs: number | null = null
  status = 0
  body: ResponseBody | null = null
  stopAt = ''
  constructor(readonly options: Options) {
    this.input = options.outcome === 'invalid' ? {value:'hello'} : {algorithm:'SHA256',value:'hello'}
    this.used = options.outcome === 'quota' ? 8 : 7
  }
  enter(s: CueId) {
    switch (s) {
      case 'send': this.request = '已发出'; break
      case 'header': this.auth = '已提取凭证'; break
      case 'key': this.auth = 'Key 已核验'; break
      case 'app': this.auth = 'Application 有效'; break
      case 'owner': this.auth = 'Owner 有效 · 已认证'; break
      case 'wait': this.rate = '正在等待许可'; break
      case 'permit': this.rate = this.options.wait ? '等待后放行' : '立即放行'; break
      case 'rateFull': case 'rateTimeout':
        this.rate = s === 'rateFull' ? '队满，立即拒绝' : '排队超时'
        this.stopAt = '限流过滤器 · MVC 之前'; break
      case 'pre': this.validation = '已进入 MVC · 开始计时'; break
      case 'bind': this.validation = '必填字段通过'; break
      case 'invalid': this.validation = '缺少 algorithm'; this.stopAt = 'MVC · Bean Validation'; break
      case 'bytes': this.validation = 'UTF-8 · 5 / 4096 bytes'; break
      case 'locks': this.quota = '已加锁 · 尚未提交'; break
      case 'period': this.quota = '本期条件 UPDATE'; break
      case 'commit': this.used = 8; this.quota = '7 → 8 · COMMIT SUCCESS'; break
      case 'exhausted': this.quota = '8 → 8 · ROLLBACK'; this.stopAt = 'MySQL · 配额短事务'; break
      case 'hash': this.business = 'SHA256 已计算'; break
      case 'response':
        this.request = '已返回'
        switch (this.options.outcome) {
          case 'success': this.status=200; this.body={code:'SUCCESS',message:'hash摘要成功',data:{hashContent:digest}}; break
          case 'rate': this.status=429; this.body=this.options.timeout
            ? {code:'APPLICATION_RATE_WAIT_TIMEOUT',message:'请求等待限流许可超时',data:null}
            : {code:'APPLICATION_RATE_QUEUE_FULL',message:'Application 请求等待队列已满',data:null}; break
          case 'quota': this.status=429; this.body={code:'APPLICATION_QUOTA_EXHAUSTED',message:'应用当前720小时周期的调用额度已耗尽',data:null}; break
          case 'invalid': this.status=400; this.body={code:'VALIDATION_ERROR',message:'请求参数校验失败',data:{algorithm:'算法为空'}}; break
        }
        break
      case 'complete': this.durationMs = 12; break // Fixed teaching sample, not animation wall time.
      case 'event': this.eventId = crypto.randomUUID(); this.usage = '已创建 eventId'; break
      case 'submit': this.usage = '提交后台任务'; break
      case 'queued': this.usage = '已入队'; break
      case 'saved': this.usage = '已持久化'; break
      case 'failed': this.usage = '写入失败'; break
    }
  }
}
