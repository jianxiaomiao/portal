# Phase 9 B+ 修改文件清单

工作区为本地分支 `codex/codeville-portal-integration`，基线为 `1807fc1ec2ab362755d7206eb04bb0d2edbf2017`。下表及清单根据当前 Git 工作树生成。

| 范围 | 用途 |
| --- | --- |
| 现有 Vue、Vite、HTML、项目配置及 npm 锁文件 | 构建时生成页面、保留原锚点与仓库地址、动态启动三维，锁定运行时与测试依赖。 |
| src/media、src/codeville、public | 正式页面海报、实录、站点图标以及 Phase 8 的运行时快照、完整模型、布局与降级素材。 |
| scripts、tests | 生成可独立托管的静态页面，运行章节、路由、缓存、释放及媒体验收。 |
| reports | 审阅材料、逐项结果、初次失败与修复后的实测记录。 |

已跟踪文件修改 10 个，新增未跟踪文件 182 个。下列路径相对于 Portal 根目录。

<details><summary>现有仓库文件（10）</summary>

```text
.gitignore
README.md
index.html
package-lock.json
package.json
src/App.vue
src/config/projects.ts
src/main.ts
src/style.css
vite.config.ts
```

</details>

<details><summary>静态页面、构建与公共入口（5）</summary>

```text
public/favicon.svg
scripts/build.mjs
src/catalog.ts
src/env.d.ts
src/render.ts
```

</details>

<details><summary>Portal 验收与审阅说明（20）</summary>

```text
reports/README.md
reports/changes.md
reports/hosting/README.md
reports/hosting/browser.json
reports/hosting/http-files.json
reports/hosting/model-paths.json
reports/hosting/pages-no-js.png
reports/hosting/pages-no-webgl.png
reports/hosting/release-switch.json
reports/hosting/root-no-js.png
reports/hosting/root-no-webgl.png
reports/hosting/safari.json
reports/integration/README.md
reports/integration/dev.json
reports/integration/entry.json
reports/integration/gestures.json
reports/integration/lifecycle.json
reports/integration/loading-edges.json
reports/integration/loading.json
reports/review-and-release.md
```

</details>

<details><summary>页面截图与录屏（17）</summary>

```text
reports/media/capture.json
reports/media/chapter-api.png
reports/media/chapter-chat.png
reports/media/chapter-ticket.png
reports/media/creative.png
reports/media/deep-links.webm
reports/media/explore.png
reports/media/home-desktop-full.png
reports/media/home-desktop.png
reports/media/home-mobile-full.png
reports/media/home-preview-explore.webm
reports/media/home-preview.png
reports/media/projects-flowops.png
reports/media/projects-newcrisp.png
reports/media/projects-nexus.png
reports/media/studio.png
reports/media/systems.png
```

</details>

<details><summary>Phase 8 业务用例及资源证据（57）</summary>

```text
reports/phase8/README.md
reports/phase8/api-checks.json
reports/phase8/chat-lifecycle.json
reports/phase8/chat-state.json
reports/phase8/chat-stories.json
reports/phase8/chat-visibility.json
reports/phase8/journey-branches.json
reports/phase8/phase8-entry.json
reports/phase8/render-contracts.json
reports/phase8/restore-comparison-initial.txt
reports/phase8/screenshots/api-invalid.png
reports/phase8/screenshots/api-mobile.png
reports/phase8/screenshots/api-quota.png
reports/phase8/screenshots/api-rate.png
reports/phase8/screenshots/api-response.png
reports/phase8/screenshots/api-success.png
reports/phase8/screenshots/chat-desk.png
reports/phase8/screenshots/chat-lost-panels.png
reports/phase8/screenshots/chat-lost.png
reports/phase8/screenshots/chat-mobile-panels.png
reports/phase8/screenshots/chat-mobile-route.png
reports/phase8/screenshots/chat-mobile-staff.png
reports/phase8/screenshots/chat-normal-panels.png
reports/phase8/screenshots/chat-offline-panels.png
reports/phase8/screenshots/chat-reconnected.png
reports/phase8/screenshots/chat-route.png
reports/phase8/screenshots/chat-transfer-panels.png
reports/phase8/screenshots/journey-lost.png
reports/phase8/screenshots/journey-mobile.png
reports/phase8/screenshots/town-FO.png
reports/phase8/screenshots/town-NC.png
reports/phase8/screenshots/town-NX.png
reports/phase8/screenshots/town-ST.png
reports/phase8/screenshots/town-exploded.png
reports/phase8/screenshots/town-globe.png
reports/phase8/screenshots/town-home.png
reports/phase8/screenshots/town-hub.png
reports/phase8/screenshots/town-market.png
reports/phase8/screenshots/town-mobile.png
reports/phase8/screenshots/town-plan.png
reports/phase8/screenshots/town-poster.png
reports/phase8/screenshots/town-quay.png
reports/phase8/screenshots/town-residential.png
reports/phase8/screenshots/town-reverse.png
reports/phase8/source-comparison.json
reports/phase8/suite-all.json
reports/phase8/suite-phase8-entry_town-views_render-contracts_support-chat-lifecycle.json
reports/phase8/suite-support-chat-lifecycle.json
reports/phase8/town-views-initial.json
reports/phase8/town-views-initial.txt
reports/phase8/town-views.json
reports/phase8/verified.json
reports/phase8/一条客服消息.webm
reports/phase8/三章连续切换.webm
reports/phase8/保存后ACK丢失.webm
reports/phase8/断线后补拉.webm
reports/phase8/领取竞争与主管转派.webm
```

