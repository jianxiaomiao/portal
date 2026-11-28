# 正式构建、部署条件与整包回退

本地 HEAD、main 和匿名查询的远端 main 为 `1807fc1ec2ab362755d7206eb04bb0d2edbf2017`。候选源位于未提交的 `codex/codeville-portal-integration`。在隔离源码副本用锁文件离线 npm ci 安装 61 个包，执行含 vue-tsc 的构建。本机 Node 24.22.3 与 Actions 所用主版本对应的 Node 22.23.2 生成的 Pages 包逐文件相同；Linux 托管 runner 上的本次候选仍需经授权的 PR 构建。

| 可用目录 | 用途 | 验证 |
| --- | --- | --- |
| dist/ | Nginx 根路径，44 文件，24,767,617 B | [SHA-256](evidence/dist.sha256) |
| dist-pages/ | GitHub Pages 项目站 /portal/，44 文件，24,769,129 B | [SHA-256](evidence/dist-pages.sha256) |
| dist-rollback-main-1807fc1/ | 从基线 git archive、对应锁文件与 npm ci 重建的整包，3 文件，89,076 B | [SHA-256](evidence/dist-rollback-main-1807fc1.sha256) |
| dist-check/ | 本机旧用例专用诊断构建，含测试对象 | 不作为托管上传源 |

在 Portal 根目录执行。npm ci 建议在干净检出目录运行，以免替换正在使用的本地依赖。

```sh
npm ci
PORTAL_INSPECT=0 PORTAL_BASE=/ PORTAL_OUT=dist npm run build
PORTAL_INSPECT=0 PORTAL_BASE=/portal/ PORTAL_OUT=dist-pages npm run build
(cd dist && shasum -a 256 -c ../reports/release-candidate/evidence/dist.sha256)
(cd dist-pages && shasum -a 256 -c ../reports/release-candidate/evidence/dist-pages.sha256)
(cd dist-rollback-main-1807fc1 && shasum -a 256 -c ../reports/release-candidate/evidence/dist-rollback-main-1807fc1.sha256)
```

在真机和桌面业务回归后补入单个第三方许可文本。其余 43 个文件在两个前缀均逐一核对与回归时的 SHA-256 一致，含许可的 44 文件已重跑 HTTP 与回退校验。Vite 提示按需加载的 Three.js 分块约 533 kB，压缩前超过 500 kB 提示线，普通首页不会请求它。

本机独立 Nginx 1.30.8 在同一监听口承载两套路径。各前缀 8 个公开实体页面及 404.html，逐文件检查内容、MIME、ETag 与 304，版本资源带 immutable，HTML 带 no-cache，嵌套未知路径返回本套正文及 HTTP 404。Chrome 无 JS 刷新、返回、深链、无 WebGL 和正常模型均有新记录。两版模型与 layout 位于 town-6c2fa5d037a0，媒体按 media-c0a27766cbce 成组。浏览器持久配置的同资源第二次读取命中缓存。实际 Pages 响应头需上线后单测。[双路径 HTTP](evidence/hosting/http-files.json) · [浏览器](evidence/hosting/browser.json) · [模型路径](evidence/hosting/model-paths.json)

**回退演练有两种。** 第一种在临时目录对 main → RC → main 做原子目录切换，逐步对比了 3、44、3 个 HTTP 文件，首尾树摘要相同；基线首页可读，基线没有的探索地址恢复为 404。第二种在有三维的两个候选构建间改变布局版本，升级期间旧标签仍可延后启用，刷新取得同一新版 layout 与 GLB，回滚后取回同一旧版。真实浏览器重进热缓存模型中位 959 ms。[基线整包切换](evidence/baseline-switch.json) · [旧标签与延迟加载](evidence/hosting/release-switch.json)

**生产执行边界。** Nginx 发布时应先保留现服完整目录、配置与哈希，在新目录核对后原子切换站点指针，并在旧标签存续期保留旧指纹资源的可访问路径。回退时将指针切回并从首页、一个旧深链及静态资源验证。候选 Pages workflow 每次仅上传本次 dist-pages，不能保证 CDN 替旧标签保存旧分块；若要求无缝升级，在另获授权后将上一版的指纹资源并入上传包并验证体积，或明确刷新恢复策略。Pages 回退需要重新部署经核验的完整上版产物，或以一个正常回退提交在 main 触发构建。切勿将诊断目录、报告或证书打进部署包。基线重建包与曾在线上的具体字节之间没有可比对的生产凭据。

**工作流触发条件。** 本地修改、暂存、提交和本地合并均不会自行触发远端 Actions。推送 main（包括完成对 main 的远端合并）会构建、上传并尝试 deploy。PR 目标 main 只构建；手动 workflow_dispatch 在 main 会部署，选择其他分支仍可构建和上传，但 deploy 条件不成立。直接推送本开发分支、单独推 tag 均不匹配 push 过滤器；已有 PR 时更新其分支可能触发 PR 构建。

2026-11-28 只读核查显示仓库为 Public，默认分支 main，has_pages 为 true。作者已在管理界面确认 Source 为 GitHub Actions，默认域名启用 HTTPS。匿名 Pages 元数据接口返回 404，无法独立读取 Source。github-pages 环境返回自定义部署规则共一条，类型 branch、名称 main，未返回标签规则、等待时间或必需审阅人。main 分支接口返回 protected 为 false，生产授权须在合并前完成。[仓库元数据](https://api.github.com/repos/jianxiaomiao/portal) · [环境规则](https://api.github.com/repos/jianxiaomiao/portal/environments/github-pages/deployment-branch-policies)

旧工作流能根据 Actions 环境推导 /portal/，默认构建并上传 dist。历史运行 45959772344 的故障发生在创建 deployment 阶段。候选沿用同一工作流，将 PORTAL_BASE=/portal/、PORTAL_OUT=dist-pages、PORTAL_INSPECT=0 与上传目录显式绑定。build 仅获 contents: read，pages: write 和 id-token: write 只授予 deploy。按 Git ref 分组排队。正式目标 HTTPS 首页本轮匿名访问为 404，首个成功部署、线上响应头和生产回退仍待验证。[历史运行](https://github.com/jianxiaomiao/portal/actions/runs/45959772344) · [正式目标](https://jianxiaomiao.github.io/portal/)

最终复核从 183 个白名单路径及 2 个未变更的已跟踪文件（LICENSE、tsconfig.json）还原干净目录。Node 22.23.2、npm 10.9.8 完成 npm ci 和两次正式构建，两份逐文件清单完全匹配。本机 HTTP 实测每套 8 页、44 个文件、2 个未知地址。Chrome 分别验证默认 Meshopt、手选普通 GLB，以及 Meshopt 返回 503 后在直达探索深链和刷新时以普通 GLB 恢复。inspect 查询参数未暴露测试对象。

| SHA-256 校验清单文件 | 清单本身的 SHA-256 |
| --- | --- |
| dist.sha256 | `a4995099224c9f70207ea88e94920d0099aa4e39a9c5ac1b71eb3ae2f9be11c0` |
| dist-pages.sha256 | `6fe1fa52de556d1329a500f6580235a111d68c3d727bf824cba687751e2ea4ea` |
