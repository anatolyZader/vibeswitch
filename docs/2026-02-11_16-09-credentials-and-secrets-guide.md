# Where to Store Credentials and What to Add to GitHub Actions

This guide covers where to save API keys and tokens for programmatic use (Claude, SonarCloud, OpenAI) and which secrets/variables to configure in GitHub Actions.

---

## 1) Where to save credentials locally (programmatic use)

**Rule:** Never commit secrets to the repo. Use one of the options below.

### Option A: VS Code / Cursor settings (recommended for the extension)

Store API keys in **User** or **Workspace** settings so the extension can use them. User settings apply to all workspaces on that machine; Workspace settings live in `.vscode/settings.json` and apply only to that folder (do not commit real keys there if the repo is shared).

**How to add these to settings (step-by-step):**

1. **Open the settings file:**  
   - Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (Mac) to open the Command Palette.  
   - Type **“Open User Settings (JSON)”** and choose **Preferences: Open User Settings (JSON)**.  
   - A JSON file opens (e.g. `settings.json` in your user config folder). Use **User** so the key is not in the project.

2. **Add the key and value:**  
   - The file is a single JSON object `{ ... }`.  
   - Add a new line inside the `{ }` with the setting name in double quotes, a colon, then the value in double quotes.  
   - Example for OpenAI (replace with your real key):  
     ```json
     "vibeswitch.llm.openai.apiKey": "sk-proj-your-actual-key-here",
     "vibeswitch.llm.openai.model": "gpt-4.1-mini"
     ```  
   - If there are already other settings, put a **comma** after the last one before your new lines. Valid example:  
     ```json
     {
       "editor.fontSize": 14,
       "vibeswitch.llm.openai.apiKey": "sk-proj-...",
       "vibeswitch.llm.openai.model": "gpt-4.1-mini"
     }
     ```

3. **Save the file** (Ctrl+S / Cmd+S). The extension will read these settings the next time it needs them (you may need to reload the window or restart Cursor).

**Alternative (UI):** You can also use **File → Preferences → Settings**, search for e.g. `vibeswitch.llm.openai`, and paste the API key into the “Api Key” field. That writes the same JSON for you; User vs Workspace is chosen by the tab (User / Workspace) at the top.

#### OpenAI (VibeSwitch)

The extension uses two OpenAI-related settings. Both are optional; if you use LLM insights or dashboard chat, set at least one.

| Setting ID | Purpose | Example value |
|------------|---------|---------------|
| **`vibeswitch.llm.openai.apiKey`** | API key for the main LLM provider (insights, awareness, etc.) when provider is OpenAI. | `"sk-proj-..."` |
| **`vibeswitch.llm.openai.model`** | Model name for that provider. Default: `gpt-4.1-mini`. | `"gpt-4.1-mini"` or `"gpt-4o"` |
| **`vibeswitch.dashboardChat.openai.apiKey`** | API key for the **dashboard chat** feature only. | `"sk-proj-..."` |
| **`vibeswitch.dashboardChat.openai.model`** | Model for dashboard chat. If empty, falls back to `vibeswitch.llm.openai.model`. | `""` or `"gpt-4o-mini"` |

**Fallback:** If `vibeswitch.dashboardChat.openai.apiKey` is empty, the extension uses `vibeswitch.llm.openai.apiKey` for dashboard chat. So you can set only `vibeswitch.llm.openai.apiKey` and both LLM features and dashboard chat will use it.

**Example (User settings JSON):**
```json
{
  "vibeswitch.llm.openai.apiKey": "sk-proj-your-key-here",
  "vibeswitch.llm.openai.model": "gpt-4.1-mini"
}
```

**Security:** Prefer **User** settings for keys so they stay out of the workspace and are not committed. If you use Workspace settings, add `.vscode/settings.json` to `.gitignore` for that project or use a separate, non-committed config.

#### Other extension secrets

| What | Where | Notes |
|------|--------|------|
| **Cursor usage token**, **Ed25519 keypair** | VS Code `context.secretStorage` (extension-managed) | Stored securely by the extension; not in settings JSON. |

#### Claude / Anthropic (future)

If you add Claude support to the extension, define a setting such as `vibeswitch.llm.anthropic.apiKey` and put the key in User or Workspace settings only (same pattern as OpenAI).

#### Why not use a `.env` file in the extension?

You *could* have the extension read API keys from a `.env` file in the workspace (and `.env` is already gitignored). We still recommend **settings** for the extension for these reasons:

