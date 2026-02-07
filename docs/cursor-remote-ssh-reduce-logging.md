# Reducing Remote-SSH Logging & Improving Performance

If your **local** machine gets stuck, often due to excessive Remote-SSH output in **View → Output → Remote-SSH**, apply these on your **local** Cursor (not on the remote host).

## 1. Lower Remote-SSH log level (fastest fix)

On your **local** machine:

1. **Command Palette** (Ctrl+Shift+P / Cmd+Shift+P) → **Developer: Set Log Level...**
2. Choose the **Remote - SSH** (or **ms-vscode-remote.remote-ssh**) channel.
3. Set level to **Warning** or **Error** (instead of Debug/Trace/Info).

This cuts down what the Output panel stores and renders.

## 2. Add these to your local User settings.json

Open **File → Preferences → Settings**, click the **Open Settings (JSON)** icon, and add or merge:

```json
{
  "remote.SSH.enableDynamicForwarding": true,
  "remote.SSH.showLoginTerminal": false,
  "remote.SSH.useLocalServer": true,
  "log.level": "warn",
  "terminal.integrated.scrollback": 2000,
  "output.smartScroll.enabled": true
}
```

- **`log.level": "warn"`** – Reduces general Cursor/VS Code log verbosity (optional; use if the whole app feels heavy).
- **`terminal.integrated.scrollback": 2000`** – Limits terminal scrollback (default is often 1000–10000); lower = less memory.
- **`remote.SSH.useLocalServer": true`** – Uses a local server for SSH; try **false** if you have connection issues or high CPU.

Adjust or remove any key that conflicts with your existing settings.

## 3. Reduce SSH client verbosity (optional)

On your **local** machine, edit your SSH config (e.g. **Remote-SSH: Open SSH Configuration File...** from the Command Palette). For the host you use with Cursor, add:

```
Host your-remote-host
  LogLevel ERROR
```

Replace `your-remote-host` with the Host name you use to connect. This quiets the SSH client; the main win is usually step 1.

## 4. If it’s still slow

- **Close the Output panel** when you don’t need it (View → Output, then close the panel or switch to another channel).
- **Clear Output**: in the Output panel, right‑click → **Clear Output** for the Remote-SSH channel to free memory.
- **Reload the window**: Command Palette → **Developer: Reload Window** after changing settings.
- Try **Remote-SSH: Kill VS Code Server on Host...** and reconnect if the remote side feels stuck.

## Settings file locations (local machine)

| OS     | Path |
|--------|------|
| macOS  | `~/Library/Application Support/Cursor/User/settings.json` |
| Linux  | `~/.config/Cursor/User/settings.json` |
| Windows| `%APPDATA%\Cursor\User\settings.json` |

Apply all of the above on the machine where Cursor is running (your laptop/desktop), not on the SSH host.
