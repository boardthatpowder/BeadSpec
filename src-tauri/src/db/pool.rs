pub use crate::bd::api::BeadsDataSource;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

/// Canonical project identities own their native processes and Beads transport.
#[derive(Default)]
pub struct ProjectRegistry {
    shutting_down: AtomicBool,
    sources: RwLock<HashMap<String, BeadsDataSource>>,
    connections: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}
impl ProjectRegistry {
    pub fn new() -> Self {
        Self::default()
    }
    async fn connection_gate(&self, path: &str) -> Arc<Mutex<()>> {
        self.connections
            .lock()
            .await
            .entry(path.into())
            .or_default()
            .clone()
    }
    pub async fn get_or_connect(
        &self,
        project_path: &str,
        bd_override: &str,
        actor: &str,
    ) -> Result<BeadsDataSource, String> {
        if self.shutting_down.load(Ordering::Acquire) {
            return Err("Project registry is shutting down".into());
        }
        let canonical = canonical_path(project_path)?;
        let gate = self.connection_gate(&canonical).await;
        let _connecting = gate.lock().await;
        if self.shutting_down.load(Ordering::Acquire) {
            return Err("Project registry is shutting down".into());
        }
        if let Some(source) = self.sources.read().await.get(&canonical) {
            return Ok(source.clone());
        }
        // Independent projects keep serving reads while another child's startup waits.
        let source = BeadsDataSource::connect(&canonical, bd_override, actor).await?;
        let mut sources = self.sources.write().await;
        if self.shutting_down.load(Ordering::Acquire) {
            drop(sources);
            source.stop().await;
            return Err("Project registry is shutting down".into());
        }
        sources.insert(canonical, source.clone());
        Ok(source)
    }
    pub async fn get(&self, project_path: &str) -> Result<BeadsDataSource, String> {
        let canonical = canonical_path(project_path)?;
        self.sources
            .read()
            .await
            .get(&canonical)
            .cloned()
            .ok_or_else(|| {
                format!("Project not connected — call connect_project first for '{project_path}'")
            })
    }
    pub async fn close(&self, project_path: &str) {
        let canonical = canonical_path(project_path).unwrap_or_else(|_| project_path.into());
        let gate = self.connection_gate(&canonical).await;
        let _connecting = gate.lock().await;
        let source = self.sources.write().await.remove(&canonical);
        if let Some(source) = source {
            source.stop().await;
        }
    }
    pub async fn stop_all(&self) {
        self.shutting_down.store(true, Ordering::Release);
        // Startup owns children before registration. Wait for those bounded startup
        // transactions to notice shutdown and dispose them before the app exits.
        let pending: Vec<_> = self.connections.lock().await.values().cloned().collect();
        for gate in pending {
            let _startup_finished = gate.lock().await;
        }
        let sources: Vec<_> = self
            .sources
            .write()
            .await
            .drain()
            .map(|(_, source)| source)
            .collect();
        for source in sources {
            source.stop().await;
        }
    }
}
fn canonical_path(path: &str) -> Result<String, String> {
    std::fs::canonicalize(path)
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| format!("Invalid project path: {error}"))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    use std::time::Duration;

    #[tokio::test]
    async fn pending_startup_cannot_register_after_shutdown() {
        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().to_string_lossy().into_owned();
        std::fs::create_dir(directory.path().join(".beads")).unwrap();
        let binary = directory.path().join("bd");
        let context =
            serde_json::json!({"beads_dir":directory.path().join(".beads"),"dolt_mode":"embedded"});
        std::fs::write(
            &binary,
            format!(
                r#"#!/bin/sh
case "$3" in
version) touch version-started; sleep 0.2; echo 'bd version 1.3.0' ;;
context) echo '{context}' ;;
*) echo '{{"value":"false"}}' ;;
esac
"#
            ),
        )
        .unwrap();
        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).unwrap();
        let registry = Arc::new(ProjectRegistry::new());
        let connecting = registry.clone();
        let binary = binary.to_string_lossy().into_owned();
        let connected_project = project.clone();
        let task = tokio::spawn(async move {
            connecting
                .get_or_connect(&connected_project, &binary, "test")
                .await
        });
        tokio::time::timeout(Duration::from_secs(2), async {
            while !directory.path().join("version-started").exists() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        registry.stop_all().await;
        assert!(
            task.is_finished(),
            "shutdown returned before the pending startup released owned resources"
        );
        assert!(
            task.await.unwrap().is_err(),
            "startup registered a source after app shutdown"
        );
        assert!(registry.get(&project).await.is_err());
    }
}
