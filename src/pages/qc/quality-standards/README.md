# 质检标准配置

- 页面名称：质检标准配置
- 访问路径：`/qc/quality-standards`
- 菜单位置：质检优化 / 质检标准配置

## 页面目标

原样迁移自旧版「AI 质检优化平台」Demo，维护维度 → 大类 → 小类 → 标准四级质检标准表格，承载在 ZhijiLab 原型框架的 AppShell 之下。

## 页面结构

- 四级联动表格：维度/大类跨行合并展示，逐层维护新增同级、编辑、删除操作。
- 标准说明、错误码配置项、错误等级支持双击行内编辑。
- 导入配置：分三步（说明 → 选择文件 → 校验错误）模拟标准导入流程，可下载导入模板。
- 导出配置：导出当前全部标准为 `.xlsx`。

## 技术实现说明

- 复用旧仓库的 shadcn/ui 组件、`onlineStore`、`quality-standards` mock 数据，未做业务逻辑改动。
- 与 `qc/task-list` 共用同一套 Tailwind 构建（`src/legacy-tailwind.css` + `tailwind.config.js`），不影响框架其余页面样式。
