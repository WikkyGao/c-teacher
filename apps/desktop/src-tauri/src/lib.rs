use base64::Engine;
use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const WORKSPACE_KEY: &str = "workspace";
const BACKUP_VERSION: u32 = 1;
const MAX_SCAN_DEPTH: usize = 3;
const MAX_SCAN_ITEMS: usize = 500;
const MAX_MISTAKE_IMAGE_BYTES: u64 = 8 * 1024 * 1024;
const FTP_TIMEOUT_SECONDS: u64 = 10;
const API_SERVER_BIN: &str = "c-teacher-api";
const API_SERVER_ADDR: &str = "0.0.0.0:18080";

struct ApiServerHandle(Mutex<Option<Child>>);

fn sidecar_path(app: &AppHandle) -> PathBuf {
    // In production, Tauri places externalBin in the bundle resources/<target-triple>
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    // Tauri resolves externalBin as: resources/<binary-name>-<target-triple>
    let target_triple = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        _ => "aarch64-apple-darwin",
    };
    let prod_name = format!("{}-{}", API_SERVER_BIN, target_triple);
    let prod_path = resource_dir.join(&prod_name);
    if prod_path.exists() {
        return prod_path;
    }
    // Fallback for development: CARGO_MANIFEST_DIR/binaries/
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(&prod_name);
    dev_path
}

