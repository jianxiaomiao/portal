# 大文件与运行资源

以 1 MiB 为此次人工逐项核对线。每个超线候选文件均列在下表，小型正式模型配套资源另列。所有原始截图及视频的文件校验值可在归档清单找到。

| 文件 | 字节 | MiB | 用途 |
| --- | ---: | ---: | --- |
| `src/codeville/resources/Town.glb` | 13,812,376 | 13.17 | 普通版运行模型；手选及压缩故障回退 |
| `src/codeville/resources/Town.meshopt.glb` | 7,591,900 | 7.24 | 默认压缩模型；配套本地 Meshopt 解码器 |
| `reports/phase8/一条客服消息.webm` | 7,228,770 | 6.89 | 验收录像，记录「一条客服消息」；历史归档 |
| `reports/phase8/断线后补拉.webm` | 4,192,087 | 4.00 | 验收录像，记录「断线后补拉」；历史归档 |
| `reports/phase8/领取竞争与主管转派.webm` | 4,012,283 | 3.83 | 验收录像，记录「领取竞争与主管转派」；历史归档 |
| `reports/phase8/保存后ACK丢失.webm` | 3,801,312 | 3.63 | 验收录像，记录「保存后ACK丢失」；历史归档 |
| `reports/phase8/三章连续切换.webm` | 2,971,283 | 2.83 | 验收录像，记录「三章连续切换」；历史归档 |
| `reports/media/deep-links.webm` | 2,767,788 | 2.64 | 验收录像，记录「deep-links」；历史归档 |
| `reports/media/home-desktop-full.png` | 1,275,089 | 1.22 | 页面实录「home-desktop-full」；历史归档 |
| `reports/media/home-preview-explore.webm` | 1,078,599 | 1.03 | 验收录像，记录「home-preview-explore」；历史归档 |

**仓库适配。** 27 个 src 运行资源合计 23,879,497 B。体积最大的普通 GLB 为 13.17 MiB。GitHub 普通 Git 超过 50 MiB 给出警告，超过 100 MiB 会阻止提交到远端。当前单文件适合随源码保存，无需为这次候选引入 LFS；模型频繁改版仍会累积历史体积。59 个历史截图与录屏合计 51,040,630 B，独立私有归档可避免反复增加二进制历史。本次静态站约 23.62 MiB，在 Pages 1 GB 的站点体积上限内。访客冷载模型会占用带宽，实际流量上线后观察。[GitHub 大文件](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) · [Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

**两个 GLB。** glTF 2.0、声明长度与文件长度一致。两者各有 194 个 extras 对象，使用 codeville_id、environment_batch、export_unit、interactive、project、role。两张纹理都内嵌，无外部 URI。Meshopt 额外要求 EXT_meshopt_compression。运行时将两个布局专有标记补入注册表，两个模型均取得 196 个稳定 ID；逐锚点校验位置，布局和普通/压缩模型共享版本前缀。[GLB 检查](evidence/scan.json) · [两模型场景契约](evidence/phase8/render-contracts.json)

| 运行文件 | 字节 | 用途 |
| --- | ---: | --- |
| `public/favicon.svg` | 303 | 页签图标 |
| `src/codeville/resources/FO.jpg` | 15,172 | 静态建筑缩略图或探索海报 |
| `src/codeville/resources/NC.jpg` | 14,469 | 静态建筑缩略图或探索海报 |
| `src/codeville/resources/NX.jpg` | 14,537 | 静态建筑缩略图或探索海报 |
| `src/codeville/resources/ST.jpg` | 17,042 | 静态建筑缩略图或探索海报 |
| `src/codeville/resources/Town.glb` | 13,812,376 | 普通版运行模型；手选及压缩故障回退 |
| `src/codeville/resources/Town.meshopt.glb` | 7,591,900 | 默认压缩模型；配套本地 Meshopt 解码器 |
| `src/codeville/resources/layout.json` | 56,322 | 路线、锚点与工作室布局 |
| `src/codeville/resources/poster.jpg` | 154,917 | 静态建筑缩略图或探索海报 |
| `src/media/FO.webp` | 200,320 | 项目、街区、工作室或收藏的实景图 |
| `src/media/NC.webp` | 200,682 | 项目、街区、工作室或收藏的实景图 |
| `src/media/NX.webp` | 175,846 | 项目、街区、工作室或收藏的实景图 |
| `src/media/ST.webp` | 204,000 | 项目、街区、工作室或收藏的实景图 |
| `src/media/api-response.webp` | 85,720 | 章节导读实录 |
| `src/media/chat-normal-panels.webp` | 69,742 | 章节导读实录 |
| `src/media/collection.webp` | 57,224 | 项目、街区、工作室或收藏的实景图 |
| `src/media/day-1280.webp` | 106,358 | 首页响应式海报或兼容图 |
| `src/media/day-1800.webp` | 165,752 | 首页响应式海报或兼容图 |
| `src/media/day-480.webp` | 26,390 | 首页响应式海报或兼容图 |
| `src/media/day-800.webp` | 55,814 | 首页响应式海报或兼容图 |
| `src/media/day.jpg` | 259,666 | 首页响应式海报或兼容图 |
| `src/media/globe.webp` | 88,718 | 项目、街区、工作室或收藏的实景图 |
| `src/media/inside.webp` | 157,246 | 项目、街区、工作室或收藏的实景图 |
| `src/media/market.webp` | 21,026 | 项目、街区、工作室或收藏的实景图 |
| `src/media/night.webp` | 147,306 | 项目、街区、工作室或收藏的实景图 |
| `src/media/quay.webp` | 104,548 | 项目、街区、工作室或收藏的实景图 |
| `src/media/residential.webp` | 31,052 | 项目、街区、工作室或收藏的实景图 |
| `src/media/ticket-delivery.webp` | 45,352 | 章节导读实录 |
