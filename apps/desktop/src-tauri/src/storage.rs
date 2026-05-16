//! Local SQLite store for the N0Tune Desktop.
//!
//! The schema mirrors the Gateway's so the same Context Compiler contract
//! works in both modes — see `apps/api/app/models/entities.py`. We
//! deliberately keep the tables small: memories, style_profile, persona,
//! and a key/value table for misc state (last provider config without
//! the secret part, etc.). API keys live in the OS keychain (`secrets.rs`),
//! not in SQLite.

use std::path::PathBuf;
use std::sync::Mutex;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use once_cell::sync::OnceCell;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const SCHEMA: &str = r"
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    state TEXT NOT NULL DEFAULT 'active',
    scope TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_state ON memories(state);
CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at);

CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
";

/// Singleton connection guarded by a mutex. SQLite with the `bundled`
/// feature is single-writer-friendly; one connection per process is the
/// simplest correct choice for a desktop app.
static CONN: OnceCell<Mutex<Connection>> = OnceCell::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRow {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub text: String,
    pub confidence: f64,
    pub state: String,
    pub scope: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

pub fn init(db_path: PathBuf) -> Result<()> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create dir {parent:?}"))?;
    }
    let conn = Connection::open(&db_path).with_context(|| format!("open sqlite {db_path:?}"))?;
    conn.execute_batch(SCHEMA).context("apply schema")?;
    CONN.set(Mutex::new(conn))
        .map_err(|_| anyhow::anyhow!("storage already initialized"))?;
    Ok(())
}

fn with_conn<R>(f: impl FnOnce(&Connection) -> Result<R>) -> Result<R> {
    let cell = CONN.get().ok_or_else(|| anyhow::anyhow!("storage not initialized"))?;
    let guard = cell.lock().map_err(|_| anyhow::anyhow!("storage mutex poisoned"))?;
    f(&guard)
}

pub fn list_memories() -> Result<Vec<MemoryRow>> {
    with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, type, text, confidence, state, scope, created_at, updated_at, deleted_at
             FROM memories
             WHERE deleted_at IS NULL
             ORDER BY datetime(updated_at) DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(MemoryRow {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    text: row.get(2)?,
                    confidence: row.get(3)?,
                    state: row.get(4)?,
                    scope: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                    deleted_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    })
}

pub fn save_memory(
    text: &str,
    kind: Option<&str>,
    confidence: Option<f64>,
) -> Result<MemoryRow> {
    if text.trim().is_empty() {
        anyhow::bail!("memory text is empty");
    }
    let row = MemoryRow {
        id: format!("mem_local_{}", Uuid::new_v4().simple()),
        kind: kind.unwrap_or("fact").to_string(),
        text: text.to_string(),
        confidence: confidence.unwrap_or(0.8),
        state: "active".to_string(),
        scope: "user".to_string(),
        created_at: now_iso(),
        updated_at: now_iso(),
        deleted_at: None,
    };
    with_conn(|conn| {
        conn.execute(
            "INSERT INTO memories(id, type, text, confidence, state, scope, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                row.id,
                row.kind,
                row.text,
                row.confidence,
                row.state,
                row.scope,
                row.created_at,
                row.updated_at,
            ],
        )?;
        Ok(())
    })?;
    Ok(row)
}

pub fn forget_memory(id: &str) -> Result<()> {
    let now = now_iso();
    with_conn(|conn| {
        conn.execute(
            "UPDATE memories SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
            params![id, now],
        )?;
        Ok(())
    })
}

pub fn kv_get(key: &str) -> Result<Option<String>> {
    with_conn(|conn| {
        let value: Option<String> = conn
            .query_row(
                "SELECT value FROM kv_store WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?;
        Ok(value)
    })
}

pub fn kv_set(key: &str, value: &str) -> Result<()> {
    let now = now_iso();
    with_conn(|conn| {
        conn.execute(
            "INSERT INTO kv_store(key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, now],
        )?;
        Ok(())
    })
}

fn now_iso() -> String {
    let now: DateTime<Utc> = Utc::now();
    now.to_rfc3339()
}