fn spawn_api_server(app: &AppHandle) -> Result<Child, String> {
    let bin = sidecar_path(app);
    if !bin.exists() {
        return Err(format!(
            "API server binary not found at {} — run: cd services/api && go build -o ../../apps/desktop/src-tauri/binaries/{}-<triple> ./cmd/server",
            bin.display(),
            API_SERVER_BIN
        ));
    }

    // Kill any stale process holding the port
    let _ = std::process::Command::new("lsof")
        .args(["-ti", ":18080"])
        .output()
        .ok()
        .and_then(|out| {
            let pids = String::from_utf8_lossy(&out.stdout);
            pids.lines().find(|l| !l.is_empty()).map(|pid| {
                let _ = std::process::Command::new("kill").arg("-9").arg(pid).output();
            })
        });

    let mut child = Command::new(&bin)
        .env("C_TEACHER_API_ADDR", API_SERVER_ADDR)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start API server: {e}"))?;

    // Consume stdout/stderr in background to prevent pipe blocking
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(l) = line {
                    println!("[c-teacher-api] {}", l);
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    eprintln!("[c-teacher-api] {}", l);
                }
            }
        });
    }

    // Wait for server to be ready (poll /health up to 5 seconds)
    let health_url = format!("http://127.0.0.1:{}/health", API_SERVER_ADDR.split(':').last().unwrap_or("18080"));
    for attempt in 0..20 {
        std::thread::sleep(Duration::from_millis(250));
        match std::process::Command::new("curl")
            .args(["-sf", "-o", "/dev/null", &health_url])
            .status()
        {
            Ok(status) if status.success() => {
                println!("[c-teacher] API server ready on {} (attempt {})", API_SERVER_ADDR, attempt + 1);
                return Ok(child);
            }
            _ => continue,
        }
    }

    // Server didn't become ready in time — kill it
    let _ = child.kill();
    let _ = child.wait();
    Err("API server started but did not respond within 5 seconds".to_string())
}
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "mp4",
    "mov", "txt", "md",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScannedMaterial {
    title: String,
    source_path: String,
    file_type: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct FtpSource {
    host: String,
    port: u16,
    path: String,
}

#[derive(Debug, PartialEq, Eq)]
struct FtpListEntry {
    name: String,
    is_dir: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EntityCounts {
    students: i64,
    materials: i64,
    material_sources: i64,
    class_records: i64,
    reminders: i64,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceBackup {
    version: u32,
    exported_at: String,
    state: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SystemReminderRequest {
    title: String,
    student_name: String,
    related_type: String,
    remind_at: i64,
}

#[tauri::command]
fn health_check() -> &'static str {
    "ok"
}

#[tauri::command]
fn read_mistake_image_data_url(path: String) -> Result<String, String> {
    let image_path = PathBuf::from(path.trim());
    if image_path.as_os_str().is_empty() {
        return Err("请先选择错题图片".to_string());
    }
    if !image_path.is_absolute() || !image_path.is_file() {
        return Err("错题图片路径无效".to_string());
    }
    let extension = image_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let media_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => return Err("错题图片仅支持 png、jpg、jpeg、webp".to_string()),
    };
    let metadata =
        fs::metadata(&image_path).map_err(|error| format!("无法读取错题图片信息: {error}"))?;
    if metadata.len() > MAX_MISTAKE_IMAGE_BYTES {
        return Err("错题图片不能超过 8MB".to_string());
    }
    let bytes = fs::read(&image_path).map_err(|error| format!("无法读取错题图片: {error}"))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{media_type};base64,{encoded}"))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("failed to create app data dir: {error}"))?;
    Ok(data_dir.join("c-teacher.sqlite3"))
}

// ── Database write safety ─────────────────────────────────────────────
//
// CONVENTION: Every INSERT/UPDATE/DELETE must check rows_affected.
// rusqlite's `execute()` returns Ok(0) (not Err) when 0 rows match —
// this is the classic "write 0" silent-failure pattern. Always bind the
// result to `let affected = ...` and verify `affected > 0` (unless the
// operation is intentionally idempotent like INSERT OR IGNORE).
//
// Helper for future write operations — use `require_rows(affected, "operation name")?`
// instead of silently ignoring a 0-rows-affected result.
#[allow(dead_code)]
fn require_rows(affected: usize, label: &str) -> Result<usize, String> {
    if affected == 0 {
        return Err(format!("{label}: 0 rows affected"));
    }
    Ok(affected)
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection =
        Connection::open(path).map_err(|error| format!("failed to open workspace db: {error}"))?;
    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| format!("failed to migrate workspace db: {error}"))?;
    migrate_entity_tables(&connection)?;
    seed_k12_tags(&connection)?;
    Ok(connection)
}

fn migrate_entity_tables(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                goal TEXT NOT NULL,
                style TEXT NOT NULL,
                courses_json TEXT NOT NULL,
                materials_json TEXT NOT NULL,
                mistake_book_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS materials (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                tags_json TEXT NOT NULL,
                assigned_student_ids_json TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_path TEXT NOT NULL,
                sync_status TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS material_sources (
                id TEXT PRIMARY KEY,
                protocol TEXT NOT NULL,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                path TEXT NOT NULL,
                auth_method TEXT NOT NULL,
                connection_status TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS class_records (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                lesson_content TEXT NOT NULL,
                performance TEXT NOT NULL,
                homework TEXT NOT NULL,
                grading_status TEXT NOT NULL DEFAULT '待批改',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                title TEXT NOT NULL,
                remind_at INTEGER NOT NULL,
                related_type TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mistake_tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mistake_records (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                question_text TEXT NOT NULL DEFAULT '',
                image_path TEXT NOT NULL DEFAULT '',
                student_answer TEXT NOT NULL DEFAULT '',
                correct_answer TEXT NOT NULL DEFAULT '',
                mistake_reason TEXT NOT NULL DEFAULT '',
                knowledge_points_json TEXT NOT NULL DEFAULT '[]',
                tags_json TEXT NOT NULL DEFAULT '[]',
                mastery_status TEXT NOT NULL DEFAULT '待复习',
                difficulty TEXT NOT NULL DEFAULT '中等',
                grade_level TEXT NOT NULL DEFAULT '',
                semester TEXT NOT NULL DEFAULT '',
                similar_questions_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .map_err(|error| format!("failed to migrate entity tables: {error}"))?;
    ensure_column(
        connection,
        "class_records",
        "grading_status",
        "TEXT NOT NULL DEFAULT '待批改'",
    )?;
    Ok(())
}

#[tauri::command]
fn load_workspace_state(app: AppHandle) -> Result<Option<Value>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT payload FROM app_state WHERE key = ?1")
        .map_err(|error| format!("failed to prepare workspace load: {error}"))?;
    let payload = statement
        .query_row(params![WORKSPACE_KEY], |row| row.get::<_, String>(0))
        .map(Some)
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            _ => Err(error),
        })
        .map_err(|error| format!("failed to load workspace state: {error}"))?;

    match payload {
        Some(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|error| format!("failed to parse workspace state: {error}")),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_workspace_state(app: AppHandle, state: Value) -> Result<(), String> {
    let mut connection = open_database(&app)?;
    save_state_with_connection(&mut connection, &state)
}

fn save_state_with_connection(connection: &mut Connection, state: &Value) -> Result<(), String> {
    let payload = serde_json::to_string(&state)
        .map_err(|error| format!("failed to serialize workspace state: {error}"))?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("failed to open workspace transaction: {error}"))?;
    let affected = transaction
        .execute(
            "INSERT INTO app_state (key, payload, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
               payload = excluded.payload,
               updated_at = CURRENT_TIMESTAMP",
            params![WORKSPACE_KEY, payload],
        )
        .map_err(|error| format!("failed to save workspace state: {error}"))?;
    if affected == 0 {
        return Err("failed to save workspace state: 0 rows affected".to_string());
    }
    sync_entity_tables(&transaction, &state)?;
    transaction
        .commit()
        .map_err(|error| format!("failed to commit workspace state: {error}"))?;
    Ok(())
}

fn value_string(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn value_i64(value: &Value, key: &str) -> i64 {
    value.get(key).and_then(Value::as_i64).unwrap_or_default()
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| format!("failed to inspect {table}: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to read {table} columns: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to collect {table} columns: {error}"))?;
    if columns.iter().any(|name| name == column) {
        return Ok(());
    }
    connection
        .execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"), [])
        .map_err(|error| format!("failed to add {column} to {table}: {error}"))?;
    Ok(())
}

fn child_json(value: &Value, key: &str) -> Result<String, String> {
    serde_json::to_string(value.get(key).unwrap_or(&Value::Null))
        .map_err(|error| format!("failed to serialize {key}: {error}"))
}

fn sync_entity_tables(transaction: &Transaction<'_>, state: &Value) -> Result<(), String> {
    for table in [
        "students",
        "materials",
        "material_sources",
        "class_records",
        "reminders",
    ] {
        transaction
            .execute(&format!("DELETE FROM {table}"), [])
            .map_err(|error| format!("failed to clear {table}: {error}"))?;
    }

    if let Some(students) = state.get("students").and_then(Value::as_array) {
        for student in students {
            let affected = transaction
                .execute(
                    "INSERT INTO students (
                        id, name, goal, style, courses_json, materials_json, mistake_book_json, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)",
                    params![
                        value_string(student, "id"),
                        value_string(student, "name"),
                        value_string(student, "goal"),
                        value_string(student, "style"),
                        child_json(student, "courses")?,
                        child_json(student, "materials")?,
                        child_json(student, "mistakeBook")?,
                    ],
                )
                .map_err(|error| format!("failed to sync students: {error}"))?;
            if affected == 0 {
                return Err(format!("failed to sync students: 0 rows inserted for {}", value_string(student, "id")));
            }
        }
    }

    if let Some(materials) = state.get("materials").and_then(Value::as_array) {
        for material in materials {
            let affected = transaction
                .execute(
                    "INSERT INTO materials (
                        id, title, category, tags_json, assigned_student_ids_json,
                        source_type, source_path, sync_status, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP)",
                    params![
                        value_string(material, "id"),
                        value_string(material, "title"),
                        value_string(material, "category"),
                        child_json(material, "tags")?,
                        child_json(material, "assignedStudentIds")?,
                        value_string(material, "sourceType"),
                        value_string(material, "sourcePath"),
                        value_string(material, "syncStatus"),
                    ],
                )
                .map_err(|error| format!("failed to sync materials: {error}"))?;
            if affected == 0 {
                return Err(format!("failed to sync materials: 0 rows inserted for {}", value_string(material, "id")));
            }
        }
    }

    if let Some(sources) = state.get("materialSources").and_then(Value::as_array) {
        for source in sources {
            let affected = transaction
                .execute(
                    "INSERT INTO material_sources (
                        id, protocol, name, host, path, auth_method, connection_status, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)",
                    params![
                        value_string(source, "id"),
                        value_string(source, "protocol"),
                        value_string(source, "name"),
                        value_string(source, "host"),
                        value_string(source, "path"),
                        value_string(source, "authMethod"),
                        value_string(source, "connectionStatus"),
                    ],
                )
                .map_err(|error| format!("failed to sync material_sources: {error}"))?;
            if affected == 0 {
                return Err(format!("failed to sync material_sources: 0 rows inserted for {}", value_string(source, "id")));
            }
        }
    }

    if let Some(records) = state.get("classRecords").and_then(Value::as_array) {
        for record in records {
            let affected = transaction
                .execute(
                    "INSERT INTO class_records (
                        id, student_id, subject, lesson_content, performance, homework,
                        grading_status, created_at, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP)",
                    params![
                        value_string(record, "id"),
                        value_string(record, "studentId"),
                        value_string(record, "subject"),
                        value_string(record, "lessonContent"),
                        value_string(record, "performance"),
                        value_string(record, "homework"),
                        value_string(record, "gradingStatus"),
                        value_string(record, "createdAt"),
                    ],
                )
                .map_err(|error| format!("failed to sync class_records: {error}"))?;
            if affected == 0 {
                return Err(format!("failed to sync class_records: 0 rows inserted for {}", value_string(record, "id")));
            }
        }
    }

    if let Some(reminders) = state.get("reminders").and_then(Value::as_array) {
        for reminder in reminders {
            let affected = transaction
                .execute(
                    "INSERT INTO reminders (
                        id, student_id, title, remind_at, related_type, status, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)",
                    params![
                        value_string(reminder, "id"),
                        value_string(reminder, "studentId"),
                        value_string(reminder, "title"),
                        value_i64(reminder, "remindAt"),
                        value_string(reminder, "relatedType"),
                        value_string(reminder, "status"),
                    ],
                )
                .map_err(|error| format!("failed to sync reminders: {error}"))?;
            if affected == 0 {
                return Err(format!("failed to sync reminders: 0 rows inserted for {}", value_string(reminder, "id")));
            }
        }
    }

    Ok(())
}

fn is_supported_material(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|supported| supported.eq_ignore_ascii_case(extension))
        })
        .unwrap_or(false)
}

fn scan_directory(
    directory: &Path,
    depth: usize,
    scanned: &mut Vec<ScannedMaterial>,
) -> Result<(), String> {
    if depth > MAX_SCAN_DEPTH || scanned.len() >= MAX_SCAN_ITEMS {
        return Ok(());
    }

    let entries = fs::read_dir(directory)
        .map_err(|error| format!("failed to read material source directory: {error}"))?;

    for entry in entries {
        if scanned.len() >= MAX_SCAN_ITEMS {
            break;
        }

        let entry = entry.map_err(|error| format!("failed to read material source entry: {error}"))?;
        let path = entry.path();

        if path.is_dir() {
            scan_directory(&path, depth + 1, scanned)?;
            continue;
        }

        if !path.is_file() || !is_supported_material(&path) {
            continue;
        }

        let title = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("未命名资料")
            .to_string();
        let file_type = path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("file")
            .to_lowercase();

        scanned.push(ScannedMaterial {
            title,
            source_path: path.to_string_lossy().to_string(),
            file_type,
        });
    }

    Ok(())
}

