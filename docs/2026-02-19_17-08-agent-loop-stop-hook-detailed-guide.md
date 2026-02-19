# Agent Loop (Stop Hook) — Detailed Guide

This guide explains **exactly** how the long-running agent loop works and how to use it step by step.

---

## 1. What problem does this solve?

Sometimes you want the agent to **keep working** until a goal is met (e.g. “all tests pass” or “lint is clean”), without you having to say “continue” after every turn. The **stop hook** lets Cursor **automatically start the next agent turn** when the current one finishes—until a condition is met (e.g. you or the agent writes `DONE` in a scratchpad file) or a max iteration count is reached.

---

## 2. Concepts you need

| Term | Meaning |
|------|--------|
| **Turn** | One “run” of the agent: it reads the conversation, uses tools (edit files, run terminal, search), then **stops**. That’s one turn. |
| **Stop hook** | A script that Cursor runs **when the agent finishes a turn**. It’s configured in `.cursor/hooks.json` under `"stop"`. |
| **Follow-up message** | If the stop hook prints `{ "followup_message": "some text" }` to stdout, Cursor starts a **new** agent turn with that text as the next user message. So the agent “continues” automatically. |
| **Scratchpad** | A file (default `.cursor/scratchpad.md`) that the hook script reads. If it contains the word `DONE`, the script tells Cursor **not** to continue (loop ends). |
| **Grind script** | Our stop-hook script (`.cursor/hooks/grind.js`). It reads the scratchpad and decides: “continue” (send followup_message) or “stop” (send `{}`). |

---

## 3. Step-by-step: what happens when you use the loop

### 3.1 You start the loop

1. You open the Agent / Chat in Cursor.
2. You send a message that describes a **repeating goal**, for example:
   - *“Run `npm test`. If any test fails, fix the code and run tests again. When **all** tests pass, write the word **DONE** (on its own line) in `.cursor/scratchpad.md`. Do not write DONE until all tests pass.”*
3. You send that message. That starts **Turn 1**.

### 3.2 Turn 1 runs

4. The agent runs (with “Run Everything” it can run terminal, edits, search without asking you).
5. It might run `npm test`, see failures, edit files, run `npm test` again.
6. When it’s done with its work for this turn, it **stops**. That’s the end of **Turn 1**.

### 3.3 Cursor runs the stop hook

7. Cursor sees: “The agent stopped.”
8. Cursor runs the **stop** hook:  
   `node .cursor/hooks/grind.js`  
   and passes one line of JSON into the script’s **stdin**, for example:
   ```json
   {"conversation_id":"abc-123","status":"completed","loop_count":0}
   ```

### 3.4 What the grind script does

9. **grind.js**:
   - Reads stdin → gets `status` and `loop_count`.
   - If `status !== "completed"` or `loop_count >= 5` (or `GRIND_MAX_ITERATIONS`) → prints `{}` and exits. **Loop ends.**
   - Otherwise reads `.cursor/scratchpad.md`:
     - If the file **contains** the word `DONE` → prints `{}` and exits. **Loop ends.**
     - If the file does **not** contain `DONE` → prints one line to **stdout**, for example:
       ```json
       {"followup_message":"[Iteration 1/5] Continue working. Update .cursor/scratchpad.md with DONE when complete."}
       ```
   - Exits.

### 3.5 Cursor starts the next turn

10. Cursor reads the hook’s stdout.
11. If it sees `followup_message`, Cursor **starts a new agent turn** with that text as the next user message. So the agent “wakes up” again with: *“[Iteration 1/5] Continue working. Update .cursor/scratchpad.md with DONE when complete.”*
12. That is **Turn 2**. The agent runs again (tests, fixes, etc.).
13. When the agent stops again, Cursor runs the hook again with `loop_count: 1`, and so on.

### 3.6 How the loop ends

- **Success:** The agent (or you) writes `DONE` in `.cursor/scratchpad.md`. On the **next** time the hook runs, it sees `DONE`, outputs `{}`, and Cursor does **not** start another turn. Conversation stays stopped.
- **Max iterations:** After 5 turns by default (or `GRIND_MAX_ITERATIONS`), the hook gets `loop_count >= 5`, outputs `{}`, and the loop stops even if `DONE` was never written.
- **Other:** If the hook script outputs `{}` for any other reason (e.g. invalid JSON, `status` not `"completed"`), the loop also ends.

---

## 4. What you need in place

### 4.1 Configuration (you already have this)

- **`.cursor/hooks.json`** must contain something like:
  ```json
  {
    "version": 1,
    "hooks": {
      "stop": [{ "command": "node .cursor/hooks/grind.js", "timeout": 10 }]
    }
  }
  ```
- **`.cursor/hooks/grind.js`** must exist (it does in this repo).

### 4.2 Scratchpad

- The hook reads **`.cursor/scratchpad.md`** (or the path in `GRIND_SCRATCHPAD`).
- To **start a new loop**, make sure the scratchpad does **not** contain `DONE` when you want the loop to continue.
- To **stop the loop**, write `DONE` in that file (e.g. on its own line). The agent can do this when the goal is met (e.g. all tests pass).

**Quick tip:** Use the command **“VibeSwitch: Open Agent Loop Scratchpad”** to open or create `.cursor/scratchpad.md`.

---

## 5. Detailed instructions to run a grind

