# Design Language — 课程表 & 编辑课程页面优化

## Design Read

**感觉**: 清晰、有条理的教育工具界面，信息密度适中，操作路径明确。
**赌注**: 用更精细的视觉层级和微交互提升专业感，而非大改风格。

## Aesthetic Direction

**Technical / Utilitarian** — 功能优先的教育管理工具，视觉服务于信息组织。

## Design System

基于现有 naive-ui + CSS Variables 体系，不引入新框架。

## Palette (现有主题继承)

| Token | 值 | 用途 |
|-------|-----|------|
| `--primary` | `#1769d4` | 主操作、选中态 |
| `--primary-soft` | `#e7f0ff` | 主色浅底 |
| `--text` | `#142033` | 正文 |
| `--muted` | `#5d6b80` | 次要信息 |
| `--border` | `#d7e3f3` | 分割线、边框 |
| `--panel` | `rgba(255,255,255,0.92)` | 卡片背景 |
| `--bg` | `#f4f8ff` | 页面底色 |

## Typography Scale

| 角色 | 大小 | 字重 | 行高 |
|------|------|------|------|
| Page Title | 24px | 800 | 1.2 |
| Section Title | 15px | 700 | 1.3 |
| Body | 14px | 400 | 1.5 |
| Caption | 12px | 600 | 1.4 |
| Badge | 11px | 700 | 1.3 |

## Spacing Scale

| Token | 值 |
|-------|-----|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |

## Radius

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 6px | 小按钮、标签 |
| `--radius-md` | 8px | 输入框、切换按钮 |
| `--radius-lg` | 12px | 卡片、面板 |

## Motion

- 过渡时间: `0.15s ease`
- 仅在 hover/focus 状态变化时使用过渡
- 无弹跳、无无限动画
- `prefers-reduced-motion: reduce` 时禁用所有过渡

## Signature Element

- 课程卡片左侧 3px 色条（组颜色）
- 科目标签：圆角方块 + 浅底色 + 主色文字
- 表单区域：2 列网格 + 分割线标题
