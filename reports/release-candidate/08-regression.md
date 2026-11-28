# 最终功能回归

重跑时将当前源码及保留的 Phase 9 测试复制到隔离目录，各套件新生成结果，原报告、初次失败截图与录屏仍在原位。诊断包负责对象生命周期断言，正式包另用浏览器验证可见页面、网络、缓存和回退。Phase 8 套件串行执行，9 个子进程退出码全部为 0。[本轮九项退出码与耗时](evidence/phase8/suite-all.json) · [本轮命令结果](evidence/runs.json)

| 覆盖 | 本轮结果与原始证据 |
| --- | --- |
| API 六组 | 成功、队列满、配额耗尽、参数错误、等待超时、等候获准后用量写入失败均通过。验证响应、扣额与后台事件的独立顺序。[API](evidence/phase8/api-checks.json) |
| 工单五分支 | 首次成功、回执丢失、内容冲突、回执校验失败、旧租约通过。租约、回执与状态断言保持原脚本。每条记录核对写入、分派及账本。[工单](evidence/phase8/journey-branches.json) |
| 客服四剧情 | 正常、ACK 丢失、断线补拉及争抢转派通过；原生前后台、双端读水位和重复消息断言通过。[客服](evidence/phase8/chat-stories.json) · [前后台](evidence/phase8/chat-visibility.json) |
| 十轮预览提升及退出 | 每轮复用同一画布与模型，1 次 GLB 请求；退出后 canvas 和场景 RAF 归零，旧 context 已释放。[十轮记录](evidence/integration/lifecycle.json) |
| 十轮三章交替 | 每轮资源回到 308 个几何、59 个材质、5 张纹理、1 个模型，章末轨道占用为空。[三章生命周期](evidence/phase8/chat-lifecycle.json) |
| 慢加载、取消、失败回退 | 在途取消成功；延迟返回的两个纹理位图均 close，未挂回画布；未知长度只显示已收字节。压缩文件或解码器故障只回退普通模型一次，双失败进入静态导航。[加载边界](evidence/integration/loading-edges.json) · [故障路径](evidence/integration/lifecycle.json) |
| 三次重建与上下文丢失 | 三次重建后原画布监听归零。主动丢失上下文后画布监听与场景 RAF 为 0，重试可恢复选中地点及夜色。[重建](evidence/phase8/phase8-entry.json) · [入场与恢复](evidence/integration/entry.json) |
| 景点、动效、移动输入 | 四栋建筑、街区与室内、Frostwick、两模型动画和阴影标识通过。实际分辨率变化和系统设备结果另见真机表。Chrome 减少动态、首访跳过、省流量入口与触屏阅读/操控通过。[小镇](evidence/phase8/town-views.json) · [触控](evidence/integration/gestures.json) |
| 公开包和降级 | 根路径、/portal/ 各 8 页；无 JS 可读、刷新、旧锚点、无 WebGL 静态导航、两套模型、404 及热缓存通过。正式页三条剧情均推进到结尾，未产生业务网络调用。[托管](evidence/hosting/browser.json) · [正式剧情](evidence/public-network.json) |
| 完整回退 | 基线整包恢复、旧标签延迟取模型、布局与版本配对均通过。[构建与回退](09-build-rollback.md) |

复现命令见仓库 README 的「复现回归」及 tests/hosting/README.md；补充的正式剧情网络断言在双前缀 Nginx 上执行 `node tests/hosting/check-local-demos.mjs`。浏览器为 Chrome 158.0.8127.88，本机模拟数据和 USB 真机数据应分别解读。
