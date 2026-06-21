# C-teacher

C-teacher 是面向教师的一对多个性化教学管理桌面应用。当前实现路线:

- macOS 桌面端: Tauri v2 + Vue 3 + TypeScript + Native UI
- 本地数据: SQLite
- 后端: Go，先作为 AI Gateway，后续扩展账号、同步和任务队列
- 交付目标: 生成 macOS `.dmg` 和 Windows `.exe` 安装包

## 当前状态

- `main.pen` 是唯一保留的 Pencil 设计文件。
- `apps/desktop` 是桌面端工程。
- `services/api` 是 Go 后端骨架。
- 当前桌面端已可运行，并已生成 macOS DMG:
  `apps/desktop/src-tauri/target/release/bundle/dmg/C-teacher_0.1.0_aarch64.dmg`
- Windows 安装包使用 Tauri NSIS 生成，需要在 Windows 环境或 GitHub Actions `windows-latest` runner 上构建。
- 当前可用能力:
  - 小孩管理卡片、小孩新增/编辑/删除、多学科课程信息。
  - 工作台展示小孩进度、资料归属、学习风格、错题待处理。
  - 小孩错题本入口和 AI 分析；Go Gateway 支持 mock/OpenAI Responses API 切换，Gateway 不可用时前端会使用本地演示分析，保证安装包独立可操作。
  - 资料库新增资料、小孩分配、本地目录、已挂载 SMB 目录和匿名 FTP 目录扫描导入；本地文件和 SMB 资料可交给系统直接打开。
  - 课堂记录保存、作业批改状态跟踪、提醒创建；macOS 桌面端会写入系统“提醒事项”，并尝试发送通知中心测试通知。
  - 学习报告按小孩汇总课程进度、课堂记录、作业、资料和薄弱点，支持复制 Markdown 和导出 `.md` 文件。
  - 移动端核心页面预览。
  - 应用诊断页，可查看 SQLite 实体表计数与当前工作台状态是否一致，并支持工作台 JSON 备份导出/导入。
- 当前桌面端使用 Tauri 原生命令写入应用数据目录下的 SQLite；保存完整工作台快照，同时同步小孩、资料、资料源、课堂记录、提醒等实体镜像表，Web 预览环境使用 `localStorage` 兜底。
- FTP 扫描当前为只读匿名模式，资料源填写 `host[:port]` 和目录路径后会以 `ftp://host[:port]/path` 扫描；账号密码/钥匙串凭据需要后续做安全凭据设计。
- 系统提醒当前优先接入 macOS“提醒事项”App，会创建 `C-teacher` 列表并写入到期时间；Web 预览环境仅保留应用内提醒记录。

## 本地开发

安装前端依赖:

```bash
npm install
```

启动前端 Web 预览:

```bash
npm run dev:desktop
```

启动 Go API:

```bash
npm run dev:server
```

Tauri/DMG 构建需要本机安装 Rust/Cargo:

```bash
npm run tauri:dev
npm run build:dmg
```

按 macOS 芯片架构分别打包 DMG 到 `outputs/`:

```bash
# Intel 芯片 Mac
./build-dmg-intel.sh

# M 系列芯片 Mac
./build-dmg-apple-silicon.sh
```

Windows `.exe` 安装包构建需要在 Windows 环境执行:

```bash
npm run build:windows
```

产物路径:

```text
apps/desktop/src-tauri/target/release/bundle/nsis/*.exe
```

也可以在 GitHub Actions 手动运行 `Build Windows Installer` 工作流，构建完成后从 artifact 下载 Windows 安装包。

## 验证命令

```bash
npm run test
npm run lint
npm run build:desktop
cd services/api && env GOCACHE=/Users/wikky/Documents/C-teacher/.cache/go-build go test ./...
npm run build:dmg
# Windows 环境或 GitHub Actions windows-latest:
npm run build:windows
```
