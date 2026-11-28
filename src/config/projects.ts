export interface ProjectItem {
  id: 'nexus' | 'flowops' | 'newcrisp';
  name: string;
  subtitle: string;
  tagline: string;
  /** 填写真实线上地址（如 https://nexus.yourdomain.com）后，入口按钮会自动变为可跳转链接；留空则显示占位状态 */
  liveUrl: string;
  repoUrl: string;
  highlights: string[];
  stack: string[];
  accent: 'forest' | 'amber' | 'teal';
}

export const DOMESTIC_SITE_NAME = '个人学习记录'

export const SITE_PROFILE = {
  brand: '简小淼',
  brandEn: 'Studio',
  roleBadge: '软件工程专业学生',
  headline: '用代码建造一个小世界。',
  intro: '你好，我是简小淼，一名软件工程专业学生。我喜欢通过实际项目探索后端开发、软件架构与系统设计，也对三维建模和交互式可视化感兴趣。这里记录了我的软件作品、工程实验和学习过程。',
  githubProfile: 'https://github.com/jianxiaomiao',
  coreStack: [
    'Java 21',
    'Spring Boot 3 / 4',
    'Vue 3',
    'TypeScript',
    'MySQL 8.4',
    'Flyway',
    'WebSocket',
    'Redis',
    'RabbitMQ',
    'Milvus & Spring AI',
    'Electron',
    'Docker',
    'Playwright',
  ],
};

/**
 * 项目列表（所有链接集中维护于此，部署 ECS 域名后只需填入 liveUrl 即可生效）
 */
export const PROJECTS: ProjectItem[] = [
  {
    id: 'nexus',
    name: 'Nexus',
    subtitle: 'Developer API Platform',
    tagline:
      '模块化单体开发者 API 平台，统一管理用户会话、Application、API Key、配额限速、用量统计、异步截图任务与 Webhook，覆盖 Web、Electron 桌面端与 Android 移动端。',
    liveUrl: '', // 上线验收通过后填入 'https://nexus.myxiaomiao.com/'
    repoUrl: 'https://github.com/jianxiaomiao/Nexus',
    highlights: [
      'JWT + Refresh 令牌轮换与多标签页协调，管理与机器调用双身份边界',
      '开放 API：UUID、文本摘要、网页正文提取、短链与异步网页截图',
      'Application 级配额限速、Key 用量统计与 Webhook 签名重试',
      'Web（Three.js 3D 小猫星球登录页）+ Electron 桌面 + uni-app Android',
    ],
    stack: ['Java 21', 'Spring Boot 4', 'MyBatis-Plus', 'Vue 3', 'Three.js', 'Electron'],
    accent: 'forest',
  },
  {
    id: 'flowops',
    name: 'FlowOps',
    subtitle: '企业多租户工单与知识协作平台',
    tagline:
      '面向企业内部协作的多租户工单闭环与知识库系统，融合 SLA 原子超时扫描、Transactional Outbox 异步通知，以及基于 Spring AI + Milvus 的租户隔离相似知识推荐。',
    liveUrl: '', // 上线验收通过后填入 'https://flowops.myxiaomiao.com/'
    repoUrl: 'https://github.com/jianxiaomiao/flowOps',
    highlights: [
      '工单创建、部门分派、处理、方案确认/驳回与完整审计追踪闭环',
      'SLA 截止时间快照与幂等扫描，Transactional Outbox + RabbitMQ 死信重试',
      'Redis 分布式限流、未读数缓存与 JWT 会话版本撤销',
      'Spring AI + Ollama + Milvus 向量召回，严格双重租户权限校验',
    ],
    stack: ['Java 21', 'Spring Boot 3.5', 'RabbitMQ', 'Redis', 'Milvus', 'Prometheus'],
    accent: 'amber',
  },
  {
    id: 'newcrisp',
    name: 'NewCrisp',
    subtitle: '轻量级多租户 Web 在线客服服务台',
    tagline:
      '对标 Crisp 核心人工客服体验打造的多租户服务台。一行 script 代码即可为任意官网挂载 Shadow DOM 悬浮窗，内置 SaaS 自助注册、平台超管台、内部协作与数据看板。',
    liveUrl: '', // 上线验收通过后填入 'https://chat.myxiaomiao.com/'
    repoUrl: 'https://github.com/jianxiaomiao/newCrisp',
    highlights: [
      'Shadow DOM 一行代码悬浮窗 + 紧凑双界面布局，支持访客接续码合并',
      'WebSocket 实时对话、乐观发送、已读回执、正在输入态与断线 seq 补齐',
      '客户画像、团队内部备注、标签、/ 快捷回复、自动分配与 CSAT 看板',
      '对外 SaaS 自助注册（算术 + QQ 邮箱验证）与 Platform Key 超管控制台',
    ],
    stack: ['Java 21', 'Spring Boot 4', 'WebSocket', 'Vue 3', 'Shadow DOM', 'MySQL 8.4'],
    accent: 'teal',
  },
];

/**
 * 可选：待 NewCrisp 上线 ECS 后，开启此配置即可在个人主页右下角直接挂载活体在线客服悬浮窗
 */
export const NEWCRISP_WIDGET = {
  enabled: false,
  origin: '', // 例如 'https://crisp.yourdomain.com'
  siteId: '', // NewCrisp 工作台「访客入口」生成的站点 ID
};
