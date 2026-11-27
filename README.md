# 简小淼 · 个人项目展示门户（Portal）

清雅暖白鼠尾草风格的个人项目作品集与系统入口主页，统一聚合 **Nexus**、**FlowOps** 与 **NewCrisp** 的在线体验入口与 GitHub 仓库地址。

## 快速配置线上入口

所有项目介绍、状态、GitHub 地址与线上访问域名均集中在 [src/config/projects.ts](src/config/projects.ts)：

1. 当项目部署至 ECS 并绑定域名后，只需把对应项目的 `liveUrl` 填入（如 `https://nexus.yourdomain.com`），卡片状态会自动切换为「在线运行」并启用主跳转按钮。
2. 当 NewCrisp 上线后，可将 `NEWCRISP_WIDGET.enabled` 设为 `true` 并填入 `origin` 与 `siteId`，即可在个人主页右下角直接挂载活体在线客服悬浮窗。

## 本地运行与构建

```sh
npm install
npm run dev      # 本地预览 http://127.0.0.1:5175
npm run build    # 类型检查并构建纯静态产物至 dist/
```

## 部署方式

- **GitHub Pages**：已内置 `.github/workflows/deploy.yml`，推送到 `main` 分支并在仓库 Settings → Pages 中将 Source 设为 **GitHub Actions** 即可自动发布。
- **自有 ECS Nginx**：运行 `npm run build` 后将 `dist/` 目录直接挂载为站点根目录即可。
