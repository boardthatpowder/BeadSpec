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

fn parse_worker_from_notes(notes: &str) -> Option<String> {
    const PREFIX: &str = "Auto-filed by ruflo-";
    const DELIMITER: &str = " on ";

    let first_line = notes.lines().next()?;
    let rest = first_line.strip_prefix(PREFIX)?;
    let delimiter_index = rest.find(DELIMITER)?;
    let worker = &rest[..delimiter_index];

    if worker.is_empty()
        || !worker
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return None;
    }

    Some(worker.to_string())
}

#[cfg(test)]
mod tests {
    use super::parse_worker_from_notes;

    #[test]
    fn parse_worker_from_notes_accepts_canonical_prefix() {
        let notes = "Auto-filed by ruflo-alpha on 2026-05-17\nSecond line";

        assert_eq!(parse_worker_from_notes(notes), Some("alpha".to_string()));
    }

    #[test]
    fn parse_worker_from_notes_accepts_hyphenated_worker_names() {
        let notes = "Auto-filed by ruflo-feature-scanner-7 on 2026-05-17";

        assert_eq!(
            parse_worker_from_notes(notes),
            Some("feature-scanner-7".to_string())
        );
    }

    #[test]
    fn parse_worker_from_notes_rejects_mid_string_occurrences() {
        let notes = "Note: Auto-filed by ruflo-alpha on 2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), None);
    }

    #[test]
    fn parse_worker_from_notes_rejects_malformed_delimiter() {
        let notes = "Auto-filed by ruflo-alpha on2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), None);
    }

    #[test]
    fn parse_worker_from_notes_rejects_empty_notes() {
        assert_eq!(parse_worker_from_notes(""), None);
    }

    #[test]
    fn parse_worker_from_notes_rejects_invalid_worker_tokens() {
        let notes = "Auto-filed by ruflo-Alpha on 2026-05-17";

        assert_eq!(parse_worker_from_notes(notes), None);
    }
}
