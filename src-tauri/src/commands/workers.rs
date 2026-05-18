#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct WorkerFinding {
    pub issue_id: String,
    pub title: String,
    pub worker: String,
    pub priority: i32,
    pub status: String,
    pub notes_first_line: String,
    pub created_at: String,
}
