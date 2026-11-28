# Codeville · Release Candidate V1

**RC V1 已完成本地发布准备，等待作者确认 183 个路径的公开范围并授权提交。** iPhone Safari 与 Android Chrome 均已覆盖 15 项验收。桌面 Chrome 的三章 6/5/4 分支、十轮资源生命周期和本地整包回退通过。当前 Mac 的 Safari 在模型下载前丢失 WebGL 2 上下文，静态降级可用，桌面三维仍未通过。发布目标为 GitHub Pages 项目站，环境仅允许 main 部署。首次在线部署及 CDN 检查待授权后执行。

| 验收域 | 状态 | 审阅入口 |
| --- | --- | --- |
| 待提交内容、归档边界 | 已逐项分类，61 份私存材料已归档并保留原件，暂存区为空 | [02 · Git 文件及精确白名单](02-git.md) |
| GLB、布局、图片及二进制体积 | 已核对大小、用途、版本与 GitHub 限制 | [03 · 大文件与资源](03-assets.md) |
| 公开数据、凭证、诊断接口 | 已审阅；正式三章的越界网络请求及 WebSocket 均为 0 | [04 · 隐私与安全](04-privacy.md) |
| 桌面 Safari | 首页、详情、静态降级通过；本机三维初始化失败 | [05 · Safari](05-safari.md) |
| iPhone 与 Android | 真实设备完成 15 项，含人工手势、系统返回和模型对照 | [06 · 手机与独立 HTTPS 环境](06-mobile.md) |
| 加载策略 | 维持首页海报，默认 Meshopt，保留普通版选择与失败回退 | [07 · 模型决策](07-models.md) |
| 完整回归 | Phase 8 九项套件、Portal 五项、托管四项及正式包请求检查通过 | [08 · 功能与资源回归](08-regression.md) |
| 两套正式包及回退包 | 根路径和 /portal/ 各 8 个实体 HTML 加 404；已恢复完整基线并核对哈希 | [09 · 构建、触发条件与回退](09-build-rollback.md) |
| 公开介绍 | POM、项目文档、匿名 GitHub 页面与 Frostwick 源作品已核对 | [10 · 资料核对与待补](10-content.md) |
| 发布判定 | 本机 Safari 限制已接受，等待作者授权及首次在线部署 | [11 · 已知限制与阻塞](11-blockers.md) |
| 正式操作 | 等待作者另行授权；部署、回退与上线后复核均有独立步骤 | [12 · 发布操作计划](12-plan.md) |

2026-11-28，在 `codex/codeville-portal-integration` 完成。本地 HEAD 与远端 main 核对为 `1807fc1ec2ab362755d7206eb04bb0d2edbf2017`。本次只对 Portal 做了发布相关修正和本地验收。全套生产构建、诊断构建、回退包各自独立；Git、托管及生产配置在审阅后另行操作。
