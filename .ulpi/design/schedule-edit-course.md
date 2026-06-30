# 课程表 & 编辑课程页面优化 Spec

## 优化范围

1. **课程表页面** — 日历视图、列表视图、顶部操作栏
2. **新建/编辑课程页面** — 表单布局、课时列表

## 具体优化项

### 1. 课程表 — 日历视图

**现状问题**: 日历网格信息密度高，课程卡片视觉层级不够清晰。

**优化方案**:
- 课程卡片增加左侧 3px 色条（继承组颜色），与列表视图保持一致
- 月视图中课程条目增加 hover 态背景色变化（`--bg-elevated`）
- 周/日视图的时间槽增加 subtle 底色区分（`--surface-soft` 用于偶数行）

### 2. 课程表 — 列表视图

**现状问题**: 课程卡片结构清晰，但展开详情的课时表格可以更紧凑。

**优化方案**:
- 课时表格行高从 `8px 12px` 优化为 `6px 12px`，信息更紧凑
- 课时序号列使用 `--muted` 色，标题列使用 `--text` 色，增强层级
- 操作按钮（编辑/删除）使用 `quaternary` 样式，减少视觉干扰

### 3. 顶部操作栏

**现状问题**: 视图切换按钮和日历工具栏在切换时有跳动。

**优化方案**:
- 已修复：sticky 定位 + 日历工具栏始终占位
- 进一步：切换按钮使用 `n-segment-control` 替代自定义 button 组，更统一

### 4. 新建/编辑课程页面

**现状问题**: 表单布局合理，但视觉层级可以更清晰。

**优化方案**:
- 表单区域标题增加左侧 3px 色条装饰（`--primary`）
- 课时列表每行增加 subtle hover 背景色
- 课时拖拽手柄使用 `--muted` 色，hover 时变为 `--primary`
- 表单底部按钮组使用 `justify-content: space-between` 分组

### 5. 课时列表（编辑课程页）

**现状问题**: 课时列表列数多，横向空间紧张。

**优化方案**:
- 日期列宽度从 130px 优化为 120px
- 时间列宽度从 110px 优化为 100px
- 时长列使用紧凑的 `n-select`（宽度 90px）
- 资料列使用 `max-tag-count="1"` 限制显示

## 组件规格

### CourseCard（课程卡片）

| 属性 | 值 |
|------|-----|
| 背景 | `var(--panel)` |
| 边框 | `1px solid var(--border)` |
| 圆角 | `var(--radius-lg)` |
| Hover 边框 | `color-mix(in srgb, var(--primary) 30%, var(--border))` |
| Hover 阴影 | `var(--shadow-sm)` |
| 左侧色条 | `3px solid {组颜色}` |
| 内边距 | `14px 16px` |

### LessonRow（课时行）

| 属性 | 值 |
|------|-----|
| 背景 | `var(--panel)` |
| 悬停背景 | `var(--bg-elevated)` |
| 分割线 | `1px solid var(--border)` |
| 内边距 | `6px 12px` |
| 过渡 | `background 0.15s` |

### FormSection（表单区域标题）

| 属性 | 值 |
|------|-----|
| 字号 | 15px |
| 字重 | 700 |
| 底部分割线 | `1px solid var(--border)` |
| 左侧装饰 | 可选：3px `var(--primary)` 色条 |

## 状态覆盖

| 状态 | 处理 |
|------|------|
| 加载中 | 骨架屏占位 |
| 空状态 | 居中图标 + 文字 + 操作按钮 |
| 错误 | naive-ui `message.error` 提示 |
| 无数据 | 「暂无课程，点击新建」引导 |

## 无障碍

- 所有按钮有 `aria-label`
- 日历视图支持键盘导航
- 颜色对比度符合 WCAG AA（`--text` on `--bg` = 12.5:1）
- `prefers-reduced-motion: reduce` 时禁用过渡

## 构建交接

**目标 Agent**: `vue-tauri-engineer`（Electron-Tauri SPA）
**设计系统**: naive-ui + CSS Variables（已有）
**验收标准**:
1. 所有样式使用 CSS Variables，不硬编码颜色
2. 过渡时间统一 `0.15s`
3. 组件状态完整（hover/focus/active/disabled）
4. 响应式：表单在窄屏下切换为单列
