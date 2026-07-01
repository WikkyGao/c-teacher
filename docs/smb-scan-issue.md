# SMB 扫描问题记录

## 问题描述

SMB 共享资料源扫描失败，提示 `material source path does not exist`。

## 问题点

### 1. 路径格式混淆

用户输入的路径存在两种理解：

- **SMB共享内路径**：`/电子书/C-teacher`（相对于共享根目录）
- **本地挂载路径**：`/Volumes/电子书/C-teacher`（挂载后的绝对路径）

当前逻辑：`normalizeSourcePath` 对 SMB 协议如果路径以 `/` 开头，直接返回原路径，不构造 `smb://` URL。

### 2. 后端扫描逻辑

```rust
// scan_material_source 函数
if path.trim().starts_with("smb://") {
    return scan_smb_source(&path, ...);  // 只有 smb:// 开头才走这个分支
}
// 否则检查本地路径是否存在
let source_path = PathBuf::from(path.trim());
if !source_path.exists() {
    return Err("material source path does not exist");
}
```

**问题**：如果用户输入 `/电子书/C-teacher`，既不以 `smb://` 开头，也不是有效的本地路径，所以报错。

### 3. 用户期望 vs 实际行为

| 用户输入 | 期望行为 | 实际行为 |
|---------|---------|---------|
| 路径：`/电子书/C-teacher` | 扫描 SMB 共享中的该目录 | 报错：路径不存在 |
| 路径：`/Volumes/电子书/C-teacher` | 扫描本地挂载的目录 | ✅ 正常工作 |

### 4. 可能的解决方案

#### 方案 A：自动挂载 SMB（技术难点）
- 使用 `mount_smbfs` 或 `osascript mount volume`
- **问题**：中文字符导致 URL 解析失败、需要 sudo 权限

#### 方案 B：强制使用本地挂载路径（当前方案）
- 用户必须先手动挂载 SMB 共享
- 在「共享路径」中输入 `/Volumes/xxx/子目录`
- **问题**：用户体验差，需要额外步骤

#### 方案 C：智能路径解析（待实现）
- 如果路径不以 `/Volumes/` 开头，尝试在 `/Volumes/` 下查找匹配的挂载点
- 用户输入 `电子书/C-teacher` → 自动匹配 `/Volumes/电子书/C-teacher`
- **优点**：更友好，但需要更复杂的匹配逻辑

#### 方案 D：使用 SMB 客户端库（如 smbclient-rs）
- 通过 Rust SMB 客户端库直接访问共享
- **问题**：需要添加新依赖，可能有编译问题

## 待解决

1. [ ] 确定最终方案（建议方案 C 或 D）
2. [ ] 实现 SMB 自动挂载或智能路径解析
3. [ ] 处理中文字符编码问题
4. [ ] 测试不同 SMB 服务器（Synology、QNAP、Windows 共享）

## 测试环境

- SMB 服务器：`192.168.50.224`
- 共享路径：`/电子书/C-teacher`
- macOS：需要先手动挂载到 `/Volumes/电子书`
