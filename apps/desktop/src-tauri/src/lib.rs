use serde::Serialize;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![runtime_info])
        .run(tauri::generate_context!())
        .expect("error while running N0Tune desktop");
}
