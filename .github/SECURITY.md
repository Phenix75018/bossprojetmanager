# Security Policy

## Automated scanning

Every pull request to `main` runs the **Security Scan** workflow
(`.github/workflows/security.yml`). It blocks merges when a regression is
detected. Jobs:

| Job | Tool | What it catches |
| --- | --- | --- |
| `dependency-audit` | `npm audit` via `audit-ci` | High/critical CVEs in npm dependencies |
| `secret-scan` | `gitleaks` | API keys, tokens, private keys committed to the repo |
| `codeql` | GitHub CodeQL (`security-and-quality`) | XSS, injection, unsafe patterns in TS/JS |
| `supabase-migrations` | Custom shell checks | New `public` tables missing RLS or `GRANT`, plaintext `share_password` writes, list of `verify_jwt = false` edge functions |

A weekly cron also runs the full scan to catch newly disclosed CVEs against
unchanged code.

## Dependabot

`.github/dependabot.yml` opens weekly PRs for npm and GitHub Actions updates.
Patch/minor updates are grouped to reduce noise.

## Reporting a vulnerability

Please open a private security advisory via GitHub
(**Security → Advisories → Report a vulnerability**) instead of a public issue.

## Local pre-flight

Before opening a PR you can replicate the most useful checks locally:

```sh
# Dependency CVEs
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npx audit-ci@^7 --high

# Secret scan
gitleaks detect --no-banner
```
