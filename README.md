# AI 质检优化平台（新框架版）

基于 ZhijiLab 高保真原型框架（antd + TDesign）承载的 AI 质检优化平台原型，与旧版 `ai-quality-inspection-platform`（Tailwind + shadcn）技术栈完全独立。

## 已迁移页面

- 人工质检任务（`/qc/task-list`）：质检优化 / 人工质检任务

标注工作台、质检分析、质检标准配置、优化操作台四个子页面尚未迁移，仍使用旧版 Demo。

## 本地运行

```bash
npm install
npm run dev
```

提交前运行构建检查：

```bash
npm run build
```

## 开发约定

页面统一放置在 `src/pages/<code-path>/`，路由和菜单由工程自动生成。请遵循 [AGENTS.md](./AGENTS.md) 中的组件复用、页面结构、预览场景和交付规范。
