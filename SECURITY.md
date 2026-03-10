# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Argus, please report it privately rather than opening a public issue.

**Contact:** Open a [GitHub Security Advisory](https://github.com/Jmsa/argus/security/advisories/new) on this repository.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any suggested mitigations if known

You can expect an acknowledgment within 48 hours and a resolution or status update within 7 days.

## Scope

Argus is a local development tool that connects to a Chrome instance on your machine. It is not designed to be exposed to the internet or run in multi-user environments. Security issues most relevant to this project include:

- Unintended remote code execution via MCP tool inputs
- Unsafe handling of CDP responses that could affect the host system
- Credential or secret leakage through network recording or logging
