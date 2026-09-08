# 人工质检任务

- 页面名称：人工质检任务
- 访问路径：`/qc/task-list`
- 菜单位置：质检优化 / 人工质检任务

## 页面目标

原样迁移自旧版「AI 质检优化平台」Demo（Tailwind + shadcn 技术栈），承载在当前 ZhijiLab 原型框架的 AppShell 之下，仅替换了侧边栏/顶栏/菜单为框架统一样式，页面内部的业务操作区视觉与交互保持不变。

## 页面结构

- 任务卡片列表：按状态（进行中/待分配/待处理）筛选、按名称搜索，卡片展示来源、创建时间、进度。
- 触发器列表：与任务列表同级的另一视图，通过顶部按钮切换。
- 创建任务：完整的多步骤任务创建弹窗（原样迁移自 `task-creation-dialog-new.tsx`）。
- 下载任务信息：导出单条任务信息为 `.xlsx`。
- 进入任务：点击后在同一页面内切换到标注工作台（`AnnotationWorkbench.tsx`），不新增路由，参照框架内 `model-iteration` 页面的看板/详情切换约定。

## 标注工作台（内嵌）

- 问题列表（全部/待标注/已标注）+ 对话详情 + 右侧标注面板（错误码、风险等级、优化策略、备注、划词评论）。
- 支持键盘左右方向键切换问题；切到下一条时若当前记录无任何标注内容，自动标记为"无风险"。
- 支持导出标注结果为 `.xlsx`，额外附带"统计汇总"sheet（总标注数、合格率、各风险等级分布）。

## 技术实现说明

- 复用旧仓库的 shadcn/ui 组件（`src/components/ui/*`）、`onlineStore`、`quality-standards` mock 数据与 `gbot-channel-service`，未做业务逻辑改动。
- 引入独立的 Tailwind CSS 构建（`src/legacy-tailwind.css` + `tailwind.config.js`），仅扫描本页面与其依赖组件，不启用 Preflight 基础重置，不影响框架其余页面与 AppShell 样式。
- 页面根节点统一包裹 `legacy-scope` class，用于承载旧平台的颜色变量与盒模型设置。

## 尚未迁移

质检分析、质检标准配置、优化操作台三个页面按原样保留独立页面（分别位于 `qc/quality-analysis`、`qc/quality-standards`、`qc/optimization`）。
