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
