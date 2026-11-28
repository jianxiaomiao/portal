# 公开资料核对与待补内容

| 页面 | 当前表述 | 核对依据与结论 |
| --- | --- | --- |
| 首页、About、Studio | 简小淼、软件工程专业学生，关注后端、架构、建模与交互 | 来自作者提供的自述与既有 Phase 9 审阅。首页项目卡的技术前三项、详情与 Studio 的完整栈共享 projects.ts。没有学校、手机号、邮箱或个人商业运营承诺。 |
| Nexus | Java 21、Spring Boot 4，API 平台、配额、异步截图及 Webhook，Web/Electron/Android | Nexus 的 nexus-server/pom.xml 指定 4.1.1 / 21；README 与三个客户端目录支持功能说明。网页展示主版本正确。[项目仓库](https://github.com/jianxiaomiao/Nexus) |
| FlowOps | Java 21、Spring Boot 3.5，多租户工单、SLA、Outbox、RabbitMQ、Redis、Milvus | flowOps 的 demo/pom.xml 指定 3.5.16 / 21；README、compose.yaml 与工单、消息、检索说明对应。首页及详情版本一致。[项目仓库](https://github.com/jianxiaomiao/flowOps) |
| NewCrisp | Java 21、Spring Boot 4，WebSocket、Vue 3、Shadow DOM、MySQL 8.4 | newCrisp 的 pom.xml 指定 4.1.1 / 21。README 描述挂件、会话、回执、断线补拉、分派、CSAT 和邮箱验证。网页版本正确。[项目仓库](https://github.com/jianxiaomiao/newCrisp) |
| Frostwick | 霜镇夜邮局、红邮车、钟楼、雪景球、编号 07 | 本机 Frostwick.blend、renders/01-Frostwick.png、作品说明.md 与 GLB 贴图 Frostwick-Label 可相互核对。Creative 页呈现原作与 Codeville 室内收藏两种画面。 |
| 对外链接 | GitHub 个人主页及三个仓库 | 匿名 GitHub 网页均返回 200，另从公共 API 确认账户登录名及三仓库的 full_name、visibility=public；与本机 git remote 一致。Portal 仓库也为 public。三项 liveUrl 均为空。无依据的旧 ECS 状态文案已从配置移除。[作者主页](https://github.com/jianxiaomiao) |

**待作者提供，可暂缺。** 各项目本人负责的模块及可公开 PR、协作者署名、Frostwick 创作日期及署名偏好、获准公布的上线地址或联系方式。项目既有实现可以支撑功能介绍；尚无资料量化个人完成比例、商业客户数或线上可用率。当前页面保持已有介绍，资料提供后按来源更新。

**发布前确认。** 由作者确认现有署名、项目截图和可下载模型允许对外传播。首页版本标签精度沿用现有设计，未填业务地址继续隐藏。此次审阅只读取三个业务项目。