fn parse_ftp_source(raw_source: &str) -> Result<FtpSource, String> {
    let trimmed = raw_source.trim();
    let without_scheme = trimmed
        .strip_prefix("ftp://")
        .ok_or_else(|| "FTP source must start with ftp://".to_string())?;
    if without_scheme.contains('@') {
        return Err("FTP source currently supports anonymous access only; credentials are not stored".to_string());
    }

    let (authority, raw_path) = without_scheme
        .split_once('/')
        .map(|(authority, path)| (authority, format!("/{path}")))
        .unwrap_or((without_scheme, "/".to_string()));
    if authority.trim().is_empty() {
        return Err("FTP source host is required".to_string());
    }

    let (host, port) = if let Some((host, port)) = authority.rsplit_once(':') {
        let parsed_port = port
            .parse::<u16>()
            .map_err(|_| "FTP source port must be a number".to_string())?;
        (host.to_string(), parsed_port)
    } else {
        (authority.to_string(), 21)
    };
    if host.trim().is_empty() {
        return Err("FTP source host is required".to_string());
    }

    Ok(FtpSource {
        host,
        port,
        path: normalize_ftp_path(&raw_path),
    })
}

fn normalize_ftp_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return "/".to_string();
    }
    let mut with_leading_slash = if trimmed.starts_with('/') {
        trimmed.to_string()
    } else {
        format!("/{trimmed}")
    };
    while with_leading_slash.len() > 1 && with_leading_slash.ends_with('/') {
        with_leading_slash.pop();
    }
    with_leading_slash
}

fn join_ftp_path(base: &str, name: &str) -> String {
    if base == "/" {
        format!("/{name}")
    } else {
        format!("{}/{}", base.trim_end_matches('/'), name)
    }
}

fn ftp_source_url(source: &FtpSource, path: &str) -> String {
    let authority = if source.port == 21 {
        source.host.clone()
    } else {
        format!("{}:{}", source.host, source.port)
    };
    format!("ftp://{}{}", authority, normalize_ftp_path(path))
}

fn parse_ftp_list_line(line: &str) -> Option<FtpListEntry> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("total ") {
        return None;
    }

    if trimmed.starts_with('d') || trimmed.starts_with('-') {
        let mut parts = trimmed.split_whitespace();
        let permissions = parts.next()?;
        for _ in 0..7 {
            parts.next()?;
        }
        let name = parts.collect::<Vec<_>>().join(" ");
        if name.is_empty() || name == "." || name == ".." {
            return None;
        }
        return Some(FtpListEntry {
            name,
            is_dir: permissions.starts_with('d'),
        });
    }

    let upper = trimmed.to_ascii_uppercase();
    if upper.starts_with("<DIR>") || upper.contains(" <DIR> ") {
        let name = trimmed.split_whitespace().last()?.to_string();
        if name == "." || name == ".." {
            return None;
        }
        return Some(FtpListEntry { name, is_dir: true });
    }

    let name = trimmed.split_whitespace().last()?.to_string();
    if name == "." || name == ".." {
        return None;
    }
    Some(FtpListEntry {
        name,
        is_dir: false,
    })
}

fn read_ftp_response(reader: &mut BufReader<TcpStream>) -> Result<(u16, String), String> {
    let mut response = String::new();
    let mut first_code: Option<String> = None;

    loop {
        let mut line = String::new();
        let bytes = reader
            .read_line(&mut line)
            .map_err(|error| format!("failed to read FTP response: {error}"))?;
        if bytes == 0 {
            return Err("FTP connection closed unexpectedly".to_string());
        }
        response.push_str(&line);

        if line.len() < 4 {
            continue;
        }
        let code = &line[0..3];
        if !code.chars().all(|character| character.is_ascii_digit()) {
            continue;
        }

        match &first_code {
            None if line.as_bytes().get(3) == Some(&b'-') => {
                first_code = Some(code.to_string());
            }
            None => {
                let parsed = code
                    .parse::<u16>()
                    .map_err(|_| format!("invalid FTP response code: {code}"))?;
                return Ok((parsed, response));
            }
            Some(expected_code)
                if expected_code == code && line.as_bytes().get(3) == Some(&b' ') =>
            {
                let parsed = code
                    .parse::<u16>()
                    .map_err(|_| format!("invalid FTP response code: {code}"))?;
                return Ok((parsed, response));
            }
            _ => {}
        }
    }
}

fn write_ftp_command(stream: &mut TcpStream, command: &str) -> Result<(), String> {
    stream
        .write_all(format!("{command}\r\n").as_bytes())
        .map_err(|error| format!("failed to write FTP command: {error}"))?;
    stream
        .flush()
        .map_err(|error| format!("failed to flush FTP command: {error}"))
}

fn expect_ftp_response(
    reader: &mut BufReader<TcpStream>,
    expected_codes: &[u16],
    action: &str,
) -> Result<String, String> {
    let (code, response) = read_ftp_response(reader)?;
    if expected_codes.contains(&code) {
        Ok(response)
    } else {
        Err(format!(
            "FTP {action} failed with code {code}: {}",
            response.trim()
        ))
    }
}

struct FtpClient {
    source: FtpSource,
    reader: BufReader<TcpStream>,
    writer: TcpStream,
}

impl FtpClient {
    fn connect(source: FtpSource) -> Result<Self, String> {
        let address = (source.host.as_str(), source.port)
            .to_socket_addrs()
            .map_err(|error| format!("failed to resolve FTP host: {error}"))?
            .next()
            .ok_or_else(|| "failed to resolve FTP host".to_string())?;
        let stream = TcpStream::connect_timeout(&address, Duration::from_secs(FTP_TIMEOUT_SECONDS))
            .map_err(|error| format!("failed to connect FTP source: {error}"))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(FTP_TIMEOUT_SECONDS)))
            .map_err(|error| format!("failed to set FTP read timeout: {error}"))?;
        stream
            .set_write_timeout(Some(Duration::from_secs(FTP_TIMEOUT_SECONDS)))
            .map_err(|error| format!("failed to set FTP write timeout: {error}"))?;

        let writer = stream
            .try_clone()
            .map_err(|error| format!("failed to clone FTP control stream: {error}"))?;
        let mut client = Self {
            source,
            reader: BufReader::new(stream),
            writer,
        };
        expect_ftp_response(&mut client.reader, &[220], "welcome")?;
        client.command("USER anonymous", &[230, 331], "login user")?;
        client.command("PASS anonymous@c-teacher.local", &[230, 202], "login password")?;
        client.command("TYPE A", &[200], "set transfer type")?;
        Ok(client)
    }

    fn command(
        &mut self,
        command: &str,
        expected_codes: &[u16],
        action: &str,
    ) -> Result<String, String> {
        write_ftp_command(&mut self.writer, command)?;
        expect_ftp_response(&mut self.reader, expected_codes, action)
    }

    fn open_passive_data_stream(&mut self) -> Result<TcpStream, String> {
        let response = self.command("PASV", &[227], "enter passive mode")?;
        let start = response
            .find('(')
            .ok_or_else(|| format!("invalid FTP PASV response: {}", response.trim()))?;
        let end = response[start + 1..]
            .find(')')
            .map(|index| start + 1 + index)
            .ok_or_else(|| format!("invalid FTP PASV response: {}", response.trim()))?;
        let numbers = response[start + 1..end]
            .split(',')
            .map(|part| part.trim().parse::<u16>())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| format!("invalid FTP PASV response: {}", response.trim()))?;
        if numbers.len() != 6 || numbers.iter().any(|number| *number > 255) {
            return Err(format!("invalid FTP PASV response: {}", response.trim()));
        }

        let host = format!(
            "{}.{}.{}.{}",
            numbers[0], numbers[1], numbers[2], numbers[3]
        );
        let port = numbers[4] * 256 + numbers[5];
        let address = (host.as_str(), port)
            .to_socket_addrs()
            .map_err(|error| format!("failed to resolve FTP passive address: {error}"))?
            .next()
            .ok_or_else(|| "failed to resolve FTP passive address".to_string())?;
        let stream = TcpStream::connect_timeout(&address, Duration::from_secs(FTP_TIMEOUT_SECONDS))
            .map_err(|error| format!("failed to connect FTP passive stream: {error}"))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(FTP_TIMEOUT_SECONDS)))
            .map_err(|error| format!("failed to set FTP passive read timeout: {error}"))?;
        Ok(stream)
    }

    fn list(&mut self, path: &str) -> Result<Vec<FtpListEntry>, String> {
        let mut data_stream = self.open_passive_data_stream()?;
        write_ftp_command(&mut self.writer, &format!("LIST {path}"))?;
        expect_ftp_response(&mut self.reader, &[125, 150], "list directory")?;

        let mut listing = String::new();
        data_stream
            .read_to_string(&mut listing)
            .map_err(|error| format!("failed to read FTP directory listing: {error}"))?;
        drop(data_stream);
        expect_ftp_response(&mut self.reader, &[226, 250], "finish listing")?;

        Ok(listing.lines().filter_map(parse_ftp_list_line).collect())
    }
}