### Step 1: Prepare the scratchpad

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P).
2. Run: **VibeSwitch: Open Agent Loop Scratchpad** (or create/open `.cursor/scratchpad.md` yourself).
3. **Remove** the word `DONE` from the file if it’s there (so the hook will send a follow-up and the loop continues). You can leave a short note like: “Goal: all tests pass.”
4. Save the file.

### Step 2: Send the initial prompt

5. Open the Agent / Chat pane.
6. Send a message that:
   - States the **goal** (e.g. “all tests pass”).
   - Tells the agent **what to do** when the goal is met (write `DONE` in `.cursor/scratchpad.md`).
   - Tells the agent **not** to write `DONE` until the goal is met.

**Example prompt:**

```text
Run npm test. If any test fails, fix the code and run npm test again.
When ALL tests pass, write exactly the word DONE on its own line in .cursor/scratchpad.md.
Do not write DONE until every test passes. Keep fixing and re-running until then.
```

### Step 3: Let it run

7. The agent runs (Turn 1). With “Run Everything” it will run terminal and edits without asking.
8. When it stops, Cursor runs the stop hook. The hook reads `.cursor/scratchpad.md`; if there’s no `DONE` and `loop_count < 5`, it returns a follow-up message.
9. Cursor starts Turn 2 automatically with that message. The agent continues.
10. This repeats until either:
    - The agent (or you) writes `DONE` in `.cursor/scratchpad.md`, or
    - 5 iterations (or `GRIND_MAX_ITERATIONS`) are reached.

### Step 4: Stopping early (optional)

- **Let it finish:** Wait until the agent writes `DONE` or max iterations run out.
- **Stop manually:** Open `.cursor/scratchpad.md`, add a line with `DONE`, save. The **next** time the agent stops and the hook runs, the loop will end.
- You can also cancel or stop the agent in the UI; the hook only runs when the agent **completes** a turn.

---

## 6. Test that the hook works (without the agent)

From the **repo root** in a terminal:

```bash
# Scratchpad WITHOUT DONE → hook should ask to continue
echo '{"conversation_id":"test","status":"completed","loop_count":0}' | node .cursor/hooks/grind.js
```

- If `.cursor/scratchpad.md` does **not** contain `DONE`, you should see one line like:
  `{"followup_message":"[Iteration 1/5] Continue working. Update .cursor/scratchpad.md with DONE when complete."}`
- If it **does** contain `DONE`, you should see: `{}`

Then:

```bash
# Scratchpad WITH DONE → hook should stop loop
# (First add DONE to .cursor/scratchpad.md, then run the same command again.)
echo '{"conversation_id":"test","status":"completed","loop_count":0}' | node .cursor/hooks/grind.js
```

You should see: `{}`

---

## 7. Environment variables (optional)

| Variable | Default | Meaning |
|----------|---------|--------|
| `GRIND_MAX_ITERATIONS` | `5` | Max number of follow-up turns. After this, the hook returns `{}` even if `DONE` is not in the scratchpad. |
| `GRIND_SCRATCHPAD` | `.cursor/scratchpad.md` | Full path to the scratchpad file the hook reads. |

Example (bash):

```bash
export GRIND_MAX_ITERATIONS=10
# then run Cursor / agent as usual; the hook will use 10 iterations
```

---

## 8. Summary diagram

```text
You send: "Run tests until all pass; then write DONE in .cursor/scratchpad.md"
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turn 1: Agent runs (tests, fixes, …) then STOPS                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
Cursor runs: node .cursor/hooks/grind.js
    │  stdin: {"status":"completed","loop_count":0}
    ▼
grind.js reads .cursor/scratchpad.md
    │  No "DONE" → stdout: {"followup_message":"[Iteration 1/5] Continue..."}
    ▼
Cursor starts Turn 2 with that message
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turn 2: Agent runs again, then STOPS                            │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
… repeat until scratchpad contains DONE or loop_count >= 5 …
    │
    ▼
grind.js sees DONE or max iterations → stdout: {}
    │
    ▼
Cursor does NOT start another turn. Loop ended.
```

---

## 9. Relation to “Run Everything”

- **Run Everything** (Cursor Agents setting): the agent can run **tools** (terminal, MCP, file writes) **inside each turn** without asking you. It does **not** start the next turn.
- **Stop hook**: runs **after each turn** and can tell Cursor to **start the next turn** by returning `followup_message`.

So: **Run Everything** = no approval inside a turn. **Stop hook** = automatic next turn until the grind script says stop. They work together for long, hands-off agent cycles.

---

## 10. Grind by default (rules + skill)

You can make the agent **treat every interaction** as part of the grind loop so you don’t have to say “run until tests pass” every time:

- **Rule:** In `.cursor/rules.md`, the section **“Grind loop (stop hook) — enforce by default”** tells the agent:
  - For **tasks with a goal** (fix, implement, tests pass): don’t write `DONE` until the goal is met; then write `DONE`.
  - For **one-off questions** (explain, what is): answer, then write `DONE` so the loop doesn’t start another turn.
- **Skill:** The project skill **enforce-grind-hook** (`.cursor/skills/enforce-grind-hook/SKILL.md`) encodes the same behavior so it can be applied when you want grind enforced for every interaction.

With that in place, the stop hook (which runs after every turn) and the agent’s use of the scratchpad together give you “grind by default” without a special prompt each time.

---

## 11. More info

- Full contract and options: [AGENT-LOOP-STOP-HOOK.md](AGENT-LOOP-STOP-HOOK.md)
- Grind loop section in agent rules: `.cursor/rules.md` (search for “Grind loop”).
