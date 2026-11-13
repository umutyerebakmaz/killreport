//! Port of `backend/src/services/esi-client.guard.spec.ts`: ESI's host may
//! appear in exactly one file, so every request has to go through the client
//! and its limiter.

use std::path::{Path, PathBuf};

/// Built from parts so this file does not name the host itself.
const NEEDLE: &str = concat!("esi.", "evetech", ".net");
const ALLOWED: &str = "crates/esi/src/client.rs";

fn rust_files(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).expect("readable directory") {
        let path = entry.expect("directory entry").path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        if path.is_dir() {
            if name != "target" && !name.starts_with('.') {
                rust_files(&path, out);
            }
        } else if name.ends_with(".rs") {
            out.push(path);
        }
    }
}

#[test]
fn only_the_client_names_the_esi_host() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let root = root.canonicalize().expect("backend-rs root");
    let mut files = Vec::new();
    rust_files(&root, &mut files);
    assert!(files.len() > 5, "the walk found almost nothing: {files:?}");

    let offenders: Vec<String> = files
        .iter()
        .filter(|file| {
            std::fs::read_to_string(file)
                .unwrap_or_default()
                .contains(NEEDLE)
        })
        .map(|file| {
            file.strip_prefix(&root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/")
        })
        .filter(|relative| relative != ALLOWED)
        .collect();
    assert!(
        offenders.is_empty(),
        "{NEEDLE} named outside the client: {offenders:?}"
    );

    let client = std::fs::read_to_string(root.join(ALLOWED)).expect("client.rs");
    assert!(
        client.contains(NEEDLE),
        "the client no longer names the host"
    );
}
