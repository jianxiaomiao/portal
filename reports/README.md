# Phase 9 B+ · 本机审阅入口

[正式首页本机预览](http://127.0.0.1:4398/) · [独立探索模式](http://127.0.0.1:4398/explore/) · [模拟 Pages 子路径](http://127.0.0.1:4398/portal/)

开发分支为 codex/codeville-portal-integration，起点为 main 的 1807fc1ec2ab362755d7206eb04bb0d2edbf2017。所有验收均在本机进行。

当前发布判断见 [Phase 10 发布候选验收总表](release-candidate/README.md)。本页保留 Phase 9 原始验收记录。历史图片及视频的独立归档与本地还原位置见[文件清单](release-candidate/02-git.md)。

## 页面与录屏

| 内容 | 实际页面截图或视频 |
| --- | --- |
| B+ 首页 | [宽屏首屏](media/home-desktop.png) · [桌面全页](media/home-desktop-full.png) · [手机完整首页](media/home-mobile-full.png) |
| 软件工程作品 | [Nexus](media/projects-nexus.png) · [FlowOps](media/projects-flowops.png) · [NewCrisp](media/projects-newcrisp.png) |
| Codeville | [首页主动启用后的实景](media/home-preview.png) · [完整探索模式](media/explore.png) |
| Systems Lab | [章节目录](media/systems.png) · [第一章 · API 计算](media/chapter-api.png) · [第二章 · 工单提交](media/chapter-ticket.png) · [第三章 · 客户看到回复](media/chapter-chat.png) |
| 个人空间 | [Studio](media/studio.png) · [Creative Lab](media/creative.png) |
| 浏览演示 | [首页启用三维并进入探索](media/home-preview-explore.webm) · [项目、工作室、收藏与章节深链](media/deep-links.webm) |
| 录制核验 | [14 张 PNG 的尺寸、两段 WebM 的时长与三帧解码结果](media/capture.json) |

## 工程与验收

| 检查 | 主要结果 | 详细记录 |
| --- | --- | --- |
| 静态构建与发布路径 | 根域及 /portal/ 各有 8 个独立正文页面和实体 404。Nginx 实测两份构建各 43 个文件，资源逐字节匹配；未知地址返回 404。 | [双路径、禁 JS、禁 WebGL 与缓存报告](hosting/README.md) |
| 模型加载 | 普通首页与资料页在主动进入三维前不请求模型/Three/解码器。10 Mbit/s 冷载，主动启用到就绪中位数为 Meshopt 8.52 s、普通版 13.69 s。每种三次。 | [加载与资源生命周期](integration/README.md) |
| 场景所有权 | 十轮首页预览进入探索，均复用实际 canvas 与模型；三次完整重建；实际 context loss 后画布持久监听与场景 RAF 归零。解析滞后返回的两个位图均已关闭。 | [十轮往返](integration/lifecycle.json) · [解析取消](integration/loading-edges.json) · [重建](phase8/phase8-entry.json) |
| 三章业务语义 | API 六组、工单五分支、客服四分支；三章十轮交替返回资源稳态。原生标签切后台时，环境和章节时钟暂停。 | [三章完整回归](phase8/README.md) |
| 手机交互 | Chrome 手机视口执行真实触摸事件序列，阅读态可滚动，操控态旋转镜头，结束后恢复滚动。切换聊天侧别不改变消息和阅读水位。 | [触屏数据](integration/gestures.json) · [侧别与书签](integration/lifecycle.json) |
| 已知边界 | 物理手机和真实 Safari 三维待验收。当前 Safari 的 WebDriver 未获远程自动化许可。Pages 子路径在本机 Nginx 模拟。 | [资料清单、真机验收与发布说明](review-and-release.md) |

[修改文件清单](changes.md) · [本地开发与复现命令](../README.md)