</details>

<details><summary>Codeville 运行时与原始资源（38）</summary>

```text
src/codeville/App.vue
src/codeville/Icon.vue
src/codeville/api-request/ApiRequestPanel.vue
src/codeville/api-request/director.ts
src/codeville/api-request/story.ts
src/codeville/content.ts
src/codeville/journey/JourneyPanel.vue
src/codeville/journey/director.ts
src/codeville/journey/playback.ts
src/codeville/journey/story.ts
src/codeville/mount.ts
src/codeville/navigation.ts
src/codeville/resources/FO.jpg
src/codeville/resources/NC.jpg
src/codeville/resources/NX.jpg
src/codeville/resources/ST.jpg
src/codeville/resources/Town.glb
src/codeville/resources/Town.meshopt.glb
src/codeville/resources/layout.json
src/codeville/resources/poster.jpg
src/codeville/scene/atmosphere.ts
src/codeville/scene/camera.ts
src/codeville/scene/model.ts
src/codeville/scene/motion/ambient.ts
src/codeville/scene/motion/bindings.ts
src/codeville/scene/motion/director.ts
src/codeville/scene/motion/mechanics.ts
src/codeville/scene/motion/vehicle.ts
src/codeville/scene/picking.ts
src/codeville/scene/shadows.ts
src/codeville/scene/stats.ts
src/codeville/scene/studio.ts
src/codeville/scene/town.ts
src/codeville/scene/townViews.ts
src/codeville/style.css
src/codeville/support-chat/SupportChatPanel.vue
src/codeville/support-chat/director.ts
src/codeville/support-chat/story.ts
```

</details>

<details><summary>作品集图片与海报（19）</summary>

```text
src/media/FO.webp
src/media/NC.webp
src/media/NX.webp
src/media/ST.webp
src/media/api-response.webp
src/media/chat-normal-panels.webp
src/media/collection.webp
src/media/day-1280.webp
src/media/day-1800.webp
src/media/day-480.webp
src/media/day-800.webp
src/media/day.jpg
src/media/globe.webp
src/media/inside.webp
src/media/market.webp
src/media/night.webp
src/media/quay.webp
src/media/residential.webp
src/media/ticket-delivery.webp
```

</details>

<details><summary>集成、托管、原章节与录制测试（26）</summary>

```text
tests/hosting/README.md
tests/hosting/check-browser.mjs
tests/hosting/check-files.mjs
tests/hosting/check-model-paths.mjs
tests/hosting/check-releases.mjs
tests/hosting/preview.py
tests/hosting/safari.py
tests/media/capture.mjs
tests/phase8/README.md
tests/phase8/api-request.mjs
tests/phase8/common.mjs
tests/phase8/journey-branches.mjs
tests/phase8/phase8-entry.mjs
tests/phase8/render-contracts.mjs
tests/phase8/suite.mjs
tests/phase8/support-chat-lifecycle.mjs
tests/phase8/support-chat-state.mjs
tests/phase8/support-chat-ui.mjs
tests/phase8/support-chat.mjs
tests/phase8/town-views.mjs
tests/phase8/visibility.mjs
tests/portal/entry.mjs
tests/portal/gestures.mjs
tests/portal/integration.mjs
tests/portal/loading-edges.mjs
tests/portal/loading.mjs
```

</details>

## 构建产物

`dist/` 是根域生产包，`dist-pages/` 是带 /portal/ 前缀的生产包，每份 43 个文件。[逐文件 HTTP 和哈希记录](hosting/http-files.json)可用于核对托管内容。构建目录按仓库惯例被 Git 忽略。

`dist-check/` 是本地回归专用构建，包含仅供测试使用的运行时检查入口。`node_modules/` 和原回归脚本的本地 .log 输出也按仓库规则忽略。需要保留的初次失败内容另以 .txt 归档。
