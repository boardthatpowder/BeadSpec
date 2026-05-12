# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |
| older   | No        |

Only the latest released version receives security fixes. Upgrade to the latest release before reporting a vulnerability.

## Reporting a Vulnerability

**Do not open a public GitHub Issue for security vulnerabilities.**

Report security issues privately via [GitHub Security Advisories](https://github.com/boardthatpowder/BeadSpec/security/advisories/new). This keeps details confidential until a fix is released.

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

**Response SLA**: I aim to acknowledge reports within 72 hours and provide a timeline for a fix within 7 days.

## Scope

In scope:
- Remote code execution
- Privilege escalation
- Credential or token exposure
- XSS in the embedded WebView
- Tauri IPC injection

Out of scope:
- Vulnerabilities in `bd` / Dolt (report those upstream)
- Social engineering
- Denial of service against a local desktop app
- Issues requiring physical access to the machine
