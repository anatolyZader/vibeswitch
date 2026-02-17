/**
 * Stop-hook script for long-running agent loops (e.g. grind until tests pass).
 * Receives StopHookInput JSON on stdin; prints { followup_message } to stdout to continue the loop.
 * Run with: bun run .cursor/hooks/grind.ts (requires Bun on PATH).
 *
 * Contract: Cursor passes { conversation_id, status, loop_count }. If we output
 * { "followup_message": "..." }, the agent continues; empty {} or no output ends the loop.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface StopHookInput {
  conversation_id: string;
  status: "completed" | "aborted" | "error";
  loop_count: number;
}

let input: StopHookInput;
try {
  input = await Bun.stdin.json();
} catch {
  console.log(JSON.stringify({}));
  process.exit(0);
}
const MAX_ITERATIONS = parseInt(process.env.GRIND_MAX_ITERATIONS ?? "5", 10);
const SCRATCHPAD_PATH =
  process.env.GRIND_SCRATCHPAD ?? join(process.cwd(), ".cursor", "scratchpad.md");

if (input.status !== "completed" || input.loop_count >= MAX_ITERATIONS) {
  console.log(JSON.stringify({}));
  process.exit(0);
}

const scratchpad = existsSync(SCRATCHPAD_PATH)
  ? readFileSync(SCRATCHPAD_PATH, "utf-8")
  : "";

if (scratchpad.includes("DONE")) {
  console.log(JSON.stringify({}));
} else {
  console.log(
    JSON.stringify({
      followup_message: `[Iteration ${input.loop_count + 1}/${MAX_ITERATIONS}] Continue working. Update .cursor/scratchpad.md with DONE when complete.`,
    })
  );
}
process.exit(0);
