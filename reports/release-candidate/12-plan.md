# GitHub Pages 发布操作计划

正式目标为 [GitHub Pages 项目站](https://jianxiaomiao.github.io/portal/)。以下操作安排在对应授权之后。

1. **确认范围。** 作者审阅 183 项白名单、公开署名和模型授权。本机桌面 Safari 三维限制已记录。保留已校验的本地基线整包以及 61 份私有材料。[精确清单](commit-paths.txt) · [已知限制](11-blockers.md)
2. **暂存与提交。** 获准后在开发分支执行下方命令。比较两份排序结果，核对暂存差异及二进制大小。吻合后提交，建议标题为「准备 Codeville RC V1 与 GitHub Pages 发布配置」。
3. **推送与 PR。** 推送 codex/codeville-portal-integration 至 origin，以 main 为目标创建 PR。记录提交 SHA、两份校验清单和 Safari 限制。等待 Linux runner 构建成功，确认 PR 的上传步骤和 deploy 作业均跳过。
4. **合并前。** 核对远端 main 和已审阅的 PR SHA。若 main 或构建输入有变，复核差异并重建受影响的包。保存该版本的完整产物、锁文件、清单与基线回退包。此站点尚无已验证的成功线上版本。
5. **正式发布。** 取得作者单独的生产授权后才将 PR 合并入 main。此次合并会自动构建并上传 dist-pages，触发 github-pages 环境部署。记下 Actions 运行、部署 SHA 与页面地址，一次合并即可触发发布。
6. **上线复验。** 检查首页、三个项目页、系统页、探索深链刷新、Studio、Creative 和未知嵌套地址。核对资源哈希、许可、实际 CDN 缓存、默认及回退模型、无 JS/WebGL 阅读，并在手机上确认可交互。旧标签遇到跨版本资源过期时刷新页面。
7. **回退。** 首次部署失败先确认部署状态和当前线上响应。在已有成功版本时，获准后用回退 PR 恢复上次已核验的完整源码与工作流，或按授权重部署对应整包。首发前仅有本地重建的 1807fc1 基线，恢复它会回到仅首页的版本。按原基线工作流构建并上传 dist，核对基线的三个文件、首页和新增深链的预期 404。记录回退后的线上结果。[构建与回退证据](09-build-rollback.md)

授权之后，在仓库根目录的开发分支执行以下核对。diff 无输出表示暂存路径与白名单相同。

```sh
git --literal-pathspecs add --pathspec-from-file=reports/release-candidate/commit-paths.txt
git -c core.quotepath=false diff --cached --name-only | LC_ALL=C sort > "$TMPDIR/portal-rc-staged.txt"
LC_ALL=C sort reports/release-candidate/commit-paths.txt > "$TMPDIR/portal-rc-allowed.txt"
diff -u "$TMPDIR/portal-rc-allowed.txt" "$TMPDIR/portal-rc-staged.txt"
git diff --cached --check
git diff --cached --stat
```
