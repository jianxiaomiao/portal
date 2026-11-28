# 本机托管兼容检查

在仓库根目录分别生成根站点和带仓库前缀的静态产物。

```sh
npm run build
PORTAL_BASE=/portal/ PORTAL_OUT=dist-pages npm run build
```

用本机已有的 Nginx 启动独立预览。脚本自动生成临时配置、日志目录和 PID 文件，绑定回环地址，默认端口为 4398。Nginx 在前台运行，可用 Ctrl+C 结束。根路径使用 dist，/portal/ 使用 dist-pages，两处都用各自的 404.html 响应未知页面。内容寻址的资源有 immutable，HTML 支持 ETag 条件请求。

```sh
python3 tests/hosting/preview.py --nginx /path/to/nginx
```

在另一个终端运行以下检查，保留同一轮的报告。浏览器脚本需要本机 Chrome。

```sh
node tests/hosting/check-files.mjs
node tests/hosting/check-browser.mjs
node tests/hosting/check-model-paths.mjs
```

第一项对两个产物的每个文件分别进行 HTTP 下载、逐字节比对、MIME 和 304 检查，复算模型及图片版本目录的 SHA-256，验证真实 HTML 与静态 404。第二项通过 Chrome 禁用脚本与 WebGL，检查跨页链接、刷新、回退、静态信息、普通内容页网络请求以及同版本 Meshopt 的浏览器缓存。第三项在浏览器启用 WebGL，分别从两个生产构建启动默认 Meshopt 和手动普通 GLB，检查首帧可见、资源基址与解码器按需下载。切换监听地址可通过 PORTAL_PREVIEW_ORIGIN 指定。

在已生成根域生产包后运行 `node tests/hosting/check-releases.mjs`。该项在系统临时目录复制构建源码，改变 layout 尾部空白以生成第二套版本，启动隔离回环服务，实测升级、旧标签页延后加载、回退及三组热载耗时。结束时删除临时副本。

真实 Safari 的可选探测连接开发验证构建，需要本机已允许 Safari 远程自动化。页面目标默认为 http://127.0.0.1:4399/explore/，可通过 PORTAL_DIAGNOSTIC_ORIGIN 指定。脚本记录握手结果，成功时进一步检查两版模型和昼夜主题。

```sh
python3 tests/hosting/safari.py
```

结果在 [托管验收目录](../../reports/hosting/)。
