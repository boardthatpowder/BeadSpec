use std::fs;
use serde_json::Value;

/// Resolve a path relative to the src-tauri directory (the Cargo manifest dir).
fn src_tauri(rel: &str) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(rel)
}

#[test]
fn csp_is_not_null() {
    let conf_path = src_tauri("tauri.conf.json");
    let conf: Value = serde_json::from_str(
        &fs::read_to_string(&conf_path)
            .unwrap_or_else(|_| panic!("tauri.conf.json not found at {:?}", conf_path)),
    )
    .expect("tauri.conf.json is not valid JSON");

    let csp = conf.pointer("/app/security/csp");
    assert!(csp.is_some(), "app.security.csp is missing from tauri.conf.json");
    assert!(
        !csp.unwrap().is_null(),
        "app.security.csp must not be null in tauri.conf.json"
    );

    let csp_str = csp.unwrap().as_str().unwrap_or("");
    assert!(
        !csp_str.contains("'unsafe-eval'"),
        "CSP must not allow 'unsafe-eval', found in: {csp_str}"
    );
}

#[test]
fn no_capability_grants_broad_shell_permissions() {
    let caps_dir = src_tauri("capabilities");
    if !caps_dir.exists() {
        // No capabilities directory — nothing to check.
        return;
    }

    for entry in fs::read_dir(&caps_dir)
        .unwrap_or_else(|e| panic!("failed to read capabilities dir {:?}: {e}", caps_dir))
    {
        let path = entry.unwrap().path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            let raw = fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("failed to read {:?}: {e}", path));
            let content: Value =
                serde_json::from_str(&raw).unwrap_or_else(|e| {
                    panic!("invalid JSON in capability file {:?}: {e}", path)
                });

            let perms = content.get("permissions").and_then(|p| p.as_array());
            if let Some(perms) = perms {
                for perm in perms {
                    let perm_str = perm.as_str().unwrap_or("");
                    assert!(
                        perm_str != "shell:allow-execute" && perm_str != "shell:allow-open",
                        "Capability file {:?} grants broad shell permission without an allow list: {}",
                        path,
                        perm_str
                    );
                }
            }
        }
    }
}
