# 数据库迁移方案

## 当前状态

### c-teacher (Tauri/Rust) 现有表
- `app_state` - 键值存储
- `students` - 学生 (简化版)
- `materials` - 资料
- `material_sources` - 资料源
- `class_records` - 课堂记录
- `reminders` - 提醒
- `mistake_tags` - 错题标签
- `mistake_records` - 错题记录

### c-financial (Flutter/Dart) 目标表
- `local_accounts` - 本地账号
- `students` - 学生 (完整版)
- `courses` - 课程
- `course_packages` - 课包
- `hour_balances` - 课时余额
- `schedules` - 排课
- `class_consumptions` - 课消
- `billing_records` - 收费
- `installment_plans` - 分期
- `arrears_records` - 欠费
- `refund_records` - 退费
- `operation_logs` - 操作日志

## 迁移策略

### 方案 A: 增量迁移 (推荐)

保留 c-teacher 现有表，添加 c-financial 缺少的表：

```sql
-- 1. 添加本地账号表
CREATE TABLE IF NOT EXISTS local_accounts (...);

-- 2. 扩展 students 表
ALTER TABLE students ADD COLUMN account_id TEXT;
ALTER TABLE students ADD COLUMN guardian_name TEXT;
ALTER TABLE students ADD COLUMN guardian_phone TEXT;
ALTER TABLE students ADD COLUMN contact_address TEXT;
ALTER TABLE students ADD COLUMN home_address TEXT;
ALTER TABLE students ADD COLUMN school TEXT;
ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'active';

-- 3. 添加课程相关表
CREATE TABLE IF NOT EXISTS courses (...);
CREATE TABLE IF NOT EXISTS course_packages (...);
CREATE TABLE IF NOT EXISTS hour_balances (...);

-- 4. 添加排课和课消表
CREATE TABLE IF NOT EXISTS schedules (...);
CREATE TABLE IF NOT EXISTS class_consumptions (...);

-- 5. 添加财务相关表
CREATE TABLE IF NOT EXISTS billing_records (...);
CREATE TABLE IF NOT EXISTS installment_plans (...);
CREATE TABLE IF NOT EXISTS arrears_records (...);
CREATE TABLE IF NOT EXISTS refund_records (...);

-- 6. 添加操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (...);
```

### 方案 B: 完整替换

删除现有表，使用共享 schema.sql 中的完整表结构。

**注意**: 此方案会丢失现有数据，需要先备份。

## 迁移脚本

创建 `shared/database/migrate.sql`:

```sql
-- 迁移脚本: v1 -> v2
-- 添加 c-financial 兼容表结构

BEGIN TRANSACTION;

-- 1. 创建本地账号表 (如果不存在)
CREATE TABLE IF NOT EXISTS local_accounts (
    id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

-- 2. 扩展 students 表
-- 注意: SQLite 不支持 IF NOT EXISTS for ADD COLUMN
-- 需要先检查列是否存在

-- 3. 创建课程表
CREATE TABLE IF NOT EXISTS courses (...);

-- ... 其他表

COMMIT;
```

## 使用方式

### c-teacher (Rust)

```rust
fn migrate_database(connection: &Connection) -> Result<(), String> {
    // 读取迁移脚本
    let migration_sql = include_str!("../../shared/database/migrate.sql");
    connection.execute_batch(migration_sql)
        .map_err(|e| format!("migration failed: {e}"))?;
    Ok(())
}
```

### c-financial (Flutter/Dart)

```dart
// 在 Drift migration 中使用
await customStatement(sharedDatabaseSchemaSql);
```

## 注意事项

1. **数据备份**: 迁移前务必备份现有数据库
2. **版本控制**: 使用数据库版本号管理迁移
3. **回滚策略**: 准备回滚脚本以防迁移失败
4. **测试验证**: 在测试环境先验证迁移脚本
