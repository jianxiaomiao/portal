export const buildings = {
  NX: {
    name: 'Nexus',
    type: '科技研究所',
    color: '#247b70',
    description:
      '面向开发者的 API 平台，将应用、凭证、配额和用量记录集中管理。透过一层窗带可以看到服务器机柜与控制台。',
    features: [
      '应用与 API Key 管理',
      '配额控制与用量查询',
      '异步截图任务与 Webhook 通知',
    ],
    stack: ['Java 21', 'Spring Boot', 'MySQL', 'Vue 3'],
    url: 'https://github.com/jianxiaomiao/Nexus',
  },
  FO: {
    name: 'FlowOps',
    type: '任务调度中心',
    color: '#b67d48',
    description:
      '多租户工单与知识协作平台。扫描门、调度屏和分拣臂依次对应接收、分派与处理。',
    features: [
      '工单创建、分派与确认',
      'Outbox 投递、重试与幂等消费',
      '知识库与 SLA 扫描',
    ],
    stack: ['Spring Boot', 'RabbitMQ', 'Redis', 'Vue 3'],
    url: 'https://github.com/jianxiaomiao/flowOps',
  },
  NC: {
    name: 'NewCrisp',
    type: '通信邮局',
    color: '#6388a1',
    description:
      '面向网站访客与人工客服的轻量工作台。雾蓝色服务窗内设有接待屏和信件分拣格。',
    features: [
      '网页嵌入式对话窗',
      'WebSocket 消息、回执与重连补拉',
      '客服分组、转派与满意度评价',
    ],
    stack: ['Spring Boot', 'WebSocket', 'MySQL', 'TypeScript'],
    url: 'https://github.com/jianxiaomiao/newCrisp',
  },
  ST: {
    name: 'Portal',
    type: '个人工作室',
    color: '#9b8063',
    description:
      '花园里的开发工作室。移开屋顶和两面临街墙，可以走近工作台、设计白板与收藏架。',
    features: [],
    stack: [],
    url: 'https://github.com/jianxiaomiao/portal',
  },
} as const
export type Building = keyof typeof buildings
export type Place = Building | 'hub'
export const keys = Object.keys(buildings) as Building[]
export const hotspots = {
  Computer: [
    '电脑',
    '开发项目',
    '双屏工作台连接小镇的三个软件项目。可从 GitHub 查看源代码与项目文档。',
  ],
  Coffee: [
    '咖啡杯',
    '个人日常',
    '桌边的咖啡杯和台灯，是这间个人工作室的日常物件。',
  ],
  Books: [
    '书架',
    '技术栈',
    '书架上的分布式系统、数据结构与网络书籍，呼应项目中的 Java、Vue 与消息队列实践。',
  ],
  Board: [
    '白板',
    '系统设计',
    '沿白板追踪 API、Outbox、Queue 和 ACK，观察异步投递与确认之间的关系。',
  ],
  Notes: [
    '开发笔记',
    '学习历程',
    '开发笔记记录从接口设计、可靠投递到客户端交互的学习主题。',
  ],
  Frostwick: [
    '雪景球',
    '创意作品',
    'Frostwick「霜镇夜邮局」收藏版。雪顶钟楼、红邮车和编号 07 的黄铜铭牌都藏在球罩之内。',
  ],
} as const
export type Hotspot = keyof typeof hotspots
export const spots = Object.keys(hotspots) as Hotspot[]
export const demos = ['API 请求', '可靠工单投递', '实时客服通信'] as const
export const assets = import.meta.env.BASE_URL + __TOWN_DIR__ + '/'