1. **No extra code or file I/O** — The extension already uses `vscode.workspace.getConfiguration('vibeswitch')` for all config. Keys in settings work with the existing code; no need to load or parse a file, or depend on `dotenv`.
2. **Keys can live completely outside the workspace** — **User** settings are stored in your OS user directory (e.g. `~/.config/Code/User/settings.json`), not in the project. So the key never sits in the repo or in a file under the workspace. With `.env`, the file must be in (or relative to) the workspace, so it’s easier to accidentally commit or share.
3. **Standard for VS Code extensions** — Users and docs expect API keys and secrets to be in Settings or in the editor’s secret storage. Extensions don’t conventionally read `.env` by default.
4. **Workspace root is ambiguous** — With a single workspace root it’s clear where `.env` goes; with multi-root or “Open File” (no folder), the extension would have to define where `.env` lives. Settings don’t have that problem.
5. **.env is already protected from agents** — The extension’s mode-enforcement blocklist forbids agent edits to `.env` (and `secrets.json`, etc.) to avoid leaking keys. Using `.env` for the same keys would tie the extension’s behavior to a file that’s workspace-local and specially protected; User settings keep keys out of the workspace entirely.

**When `.env` makes sense:** For **scripts or CLI tools** that run outside the extension (e.g. `node scripts/…`, GitHub Actions, local dev scripts), a `.env` in the project root is fine and already documented in Option B. So: extension → settings; scripts/CI → `.env` or env vars.

#### How safe is the settings option?

**User settings (recommended):** Stored in plain JSON on your machine (e.g. `~/.config/Code/User/settings.json` or the Cursor equivalent). Safe in the sense that: (1) the file is outside the project, so it won’t be committed; (2) only processes with access to your user directory can read it (same as other config files). Not encrypted at rest; anyone with access to your user folder (or backups) can read the keys. For most developers and personal machines this is an acceptable tradeoff.

**Workspace settings:** Stored in `.vscode/settings.json` in the repo. **Less safe** if the repo is shared or public: the file can be committed by mistake. Only use workspace settings for keys if that file is gitignored or you use a separate, private config.

**Safer alternative for high sensitivity:** For keys you want better protected, use VS Code’s **secret storage** (`context.secretStorage`): the extension stores a value under a key (e.g. `vibeswitch.openai.apiKey`), and the OS/keychain can encrypt it. The extension already uses this for the approval keypair and Cursor token. Supporting API keys via secret storage would require the extension to read from secret storage instead of (or as a fallback to) settings; that’s more secure but needs code changes.

**Summary:** User settings = reasonably safe for typical use (no commit risk, same as other local config). For maximum safety on a shared machine or paranoia, use secret storage once the extension supports it for API keys.

### Option B: Local env file (CLI / scripts / local dev)

For scripts or tools that run outside the extension (e.g. local scripts calling APIs):

- **File:** `.env` in the project root (or a path you choose).  
- **Content (example):**
  ```bash
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  # SONAR_TOKEN only for local Sonar scans; CI uses GitHub Secrets
  ```
- **Already gitignored:** `.env` and `.env.local` are in [.gitignore](.gitignore). Do not remove them.  
- **Usage in scripts:** `require('dotenv').config()` or read `process.env.OPENAI_API_KEY` etc. (do not add `.env` to the repo).

### Option C: System / user environment variables

- Set in your shell profile (e.g. `~/.bashrc`, `~/.zshrc`) or in your OS environment:
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- Use in Node: `process.env.OPENAI_API_KEY`. No file in the repo.

**Summary:** Extension → VS Code settings (and secret storage). Scripts / CLI → `.env` (gitignored) or system env vars. Never commit keys.

---

## 2) Which secrets and variables to add to GitHub Actions

Only add secrets that a **workflow** needs. The extension runs on the user's machine and should not use GitHub Secrets.

### Required for current workflows

