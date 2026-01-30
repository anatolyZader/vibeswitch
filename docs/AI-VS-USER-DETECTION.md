# How VibeSwitch Distinguishes AI vs User

The awareness meter only counts **AI-generated** changes as unreviewed. Here is how the system decides whether something came from an AI agent or from the user.

## 1. In-document edits (text changes)

- **@ai marker (definitive)**  
  If the **changed text** contains a comment marker like `// @ai`, `# @ai`, `<!-- @ai -->`, `-- @ai`, or `/* @ai */`, the change is treated as AI. No heuristics are needed.

- **Heuristics (when no marker)**  
  If there is no marker, the classifier uses behavior:
  - **AI-like:** large insertions, rapid scattered edits, multi-line insertions, pure insertions.
  - **User-like:** small edits, typing patterns.
  - **Formatter:** bulk formatting patterns.

So for **edits**, the system uses: marker first, then heuristics.

## 2. File saves

A save is only counted as “AI file write” (and added to unreviewed) if **at least one** of these is true:

- The event is explicitly from the agent (`source: 'agent'`), or  
- The file content contains an **@ai marker** (same patterns as above), or  
- The file was “recently created” (internal signal).

Otherwise the save is treated as normal user save and **not** counted as unreviewed.

## 3. New files (file creation)

When a **new file** appears (e.g. file system watcher or `onDidCreateFiles`):

- The extension opens the file and reads its content.
- It is only added as unreviewed (suggestion + debt) if:
  - The caller passed an explicit AI signal (`source: 'agent'` or `hasAIMarker: true`), **or**
  - The **file content** contains an **@ai marker** (same comment patterns as above).

If there is no explicit signal and no @ai marker in the content, the file is **not** counted as unreviewed. That avoids treating user-created new files as AI-generated.

## Summary

| Signal / path              | How we treat as AI |
|----------------------------|---------------------|
| **Edits**                  | @ai in changed text, or heuristics (size, pattern). |
| **Saves**                  | Explicit `source: 'agent'`, or @ai in file content, or “recently created”. |
| **New files (watcher/API)**| Explicit `source: 'agent'` / `hasAIMarker`, or @ai in file content. |

So the system knows “AI vs user” by: **@ai markers** (strong signal), **explicit agent source** when the extension is told, and **edit/save heuristics** for in-document changes when no marker is present.