fn is_supported_material_name(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|supported| supported.eq_ignore_ascii_case(extension))
        })
        .unwrap_or(false)
}

fn scan_ftp_directory(
    client: &mut FtpClient,
    directory: &str,
    depth: usize,
    scanned: &mut Vec<ScannedMaterial>,
) -> Result<(), String> {
    if depth > MAX_SCAN_DEPTH || scanned.len() >= MAX_SCAN_ITEMS {
        return Ok(());
    }

    let entries = client.list(directory)?;
    for entry in entries {
        if scanned.len() >= MAX_SCAN_ITEMS {
            break;
        }

        let source_path = join_ftp_path(directory, &entry.name);
        if entry.is_dir {
            scan_ftp_directory(client, &source_path, depth + 1, scanned)?;
            continue;
        }

        if !is_supported_material_name(&entry.name) {
            continue;
        }

        let file_type = Path::new(&entry.name)
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("file")
            .to_lowercase();
        scanned.push(ScannedMaterial {
            title: entry.name,
            source_path: ftp_source_url(&client.source, &source_path),
            file_type,
        });
    }

    Ok(())
}

fn scan_ftp_source(path: &str) -> Result<Vec<ScannedMaterial>, String> {
    let source = parse_ftp_source(path)?;
    let root_path = source.path.clone();
    let mut client = FtpClient::connect(source)?;
    let mut scanned = Vec::new();
    scan_ftp_directory(&mut client, &root_path, 0, &mut scanned)?;
    Ok(scanned)
}

#[tauri::command]
fn scan_material_source(path: String) -> Result<Vec<ScannedMaterial>, String> {
    if path.trim().starts_with("ftp://") {
        return scan_ftp_source(&path);
    }

    let source_path = PathBuf::from(path.trim());
    if !source_path.exists() {
        return Err("material source path does not exist".to_string());
    }
    if !source_path.is_dir() {
        return Err("material source path is not a directory".to_string());
    }

    let mut scanned = Vec::new();
    scan_directory(&source_path, 0, &mut scanned)?;
    Ok(scanned)
}

fn normalize_open_material_target(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("material path is required".to_string());
    }
    if trimmed.starts_with("smb://") {
        return Ok(trimmed.to_string());
    }
    if trimmed.contains("://") {
        return Err("only local files and SMB paths can be opened from C-teacher".to_string());
    }
    if !Path::new(trimmed).is_absolute() {
        return Err("material path must be an absolute local path or an SMB URL".to_string());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
fn open_material_target(path: String) -> Result<(), String> {
    let target = normalize_open_material_target(&path)?;
    let mut command = if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(&target);
        command
    } else if cfg!(target_os = "windows") {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", &target]);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(&target);
        command
    };

    let output = command
        .output()
        .map_err(|error| format!("failed to open material: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        "failed to open material".to_string()
    } else {
        format!("failed to open material: {stderr}")
    })
}

fn table_count(connection: &Connection, table: &str) -> Result<i64, String> {
    connection
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
        .map_err(|error| format!("failed to count {table}: {error}"))
}

#[tauri::command]
fn workspace_entity_counts(app: AppHandle) -> Result<EntityCounts, String> {
    let connection = open_database(&app)?;
    Ok(EntityCounts {
        students: table_count(&connection, "students")?,
        materials: table_count(&connection, "materials")?,
        material_sources: table_count(&connection, "material_sources")?,
        class_records: table_count(&connection, "class_records")?,
        reminders: table_count(&connection, "reminders")?,
    })
}

#[tauri::command]
fn export_workspace_backup(app: AppHandle, path: String) -> Result<(), String> {
    let state = load_workspace_state(app)?.ok_or_else(|| "workspace state is empty".to_string())?;
    let backup = WorkspaceBackup {
        version: BACKUP_VERSION,
        exported_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("failed to get system time: {error}"))?
            .as_secs()
            .to_string(),
        state,
    };
    let payload = serde_json::to_string_pretty(&backup)
        .map_err(|error| format!("failed to serialize workspace backup: {error}"))?;
    fs::write(path, payload).map_err(|error| format!("failed to write workspace backup: {error}"))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("file path is required".to_string());
    }
    fs::write(path, content).map_err(|error| format!("failed to write text file: {error}"))
}

#[tauri::command]
fn import_workspace_backup(app: AppHandle, path: String) -> Result<(), String> {
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read workspace backup: {error}"))?;
    let backup: WorkspaceBackup = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse workspace backup: {error}"))?;
    if backup.version != BACKUP_VERSION {
        return Err(format!(
            "unsupported workspace backup version: {}",
            backup.version
        ));
    }
    validate_workspace_state(&backup.state)?;
    let mut connection = open_database(&app)?;
    save_state_with_connection(&mut connection, &backup.state)
}

fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn build_reminders_applescript(request: &SystemReminderRequest) -> Result<String, String> {
    if request.title.trim().is_empty() {
        return Err("reminder title is required".to_string());
    }
    if request.remind_at <= 0 {
        return Err("reminder time is required".to_string());
    }

    let due_date_seconds = request.remind_at / 1000;
    let title = escape_applescript_string(request.title.trim());
    let student_name = escape_applescript_string(request.student_name.trim());
    let related_type = escape_applescript_string(request.related_type.trim());
    let body = format!(
        "学生：{}\\n类型：{}\\n来自 C-teacher",
        student_name, related_type
    );

    Ok(format!(
        r#"set reminderTitle to "{title}"
set reminderBody to "{body}"
set dueDate to (current date)
set dueDate to dueDate + ({due_date_seconds} - (do shell script "date +%s")) seconds

tell application "Reminders"
  set targetList to missing value
  repeat with candidateList in lists
    if name of candidateList is "C-teacher" then
      set targetList to candidateList
      exit repeat
    end if
  end repeat
  if targetList is missing value then
    set targetList to make new list with properties {{name:"C-teacher"}}
  end if
  tell targetList
    make new reminder with properties {{name:reminderTitle, body:reminderBody, remind me date:dueDate, due date:dueDate}}
  end tell
end tell"#
    ))
}

