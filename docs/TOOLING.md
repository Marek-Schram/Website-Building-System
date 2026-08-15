# TOOLING — free tools, MCP, packages
MCP (.mcp.json, free): Context7, Playwright (QA/E2E + parity/opportunity screenshots), Filesystem, Fetch (captures/scans
sites), Sequential-Thinking. Client engine: Google Places + PageSpeed (free). Add-on providers (business supplies):
Toast/Square/ChowNow, OpenTable/Resy, Calendly/SimplyBook, Brevo, tawk.to, Stripe/Snipcart. Testing: Playwright+axe,
Vitest, Knip. Analysis (no keys): parity capture + parity-check, opportunities detector. Security: Strix/Nuclei + Cloudflare WAF.

Chatbot: free rule-based FAQ widget (no cost) with optional Cloudflare Workers AI upgrade (free 10k neurons/day). Prospect brief: chains opportunities+audit+demo into one emailable HTML/PDF. Booking (lodging): find-booking-leads (presence) → propose-lodging (Pixelreach proposal) → listing-kit (onboard + track) + `booking-link` add-on. See docs/CHATBOT.md, docs/PROSPECT-BRIEF.md, docs/BOOKING-INTEGRATION.md, docs/PROPOSALS.md, docs/LISTING-KIT.md.

## AI provider setup for oh-my-opencode agents
Keys live in `~/.local/share/opencode/auth.json` + `.env` (both gitignored — never commit). Provider models are
linked in `~/.omo/omo.jsonc` (single source; backups kept). OpenRouter usage is FREE-ONLY (`:free` variants).

**Free-tier reality (2026):** `:free` models = $0/request, but capped per account at **50 req/day** (no credits)
or **1,000 req/day** after a one-time **$10 deposit** (deposit never expires). Cap: 20 req/min. Failed requests
count against the daily quota, so openrouter concurrency is set low (~2). If you want to "code a lot" on free
models, add the $10 deposit once — it raises the ceiling ~20x and still costs $0 to use free models.
