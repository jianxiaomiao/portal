import { PROJECTS } from './config/projects'

export const buildings = { nexus: 'NX', flowops: 'FO', newcrisp: 'NC' } as const
export const chapters = [
  {
    id: 'api',
    project: 'Nexus',
    title: '一次 Nexus API 请求',
    text: '从机器身份验证到配额事务，观察 HTTP 响应和后台用量写入如何分开完成。',
    branches: '正常成功、应用限流、配额耗尽、参数校验与用量写入失败',
    image: 'NX',
    evidence: 'api-response',
    steps: [
      '核验 API Key、应用与所有者，经过应用限流后校验输入。',
      '在短事务中锁定并扣减配额，计算摘要并返回 HTTP 结果。',
      '后台写入用量事件；写入失败可与已返回的响应分别观察。',
    ],
  },
  {
    id: 'ticket',
    project: 'FlowOps',
    title: '一张工单的旅程',
    text: '跟随一张跨系统投递的工单，观察发送方丢失回执后，接收方怎样识别原来的记录。',
    branches: '首次成功、回执丢失、重放内容冲突、回执校验失败与旧租约过期',
    image: 'FO',
    evidence: 'ticket-delivery',
    steps: [
      '在同一事务中创建工单记录和待投递事件。',
      'Worker 领取租约并投递，接收方保存工单和导入结果。',
      '丢失回执后用原事件重试；验证回执和租约后更新发送账本。',
    ],
  },
  {
    id: 'chat',
    project: 'NewCrisp',
    title: '一条客服消息',
    text: '从客户窗口跟到坐席工作台，对照消息保存、断线补拉和阅读水位。',
    branches: '双向消息、保存后 ACK 丢失、断线补拉与领取转派',
    image: 'NC',
    evidence: 'chat-normal-panels',
    steps: [
      '从 Nexus 进入客服，客户与员工分别建立自己的连接。',
      '消息保存与 ACK、对端可见、阅读水位分别推进。',
      '连接恢复后按会话序号补拉，重试及转派沿用原身份与权限。',
    ],
  },
] as const
export const spots = [
  ['Computer', '电脑', '开发项目'],
  ['Coffee', '咖啡杯', '个人日常'],
  ['Books', '书架', '技术栈'],
  ['Board', '白板', '系统设计'],
  ['Notes', '开发笔记', '学习主题'],
  ['Frostwick', '雪景球', '创意收藏'],
] as const
export const districts = [
  ['residential', '住宅街'],
  ['market', '街市'],
  ['quay', '滨水公园'],
] as const
export const pageTitles: Record<string, string> = {
  '/': '简小淼 · 软件作品与 Codeville 小镇',
  '/explore/': '探索 Codeville 小镇',
  '/systems/': 'Systems Lab · 系统实验室',
  '/studio/': 'Studio · 个人工作室',
  '/creative/': 'Creative Lab · 创意收藏',
  '/404.html': '找不到这个页面',
  ...Object.fromEntries(
    PROJECTS.map((p) => [
      '/projects/' + p.id + '/',
      p.name + ' · ' + p.subtitle,
    ]),
  ),
}
export function href(path: string) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
export function media(name: string) {
  return href(__MEDIA_DIR__ + '/' + name)
}
