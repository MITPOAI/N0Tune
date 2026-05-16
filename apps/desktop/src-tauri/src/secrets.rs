//! OS keychain wrapper for provider API keys.
//!
//! Uses the `keyring` crate, which talks to the macOS Keychain, the
//! Windows Credential Manager, and Linux's Secret Service / kwallet. We
//! deliberately keep API keys *out* of SQLite — they go in the OS
//! credential store, named per provider id so a user can audit them with
//! the OS GUI.

use anyhow::{Context, Result};
use keyring::Entry;

const SERVICE: &str = "dev.n0tune.desktop";

fn entry(provider_id: &str) -> Result<Entry> {
    Entry::new(SERVICE, provider_id)
        .with_context(|| format!("open keyring entry for {provider_id}"))
}

pub fn set(provider_id: &str, secret: &str) -> Result<()> {
    let entry = entry(provider_id)?;
    if secret.is_empty() {
        // Treat an empty secret as a delete so callers don't need a
        // separate code path for "no API key" providers (Ollama).
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry.set_password(secret).context("write secret to keyring")
}

pub fn get(provider_id: &str) -> Result<Option<String>> {
    match entry(provider_id)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(anyhow::anyhow!("keyring read failed: {err}")),
    }
}

pub fn delete(provider_id: &str) -> Result<()> {
    match entry(provider_id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(anyhow::anyhow!("keyring delete failed: {err}")),
    }
}