#[tauri::command]
fn create_system_reminder(request: SystemReminderRequest) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let script = build_reminders_applescript(&request)?;
        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|error| format!("failed to run macOS Reminders automation: {error}"))?;
        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "failed to create macOS reminder".to_string()
        } else {
            format!("failed to create macOS reminder: {stderr}")
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = request;
        Err("system reminders are currently supported on macOS only".to_string())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiServerStatus {
    running: bool,
    port: u16,
    health_ok: bool,
    error: String,
}

#[tauri::command]
fn check_api_server() -> ApiServerStatus {
    let port: u16 = API_SERVER_ADDR
        .split(':')
        .last()
        .and_then(|p| p.parse().ok())
        .unwrap_or(18080);

    let health_url = format!("http://127.0.0.1:{}/health", port);
    let health_ok = std::process::Command::new("curl")
        .args(["-sf", "-o", "/dev/null", &health_url])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    let running = health_ok;

    ApiServerStatus {
        running,
        port,
        health_ok,
        error: if running {
            String::new()
        } else {
            "API 服务未运行。桌面端启动时会自动启动。如果没有启动，请检查：\n\
             1. 二进制文件是否存在: src-tauri/binaries/c-teacher-api-<triple>\n\
             2. 构建命令: cd services/api && go build -o ../../apps/desktop/src-tauri/binaries/<name> ./cmd/server"
                .to_string()
        },
    }
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("无法获取本机 IP: {e}"))
}

fn validate_workspace_state(state: &Value) -> Result<(), String> {
    for key in [
        "students",
        "materials",
        "materialSources",
        "classRecords",
        "reminders",
    ] {
        if !state.get(key).map(Value::is_array).unwrap_or(false) {
            return Err(format!("workspace backup is missing array field: {key}"));
        }
    }
    Ok(())
}