| Secret name | Used by | Purpose |
|-------------|---------|---------|
| **SONAR_TOKEN** | [.github/workflows/ci.yml](.github/workflows/ci.yml) (SonarCloud step) | SonarCloud analysis on PR/push. Create token at [sonarcloud.io](https://sonarcloud.io) (Account → Security or org token). |

Add at: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret.**

### Optional (only if a workflow calls these APIs)

Add these **only** when you have a workflow step that calls the API (e.g. a job that uses OpenAI or Anthropic):

| Secret name | When to add | Purpose |
|-------------|-------------|---------|
| **OPENAI_API_KEY** | When a workflow step calls OpenAI (e.g. bot, auto-review) | OpenAI API for that job. |
| **ANTHROPIC_API_KEY** (or **CLAUDE_API_KEY**) | When a workflow step calls Claude/Anthropic | Claude API for that job. |

- Use **Secrets** for keys and tokens (masked in logs).  
- Use **Variables** only for non-secret values (e.g. `SONAR_ORGANIZATION`, `API_BASE_URL`). Your SonarCloud org/project are in `sonar-project.properties`, so no need for GitHub variables for Sonar.

### What not to put in GitHub

- **OpenAI / Claude keys** if only the extension (or your local scripts) use them. Those stay in VS Code settings or `.env` / env vars on your machine.
- **SONAR_TOKEN** in the repo or in workflow file as plain text; only in **Secrets**.

---

## Quick reference

| Credential | Local / extension | GitHub Actions |
|------------|-------------------|----------------|
| **SonarCloud** | Not needed locally for CI | **SONAR_TOKEN** (required for ci.yml) |
| **OpenAI** | VS Code settings or `.env` | Only if a workflow uses OpenAI |
| **Claude / Anthropic** | VS Code settings or `.env` | Only if a workflow uses Claude |

**Add GitHub secret:** Settings → Secrets and variables → Actions → New repository secret → Name (e.g. `SONAR_TOKEN`) → Value (paste once). Never commit the value.

---

## 3) Detailed instructions: obtaining and adding each credential

Follow these steps for each credential you need. Use **User** settings for the extension so keys never live in the repo.

---

### SonarCloud token (for CI)

**Used by:** GitHub Actions workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) to run SonarCloud analysis on PRs and pushes.

#### Step 1: Create or open your SonarCloud project

