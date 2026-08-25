-- =====================================================
-- 数据库迁移脚本: c-teacher v1 -> v2
-- 添加 c-financial 兼容表结构
-- =====================================================

-- 注意: SQLite 不支持事务中的 DDL 语句
-- 每条语句独立执行

-- 1. 创建本地账号表 (如果不存在)
CREATE TABLE IF NOT EXISTS local_accounts (
    id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

-- 2. 创建课程表
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_deduct_hours REAL NOT NULL DEFAULT 1.0,
    price REAL,
    hourly_price REAL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. 创建课包表
CREATE TABLE IF NOT EXISTS course_packages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    hours REAL NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 4. 创建课时余额表
CREATE TABLE IF NOT EXISTS hour_balances (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    total_hours REAL NOT NULL DEFAULT 0,
    completed_hours REAL NOT NULL DEFAULT 0,
    remaining_hours REAL NOT NULL DEFAULT 0,
    frozen_hours REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(student_id, course_id)
);

-- 5. 创建排课表
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id TEXT,
    room TEXT,
    scheduled_start TEXT NOT NULL,
    scheduled_end TEXT NOT NULL,
    deduct_hours REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'exception')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. 创建课消记录表
CREATE TABLE IF NOT EXISTS class_consumptions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id TEXT,
    actual_start TEXT,
    actual_end TEXT,
    deducted_hours REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'reversed')),
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 7. 创建收费记录表
CREATE TABLE IF NOT EXISTS billing_records (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    package_id TEXT REFERENCES course_packages(id),
    receivable_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    collection_mode TEXT NOT NULL DEFAULT 'full' CHECK (collection_mode IN ('full', 'installment')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial_paid', 'paid')),
    payment_channel TEXT CHECK (payment_channel IN ('cash', 'bank', 'wechat', 'alipay', 'other')),
    paid_at TEXT,
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 8. 创建分期计划表
CREATE TABLE IF NOT EXISTS installment_plans (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    billing_record_id TEXT NOT NULL REFERENCES billing_records(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    planned_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    planned_collect_date TEXT,
    actual_collect_date TEXT,
    reminder_date TEXT,
    reminder_status TEXT NOT NULL DEFAULT 'none' CHECK (reminder_status IN ('none', 'pending', 'sent', 'skipped')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial_paid', 'paid')),
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 9. 创建欠费记录表
CREATE TABLE IF NOT EXISTS arrears_records (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    billing_record_id TEXT REFERENCES billing_records(id),
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial_paid', 'settled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 10. 创建退费记录表
CREATE TABLE IF NOT EXISTS refund_records (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    refund_amount REAL NOT NULL,
    refund_hours REAL NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 11. 创建操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_snapshot TEXT,
    after_snapshot TEXT,
    created_at TEXT NOT NULL
);

-- 12. 添加索引
CREATE INDEX IF NOT EXISTS idx_courses_account_id ON courses(account_id);
CREATE INDEX IF NOT EXISTS idx_course_packages_course_id ON course_packages(course_id);
CREATE INDEX IF NOT EXISTS idx_hour_balances_student_id ON hour_balances(student_id);
CREATE INDEX IF NOT EXISTS idx_schedules_student_id ON schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_schedules_account_id ON schedules(account_id);
CREATE INDEX IF NOT EXISTS idx_class_consumptions_schedule_id ON class_consumptions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_student_id ON billing_records(student_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_billing_record_id ON installment_plans(billing_record_id);
CREATE INDEX IF NOT EXISTS idx_arrears_records_student_id ON arrears_records(student_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity_id ON operation_logs(entity_id);
