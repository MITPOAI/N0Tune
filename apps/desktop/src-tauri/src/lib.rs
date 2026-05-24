mod secrets;
mod storage;

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Versioning info exposed to the renderer so the UI can verify it's
/// running inside Tauri (and not the dev `npm run dev` shell).
#[derive(Serialize)]
struct RuntimeInfo {
    runtime: &'static str,
    version: &'static str,
    tauri: &'static str,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: Option<String>,
}

#[derive(Clone, Serialize)]
struct UpdateAvailableEvent {
    current_version: String,
    latest_version: String,
    release_url: String,
}

/// Minimal "runtime_info" command. The renderer can call this via
/// `invoke('runtime_info')` to confirm the Rust runtime is alive.
/// Real memory / chat / file commands ship with the storage layer.
#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        runtime: "tauri",
        version: env!("CARGO_PKG_VERSION"),
        tauri: tauri::VERSION,
    }
}

async fn fetch_update_available() -> Result<Option<UpdateAvailableEvent>, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let response = reqwest::Client::new()
        .get("https://api.github.com/repos/MITPOAI/N0Tune/releases/latest")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(
            reqwest::header::USER_AGENT,
            "N0Tune Desktop update check",
        )
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }

    let release = response
        .error_for_status()
        .map_err(|err| err.to_string())?
        .json::<GithubRelease>()
        .await
        .map_err(|err| err.to_string())?;

    let current = Version::parse(current_version).map_err(|err| err.to_string())?;
    let latest_label = release.tag_name.trim_start_matches('v').to_string();
    let latest = Version::parse(&latest_label).map_err(|err| err.to_string())?;

    if latest <= current {
        return Ok(None);
    }

    Ok(Some(UpdateAvailableEvent {
        current_version: current_version.to_string(),
        latest_version: release.tag_name,
        release_url: release.html_url.unwrap_or_else(|| {
            "https://github.com/MITPOAI/N0Tune/releases/latest".to_string()
        }),
    }))
}

fn spawn_update_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match fetch_update_available().await {
            Ok(Some(update)) => {
                if let Err(err) = app.emit("n0tune://update-available", update) {
                    eprintln!("n0tune: failed to emit update event: {err}");
                }
            }
            Ok(None) => {}
            Err(err) => eprintln!("n0tune: update check failed: {err}"),
        }
    });
}

/// Show the main window and focus it. Used by the tray "open" item, the
/// tray icon left-click, and the global hotkey when the user wants the
/// full UI rather than the quick-remember overlay.
#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_memories() -> Result<Vec<storage::MemoryRow>, String> {
    storage::list_memories().map_err(|err| err.to_string())
}

#[derive(serde::Deserialize)]
struct SaveMemoryArgs {
    text: String,
    #[serde(default, rename = "type")]
    kind: Option<String>,
    #[serde(default)]
    confidence: Option<f64>,
}

#[tauri::command]
fn save_memory(args: SaveMemoryArgs) -> Result<storage::MemoryRow, String> {
    storage::save_memory(&args.text, args.kind.as_deref(), args.confidence)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn forget_memory(id: String) -> Result<(), String> {
    storage::forget_memory(&id).map_err(|err| err.to_string())
}

#[tauri::command]
fn kv_get(key: String) -> Result<Option<String>, String> {
    storage::kv_get(&key).map_err(|err| err.to_string())
}

#[tauri::command]
fn kv_set(key: String, value: String) -> Result<(), String> {
    storage::kv_set(&key, &value).map_err(|err| err.to_string())
}

#[tauri::command]
fn secret_set(provider_id: String, secret: String) -> Result<(), String> {
    secrets::set(&provider_id, &secret).map_err(|err| err.to_string())
}

#[tauri::command]
fn secret_get(provider_id: String) -> Result<Option<String>, String> {
    secrets::get(&provider_id).map_err(|err| err.to_string())
}

#[tauri::command]
fn secret_delete(provider_id: String) -> Result<(), String> {
    secrets::delete(&provider_id).map_err(|err| err.to_string())
}

fn handle_tray_event(app: &AppHandle, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        ..
    } = event
    {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "open" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quick_remember" => {
            // The renderer listens for this event and opens the quick-remember
            // overlay. We don't yet open a separate Tauri window for it —
            // landing that in the same release would balloon the patch.
            let _ = app.emit("n0tune://quick-remember", ());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize SQLite at the standard per-OS app data path.
            let app_data_dir = handle
                .path()
                .app_data_dir()
                .expect("OS app data dir is unavailable");
            let db_path = app_data_dir.join("n0tune.db");
            if let Err(err) = storage::init(db_path.clone()) {
                eprintln!("n0tune: storage init failed at {db_path:?}: {err}");
            }
            spawn_update_check(handle.clone());

            // Build the tray menu.
            let open_item = MenuItem::with_id(app, "open", "Show N0Tune", true, None::<&str>)?;
            let quick_item = MenuItem::with_id(
                app,
                "quick_remember",
                "Quick remember…",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quick_item, &quit_item])?;

            TrayIconBuilder::with_id("n0tune-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("N0Tune — fine-tune any AI, without fine-tuning")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    handle_menu_event(app, event.id().as_ref());
                })
                .on_tray_icon_event(|tray, event| {
                    handle_tray_event(tray.app_handle(), event);
                })
                .build(app)?;

            // Register the default global hotkey (Cmd+Shift+Space on macOS,
            // Alt+Space everywhere else). When pressed, fire the same
            // "quick-remember" event the tray menu fires.
            {
                let modifiers = if cfg!(target_os = "macos") {
                    Modifiers::META | Modifiers::SHIFT
                } else {
                    Modifiers::ALT
                };
                let shortcut = Shortcut::new(Some(modifiers), Code::Space);
                let handle_clone = handle.clone();
                if let Err(err) =
                    handle.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = handle_clone.emit("n0tune://quick-remember", ());
                            if let Some(window) = handle_clone.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                {
                    // Don't crash the app if a hotkey is already taken on this
                    // OS — just log and continue. The tray menu still works.
                    eprintln!("n0tune: failed to register global hotkey: {err}");
                }
            }

            Ok(())
        })
        // Keep N0Tune running in the tray when the window closes — that's the
        // whole "ambient armor" point. The user explicitly quits from the tray
        // menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            runtime_info,
            show_main_window,
            list_memories,
            save_memory,
            forget_memory,
            kv_get,
            kv_set,
            secret_set,
            secret_get,
            secret_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running N0Tune desktop");
}