1. Open **[https://sonarcloud.io](https://sonarcloud.io)** and sign in with **GitHub**.
2. If you haven’t added the repo yet: click **“+”** or **“Add new project”** → **“Analyze new project”** → select your **GitHub organization/user** and the **vibeswitch** repository → follow the wizard.
3. When asked **“Choose your Analysis Method”**, select **“With GitHub Actions”**.
4. Note your **Organization key** and **Project key** (e.g. `vibeswitch`). They are shown in the setup instructions and in **Project Settings** (or **Administration**) → **Analysis Method**.

#### Step 2: Create the token

**Free plan:**

1. In SonarCloud, open your **profile menu** (top right) → **My Account** (or go to **[https://sonarcloud.io/account/security](https://sonarcloud.io/account/security)**).
2. Open the **Security** tab (or **Generate Tokens**).
3. Click **Generate Tokens**.
4. Enter a **name** (e.g. `github-actions-vibeswitch`).
5. Click **Generate**.
6. **Copy the token immediately.** It is shown only once. If you lose it, generate a new one and revoke the old.

**Team plan (organization):**

1. Go to your **Organization** in SonarCloud.
2. Open **Administration** → **Scoped Organization Tokens** (or **Security**).
3. **Create token** with a name and scope **“Execute Analysis”** (or equivalent).
4. Copy the token once; store it securely.

#### Step 3: Add the token to GitHub (repository secret)

1. Open your **GitHub repository** (e.g. `https://github.com/anatolyZader/vibeswitch`).
2. Go to **Settings** (repo tab bar).
3. In the left sidebar, under **Security**, click **Secrets and variables** → **Actions**.
4. Click **New repository secret**.
5. **Name:** type exactly **`SONAR_TOKEN`** (required by the SonarCloud action).
6. **Secret:** paste the token you copied from SonarCloud.
7. Click **Add secret**.

**Check:** The secret appears in the list as `SONAR_TOKEN` (value is hidden). Never commit this token or put it in `sonar-project.properties` or any file in the repo.

#### Step 4: Set org and project in the repo (non-secret)

In the **vibeswitch** repo, open **`sonar-project.properties`** at the root and set (replace with your values if different):

```properties
sonar.organization=vibeswitch
sonar.projectKey=vibeswitch
```

Commit and push this file; these values are not secret. The token stays only in GitHub Secrets.

**Why these two go in the file (and the token does not):**  
`sonar.organization` and `sonar.projectKey` are **identifiers**, not secrets. They tell SonarCloud *which* project to attach the analysis to (e.g. organization `vibeswitch`, project `vibeswitch`). They are safe to commit: they’re visible in the SonarCloud UI and in the project URL. The **token** is a **secret** that proves “this run is allowed to send analysis for that project.” If you put the token in `sonar-project.properties`, it would be committed and pushed, and anyone with repo access could use it. So: **identifiers** (org, project key) → in the repo file; **token** → only in GitHub Secrets, passed to the workflow as `SONAR_TOKEN`.

---

### OpenAI API key (for the extension)

**Used by:** VibeSwitch extension for LLM insights and dashboard chat (when configured to use OpenAI).

#### Step 1: Obtain an API key

1. Go to **[https://platform.openai.com](https://platform.openai.com)** and sign in (or create an account).
2. Open **API keys**: profile/account menu → **API keys**, or go to **[https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)**.
3. Click **Create new secret key**.
4. Give it a name (e.g. `vibeswitch`), choose permissions if asked (e.g. “All” or restrict to “Usage”/needed endpoints).
5. Click **Create secret key**.
6. **Copy the key immediately.** It starts with `sk-proj-` or `sk-`. It is shown only once; if you lose it, create a new key and disable the old one.

#### Step 2: Add the key to VS Code or Cursor (User settings)

1. In **VS Code** or **Cursor**, open the Command Palette: **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (Mac).
2. Run **“Preferences: Open User Settings (JSON)”**.
3. In the JSON file, add (or merge) the following. Replace `sk-proj-your-actual-key` with the key you copied. Use a comma after existing keys if needed.

```json
"vibeswitch.llm.openai.apiKey": "sk-proj-your-actual-key",
"vibeswitch.llm.openai.model": "gpt-4.1-mini"
```

4. Save the file. The extension will use this key for LLM insights and, if you don’t set a separate dashboard key, for dashboard chat as well.

**Optional – separate key for dashboard chat only:** To use a different key or model for the dashboard chat feature, add:

```json
"vibeswitch.dashboardChat.openai.apiKey": "sk-proj-another-key-if-needed",
"vibeswitch.dashboardChat.openai.model": "gpt-4o-mini"
```

If you leave `vibeswitch.dashboardChat.openai.apiKey` empty or omit it, the extension uses `vibeswitch.llm.openai.apiKey` for dashboard chat.

**Security:** User settings are stored outside the project (e.g. `~/.config/Code/User/settings.json` or Cursor’s equivalent). Do not put real keys in **Workspace** settings (`.vscode/settings.json`) unless that file is gitignored and the repo is private.

#### Step 3: (Optional) Use in GitHub Actions

Only if you add a workflow step that calls the OpenAI API:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** → Name: **`OPENAI_API_KEY`** → Secret: paste the same key (or a dedicated key for CI).
3. In the workflow, pass it as `env: OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}`. Do not echo or log it.

---

### Claude / Anthropic API key (for the extension or scripts)

**Used by:** Optional; use when you add Claude support to the extension or in scripts. The extension does not read an Anthropic key today; you can add a setting later (e.g. `vibeswitch.llm.anthropic.apiKey`) and follow the same pattern as OpenAI.

#### Step 1: Obtain an API key

1. Go to **[https://console.anthropic.com](https://console.anthropic.com)** and sign in (or create an account).
2. Open **API keys** (e.g. from the left menu or **[https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)**).
3. Click **Create Key**.
4. Name it (e.g. `vibeswitch`).
5. **Copy the key.** It usually starts with `sk-ant-`. It may be shown only once; if you lose it, create a new key and delete the old one.

#### Step 2: Add the key locally (extension, when supported)

When the extension supports Claude, add to **User settings (JSON)** the same way as OpenAI:

```json
"vibeswitch.llm.anthropic.apiKey": "sk-ant-your-actual-key"
```

Use **Preferences: Open User Settings (JSON)** and paste the line (with a comma if needed). Prefer User settings so the key is not in the repo.

#### Step 3: (Optional) Scripts or .env

For **scripts** that call the Anthropic API, use one of:

- **.env** in the project root (gitignored):  
  `ANTHROPIC_API_KEY=sk-ant-...`
- **Environment variable:**  
  `export ANTHROPIC_API_KEY=sk-ant-...` in your shell profile, or set it in your OS environment.

#### Step 4: (Optional) GitHub Actions

Only if a workflow step calls the Claude/Anthropic API:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** → Name: **`ANTHROPIC_API_KEY`** (or **`CLAUDE_API_KEY`** if your workflow expects that) → Secret: paste the key.
3. In the workflow: `env: ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`. Do not log the value.

---

### Checklist summary

| Credential      | Obtain from                          | Add to (extension)              | Add to (GitHub Actions)     |
|-----------------|--------------------------------------|----------------------------------|-----------------------------|
| **SonarCloud**  | sonarcloud.io → Account/Org → token  | —                                | **SONAR_TOKEN** (required)   |
| **OpenAI**      | platform.openai.com → API keys       | User settings JSON (see above)   | OPENAI_API_KEY (if workflow uses it) |
| **Claude**      | console.anthropic.com → API keys     | User settings when supported    | ANTHROPIC_API_KEY (if workflow uses it) |

After adding each one, avoid pasting keys in chat, docs, or the repo. Rotate any key if you suspect it was exposed.
