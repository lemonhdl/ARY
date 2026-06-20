# B-Admin 提交 8d520d3 复审

审查对象：`8d520d3` (`b-admin review 2`)

结论：这次提交**不包含新的 B-Admin 功能或交付物修复**，它只把运行期生成文件和进程痕迹提交进了仓库。因此，它不能算一轮有效的 b-admin 交付更新；从代码审查角度看，这个提交应被视为一次**不应入库的运行态快照提交**。

## Findings

### 1. 高优先级：提交内容只有运行期生成物，没有任何 `app/web/admin` 或 `deliverables/b-admin` 的实际改动

- 我比对了上一轮已审的 b-admin 交付提交 `21e7e38` 到本次 `8d520d3` 的变更范围，结果只涉及 `runtime-data/assembled-view.json`、`runtime-data/compatibility-report.json`、`runtime-data/web-app.pid`、`runtime-data/web-app.log`、`runtime-data/web-app.error.log`。
- 当前运行态装配文件本来就是由 [scripts/assemble.js](../scripts/assemble.js#L93) 和 [scripts/assemble.js](../scripts/assemble.js#L94) 写出的派生产物。
- 管理端运行日志和 pid 本来就是启动脚本的副产物，仓库说明也明确写了这些文件会写入 `runtime-data/`，见 [README.md](../README.md#L65) 和 [README.md](../README.md#L66)。

影响：这次提交不能关闭任何上一轮 b-admin review 中的功能缺口，也不应被当作一次真实的管理端实现更新。

### 2. 中优先级：把 `assembled-view` / `compatibility-report` / 日志 / pid 提交进仓库，会制造高频无意义 churn，且快照具有环境依赖

- [runtime-data/assembled-view.json](../runtime-data/assembled-view.json) 和 [runtime-data/compatibility-report.json](../runtime-data/compatibility-report.json) 都是可再生文件，来源是当前本地运行时输入和装配时间，而不是手工维护的源文件。
- `web-app.pid` 是本机进程 ID，`web-app.log` / `web-app.error.log` 也是运行环境输出；它们对下游开发者不可复用，且会在每次本地启动后变化。
- 这类文件已经更适合被忽略，而不是作为功能提交的一部分长期保存在版本库中。

影响：仓库历史会混入与产品行为无关的噪声；评审者也会被误导，以为 b-admin 有新的可审功能改动，实际上并没有。

## What Passed

- 我没有发现这次提交引入新的管理端页面代码回归，因为它根本没有改动 [app/web/admin](../app/web/admin) 或 [deliverables/b-admin](../deliverables/b-admin) 下的实现文件。
- 当前运行态装配仍然可执行，`assembled-view.json` 和 `compatibility-report.json` 可以被正常重建。

## Run/Test 结果

我实际执行了以下验证：

1. 范围核对
   - 对比 `21e7e38..8d520d3` 的变更范围后，确认没有 `app/web/admin/`、`scripts/assemble.js`、`deliverables/b-admin/` 下的功能文件改动，只有 `runtime-data/` 文件变化。
2. `node scripts/assemble.js`
   - 结果：仍可正常重建 `runtime-data/assembled-view.json` 与 `runtime-data/compatibility-report.json`。
3. 仓库契约核对
   - [README.md](../README.md#L65) 与 [README.md](../README.md#L66) 明确说明 `runtime-data/web-app.pid`、`runtime-data/web-app.log`、`runtime-data/web-app.error.log` 属于运行态输出，而不是功能源码。

## Overall Assessment

- 如果看“这是不是一次有效的 b-admin 功能交付提交”，答案是：**不是**。
- 如果看“这次提交是否应该进入长期版本历史”，答案是：**不建议，除非目的是临时共享运行快照，而且应改走独立 artifact 路径而不是直接提交到 `runtime-data/`**。

## Recommended Next Steps

1. 不要再把 [runtime-data/assembled-view.json](../runtime-data/assembled-view.json)、[runtime-data/compatibility-report.json](../runtime-data/compatibility-report.json)、[runtime-data/web-app.pid](../runtime-data/web-app.pid)、[runtime-data/web-app.log](../runtime-data/web-app.log)、[runtime-data/web-app.error.log](../runtime-data/web-app.error.log) 作为 b-admin 功能提交的一部分入库。
2. 真正需要复审 b-admin 时，应提交 [app/web/admin](../app/web/admin)、[deliverables/b-admin](../deliverables/b-admin) 或 [scripts/assemble.js](../scripts/assemble.js) 里的功能修复，而不是运行快照。
3. 如果确实要保留运行态证据，建议放到专门的 review artifact 或录屏/截图路径，而不是污染运行目录的主线历史。