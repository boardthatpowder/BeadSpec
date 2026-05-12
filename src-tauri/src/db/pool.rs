use sqlx::{mysql::MySqlPoolOptions, MySql, Pool, Row};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SchemaCheckResult {
    pub compatible: bool,
    pub version: Option<String>,
    pub message: String,
}

pub async fn check_schema_version(pool: &Pool<MySql>) -> SchemaCheckResult {
    // Check that the core 'issues' table exists — if not, schema is incompatible
    let result = sqlx::query(
        "SELECT COUNT(*) FROM information_schema.tables \
         WHERE table_schema = DATABASE() AND table_name = 'issues'",
    )
    .fetch_one(pool)
    .await;

    match result {
        Ok(row) => {
            let count: i64 = row.try_get(0).unwrap_or(0);
            if count > 0 {
                SchemaCheckResult {
                    compatible: true,
                    version: None,
                    message: "Schema compatible".into(),
                }
            } else {
                SchemaCheckResult {
                    compatible: false,
                    version: None,
                    message: "Beads 'issues' table not found — is this a valid Beads project?"
                        .into(),
                }
            }
        }
        Err(e) => SchemaCheckResult {
            compatible: false,
            version: None,
            message: format!("Schema check failed: {e}"),
        },
    }
}

#[derive(Clone)]
pub struct DoltPool {
    inner: Arc<Pool<MySql>>,
    pub project_path: String,
}

impl DoltPool {
    pub async fn connect(project_path: &str, database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = MySqlPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(5))
            .connect(database_url)
            .await?;

        let schema = check_schema_version(&pool).await;
        if !schema.compatible {
            return Err(sqlx::Error::Protocol(schema.message));
        }

        Ok(Self {
            inner: Arc::new(pool),
            project_path: project_path.to_string(),
        })
    }

    pub fn pool(&self) -> &Pool<MySql> {
        &self.inner
    }
}

#[derive(Default)]
pub struct ProjectRegistry {
    pools: RwLock<HashMap<String, DoltPool>>,
}

impl ProjectRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn get_or_connect(
        &self,
        project_path: &str,
        database_url: &str,
    ) -> Result<DoltPool, sqlx::Error> {
        {
            let pools = self.pools.read().await;
            if let Some(pool) = pools.get(project_path) {
                return Ok(pool.clone());
            }
        }
        let pool = DoltPool::connect(project_path, database_url).await?;
        let mut pools = self.pools.write().await;
        pools.insert(project_path.to_string(), pool.clone());
        Ok(pool)
    }

    /// Return an already-open pool without trying to connect.
    /// Returns an error if `connect_project` has not been called for this path.
    pub async fn get(&self, project_path: &str) -> Result<DoltPool, sqlx::Error> {
        let pools = self.pools.read().await;
        pools.get(project_path).cloned().ok_or_else(|| {
            sqlx::Error::Protocol(format!(
                "Project not connected — call connect_project first for '{project_path}'"
            ))
        })
    }

    pub async fn close(&self, project_path: &str) {
        let mut pools = self.pools.write().await;
        if let Some(pool) = pools.remove(project_path) {
            pool.inner.close().await;
        }
    }
}
