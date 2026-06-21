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

## Branch protection (required setup)

To **enforce** that Security Scan must pass before merging into `main`,
configure branch protection on GitHub (one-time setup, requires admin rights):

### Option A — GitHub UI

1. Go to **Settings → Branches → Branch protection rules → Add rule**.
2. **Branch name pattern**: `main`.
3. Enable **Require a pull request before merging**
   - Require at least **1 approval** (recommended).
   - Enable **Dismiss stale approvals when new commits are pushed**.
4. Enable **Require status checks to pass before merging**
   - Enable **Require branches to be up to date before merging**.
   - In the search box, add these required checks (run the workflow once on a PR first so they appear):
     - `Dependency audit`
     - `Secret scan (gitleaks)`
     - `CodeQL static analysis`
     - `Supabase migration checks`
5. Enable **Require conversation resolution before merging**.
6. Enable **Do not allow bypassing the above settings** (applies rules to admins too).
7. (Optional) Enable **Require signed commits** and **Require linear history**.
8. Click **Create** / **Save changes**.

Also enable **Settings → Code security and analysis**:
- **Dependency graph** ✅
- **Dependabot alerts** ✅
- **Dependabot security updates** ✅
- **Code scanning** ✅ (so CodeQL/gitleaks findings appear in the Security tab and annotate PRs)
- **Secret scanning** + **Push protection** ✅

### Option B — GitHub CLI

```sh
gh api -X PUT "repos/:owner/:repo/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=Dependency audit' \
  -F 'required_status_checks.contexts[]=Secret scan (gitleaks)' \
  -F 'required_status_checks.contexts[]=CodeQL static analysis' \
  -F 'required_status_checks.contexts[]=Supabase migration checks' \
  -F enforce_admins=true \
  -F 'required_pull_request_reviews.required_approving_review_count=1' \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F required_conversation_resolution=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -f restrictions=
```

### Option C — Rulesets (modern alternative)

For organizations, prefer **Settings → Rules → Rulesets → New branch ruleset**
targeting `main` with the same required status checks. Rulesets support
inheritance across repositories and clearer bypass auditing.

> ⚠️ Status check names must match the **job `name:`** values in
> `.github/workflows/security.yml` exactly. If you rename a job there, update
> the protection rule too — otherwise the old check stays "required" forever
> and blocks every PR.

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
