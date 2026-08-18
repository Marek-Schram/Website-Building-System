# MEMORY — Obsidian, not Notion

`memory/` is a real Obsidian vault, not just "markdown that happens to look like Obsidian." Every skill in
this system (leads, opportunity scans, new clients, deploys, proposals, decisions, bugs) writes here as a
normal step — not something Marek has to remember to ask for. See `.claude/skills/memory-log/SKILL.md` for
the destination map and `memory/conventions.md` for the frontmatter schema.

Claude reads/writes the vault two ways, and they land in the exact same files:
1. **Direct file writes** — Write/Edit tools on `memory/*.md`. Works with zero setup, always available.
2. **Live MCP connection** — once the Obsidian app is open with the Local REST API plugin enabled, Claude
   Code can talk to it directly (`vault_read`, `vault_write`, `vault_append`, `search_simple`, `tag_list`,
   `open_file`, etc.) — useful for querying tags, opening a note in the UI, or confirming what's currently
   on screen in Obsidian. See "Live MCP setup" below; it's optional polish, not required for logging to work.

## One-time setup: open the vault in Obsidian

**Preferred: run Obsidian natively inside WSL via WSLg**, not the Windows app. Windows-side Obsidian
opening the vault over `\\wsl.localhost\<distro>\...` is unreliable in practice — file-watcher misses,
permission errors, sometimes the vault just won't open — and it doesn't get fixed by updating WSL, because
it's a cross-boundary Electron/UNC-path issue, not a WSL version bug. Modern WSL ships WSLg (GUI app
support), so running the Linux build of Obsidian *inside* WSL sidesteps the boundary entirely: it reads the
vault off the native Linux filesystem, and WSLg forwards the window to the Windows desktop like a normal app.

Already set up on this machine as of 2026-08-17:
- Obsidian AppImage extracted to `~/Applications/obsidian-app/` (AppImages need FUSE to run directly, which
  wasn't installed and needs sudo to add — extracting once with `--appimage-extract` and running the
  extracted `AppRun` binary avoids that dependency entirely).
- Launch with `obsidian-vault` (bash alias in `~/.bashrc` → `~/Applications/obsidian-vault.sh`), which opens
  the AppImage pointed at this vault's path. Logs go to `/tmp/obsidian.log` if something goes wrong.
- If you ever need to redo this from scratch (new machine, etc.): download the latest `*.AppImage` (not
  `*-arm64.AppImage`) from the obsidian-releases GitHub releases, `chmod +x`, then either run it directly if
  FUSE is available, or `./Obsidian-*.AppImage --appimage-extract` and run `squashfs-root/AppRun --no-sandbox
  <vault-path>`. If Electron complains about missing shared libraries (`libnspr4.so`, `libnss3.so`,
  `libasound.so.2`, etc. "not found"), that's normal on a minimal WSL install —
  `sudo apt-get install -y libnspr4 libnss3 libasound2t64` (or `libasound2` if the `t64` package doesn't
  exist on your Ubuntu point release) resolves it. `sudo` needs an actual interactive terminal — it can't be
  driven through Claude Code's Bash tool or the `!` passthrough, since neither allocates a real TTY for the
  password prompt.

Once open, **trust the vault's plugins** — Settings → Community plugins → "Turn on community plugins." The
vault already lists `obsidian-local-rest-api` (staged in `memory/.obsidian/plugins/obsidian-local-rest-api/`),
so it activates immediately — no marketplace search needed. (The plugin folder must be named to exactly match
its `manifest.json` `id` field, `obsidian-local-rest-api` — an earlier session had it suffixed `.bak`, which
silently disabled it even though `community-plugins.json` still listed it as enabled; fixed 2026-08-18.)

At this point Obsidian is a normal, fully-working vault: graph view, tag pane, search, backlinks all work
on the files Claude writes via the direct-file-write path. You're done unless you also want the live MCP
connection.

## Live MCP setup (optional)

The staged plugin ("Local REST API with MCP") runs an MCP server inside Obsidian itself — no separate
process, no third-party wrapper needed (the plugin author explicitly deprecated those in favor of the
built-in server).

1. In Obsidian: **Settings → Local REST API** → copy the **API key**, and turn on **"Enable HTTP server"**
   (gives you a plain-HTTP fallback on port 27123, which sidesteps self-signed-cert trust issues — the
   default HTTPS port 27124 works too if you'd rather trust the cert).
2. **Test connectivity** — since Obsidian now runs natively inside WSL (see above), it's on the same
   network namespace as Claude Code, so plain `127.0.0.1` works directly. No Windows-host-IP dance needed:
   ```bash
   curl -s http://127.0.0.1:27123/
   ```
   A JSON response (not a connection error) means the server's up.
3. **Register the MCP server yourself**, in your own terminal — not by pasting the key into a chat, so the
   key never has to pass through conversation history. Use `--scope local` so it's saved per-machine and
   never committed to git (this project's `.mcp.json` is shared/tracked; a personal API key doesn't belong
   in it):
   ```bash
   claude mcp add --transport http obsidian http://127.0.0.1:27123/mcp/ \
     --header "Authorization: Bearer <your-api-key>" --scope local
   ```
4. Restart/reopen Claude Code in this project so it picks up the new local MCP server. Ask Claude to list
   tags or read a note to confirm the connection (`tag_list`, `vault_read`).

If curl can't reach it at all, double-check "Enable HTTP server" is actually toggled on and Obsidian is
running — the direct-file-write path still works fully regardless, so logging is never blocked on this.

## Secrets
`memory/.obsidian/plugins/obsidian-local-rest-api/data.json` holds the generated API key + cert once the
plugin runs — it's gitignored (never commit it). No Obsidian secrets ever go in `.mcp.json` (shared/tracked)
or in memory notes themselves.
