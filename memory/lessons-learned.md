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
- 2026-08-18: `find-booking-leads.mjs` was silently never reading `GOOGLE_PLACES_API_KEY` from `.env` at
  all — it was the one script in the lodging/prospecting family missing `import '../../../env.mjs'` (every
  sibling script — find-leads.mjs, opportunities.mjs, audit.mjs, deploy.mjs — has it). Looked like ".env
  gets wiped on commit" from the outside; actually `.env` has zero commit history ever (`git log --all -- .env`
  is empty — it's gitignored, git literally never touches it). Lesson: when an env var "isn't working" in
  this repo, check the script imports `env.mjs` before suspecting the `.env` file itself.
- 2026-08-18: `AbortSignal.timeout(N)` is NOT a reliable bound on a `fetch()` against a host that's
  network-blackholed (TCP SYN sent, zero response — not an active refusal). Confirmed: a scan hung 36 minutes
  on ONE stuck connection to a down `html.duckduckgo.com` (only 6s of CPU used the whole time — a real hang,
  not slowness), because the OS-level `connect()` outlived the abort. Fix in `packages/lodging-prospects/src/scan.mjs`:
  race the fetch against an explicit `setTimeout`-based rejection (`Promise.race`), which bounds the call
  regardless of what the underlying socket does. Apply this pattern anywhere a fetch targets a host we don't
  control and can't guarantee won't blackhole.
- 2026-08-18: The keyless Bing/DuckDuckGo scraping in `packages/lodging-prospects` for booking-platform
  presence is fundamentally unreliable, not just occasionally wrong — verified by decoding Bing's actual
  result links. Bing wraps every real organic result in a `bing.com/ck/a?...&u=<base64url, "a1"-prefixed>`
  tracking redirect rather than linking directly; a naive regex scrape either matches nothing real (if it
  excludes `bing.com` URLs, which is where the real links live) or latches onto unrelated domains mentioned
  elsewhere on the page (CSS asset hosts, a hotel chain's own sidebar links, even Microsoft profile-photo CDN
  URLs). Confirmed a real case: Hyatt Regency St. Louis at The Arch is definitely on Expedia (independently
  verified), scraper said "0/5 platforms." Worse: after correctly decoding the `ck/a` redirects, two
  differently-worded queries about the same property returned IDENTICAL decoded links — a fixed "Hyatt" brand
  knowledge-panel, not per-query organic results — meaning even proper redirect-decoding doesn't reliably
  reach real results; Bing's actual SERP structure would need much deeper reverse-engineering, with no
  guarantee it stays fixed. Decision (with Marek, 2026-08-18): don't keep chasing the scrape — de-emphasize
  platform-presence entirely. `scoreLead()` in `packages/testing/unit/booking.mjs` no longer takes presence
  as an input at all (rescored from only: no-website, no-direct-booking, no-booking-system, reviews/rating —
  all fetched directly and reliable). Presence checks are still run and shown, but explicitly labeled
  "UNVERIFIED — not scored" in every output (console, JSON, markdown, lodging-opportunities.mjs reports).
  If accurate platform-presence is ever needed again, the real fix is a proper search API (Bing Web Search
  API / Google Custom Search JSON API), not more scraping — see the "Switch to a real search API" option
  that was declined this session in favor of staying keyless.
