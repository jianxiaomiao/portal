# macOS Safari 真机验收

实测 macOS 26.7.3（25G342），系统 Safari 26.6.2（21624.5.1.11.3）。系统 WebDriver 拒绝 POST /session，提示需要开启 Allow remote automation。独立于 WebDriver，使用正常启动的 Safari 访问回环页面，先做同源页面自检，再从顶层打开基于正式探索 HTML 的观测页。观测脚本记录实际上下文、像素、页面状态及请求，使用的业务 JS、模型和布局与候选包一致。[系统握手](evidence/hosting/safari.json) · [真实 Safari 观测](evidence/safari.json)

| 项目 | 本机结果 |
| --- | --- |
| 默认首页，三项软件详情 | 通过。实际读到首页及三个独立详情标题、工程说明，首页启动前没有模型请求。 |
| WebGL 2 能力 | 未通过。getContext 返回了对象，但初始 isContextLost 为 true，VERSION 为 null。清屏红色后读回 RGBA 为 0/0/0/0，错误码 37442（CONTEXT_LOST_WEBGL）。 |
| 首次探索、Meshopt、手选普通 GLB、压缩故障后切普通版 | 默认与普通路径均未到达可交互状态。顶层探索页在 2 秒和 30 秒采样均为 unsupported，实际 GLB 请求为 0。Three.js 在读取 shader precision 时遇到 null；此记录无法归因为模型或解码器故障。 |
| 静态降级 | 通过。真实 Safari 显示「静态总览」、重试按钮及项目链接。 |
| 昼夜切换 | 界面状态从日光到夜色再回日光；三维画面的光照变化待测。 |
| 旋转与缩放、NX/FO/NC/ST 拾取、工作室展开、Frostwick 特写 | 三维初始化受阻，无法执行。 |
| API、工单、客服三章 | 三个深链均尝试进入分步模式，三维播放未启动。静态章节可从 Systems 导读复核。 |
| 隐藏与恢复、离开后资源释放 | 尚缺已成功绘制场景的真实 Safari 样本。失败态离开时观察到的画布移除、已有上下文失效不计入成功场景的释放验收。 |

**复测步骤。** 在有可用 WebGL 2 的 Mac 上从正常 Safari 打开正式根包。先浏览首页与三个项目。进入探索后在性能面板确认首帧、帧率、上下文可用；切换普通版本并验证只加载对应 GLB。分别点拾四栋建筑，旋转、缩放，在 ST 展开并进入 Frostwick；切换主题、分步运行三章。切走标签页再返回，最后退出到首页，记录画布移除、RAF/上下文释放。压缩版单独故障可用手机预览工具的故障选项在本机重演。

如选择用 WebDriver，在 Safari 设置的「高级」启用网页开发者功能，再从「开发 → 开发者设置」勾选「允许远程自动化」，然后对已启动的诊断包运行 tests/hosting/safari.py。开启自动化只解决会话权限，这台 Mac 还需要独立复核 WebGL 上下文丢失。原 smoke 脚本成功时也只覆盖部分矩阵。[Apple WebDriver 设置](https://developer.apple.com/documentation/safari-developer-tools/macos-enabling-webdriver)
