// Prevents a console window from showing up on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    n0tune_desktop_lib::run();
}
