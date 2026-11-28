# iPhone Safari 与 Android Chrome 真机验收

2026-11-28，两个实体设备分别完成 15 项验收。iPhone 经私网 HTTPS 访问仅放行该设备的 Mac 静态预览；Android 经 USB ADB reverse 访问 Mac 的回环 HTTPS 预览。两个设备实际页面均报告 secure context 与可用的 crypto.subtle。Android 手势另外使用仅经 USB 到达的回环诊断包读取相机和缩放变化。桌面手机视口测试在独立的回归报告中记录。

| 设备 | 浏览器与条件 | 首次可交互 | 帧时间、持续运行及上下文 |
| --- | --- | --- | --- |
| Apple iPhone，USB 产品型号 iPhone13,1，iOS 27.2 | 真 Safari，Version/27.2。私网 HTTPS，no-store，自动画质；页内自检有可见 iframe | 主页点击启用至 ready。Meshopt 12,644 ms，普通 GLB 20,264 ms，各一次 | 30 秒前台 1,801 个 RAF 间隔，P50/P95 均 17 ms，未观察到 context loss。该次基于默认画质；补验轻量画质时应用性能面板显示 60 FPS。 |
| Xiaomi 14，23127PN0CC，Android 16 | 真 Chrome 150.0.7871.129。USB 回环、正式 HTTPS；三轮配对禁用浏览器缓存，自动画质 | Meshopt 中位 707 ms，普通 GLB 826 ms。首次独立冒烟为 790/819 ms | 低画质 60.01 秒，3,610 帧，RAF 约 60 FPS，P50 16.6 ms、P95 16.7 ms，context loss 0，末态 ready。另取四次应用自身性能面板均为 60 FPS。 |

设备系统版本取自 USB 产品服务，浏览器版本取自手机 Safari 自报的 Version 字段与 Android 包管理器。Safari UA 中用于兼容的 OS 字段与真实系统版本不同。帧采样窗口只描述当时体验；长时间发热、低内存杀进程、蜂窝网络与其他机型尚未测量。[iPhone 分项记录及操作者确认](evidence/iphone.json) · [Android 分项记录](evidence/android.json)

| 项目 | iPhone Safari | Android Chrome |
| --- | --- | --- |
| 1 首页 | 首页及海报可读，启用前无模型/Three 请求 | 首页可读，canvas 与三维请求均为 0 |
| 2 普通项目 | 三个详情标题和工程说明均取得 | 三个详情逐一打开 |
| 3 启用三维 | 点击后 ready，读取实际模型路径 | 两个模型均进入 ready |
| 4 阅读态与操控态 | canvas 的 pointer-events 经 none → auto → none | 阅读态滚动约 88 px；操控态页面滚动为 0，退出后再次滚动 |
| 5 单指旋转、双指缩放 | 记录可信单双指触摸。操作者确认分别看到了旋转和缩放 | 在实际设备的浏览器输入层派发触摸序列，单指相机位移 6.06、双指缩放变化 2.01 |
| 6 横竖屏 | 实际 portrait → landscape → portrait | 系统旋转后视口 845×283，再回 400×773 CSS px，已恢复原系统设置 |
| 7 系统返回 | 进入项目后通过 Safari 返回，记录到历史恢复 | Nexus 详情经手机系统返回恢复原首页 |
| 8 低画质 | 修正观测页跨窗口事件构造后复测通过，选中 low 并查看性能面板 | 选中 low，持续采样及性能面板通过 |
| 9 昼夜 | 正式场景切至夜色并切回日光 | 正式场景 night → day |
| 10 工作室 | 展开 ST、进入室内并到 Frostwick，出现「返回室内」 | 同一深链到收藏品特写 |
| 11 三章分步 | API、工单、客服均点击分步并推进 | 三章均进入并完成下一步 |
| 12 客服双端 | 客户 → 坐席 → 客户，校验对应面板可见 | 两侧均可切换，核实可见面板 |
| 13 后台恢复 | 记录真实 hidden/visible，返回时场景仍 ready | 经系统桌面打开后回 Chrome，hidden → visible，场景 ready |
| 14 加载失败 | 测试页仅对本浏览器的两次模型请求返回 503，静态目录可进入 NewCrisp | 仅拦截测试标签的两次 GLB 请求，静态目录进入真实项目详情 |
| 15 两模型对照 | 只加载所选文件，压缩版启用更快 | 文件名与时间逐次记录，压缩版中位更低 |

首次 iPhone 测试曾遇到 Safari 无法连接服务器，当时私网预览不可达。后续同一私网 HTTPS 端点已收到该手机的完整实测记录。未确定连接恢复的具体原因。Android 首次 shell 模拟系统按键被设备拒绝；系统返回采用实际手势，后台恢复通过正常的系统桌面与 Chrome Activity 完成。未降低手机输入安全设置。

## 复测环境

使用 Python 3.9+、OpenSSL 及正式根包。Mac 与 iPhone 在受信任私网时，先核对到设备的路由、从手机到 Mac 的可达性及证书 SAN。命令中的 MAC_LAN_IP 和 PHONE_IP 需填各自私网 IPv4；局域网模式仅接受明确列出的手机来源和主机自身，使用空闲的非特权端口。手机访问 `https://MAC_LAN_IP:8443/`。私网证书的公钥指纹可从另一可信途径核对。

```sh
PORTAL_BASE=/ PORTAL_INSPECT=0 npm run build
TLS_PARENT=$(mktemp -d)
sh tests/hosting/mobile-cert.sh "$MAC_LAN_IP" "$TLS_PARENT/site"
python3 tests/hosting/mobile-https.py --bind "$MAC_LAN_IP" --allow "$PHONE_IP" \
  --cert "$TLS_PARENT/site/server.pem" --key "$TLS_PARENT/site/server.key"
```

只有公开的 phone-ca.cer 需要传给设备。手机持有者自行决定是否安装、信任并在验收后移除该专用根证书；私钥留在仓库外的临时目录。iOS 如安装了测试描述文件，结束后可到「设置 → 通用 → VPN 与设备管理」删除。专用 CA 和站点证书均两天有效。[Apple 手动信任说明](https://support.apple.com/en-us/102390)

Android 经 USB 时可用 127.0.0.1 生成对应证书，用相同工具按默认回环地址启动，然后 `adb reverse --no-rebind tcp:8443 tcp:8443`；手机访问自己的 `https://127.0.0.1:8443/`。该地址依赖 USB 映射。首次载入对比应注明网络、缓存、是否信任证书以及画质。要复测故障，单独重启测试服务并加 `--fail-model meshopt` 或 `--fail-model both`，确认回退或静态导航后停止。

本轮已关闭专用私网及回环服务、撤销新增 USB 映射、关闭专用 ADB 进程并清理两套测试私钥。Mac 不再监听本轮预览端口。若手机安装过测试 CA，请由持有者移除描述文件。复测时重新生成证书和启动服务。
