use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::Listener;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Versioning info exposed to the renderer so the UI can verify it's
/// running inside Tauri (and not the dev `npm run dev` shell).
#[derive(Serialize)]
struct RuntimeInfo {
    runtime: &'static str,
    version: &'static str,
    tauri: &'static str,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());

    builder
        .setup(|app| {
            let handle = app.handle().clone();

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
                .tooltip("N0Tune — armor for your AI tools")
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
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
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
        .invoke_handler(tauri::generate_handler![runtime_info, show_main_window])
        .run(tauri::generate_context!())
        .expect("error while running N0Tune desktop");
}
