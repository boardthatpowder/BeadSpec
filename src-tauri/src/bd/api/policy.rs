pub(super) fn supported_version(text: &str) -> bool {
    text.split_whitespace().any(|word| {
        let numbers: Vec<_> = word.trim_start_matches('v').split('.').collect();
        if numbers.len() < 3 {
            return false;
        }
        match (numbers[0].parse::<u64>(), numbers[1].parse::<u64>()) {
            (Ok(major), Ok(minor)) => major > 1 || (major == 1 && minor >= 3),
            _ => false,
        }
    })
}

pub(super) fn commit_policy_requires_cli(mode: &str, policy: &str) -> bool {
    mode != "proxied" && policy != "on"
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn minimum_version() {
        assert!(supported_version("bd version 1.3.0"));
        assert!(supported_version("v2.0.0"));
        assert!(!supported_version("bd version 1.0.3"));
        assert!(!supported_version("unknown"));
    }
    #[test]
    fn default_on_allows_http() {
        assert!(!commit_policy_requires_cli("server", "on"));
        assert!(commit_policy_requires_cli("server", "batch"));
        assert!(commit_policy_requires_cli("server", "off"));
        assert!(!commit_policy_requires_cli("proxied", "off"));
    }
}
