# C-teacher DMG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从当前 PRD/Pencil/HTML 原型落地为可运行的 macOS 桌面应用，并生成可安装的 `.dmg` 文件。

**Architecture:** 使用 Vue 3 + TypeScript + Vite + Native UI 构建前端工作台，Tauri v2 提供 macOS 桌面壳、SQLite、本地文件、通知和打包能力。Go 后端提供 AI Gateway、鉴权、限流和后续同步接口。

**Tech Stack:** Vue 3, TypeScript, Vite, Native UI, Pinia, Tauri v2, Rust, SQLite, sqlx, Go, Vitest, Playwright.

---

## 当前执行修订

本计划最初草稿包含部分 React/pnpm/Node AI Gateway 示例。2026-05-31 已按用户确认调整为实际工程栈:

- 前端: Vue 3 + TypeScript + Vite + Native UI + Pinia。
- 包管理: npm workspaces。
- 后端: Go `net/http`，先实现 AI Gateway mock 骨架。
- 桌面壳: Tauri v2，保留最终 `npm run build:dmg` 生成 DMG 的目标。

当前代码实现以 `package.json`、`apps/desktop/package.json`、`apps/desktop/src/app/App.vue`、`services/api/cmd/server/main.go` 为准。下方历史任务中的 React/pnpm 示例需要在继续执行对应任务前重写为 Vue/npm 版本。

## 文件结构

```text
apps/desktop/
  package.json
  src/
    app/
    features/
      dashboard/
      students/
      mistake-book/
      records/
      materials/
      reminders/
      settings/
    shared/
      api/
      components/
      styles/
      types/
  src-tauri/
    tauri.conf.json
    Cargo.toml
    src/
      lib.rs
      commands/
      db/
      domain/
      providers/
      migrations/
services/ai-gateway/
  package.json
  src/
    index.ts
    prompts/
    routes/
    providers/
docs/
  architecture/
  superpowers/plans/
```

## 里程碑

| 里程碑 | 目标 | 验收 |
| --- | --- | --- |
| M1 | 桌面应用骨架 | `npm run dev:desktop` 可启动 Tauri 应用。 |
| M2 | 本地数据模型 | SQLite migration 完成，学生/课程/资料/错题可 CRUD。 |
| M3 | 核心页面 | 工作台、学生管理、错题本入口、资料库、课堂记录、提醒可用。 |
| M4 | AI 与资料源 | AI Gateway mock/真实调用切换，FTP/挂载 SMB 资料源可登记和扫描。 |
| M5 | DMG | macOS 下生成 `.dmg`，内部可安装运行。 |
| M6 | 签名公证 | 配置 Developer ID signing/notarization，生成可外部分发 DMG。 |

