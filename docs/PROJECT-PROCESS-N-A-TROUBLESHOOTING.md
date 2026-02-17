# Why Project Process Gauges Show N/A (and How to Fix)

The dashboard **Project process** section has three gauges: **Plan (scope & order)**, **Schedule (dates & terms)**, and **Acceptance tests**. Each shows **N/A** when the corresponding deviation value is `null` or missing. Below are the reasons and what to check.

---

## 1. All three show N/A

**Possible causes:**

- **No workspace folder open**  
  Plan and Acceptance tests need a workspace root. If you opened a single file (no folder), `getWorkspaceRoot()` is empty and both return null. Schedule (Jira) does not use the workspace path but may still be N/A if Jira is disabled or misconfigured.

- **Project progress client not created**  
  If composition of the project progress service failed at activation (e.g. exception in `compositionRoot.js`), `state.projectProgressClient` is null. Then the dashboard never calls `fetchMeasures()` and `projectProgressMeasures` is null, so all three gauges show N/A.

**What to do:**

1. Open a **folder** (File → Open Folder), not just a file.
2. Reload the window (Developer: Reload Window) and open the dashboard again.
3. Check the extension logs for errors mentioning "project progress" or "ProjectProgressService".

---

## 2. Plan (scope & order) shows N/A

**Causes:**

| Cause | What to do |
|-------|------------|
| No workspace folder open | Open a folder as the workspace. |
| Plan measure disabled | Set `vibeswitch.projectProgress.plan.enabled` to `true` (default). |
| Plan file missing | Create a plan file; default path is `PLAN.md` in the workspace root. |
| Plan path wrong | Set `vibeswitch.projectProgress.plan.path` to the correct path (e.g. `PLAN.md` or `docs/PLAN.md`). |
| File has no checkboxes | Add markdown checkboxes: `- [ ]` (todo) and `- [x]` or `- [X]` (done). At least one such line is required. |
| Read error (permissions, etc.) | Fix file permissions / path; check logs for "Plan deviation client: read failed". |

**Minimal PLAN.md example:**

```markdown
- [ ] Task one
- [x] Task two
- [ ] Task three
```

---

## 3. Schedule (dates & terms) shows N/A

**Causes:**

| Cause | What to do |
|-------|------------|
| Jira integration disabled (default) | Set `vibeswitch.projectProgress.jira.enabled` to `true`. |
| Missing Jira URL or board | Set `vibeswitch.projectProgress.jira.baseUrl` (e.g. `https://your.atlassian.net`) and `vibeswitch.projectProgress.jira.boardId`. |
| No API token | Store a Jira API token in VS Code secret `vibeswitch.projectProgress.jira.apiToken` and set `vibeswitch.projectProgress.jira.email`. |
| No active sprint | Ensure the board has an active sprint. The client uses the first sprint returned by `?state=active`. |
| Wrong story points field | If your board uses a different field, set `vibeswitch.projectProgress.jira.storyPointsField` (default is `customfield_10016`). |
| Request timeout / API error | Check network and Jira; see logs for "Jira sprint deviation: request failed". |

Schedule is **off by default**; you must enable and configure Jira for this gauge to show a number.

---

## 4. Acceptance tests shows N/A

**Causes:**

| Cause | What to do |
|-------|------------|
| No workspace folder open | Open a folder (tests run in workspace root). |
| Acceptance tests disabled | Set `vibeswitch.projectProgress.acceptanceTests.enabled` to `true` (default). |
| Command wrong or not in PATH | Set `vibeswitch.projectProgress.acceptanceTests.command` (default `npm test`). Use a command that works in your workspace (e.g. `npx jest`, `yarn test`). |
| Output not parsed | The parser looks for lines like `X passed`, `X failed`, `X total`. If your runner uses different wording (e.g. "X passing"), see below. |
| Spawn error (e.g. npm not found) | Run the same command in a terminal from the workspace; ensure the command is on PATH when the extension runs. |
| Timeout | Increase `vibeswitch.projectProgress.acceptanceTests.timeoutMs` (default 60000 ms). If the run times out, the client may still parse partial output. |

**Parser expectations:** The client parses combined stdout+stderr for:

- `(\d+)\s+passed?`  → number passed  
- `(\d+)\s+failed?`  → number failed  
- `(\d+)\s+total`    → total (optional; otherwise passed + failed)

So "5 passed", "2 failed", "7 total" work. Formats like "5 passing (100ms)" do **not** match "passed"; the codebase can be extended to also match "passing" (see below).

---

## 5. Quick checklist

1. **Workspace:** Opened as a **folder** (not only a file).  
2. **Plan:** `PLAN.md` (or your path) exists and contains at least one `- [ ]` or `- [x]` line.  
3. **Schedule:** Jira is enabled and configured (baseUrl, boardId, email, apiToken, active sprint).  
4. **Acceptance tests:** `npm test` (or your command) runs successfully in the workspace and prints something like "X passed" / "X failed" / "X total".

After changing settings, reload the window and open the dashboard again so the payload is rebuilt with the latest `projectProgressMeasures`.
