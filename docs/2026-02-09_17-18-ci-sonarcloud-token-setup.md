# CI and SonarCloud: Obtaining and Storing the API Token Securely

The general CI workflow (`.github/workflows/ci.yml`) runs lint, tests with coverage, and SonarCloud analysis. SonarCloud requires a **single token** for authentication. This document describes how to obtain it and where to store it securely.

## What you need

- **SONAR_TOKEN** — The only secret. It identifies and authenticates the analysis to SonarQube Cloud. Do not commit it anywhere.

## 1. Create the project in SonarCloud (one-time)

1. Sign in at [sonarcloud.io](https://sonarcloud.io) (GitHub login).
2. Add your GitHub repository or create a project manually.
3. Choose analysis method **"With GitHub Actions"**.
4. Note your **Organization key** and **Project key** (e.g. `myorg_vibeswitch`).
5. In this repo, edit **sonar-project.properties** at the repo root and set:
   - `sonar.organization=<your-org-key>`
   - `sonar.projectKey=<your-project-key>`
   Do not put the token in this file; these values are not secret.

## 2. Obtain the token

- **Free plan:** [SonarCloud → Account → Security → Generate Tokens](https://sonarcloud.io/account/security). Create a token with a name (e.g. `github-actions-vibeswitch`). Copy the value **once**; it will not be shown again.
- **Team plan:** Organization → **Scoped Organization Tokens** — create a token with minimal scope (e.g. "Execute Analysis").
- **Shortcut:** When setting up the project in SonarCloud with "With GitHub Actions", the in-product tutorial can show or generate the token for you.

## 3. Store the token securely (right place)

1. In your **GitHub repository**: go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. **Name:** `SONAR_TOKEN` (exactly this; the SonarCloud action expects this name).
4. **Value:** paste the token you generated. Save.

**Do not:**

- Commit the token to the repo (no `.env`, no value in `sonar-project.properties`, no literal in `ci.yml`).
- Put it in the workflow file as plain text; the workflow must only reference `secrets.SONAR_TOKEN`.
- Echo or log the secret in any step.

The **right place** is **GitHub Actions repository secrets**, with name **SONAR_TOKEN**. The workflow passes it only via `env: SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}` to the SonarCloud scan step.

## 4. Optional: Quality gate as required check

In SonarCloud you can configure a quality gate. SonarCloud adds its result as a GitHub check. In GitHub **Settings → Branches → Branch protection** for `main` (and optionally `dev`), you can add this check to **Required status checks** so the branch cannot be merged when the quality gate fails.
