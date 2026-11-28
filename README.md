# 简小淼 Studio · Codeville Portal

软件工程学生的个人作品集。首页采用 B+ 双栏：左侧是作者与作品入口，右侧是 Phase 8 的真实小镇海报。点“启用三维预览”后可以旋转和缩放，再点“探索小镇”会沿用同一座已打开的小镇。

[本机根路径预览](http://127.0.0.1:4398/) · [本机 Pages 子路径预览](http://127.0.0.1:4398/portal/) · [交付与验收索引](reports/README.md)

发布候选 V1 的真机结果、建议提交清单与回退包校验见[Phase 10 发布候选验收总表](reports/release-candidate/README.md)。

## 本地开发和构建

使用锁文件安装依赖。本轮实测 Node.js 24.22.3、npm 10.9.7、Vue 3.5.46、Vite 6.4.6、TypeScript 5.9.3、Three.js 0.180.0、Playwright 1.63.0。仓库已有 Pages 工作流使用 Node 22。

```sh
npm ci
npm run dev
```

开发服务器默认监听本机 5175。构建过程先做类型检查，再由 Vite 生成浏览器模块，并在构建机上用 Vue 服务端渲染各个公开页面。临时渲染器在结束时清理，部署目录只需普通静态文件。两种前缀各自生成一份可独立使用的产物。

```sh
npm run build
PORTAL_BASE=/portal/ PORTAL_OUT=dist-pages npm run build
```

根站点入口是 `dist/index.html`，Pages 项目站入口是 `dist-pages/index.html`。用 HTTP 预览生产包，可运行 `npm run preview`。复现带正确未知路由状态码、缓存头和两个前缀的 Nginx 预览见[托管测试说明](tests/hosting/README.md)。

## 页面和内容

| 地址 | 内容 |
| --- | --- |
| / | 作者简介、三个项目、三章实验、工作室、创意收藏及 About。兼容 #top、#projects、#ecosystem、#stack。 |
| /projects/nexus/、/projects/flowops/、/projects/newcrisp/ | 真实工程功能、技术栈、相关章节、建筑与仓库。 |
| /systems/ | 三章可分享的文字导读、分支、可展开的步骤、实录及演示入口。 |
| /studio/ | 工作室、按项目列出的技术、学习问题与六个室内热点。 |
| /creative/ | Frostwick 独立渲染及工作室内收藏品特写。 |
| /explore/ | 真实三维漫游与静态地点目录。支持日光/夜色、三区、四栋建筑、工作室展开、环境/车辆动画与三章本地业务演示。 |

每个公开地址都有独立标题和实体 HTML。无 JS 时可以读首页、项目、章节、工作室及收藏页并使用普通链接。未知地址使用本次构建的 404.html。

个人介绍、仓库、技术栈与可选在线地址由 [projects.ts](src/config/projects.ts) 提供。仅填写真实 liveUrl 时显示在线入口。可选 NewCrisp 挂件沿用原开关，目前关闭。未提供的履历、学校、成绩、私有联系方式不出现在正式页面。[待补资料与发布时间点](reports/review-and-release.md)

## 三维入口与状态

- `/explore/?place=NX` 聚焦科技研究所。FO、NC、ST、hub 分别对应调度中心、通信邮局、个人工作室和中央双环。
- `/explore/?view=quay` 直达滨水公园。market、residential、plan、reverse、home 也可分享。
- `/explore/?place=ST&hotspot=Frostwick` 按展开、入室、特写的顺序到达收藏品。Computer、Coffee、Books、Board、Notes 可直达其他室内热点。
- `/explore/?chapter=chat&scenario=lost` 打开客服章节的回执丢失配置。api、ticket 分别选择 API 与工单章节。分支参数经白名单解析；播放与业务操作由访客启动。
- `?theme=night` 可指定本次氛围。手动主题用 localStorage 记忆，自由相机按资源版本写入 sessionStorage。恢复稳定的相机和室内观察状态时检查数值与视口方向，章节只恢复配置。
- 进入探索页后开始加载三维；节省流量模式保留启动按钮。首页（包括手机）默认海报，首次绘制和普通资料页均可独立于三维工作。手机先滚动阅读，点“开始操控”后画布才接管手势。
- 默认 Meshopt，下载/解码失败尝试普通版一次。访客可在探索顶栏切换普通模型，或使用 `?model=raw`。共享布局错误、取消和失去上下文分别处理。字节总量未知时只显示实际已收字节。
- 首页、探索消费同一异步宿主；提升不克隆 canvas 或 GLB。离开会取消下载，失效旧回调并调用 Town.dispose。返回普通页后 GPU 资源释放，重进可使用 HTTP 缓存。

运行时来自 Phase 8 源码快照，位于 [src/codeville](src/codeville/)。页面运行不依赖开发者机器上的历史工程。模型、布局及图片按内容版本发布，运行时 CSS 限定于 .cv-root。生产构建不开放诊断探针。

## 复现回归

另行生成本机诊断产物。测试接口仅编入这一构建，浏览器还须使用 `?inspect`。在一个终端启动回环服务，测试在另一个终端依次执行。Chrome 录屏需要 Playwright 配套 FFmpeg。

```sh
PORTAL_INSPECT=1 PORTAL_OUT=dist-check npm run build
python3 -m http.server 4399 --bind 127.0.0.1 --directory dist-check
```

```sh
node tests/portal/integration.mjs
node tests/portal/loading-edges.mjs
node tests/portal/gestures.mjs
node tests/portal/entry.mjs
node tests/portal/loading.mjs
node tests/phase8/suite.mjs
```

[Phase 8 原回归适配说明](tests/phase8/README.md) · [托管及无 JS/WebGL 检查](tests/hosting/README.md) · [截图与录屏脚本](tests/media/capture.mjs)

## 发布边界

发布候选位于本地分支 `codex/codeville-portal-integration`。目标为 GitHub Pages 的 `/portal/` 项目站。工作流显式构建 `dist-pages`，指向 main 的 PR 只执行构建，合并至远端 main 后会自动发布。根路径包另用 `PORTAL_BASE=/ PORTAL_OUT=dist` 构建。[RC 验收总表](reports/release-candidate/README.md) · [发布与回退计划](reports/release-candidate/12-plan.md)
