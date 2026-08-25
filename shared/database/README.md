# 共享数据库模块

本模块包含 c-teacher 和 c-financial 项目共用的数据库表结构定义。

## 文件结构

```
shared/database/
├── README.md          # 本说明文件
└── schema.sql         # 完整的 SQL 表结构定义
```

## 表结构概览

| 表名 | 说明 | 适用项目 |
|------|------|----------|
| local_accounts | 本地账号 | c-financial |
| students | 学生信息 | 两个项目 |
| courses | 课程 | c-financial |
| course_packages | 课包 | c-financial |
| hour_balances | 课时余额 | c-financial |
| schedules | 排课 | c-financial |
| class_consumptions | 课消记录 | c-financial |
| billing_records | 收费记录 | c-financial |
| installment_plans | 分期计划 | c-financial |
| arrears_records | 欠费记录 | c-financial |
| refund_records | 退费记录 | c-financial |
| mistake_books | 错题本 | c-teacher |
| mistakes | 错题 | c-teacher |
| operation_logs | 操作日志 | c-financial |

## 使用方式

### c-teacher (Tauri/Rust)

```rust
// 在 Rust 代码中使用
const SCHEMA_SQL: &str = include_str!("../../shared/database/schema.sql");

// 初始化数据库时执行
sqlx::query(SCHEMA_SQL).execute(&pool).await?;
```

### c-financial (Flutter/Dart)

```dart
// 在 Drift 中使用
// 将 schema.sql 内容转换为 Drift 表定义
// 或直接在 migration 中执行 SQL
```

## 注意事项

1. 两个项目共享相同的表结构，但可能有不同的业务逻辑
2. 修改表结构时需同时更新两个项目
3. 建议在修改前先在测试环境验证
4. 使用迁移脚本管理表结构变更
