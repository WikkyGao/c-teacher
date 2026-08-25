-- =====================================================
-- 共享数据库表结构
-- 适用于 c-teacher (Tauri/Rust) 和 c-financial (Flutter/Dart)
-- =====================================================

-- 本地账号表
CREATE TABLE local_accounts (
    id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

-- 学生表
CREATE TABLE students (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    contact_address TEXT,
    home_address TEXT,
    school TEXT,
    learning_goal TEXT,
    initial_level TEXT,
    learning_style TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 课程表
CREATE TABLE courses (
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

-- 课包表
CREATE TABLE course_packages (
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

-- 课时余额表
CREATE TABLE hour_balances (
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

-- 排课表
CREATE TABLE schedules (
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

-- 课消记录表
CREATE TABLE class_consumptions (
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

-- 收费记录表
CREATE TABLE billing_records (
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

-- 分期计划表
CREATE TABLE installment_plans (
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

-- 欠费记录表
CREATE TABLE arrears_records (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    billing_record_id TEXT REFERENCES billing_records(id),
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial_paid', 'settled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 退费记录表
CREATE TABLE refund_records (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    refund_amount REAL NOT NULL,
    refund_hours REAL NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 错题本表（c-teacher 特有）
CREATE TABLE mistake_books (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 错题表（c-teacher 特有）
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

-- 操作日志表
CREATE TABLE operation_logs (
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

-- 索引
CREATE INDEX idx_students_account_id ON students(account_id);
CREATE INDEX idx_courses_account_id ON courses(account_id);
CREATE INDEX idx_course_packages_course_id ON course_packages(course_id);
CREATE INDEX idx_hour_balances_student_id ON hour_balances(student_id);
CREATE INDEX idx_schedules_student_id ON schedules(student_id);
CREATE INDEX idx_schedules_account_id ON schedules(account_id);
CREATE INDEX idx_class_consumptions_schedule_id ON class_consumptions(schedule_id);
CREATE INDEX idx_billing_records_student_id ON billing_records(student_id);
CREATE INDEX idx_installment_plans_billing_record_id ON installment_plans(billing_record_id);
CREATE INDEX idx_arrears_records_student_id ON arrears_records(student_id);
CREATE INDEX idx_mistakes_mistake_book_id ON mistakes(mistake_book_id);
CREATE INDEX idx_operation_logs_entity_id ON operation_logs(entity_id);