## Task 1: 初始化工程骨架

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/app/App.vue`
- Create: `apps/desktop/src/shared/styles/global.css`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 workspace 配置**

```json
{
  "name": "c-teacher",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev:desktop": "pnpm --filter @c-teacher/desktop tauri dev",
    "build:desktop": "pnpm --filter @c-teacher/desktop tauri build",
    "build:dmg": "pnpm --filter @c-teacher/desktop tauri build -- --bundles dmg",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

- [ ] **Step 2: 使用 npm workspaces**

```yaml
packages:
  - "apps/*"
  - "services/*"
```

- [ ] **Step 3: 创建 desktop package**

```json
{
  "name": "@c-teacher/desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "clsx": "^2.1.1",
    "lucide-vue-next": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.8",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: 创建最小 Vue 应用**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./shared/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: 创建最小 App**

```tsx
export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">C-teacher</aside>
      <section className="workspace">
        <h1>学生进度工作台</h1>
        <p>macOS 桌面端初始化完成。</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: 验证**

Run:

```bash
npm install
npm run dev:desktop
```

Expected: Tauri 窗口打开，显示 `学生进度工作台`。

## Task 2: 配置 Tauri DMG 打包

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src-tauri/icons/icon.icns`
- Create: `apps/desktop/src-tauri/dmg/background.png`

- [ ] **Step 1: 配置 bundle**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "C-teacher",
  "version": "0.1.0",
  "identifier": "com.cteacher.desktop",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "C-teacher",
        "width": 1440,
        "height": 900,
        "minWidth": 1180,
        "minHeight": 760
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "icon": ["icons/icon.icns"],
    "macOS": {
      "dmg": {
        "background": "dmg/background.png",
        "windowSize": {
          "width": 660,
          "height": 400
        },
        "appPosition": {
          "x": 180,
          "y": 220
        },
        "applicationFolderPosition": {
          "x": 480,
          "y": 220
        }
      }
    }
  }
}
```

- [ ] **Step 2: 本机生成测试 DMG**

Run:

```bash
npm run build:dmg
```

Expected: `apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg` 存在。

- [ ] **Step 3: 安装验证**

Run:

```bash
open apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg
```

Expected: Finder 打开 DMG，能把 `C-teacher.app` 拖入 Applications。

## Task 3: 建立 SQLite 数据层

**Files:**
- Create: `apps/desktop/src-tauri/src/db/mod.rs`
- Create: `apps/desktop/src-tauri/src/db/migrations/0001_init.sql`
- Create: `apps/desktop/src-tauri/src/domain/student.rs`
- Create: `apps/desktop/src-tauri/src/domain/mistake_book.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 migration**

```sql
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  learning_goal TEXT,
  initial_level TEXT,
  learning_style TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE student_subjects (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  current_lesson INTEGER NOT NULL DEFAULT 0,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  progress_percent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE mistake_books (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE mistakes (
  id TEXT PRIMARY KEY,
  mistake_book_id TEXT NOT NULL REFERENCES mistake_books(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  question_text TEXT,
  student_answer TEXT,
  correct_answer TEXT,
  mistake_reason TEXT,
  knowledge_points TEXT NOT NULL DEFAULT '[]',
  similar_questions TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 2: 实现 DB 初始化**

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tauri::{AppHandle, Manager};

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let db_path = app_dir.join("c-teacher.sqlite");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::migrate!("./src/db/migrations")
        .run(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(pool)
}
```

- [ ] **Step 3: 验证 migration**

Run:

```bash
pnpm --filter @c-teacher/desktop tauri dev
```

Expected: 应用启动后在 app data 目录生成 `c-teacher.sqlite`。

## Task 4: 学生管理与错题本入口

**Files:**
- Create: `apps/desktop/src/features/students/StudentManagementPage.tsx`
- Create: `apps/desktop/src/features/students/StudentCard.tsx`
- Create: `apps/desktop/src/features/mistake-book/MistakeBookPanel.tsx`
- Create: `apps/desktop/src/shared/api/studentCommands.ts`
- Modify: `apps/desktop/src/app/App.tsx`

- [ ] **Step 1: 写学生卡片组件**

```tsx
type StudentCardProps = {
  student: {
    id: string;
    name: string;
    goal: string;
    style: string;
    subjects: Array<{ subject: string; current: number; total: number; progress: number }>;
    mistakeSummary: string;
  };
  onOpenMistakeBook: (studentId: string) => void;
};

export function StudentCard({ student, onOpenMistakeBook }: StudentCardProps) {
  return (
    <article className="student-card">
      <header>
        <h2>{student.name}</h2>
        <p>{student.goal} · {student.style}</p>
      </header>
      <section>
        {student.subjects.map((item) => (
          <div key={item.subject} className="course-row">
            <strong>{item.subject} · 第 {item.current}/{item.total} 节 · {item.progress}%</strong>
          </div>
        ))}
      </section>
      <button className="mistake-book-cta" onClick={() => onOpenMistakeBook(student.id)}>
        {student.mistakeSummary}
      </button>
    </article>
  );
}
```

- [ ] **Step 2: 验证入口不进入一级菜单**

Run:

```bash
pnpm --filter @c-teacher/desktop test StudentCard
```

Expected: 点击 `mistake-book-cta` 只调用 `onOpenMistakeBook`，不会切换一级导航。

## Task 5: AI 错题本与拍照改题

**Files:**
- Create: `apps/desktop/src/features/mistake-book/MistakeAiActions.tsx`
- Create: `apps/desktop/src/shared/api/aiCommands.ts`
- Create: `apps/desktop/src-tauri/src/commands/ai.rs`
- Create: `services/ai-gateway/src/index.ts`
- Create: `services/ai-gateway/src/prompts/mistake-analysis.ts`

- [ ] **Step 1: 定义 AI 输入输出**

```ts
export type AnalyzeMistakeInput = {
  studentId: string;
  subject: string;
  imageBase64?: string;
  questionText?: string;
  studentAnswer?: string;
};

export type AnalyzeMistakeOutput = {
  questionText: string;
  correctAnswer: string;
  mistakeReason: string;
  knowledgePoints: string[];
  similarQuestions: string[];
  teacherReviewRequired: true;
};
```

- [ ] **Step 2: Gateway prompt**

```ts
export function buildMistakeAnalysisPrompt(input: AnalyzeMistakeInput) {
  return {
    instruction:
      "你是教学错题分析助手。请识别题目、学生答案、标准答案，分析错误原因，输出类似题型和知识点掌握建议。所有结论必须标记为待教师确认。",
    studentId: input.studentId,
    subject: input.subject,
    questionText: input.questionText ?? "",
    studentAnswer: input.studentAnswer ?? ""
  };
}
```

- [ ] **Step 3: 桌面端调用**

```tsx
export function MistakeAiActions({ studentId, subject }: { studentId: string; subject: string }) {
  async function handlePhotoGrade() {
    const result = await analyzeMistake({ studentId, subject });
    console.log(result);
  }

  return (
    <div className="mistake-ai-actions">
      <button onClick={handlePhotoGrade}>拍照改题</button>
      <button>AI 分析</button>
      <button>出类似题</button>
    </div>
  );
}
```

- [ ] **Step 4: 验证**

Run:

```bash
pnpm --filter @c-teacher/desktop test MistakeAiActions
pnpm --filter @c-teacher/ai-gateway test
```

Expected: mock AI 返回 `teacherReviewRequired: true`。

## Task 6: 资料库与外部资料源

**Files:**
- Create: `apps/desktop/src/features/materials/MaterialLibraryPage.tsx`
- Create: `apps/desktop/src/features/materials/ExternalSourcePanel.tsx`
- Create: `apps/desktop/src-tauri/src/providers/material_source.rs`
- Create: `apps/desktop/src-tauri/src/commands/materials.rs`

- [ ] **Step 1: 定义资料源类型**

```ts
export type ExternalSource = {
  id: string;
  protocol: "local" | "mounted_smb" | "ftp";
  name: string;
  host?: string;
  path: string;
  authMethod: "none" | "password" | "keychain";
  connectionStatus: "untested" | "connected" | "failed";
};
```

- [ ] **Step 2: MVP 规则**

```text
local: 通过系统文件夹选择器授权。
mounted_smb: 用户先在 macOS Finder 挂载 SMB，再在应用内选择挂载目录。
ftp: 应用内保存 host/path/auth，Rust provider 连接和扫描文件列表。
```

- [ ] **Step 3: 验证**

Run:

```bash
pnpm --filter @c-teacher/desktop test ExternalSourcePanel
```

Expected: `测试连接` 可把状态从 `untested` 更新为 `connected` 或 `failed`。

## Task 7: 系统提醒

**Files:**
- Create: `apps/desktop/src/features/reminders/ReminderPage.tsx`
- Create: `apps/desktop/src-tauri/src/commands/reminders.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: 接入 Tauri notification plugin**

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: 前端发送通知**

```ts
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from "@tauri-apps/plugin-notification";

export async function notify(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  if (granted) {
    sendNotification({ title, body });
  }
}
```

- [ ] **Step 3: 验证**

Run:

```bash
npm run dev:desktop
```

Expected: 创建课程提醒后 macOS 出现系统通知。

## Task 8: Playwright 桌面关键流验收

**Files:**
- Create: `apps/desktop/tests/e2e/student-management.spec.ts`
- Create: `apps/desktop/tests/e2e/mistake-book.spec.ts`
- Create: `apps/desktop/tests/e2e/dmg-smoke.md`

- [ ] **Step 1: 学生管理验收**

```ts
import { test, expect } from "@playwright/test";

test("student management shows mistake book entry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "学生管理" }).click();
  await expect(page.getByText("进入错题本").first()).toBeVisible();
});
```

- [ ] **Step 2: 错题本验收**

```ts
import { test, expect } from "@playwright/test";

test("mistake book AI actions are visible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "学生管理" }).click();
  await page.getByRole("button", { name: "进入错题本" }).first().click();
  await expect(page.getByRole("button", { name: "拍照改题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 分析" })).toBeVisible();
  await expect(page.getByRole("button", { name: "出类似题" })).toBeVisible();
});
```

- [ ] **Step 3: 运行验收**

Run:

```bash
pnpm --filter @c-teacher/desktop test:e2e
```

Expected: 学生管理和错题本入口关键流通过。

## Task 9: DMG 签名、公证和发布

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `.github/workflows/build-macos.yml`
- Create: `docs/release/dmg-release-checklist.md`

- [ ] **Step 1: 配置 macOS 签名环境变量**

```text
APPLE_SIGNING_IDENTITY=Developer ID Application: <Team Name> (<Team ID>)
APPLE_ID=<apple-id-email>
APPLE_PASSWORD=<app-specific-password>
APPLE_TEAM_ID=<team-id>
```

- [ ] **Step 2: 构建 DMG**

Run:

```bash
npm run build:dmg
```

Expected:

```text
apps/desktop/src-tauri/target/release/bundle/dmg/C-teacher_0.1.0_*.dmg
```

- [ ] **Step 3: 验证 Gatekeeper**

Run:

```bash
spctl --assess --type open --context context:primary-signature --verbose apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg
```

Expected: `accepted`

- [ ] **Step 4: 安装冒烟测试**

Run:

```bash
open apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg
```

Expected: DMG 可打开，`C-teacher.app` 拖入 Applications 后可正常启动。

## 自检

- PRD 覆盖: 学生管理、资料库、提醒、错题本、AI、移动端、DMG 均有任务覆盖。
- DMG 覆盖: Task 2 生成内部测试 DMG，Task 9 处理签名、公证和发布。
- 风险处理: SMB 直连、AI Key、教师审核、系统提醒口径已在技术选型文档记录。
- 当前项目无 Git 仓库，计划未包含 commit 步骤；如果初始化 Git，建议每个 Task 完成后提交一次。
