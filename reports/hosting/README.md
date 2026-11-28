# 双路径托管与静态降级验收

2026-11-28，在 macOS 本机通过 Nginx 1.30.8 提供两个独立的 Portal 生产构建。Chrome 158.0.8127.88 完成浏览器检查。可用 [根路径预览](http://127.0.0.1:4398/) 和 [Pages 子路径预览](http://127.0.0.1:4398/portal/) 审阅。

| 实测项 | Nginx 根路径 / | Pages 项目站前缀 /portal/ |
| --- | --- | --- |
| 产物 | dist | dist-pages |
| 直接访问与刷新 | 8 个公开路由全部 HTTP 200 | 8 个公开路由全部 HTTP 200 |
| 构建一致性 | 43 个 HTTP 文件逐字节等于磁盘产物 | 43 个文件通过，页面链接保持项目站前缀 |
| HTML 初始内容 | 8 个独立标题、一级标题、图片和普通链接 | 同项通过 |
| 静态 404 | 一级及嵌套未知路径均 HTTP 404，正文来自该构建的 404.html | 同项通过，使用子路径构建的 404.html |
| HTTP 缓存 | 全部文件可用 ETag 条件请求得到 304；HTML 为 no-cache，版本化目录为 immutable | 同项通过 |
| 无 JavaScript | 8 页在 390px 宽度可读可刷新，24 个独立站内链接目标返回 200 | 同项通过 |
| 章节静态导读 | 逐章点开原生 details，各有 3 个可读步骤及 1 张成功解码的 Phase 8 实录截图 | 同项通过 |
| 旧锚点与历史 | 首页四个兼容锚点均存在；真实点击 Nexus 详情后，浏览器后退返回首页 | 同项通过 |
| 常规资料首载 | 启用 JS 的 7 个普通资料页未请求三维模型、运行时或解码器 | 同项通过 |
| 禁用 WebGL | Chrome 以 --disable-webgl 启动，实际无法创建 WebGL2，上下文失败后进入静态总览，可从项目目录点击进入 NewCrisp，GLB 请求数为 0 | 同项通过 |
| 启用 WebGL | 实际分别进入默认 Meshopt 和手动 raw 探索，正确的 layout、GLB、解码器就位，canvas 首绘可见；生产页没有测试诊断对象 | 同项通过，运行时实际请求均在 /portal/ 下 |

本轮最终产物的媒体目录为 `media-c0a27766cbce`，模型与布局目录为 `town-6c2fa5d037a0`。独立 Three.js 分块为 `assets/three-Cp5cabWI.js`。两种基址、两种模型的四次冷启动中，每次各取该分块一次。Systems Lab 的 API、工单和客服章节分别读取 `api-response.webp`、`ticket-delivery.webp` 和 `chat-normal-panels.webp`。

**模型与版本。** 两个构建的模型、布局和海报分组逐文件校验一致，版本目录的前 12 位标识可由所含文件名和文件内容的 SHA-256 复算。普通 GLB 为 13,812,376 B，Meshopt 为 7,591,900 B。实际启用 Meshopt 时只请求压缩模型及其解码器，手动普通版只请求普通模型，无解码器请求。静态文本产物未包含本机用户或临时项目的绝对路径。[HTTP 与文件完整记录](http-files.json) · [正式运行时路径记录](model-paths.json)

**热缓存。** 每个前缀单独创建空的普通 Chrome 配置目录，对同一版本的 Meshopt 用默认 fetch 策略请求两次。两次均读到 7,591,900 B，首次 Resource Timing 的 transferSize 为 7,592,200 B，重复请求为 0 B；Chrome DevTools Protocol 的 fromDiskCache 从 false 变为 true。此结果描述本机 Nginx、正常磁盘缓存和当前资源版本。无痕、禁用缓存、用户清理和缓存驱逐会影响可复用性。GitHub Pages 的真实生产响应头与 CDN 缓存行为须在获准发布后另测。[浏览器原始记录](browser.json)

**两次构建的更新和回退演练。** 在临时副本给 layout.json 增加一个换行，用相同构建器生成第二套真实产物。回环 HTTP 服务切换 HTML 并保留两版内容寻址资源。升级前已打开的标签页延后启用三维时，layout 和 GLB 取自同一旧版本；刷新页面后两者同属新版；切回原产物再打开页面，两者恢复原版。三个时点均成功首绘并启用拾取。[切换、回退及热缓存原始记录](release-switch.json)

**静态路径截图。** [根路径无 JS 首页](root-no-js.png) · [根路径无 WebGL 总览](root-no-webgl.png) · [子路径无 JS 首页](pages-no-js.png) · [子路径无 WebGL 总览](pages-no-webgl.png)

**Safari 与实机。** 真实 Safari 26.6.2 的 WebDriver 拒绝创建会话，原因为当前未开启“允许远程自动化”。本次保留现有设置，Safari 三维仍待验收。本机未取得已连接的 iPhone 或 Android 测试设备，移动截图来自 Chrome 手机视口。真机应在可由设备访问的隔离服务上复测操控进入/退出、实际触摸滚动、转屏、低画质、内存压力和前后台恢复。根站与项目站子路径本次均由本机回环服务提供，生产环境仍待作者明确发布。[Safari 探测记录](safari.json)

**复现入口。** [测试运行说明](../../tests/hosting/README.md) · [Nginx 官方源码](https://nginx.org/download/nginx-1.30.8.tar.gz)