// --- Mistake Records CRUD ---

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateMistakeRecordRequest {
    student_id: String,
    subject: String,
    question_text: String,
    image_path: Option<String>,
    student_answer: Option<String>,
    correct_answer: Option<String>,
    mistake_reason: Option<String>,
    knowledge_points: Option<Vec<String>>,
    tags: Option<Vec<String>>,
    difficulty: Option<String>,
    grade_level: Option<String>,
    semester: Option<String>,
    similar_questions: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateMistakeRecordRequest {
    question_text: Option<String>,
    image_path: Option<String>,
    student_answer: Option<String>,
    correct_answer: Option<String>,
    mistake_reason: Option<String>,
    knowledge_points: Option<Vec<String>>,
    tags: Option<Vec<String>>,
    mastery_status: Option<String>,
    difficulty: Option<String>,
    grade_level: Option<String>,
    semester: Option<String>,
    similar_questions: Option<Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MistakeRecord {
    id: String,
    student_id: String,
    subject: String,
    question_text: String,
    image_path: String,
    student_answer: String,
    correct_answer: String,
    mistake_reason: String,
    knowledge_points: Vec<String>,
    tags: Vec<String>,
    mastery_status: String,
    difficulty: String,
    grade_level: String,
    semester: String,
    similar_questions: Vec<String>,
    created_at: String,
    updated_at: String,
}

fn parse_json_string_array(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn row_to_mistake_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<MistakeRecord> {
    Ok(MistakeRecord {
        id: row.get(0)?,
        student_id: row.get(1)?,
        subject: row.get(2)?,
        question_text: row.get(3)?,
        image_path: row.get(4)?,
        student_answer: row.get(5)?,
        correct_answer: row.get(6)?,
        mistake_reason: row.get(7)?,
        knowledge_points: parse_json_string_array(&row.get::<_, String>(8)?),
        tags: parse_json_string_array(&row.get::<_, String>(9)?),
        mastery_status: row.get(10)?,
        difficulty: row.get(11)?,
        grade_level: row.get(12)?,
        semester: row.get(13)?,
        similar_questions: parse_json_string_array(&row.get::<_, String>(14)?),
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

const MISTAKE_RECORD_COLUMNS: &str = "id, student_id, subject, question_text, image_path, student_answer, correct_answer, mistake_reason, knowledge_points_json, tags_json, mastery_status, difficulty, grade_level, semester, similar_questions_json, created_at, updated_at";

#[tauri::command]
fn create_mistake_record(app: AppHandle, request: CreateMistakeRecordRequest) -> Result<MistakeRecord, String> {
    let connection = open_database(&app)?;
    let id = format!("mistake-{}", chrono::Utc::now().timestamp_millis());
    let now = chrono::Utc::now().to_rfc3339();
    let knowledge_points_json = serde_json::to_string(&request.knowledge_points.unwrap_or_default())
        .map_err(|e| format!("failed to serialize knowledge_points: {e}"))?;
    let tags_json = serde_json::to_string(&request.tags.unwrap_or_default())
        .map_err(|e| format!("failed to serialize tags: {e}"))?;
    let similar_questions_json = serde_json::to_string(&request.similar_questions.unwrap_or_default())
        .map_err(|e| format!("failed to serialize similar_questions: {e}"))?;

    let affected = connection.execute(
        &format!("INSERT INTO mistake_records ({}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)", MISTAKE_RECORD_COLUMNS),
        params![
            id,
            request.student_id,
            request.subject,
            request.question_text,
            request.image_path.unwrap_or_default(),
            request.student_answer.unwrap_or_default(),
            request.correct_answer.unwrap_or_default(),
            request.mistake_reason.unwrap_or_default(),
            knowledge_points_json,
            tags_json,
            "待复习",
            request.difficulty.unwrap_or_else(|| "中等".to_string()),
            request.grade_level.unwrap_or_default(),
            request.semester.unwrap_or_default(),
            similar_questions_json,
            now,
            now,
        ],
    ).map_err(|e| format!("failed to create mistake record: {e}"))?;
    if affected == 0 {
        return Err("failed to create mistake record: 0 rows inserted".to_string());
    }

    let record = connection.query_row(
        &format!("SELECT {} FROM mistake_records WHERE id = ?1", MISTAKE_RECORD_COLUMNS),
        params![id],
        row_to_mistake_record,
    ).map_err(|e| format!("failed to fetch created mistake record: {e}"))?;

    Ok(record)
}

#[tauri::command]
fn list_mistake_records(app: AppHandle, student_id: String, subject: Option<String>) -> Result<Vec<MistakeRecord>, String> {
    let connection = open_database(&app)?;
    let mut sql = format!("SELECT {} FROM mistake_records WHERE student_id = ?1", MISTAKE_RECORD_COLUMNS);
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(student_id)];

    if let Some(ref subj) = subject {
        if !subj.is_empty() {
            sql.push_str(" AND subject = ?2");
            params_vec.push(Box::new(subj.clone()));
        }
    }
    sql.push_str(" ORDER BY created_at DESC");

    let mut stmt = connection.prepare(&sql).map_err(|e| format!("failed to prepare list query: {e}"))?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), row_to_mistake_record)
        .map_err(|e| format!("failed to list mistake records: {e}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|e| format!("failed to read mistake record row: {e}"))?);
    }
    Ok(records)
}

#[tauri::command]
fn get_mistake_record(app: AppHandle, id: String) -> Result<MistakeRecord, String> {
    let connection = open_database(&app)?;
    connection.query_row(
        &format!("SELECT {} FROM mistake_records WHERE id = ?1", MISTAKE_RECORD_COLUMNS),
        params![id],
        row_to_mistake_record,
    ).map_err(|e| format!("failed to get mistake record: {e}"))
}

#[tauri::command]
fn update_mistake_record(app: AppHandle, id: String, request: UpdateMistakeRecordRequest) -> Result<MistakeRecord, String> {
    let connection = open_database(&app)?;
    let now = chrono::Utc::now().to_rfc3339();

    // Build dynamic UPDATE
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut param_idx = 2;
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];

    macro_rules! add_field {
        ($field:expr, $val:expr) => {
            if let Some(v) = $val {
                sets.push(format!("{} = ?{}", $field, param_idx));
                params_vec.push(Box::new(v));
                param_idx += 1;
            }
        };
    }

    add_field!("question_text", request.question_text);
    add_field!("image_path", request.image_path);
    add_field!("student_answer", request.student_answer);
    add_field!("correct_answer", request.correct_answer);
    add_field!("mistake_reason", request.mistake_reason);
    add_field!("mastery_status", request.mastery_status);
    add_field!("difficulty", request.difficulty);
    add_field!("grade_level", request.grade_level);
    add_field!("semester", request.semester);

    if let Some(kp) = request.knowledge_points {
        let json = serde_json::to_string(&kp).map_err(|e| format!("failed to serialize knowledge_points: {e}"))?;
        sets.push(format!("knowledge_points_json = ?{}", param_idx));
        params_vec.push(Box::new(json));
        param_idx += 1;
    }
    if let Some(tags) = request.tags {
        let json = serde_json::to_string(&tags).map_err(|e| format!("failed to serialize tags: {e}"))?;
        sets.push(format!("tags_json = ?{}", param_idx));
        params_vec.push(Box::new(json));
        param_idx += 1;
    }
    if let Some(sq) = request.similar_questions {
        let json = serde_json::to_string(&sq).map_err(|e| format!("failed to serialize similar_questions: {e}"))?;
        sets.push(format!("similar_questions_json = ?{}", param_idx));
        params_vec.push(Box::new(json));
        param_idx += 1;
    }

    sets.push(format!("id = ?{}", param_idx));
    params_vec.push(Box::new(id.clone()));

    let sql = format!("UPDATE mistake_records SET {} WHERE id = ?{}", sets.join(", "), param_idx);
    let affected = connection.execute(&sql, params_vec.iter().map(|p| p.as_ref()).collect::<Vec<_>>().as_slice())
        .map_err(|e| format!("failed to update mistake record: {e}"))?;
    if affected == 0 {
        return Err(format!("mistake record not found: {id}"));
    }

    get_mistake_record(app, id)
}

#[tauri::command]
fn delete_mistake_record(app: AppHandle, id: String) -> Result<bool, String> {
    let connection = open_database(&app)?;
    let affected = connection.execute("DELETE FROM mistake_records WHERE id = ?1", params![id])
        .map_err(|e| format!("failed to delete mistake record: {e}"))?;
    Ok(affected > 0)
}

#[tauri::command]
fn batch_update_mistake_mastery(app: AppHandle, ids: Vec<String>, mastery_status: String) -> Result<usize, String> {
    let connection = open_database(&app)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut total = 0;
    for id in &ids {
        let affected = connection.execute(
            "UPDATE mistake_records SET mastery_status = ?1, updated_at = ?2 WHERE id = ?3",
            params![mastery_status, now, id],
        ).map_err(|e| format!("failed to update mastery status: {e}"))?;
        total += affected;
    }
    Ok(total)
}

// --- Mistake Tags ---

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MistakeTag {
    id: String,
    name: String,
    category: String,
}

#[tauri::command]
fn list_mistake_tags(app: AppHandle) -> Result<Vec<MistakeTag>, String> {
    let connection = open_database(&app)?;
    let mut stmt = connection.prepare("SELECT id, name, category FROM mistake_tags ORDER BY category, name")
        .map_err(|e| format!("failed to prepare tags query: {e}"))?;
    let rows = stmt.query_map([], |row| {
        Ok(MistakeTag {
            id: row.get(0)?,
            name: row.get(1)?,
            category: row.get(2)?,
        })
    }).map_err(|e| format!("failed to list mistake tags: {e}"))?;

    let mut tags = Vec::new();
    for row in rows {
        tags.push(row.map_err(|e| format!("failed to read tag row: {e}"))?);
    }
    Ok(tags)
}

#[tauri::command]
fn create_mistake_tag(app: AppHandle, name: String, category: String) -> Result<MistakeTag, String> {
    let connection = open_database(&app)?;
    let id = format!("tag-{}", chrono::Utc::now().timestamp_millis());
    let affected = connection.execute(
        "INSERT INTO mistake_tags (id, name, category) VALUES (?1, ?2, ?3)",
        params![id, name, category],
    ).map_err(|e| format!("failed to create mistake tag: {e}"))?;
    if affected == 0 {
        return Err("failed to create mistake tag: 0 rows inserted".to_string());
    }

    Ok(MistakeTag { id, name, category })
}

#[tauri::command]
fn update_mistake_tag(app: AppHandle, id: String, name: Option<String>, category: Option<String>) -> Result<MistakeTag, String> {
    let connection = open_database(&app)?;
    let mut sets = vec![];
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    let mut param_idx = 1;

    if let Some(n) = name {
        sets.push(format!("name = ?{}", param_idx));
        params_vec.push(Box::new(n));
        param_idx += 1;
    }
    if let Some(c) = category {
        sets.push(format!("category = ?{}", param_idx));
        params_vec.push(Box::new(c));
        param_idx += 1;
    }

    if sets.is_empty() {
        return connection.query_row(
            "SELECT id, name, category FROM mistake_tags WHERE id = ?1",
            params![id],
            |row| Ok(MistakeTag { id: row.get(0)?, name: row.get(1)?, category: row.get(2)? }),
        ).map_err(|e| format!("failed to get mistake tag: {e}"));
    }

    sets.push(format!("id = ?{}", param_idx));
    params_vec.push(Box::new(id.clone()));

    let sql = format!("UPDATE mistake_tags SET {} WHERE id = ?{}", sets.join(", "), param_idx);
    let affected = connection.execute(&sql, params_vec.iter().map(|p| p.as_ref()).collect::<Vec<_>>().as_slice())
        .map_err(|e| format!("failed to update mistake tag: {e}"))?;
    if affected == 0 {
        return Err(format!("mistake tag not found: {id}"));
    }

    connection.query_row(
        "SELECT id, name, category FROM mistake_tags WHERE id = ?1",
        params![id],
        |row| Ok(MistakeTag { id: row.get(0)?, name: row.get(1)?, category: row.get(2)? }),
    ).map_err(|e| format!("failed to fetch updated mistake tag: {e}"))
}

#[tauri::command]
fn delete_mistake_tag(app: AppHandle, id: String) -> Result<bool, String> {
    let connection = open_database(&app)?;
    let affected = connection.execute("DELETE FROM mistake_tags WHERE id = ?1", params![id])
        .map_err(|e| format!("failed to delete mistake tag: {e}"))?;
    Ok(affected > 0)
}

#[tauri::command]
fn migrate_old_mistake_data(app: AppHandle) -> Result<String, String> {
    let connection = open_database(&app)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut migrated = 0u32;
    let mut skipped = 0u32;

    let mut stmt = connection
        .prepare("SELECT id, name, mistake_book_json FROM students")
        .map_err(|e| format!("failed to query students: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("failed to read students: {e}"))?;

    for row in rows {
        let (student_id, name, raw_json) = row.map_err(|e| format!("failed to read row: {e}"))?;

        // Skip if student already has mistake records
        let existing: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM mistake_records WHERE student_id = ?1",
                params![student_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if existing > 0 {
            skipped += 1;
            continue;
        }

        // Parse old mistake_book_json
        let book: Value = serde_json::from_str(&raw_json).unwrap_or_default();
        let analysis = book
            .get("analysis")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let knowledge = book
            .get("knowledgeInsight")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let similar = book
            .get("similarQuestions")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        // Skip if no meaningful data
        if analysis.is_empty()
            || analysis == "暂无错误分析，录入错题后可由 AI 辅助生成。"
            || analysis == "本地 AI 演示分析"
        {
            continue;
        }

        // Determine subject from old data
        let subjects = book
            .get("subjects")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|s| s.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        let subject = subjects.first().map(|s| s.to_string()).unwrap_or_else(|| "数学".to_string());

        // Extract knowledge points from text
        let kps: Vec<String> = if !knowledge.is_empty() {
            knowledge
                .split(|c: char| c == '、' || c == '，' || c == ',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty() && s.len() < 20)
                .take(5)
                .collect()
        } else {
            vec![]
        };

        // Extract similar questions
        let sqs: Vec<String> = if !similar.is_empty() && similar != "暂无类似题型。" {
            similar
                .split(|c: char| c == '；' || c == '，' || c == '\n')
                .map(|s| s.trim().trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == '、').trim().to_string())
                .filter(|s| s.len() > 4)
                .take(5)
                .collect()
        } else {
            vec![]
        };

        let id = format!("mistake-migrated-{}", chrono::Utc::now().timestamp_millis());
        let kp_json = serde_json::to_string(&kps).unwrap_or_default();
        let tags_json = "[]";
        let sq_json = serde_json::to_string(&sqs).unwrap_or_default();

        let affected = connection
            .execute(
                &format!(
                    "INSERT INTO mistake_records ({}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
                    MISTAKE_RECORD_COLUMNS
                ),
                params![
                    id,
                    student_id,
                    subject,
                    format!("{}的历史错题分析", name),
                    "", // image_path
                    "",
                    "",
                    analysis,
                    kp_json,
                    tags_json,
                    "待复习",
                    "中等",
                    "",
                    "",
                    sq_json,
                    now,
                    now,
                ],
            )
            .map_err(|e| format!("failed to insert migrated record for {}: {e}", name))?;
        if affected == 0 {
            return Err(format!("failed to insert migrated record for {}: 0 rows inserted", name));
        }

        migrated += 1;
    }

    Ok(format!(
        "迁移完成：{} 条旧数据转为错题记录，{} 名学生已有记录跳过",
        migrated, skipped
    ))
}

fn seed_k12_tags(connection: &Connection) -> Result<(), String> {
    let count: i64 = connection.query_row("SELECT COUNT(*) FROM mistake_tags", [], |row| row.get(0))
        .map_err(|e| format!("failed to count tags: {e}"))?;
    if count > 0 {
        return Ok(());
    }

    let k12_tags: Vec<(&str, &str)> = vec![
        // 数学
        ("数与代数", "数学"), ("方程与不等式", "数学"), ("函数", "数学"),
        ("几何图形", "数学"), ("三角函数", "数学"), ("概率统计", "数学"),
        ("数列", "数学"), ("导数", "数学"), ("向量", "数学"),
        // 语文
        ("文言文", "语文"), ("现代文阅读", "语文"), ("作文", "语文"),
        ("诗词鉴赏", "语文"), ("语言运用", "语文"), ("名著阅读", "语文"),
        // 英语
        ("语法", "英语"), ("阅读理解", "英语"), ("完形填空", "英语"),
        ("写作", "英语"), ("听力", "英语"), ("词汇", "英语"),
        // 物理
        ("力学", "物理"), ("电学", "物理"), ("光学", "物理"),
        ("热学", "物理"), ("运动学", "物理"), ("电磁感应", "物理"),
        // 化学
        ("有机化学", "化学"), ("无机化学", "化学"), ("化学反应", "化学"),
        ("溶液", "化学"), ("酸碱盐", "化学"), ("化学实验", "化学"),
        // 生物
        ("细胞", "生物"), ("遗传", "生物"), ("生态", "生物"),
        ("进化", "生物"), ("人体", "生物"), ("植物", "生物"),
        // 历史
        ("中国古代史", "历史"), ("中国近代史", "历史"), ("世界史", "历史"),
        // 地理
        ("自然地理", "地理"), ("人文地理", "地理"), ("区域地理", "地理"),
        // 政治
        ("经济", "政治"), ("政治", "政治"), ("文化", "政治"), ("哲学", "政治"),
    ];

    for (name, category) in k12_tags {
        let id = format!("tag-{}-{}", category, name);
        connection.execute(
            "INSERT OR IGNORE INTO mistake_tags (id, name, category) VALUES (?1, ?2, ?3)",
            params![id, name, category],
        ).map_err(|e| format!("failed to seed tag {name}: {e}"))?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            health_check,
            load_workspace_state,
            save_workspace_state,
            scan_material_source,
            workspace_entity_counts,
            export_workspace_backup,
            import_workspace_backup,
            create_system_reminder,
            open_material_target,
            read_mistake_image_data_url,
            write_text_file,
            create_mistake_record,
            list_mistake_records,
            get_mistake_record,
            update_mistake_record,
            delete_mistake_record,
            batch_update_mistake_mastery,
            list_mistake_tags,
            create_mistake_tag,
            update_mistake_tag,
            delete_mistake_tag,
            migrate_old_mistake_data,
            check_api_server,
            get_local_ip
        ])
        .setup(|app| {
            match spawn_api_server(&app.handle()) {
                Ok(child) => {
                    app.manage(ApiServerHandle(Mutex::new(Some(child))));
                }
                Err(err) => {
                    eprintln!("Warning: Could not auto-start API server: {err}");
                    eprintln!("Mobile photo upload will be unavailable.");
                    eprintln!("Run manually: cd services/api && C_TEACHER_API_ADDR=0.0.0.0:18080 go run ./cmd/server");
                    app.manage(ApiServerHandle(Mutex::new(None)));
                }
            }
            // Migrate old mistake data to new structured records
            if let Ok(msg) = migrate_old_mistake_data(app.handle().clone()) {
                if msg.contains("0 条") {
                    // No migration needed, silent
                } else {
                    println!("[c-teacher] {}", msg);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building C-teacher")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(handle) = app.try_state::<ApiServerHandle>() {
                    if let Ok(mut guard) = handle.0.lock() {
                        if let Some(ref mut child) = *guard {
                            println!("[c-teacher] Shutting down API server...");
                            let _ = child.kill();
                            let _ = child.wait();
                            println!("[c-teacher] API server stopped");
                        }
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ftp_source_supports_host_port_and_path() {
        let source = parse_ftp_source("ftp://materials.example.test:2121/courseware/math/")
            .expect("valid ftp source should parse");

        assert_eq!(
            source,
            FtpSource {
                host: "materials.example.test".to_string(),
                port: 2121,
                path: "/courseware/math".to_string()
            }
        );
    }

    #[test]
    fn parse_ftp_source_rejects_embedded_credentials() {
        let error = parse_ftp_source("ftp://teacher:secret@example.test/materials")
            .expect_err("credentials should not be accepted in persisted ftp source URLs");

        assert!(error.contains("anonymous"));
    }

    #[test]
    fn parse_ftp_list_line_handles_unix_files_and_directories() {
        assert_eq!(
            parse_ftp_list_line("-rw-r--r-- 1 owner group 42 May 30 10:00 函数图像讲义.pdf"),
            Some(FtpListEntry {
                name: "函数图像讲义.pdf".to_string(),
                is_dir: false
            })
        );
        assert_eq!(
            parse_ftp_list_line("drwxr-xr-x 2 owner group 64 May 30 10:00 math"),
            Some(FtpListEntry {
                name: "math".to_string(),
                is_dir: true
            })
        );
    }

    #[test]
    fn build_reminders_applescript_contains_reminder_fields() {
        let script = build_reminders_applescript(&SystemReminderRequest {
            title: "陈一诺数学课".to_string(),
            student_name: "陈一诺".to_string(),
            related_type: "课程".to_string(),
            remind_at: 1_717_200_000_000,
        })
        .expect("valid reminder request should produce AppleScript");

        assert!(script.contains("C-teacher"));
        assert!(script.contains("陈一诺数学课"));
        assert!(script.contains("学生：陈一诺"));
        assert!(script.contains("类型：课程"));
        assert!(script.contains("1717200000"));
        assert!(script.contains("make new reminder"));
    }

    #[test]
    fn build_reminders_applescript_escapes_quotes() {
        let script = build_reminders_applescript(&SystemReminderRequest {
            title: "作文\"订正\"".to_string(),
            student_name: "孟然".to_string(),
            related_type: "作业".to_string(),
            remind_at: 1_717_200_000_000,
        })
        .expect("quoted reminder request should produce escaped AppleScript");

        assert!(script.contains("作文\\\"订正\\\""));
    }

    #[test]
    fn sync_entity_tables_persists_class_record_grading_status() {
        let mut connection = Connection::open_in_memory().expect("in-memory sqlite should open");
        connection
            .execute(
                "CREATE TABLE app_state (
                    key TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            )
            .expect("app_state table should exist");
        migrate_entity_tables(&connection).expect("tables should migrate");
        let state = serde_json::json!({
            "students": [],
            "materials": [],
            "materialSources": [],
            "classRecords": [{
                "id": "record-1",
                "studentId": "student-1",
                "subject": "数学",
                "lessonContent": "函数复盘",
                "performance": "稳定",
                "homework": "第 1-3 题",
                "gradingStatus": "已批改",
                "createdAt": "2026-06-01T10:00:00.000Z"
            }],
            "reminders": []
        });

        save_state_with_connection(&mut connection, &state).expect("workspace state should save");

        let grading_status: String = connection
            .query_row(
                "SELECT grading_status FROM class_records WHERE id = ?1",
                params!["record-1"],
                |row| row.get(0),
            )
            .expect("grading status should be queryable");

        assert_eq!(grading_status, "已批改");
    }

    #[test]
    fn normalize_open_material_target_accepts_local_and_smb_paths() {
        assert_eq!(
            normalize_open_material_target(" /Users/teacher/资料/函数图像.pdf ")
                .expect("absolute local path should be accepted"),
            "/Users/teacher/资料/函数图像.pdf"
        );
        assert_eq!(
            normalize_open_material_target("smb://studio-nas.local/C-teacher/reading-a.pdf")
                .expect("smb url should be accepted"),
            "smb://studio-nas.local/C-teacher/reading-a.pdf"
        );
    }

    #[test]
    fn normalize_open_material_target_rejects_unsupported_targets() {
        assert!(normalize_open_material_target("").is_err());
        assert!(normalize_open_material_target("relative/file.pdf").is_err());
        assert!(normalize_open_material_target("ftp://example.test/file.pdf").is_err());
    }

    // ── "write 0" detection tests ──────────────────────────────────
    // These tests verify that INSERT/UPDATE/DELETE operations properly
    // detect and report 0 rows affected, preventing silent data loss.

    fn setup_mistake_tables(conn: &Connection) {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS mistake_tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS mistake_records (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                subject TEXT NOT NULL DEFAULT '',
                question_text TEXT NOT NULL DEFAULT '',
                image_path TEXT NOT NULL DEFAULT '',
                student_answer TEXT NOT NULL DEFAULT '',
                correct_answer TEXT NOT NULL DEFAULT '',
                mistake_reason TEXT NOT NULL DEFAULT '',
                knowledge_points_json TEXT NOT NULL DEFAULT '[]',
                tags_json TEXT NOT NULL DEFAULT '[]',
                mastery_status TEXT NOT NULL DEFAULT '待复习',
                difficulty TEXT NOT NULL DEFAULT '中等',
                grade_level TEXT NOT NULL DEFAULT '',
                semester TEXT NOT NULL DEFAULT '',
                similar_questions_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );",
        )
        .expect("mistake tables should be created");
    }

    #[test]
    fn require_rows_returns_error_on_zero() {
        assert!(require_rows(0, "test operation").is_err());
        assert_eq!(
            require_rows(0, "test operation").unwrap_err(),
            "test operation: 0 rows affected"
        );
    }

    #[test]
    fn require_rows_passes_through_on_success() {
        assert_eq!(require_rows(1, "ok").unwrap(), 1);
        assert_eq!(require_rows(42, "bulk").unwrap(), 42);
    }

    #[test]
    fn insert_mistake_record_reports_zero_rows() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_mistake_tables(&conn);

        // Insert a row — should succeed
        let affected = conn
            .execute(
                "INSERT INTO mistake_records (id, student_id, subject, question_text, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params!["rec-1", "s1", "数学", "题目", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
            )
            .expect("insert should succeed");
        assert_eq!(affected, 1, "INSERT should affect 1 row");

        // Insert with same PK — should fail with constraint violation (not 0 rows)
        let result = conn.execute(
            "INSERT INTO mistake_records (id, student_id, subject, question_text, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["rec-1", "s1", "数学", "题目", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        );
        assert!(result.is_err(), "duplicate PK INSERT should error");
    }

    #[test]
    fn update_mistake_record_reports_zero_rows_for_missing_id() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_mistake_tables(&conn);

        // UPDATE a non-existent record — should return Ok(0), NOT Err
        let affected = conn
            .execute(
                "UPDATE mistake_records SET subject = ?1 WHERE id = ?2",
                params!["语文", "nonexistent"],
            )
            .expect("update should succeed (rusqlite returns Ok(0) for no-match)");

        assert_eq!(affected, 0, "UPDATE with no match MUST return 0 — this is the 'write 0' pattern we guard against");
    }

    #[test]
    fn update_mistake_record_affects_row_for_existing_id() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_mistake_tables(&conn);

        conn.execute(
            "INSERT INTO mistake_records (id, student_id, subject, question_text, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["rec-2", "s1", "数学", "题目", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
        )
        .expect("insert should succeed");

        let affected = conn
            .execute(
                "UPDATE mistake_records SET subject = ?1 WHERE id = ?2",
                params!["语文", "rec-2"],
            )
            .expect("update should succeed");

        assert_eq!(affected, 1, "UPDATE existing record should affect 1 row");
    }

    #[test]
    fn delete_mistake_record_reports_zero_rows_for_missing_id() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_mistake_tables(&conn);

        let affected = conn
            .execute("DELETE FROM mistake_records WHERE id = ?1", params!["nonexistent"])
            .expect("delete should succeed");

        assert_eq!(affected, 0, "DELETE with no match returns 0 — must be checked by caller");
    }

    #[test]
    fn insert_mistake_tag_reports_zero_rows_on_silent_failure() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_mistake_tables(&conn);

        // INSERT OR IGNORE should succeed with 0 rows if duplicate
        conn.execute(
            "INSERT INTO mistake_tags (id, name, category) VALUES (?1, ?2, ?3)",
            params!["tag-1", "数与代数", "数学"],
        )
        .expect("first insert should succeed");

        let affected = conn
            .execute(
                "INSERT OR IGNORE INTO mistake_tags (id, name, category) VALUES (?1, ?2, ?3)",
                params!["tag-1", "数与代数", "数学"],
            )
            .expect("INSERT OR IGNORE should succeed");

        assert_eq!(affected, 0, "INSERT OR IGNORE duplicate returns 0 — intentionally idempotent");
    }

    #[test]
    fn seed_k12_tags_is_idempotent() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        setup_mistake_tables(&conn);

        // First seeding should insert tags
        seed_k12_tags(&conn).expect("first seed should succeed");
        let count1: i64 = conn
            .query_row("SELECT COUNT(*) FROM mistake_tags", [], |row| row.get(0))
            .expect("count should work");
        assert!(count1 > 0, "first seed should create tags");

        // Second seeding should be idempotent (INSERT OR IGNORE)
        seed_k12_tags(&conn).expect("second seed should succeed");
        let count2: i64 = conn
            .query_row("SELECT COUNT(*) FROM mistake_tags", [], |row| row.get(0))
            .expect("count should work");
        assert_eq!(count1, count2, "second seed should not duplicate tags");
    }
}
