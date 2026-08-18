# Lessons Learned (symptom → root cause → fix)
- 2026-08-07 (seed): Secrets leak into client bundle if referenced outside a server route → keys in server-only .env.
- 2026-08-07: Feature detection is shared across parity + opportunities — keep the two detectors in sync (both detect reviews, ordering, booking, etc.) so they agree on what a site has.
- 2026-08-07: Opportunity reports must stay credible — a strong site should score near 0. Frame as help, not criticism.
- 2026-08-07: Brand accent colors like #f59e0b / #0ea5e9 / #f472b6 / #f97316 fail WCAG AA (white text = 2.1–2.8:1).
  Use darker accents (#92400e, #0369a1, #be185d, #9a3412 = 4.9–7.1:1). Axe in Playwright catches this — run it on every demo/brief.
- 2026-08-07: The strict CSP (script-src 'self') silently breaks every native add-on because they inject inline
  scripts. If a widget stops working after hardening, check CSP before suspecting the widget.
- 2026-08-07: Chatbot FAQ matching runs BEFORE the AI call, so "pricing"/"hours" questions are answered locally
  and never reach the AI — that's intended, not a bug. Use genuinely unknown phrases when testing the AI path.
- 2026-08-15: OpenRouter free models (`:free` variants) cost $0 but are rate-capped PER ACCOUNT: 50 requests/day
  with no credits, 1,000/day after a ONE-TIME $10 credit deposit (never expires, free models still cost $0),
  20 req/min. FAILED/429 requests also count against the daily quota — so cap openrouter concurrency low
  (we set 2) and never retry-loop against free endpoints. Recommendation: make the one-time $10 deposit if you
  want to "code a lot" on free models (50/day can't sustain heavy coding). Enforce never-billing by keeping every
  openrouter model `:free` and falling back to Vercel instead of paid OpenRouter models (checked in ~/.omo/omo.jsonc).
- 2026-08-15: OpenRouter model IDs changed — old `-free` suffixed slugs (e.g. nvidia/nemotron-3-super-free) no
  longer exist; current free IDs use `:free` variants (e.g. nvidia/nemotron-3-super-120b-a12b:free,
  cohere/north-mini-code:free). Verified against /api/v1/models on 2026-08-15.
- 2026-08-17: Windows-side Obsidian opening the vault over `\\wsl.localhost\<distro>\...` stayed broken even
  after updating WSL — it's a cross-boundary Electron/UNC-path issue, not a WSL version bug, so updating WSL
  never fixes it. Root cause fix: run the Linux Obsidian AppImage natively *inside* WSL instead (WSLg forwards
  the window to the Windows desktop) — reads the vault off the native filesystem, no network path involved.
  AppImages need FUSE which wasn't installed (needs sudo); worked around by extracting once
  (`--appimage-extract`) and running the extracted `AppRun` directly, no FUSE/root needed after that. Electron
  also needed `libnspr4 libnss3 libasound2t64` (missing on a minimal WSL install) — that part DOES need sudo,
  and `sudo` needs a real interactive terminal (can't be driven through Claude Code's Bash tool or `!`
  passthrough — neither allocates a TTY for the password prompt). Full setup + a `obsidian-vault` launcher
  alias documented in docs/MEMORY.md.
