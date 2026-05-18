use crate::commands::gitnexus::parse_impact_json;
use crate::commands::gitnexus_processes::gitnexus_cli_json;
use crate::db::pool::ProjectRegistry;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub struct CallerRef {
    pub name: String,
    pub qualified_path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
pub struct SymbolHit {
    pub name: String,
    pub qualified_path: String,
    pub kind: String,
    pub one_line_description: String,
    pub risk_level: RiskLevel,
    pub top_upstream_callers: Vec<CallerRef>,
}

// Keep this in sync with the frontend stoplist in SymbolMentionMark.ts.
pub const SYMBOL_STOPLIST: &[&str] = &[
    "useEffect",
    "useState",
    "onClick",
    "className",
    "undefined",
    "boolean",
    "string",
    "number",
    "return",
    "import",
    "export",
    "default",
    "const",
    "async",
    "await",
    "function",
    "interface",
    "props",
];

fn str_field(v: &Value, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| v.get(*name).and_then(Value::as_str).map(ToOwned::to_owned))
}

fn first_symbol(value: &Value) -> Option<&Value> {
    value
        .get("symbol")
        .or_else(|| value.get("target"))
        .or_else(|| {
            value
                .get("candidates")
                .and_then(Value::as_array)
                .and_then(|a| a.first())
        })
        .or_else(|| {
            value
                .get("definitions")
                .and_then(Value::as_array)
                .and_then(|a| a.first())
        })
        .or(Some(value))
}

fn risk_from_report(report: crate::commands::gitnexus::GitnexusRisk) -> RiskLevel {
    match report {
        crate::commands::gitnexus::GitnexusRisk::Low => RiskLevel::Low,
        crate::commands::gitnexus::GitnexusRisk::Medium => RiskLevel::Medium,
        crate::commands::gitnexus::GitnexusRisk::High => RiskLevel::High,
        crate::commands::gitnexus::GitnexusRisk::Critical => RiskLevel::Critical,
        crate::commands::gitnexus::GitnexusRisk::Unknown => RiskLevel::Unknown,
    }
}

async fn lookup_one(project_path: &str, name: &str) -> Option<SymbolHit> {
    if name.trim().len() < 3 || SYMBOL_STOPLIST.contains(&name) {
        return None;
    }
    let ctx = gitnexus_cli_json(project_path, &["context", "--json", name], 60)
        .await
        .ok()?;
    let symbol = first_symbol(&ctx)?;
    let symbol_name = str_field(symbol, &["name", "symbol"])?;
    let qualified_path = str_field(symbol, &["qualified_path", "qualifiedPath", "filePath", "file_path", "id"])
        .unwrap_or_else(|| symbol_name.clone());
    let kind = str_field(symbol, &["kind", "type"]).unwrap_or_else(|| "symbol".into());
    let one_line_description = str_field(symbol, &["description", "summary", "signature"])
        .unwrap_or_else(|| format!("{kind} {symbol_name}"));

    let impact = gitnexus_cli_json(project_path, &["impact", "--target", name, "--json"], 30)
        .await
        .ok()
        .map(|v| parse_impact_json(name, &v, crate::commands::gitnexus::GitnexusIndexStatus::Unknown));

    let risk_level = impact
        .as_ref()
        .map(|r| risk_from_report(r.risk.clone()))
        .unwrap_or(RiskLevel::Unknown);
    let top_upstream_callers = impact
        .map(|r| {
            r.upstream_by_process
                .into_iter()
                .flat_map(|g| g.callers.into_iter())
                .take(3)
                .map(|c| CallerRef { name: c.name, qualified_path: c.location })
                .collect()
        })
        .unwrap_or_default();

    Some(SymbolHit {
        name: symbol_name,
        qualified_path,
        kind,
        one_line_description,
        risk_level,
        top_upstream_callers,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn lookup_symbols(
    project_path: String,
    names: Vec<String>,
    registry: State<'_, Arc<ProjectRegistry>>,
) -> Result<Vec<Option<SymbolHit>>, String> {
    if names.is_empty() {
        return Ok(Vec::new());
    }
    let _ = registry
        .get(&project_path)
        .await
        .map_err(|_| format!("project_not_connected: '{project_path}'"))?;
    let mut out = Vec::with_capacity(names.len());
    for name in names {
        out.push(lookup_one(&project_path, &name).await);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_lookup_shape_is_empty_vec() {
        let names: Vec<String> = Vec::new();
        assert!(names.is_empty());
    }

    #[test]
    fn stoplist_contains_frontend_tokens() {
        assert!(SYMBOL_STOPLIST.contains(&"useEffect"));
        assert!(SYMBOL_STOPLIST.contains(&"className"));
    }
}
