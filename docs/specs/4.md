# CHATBOT — a free (or near-free) website chatbot

The chatbot add-on gives a small-business site a helpful assistant, with two tiers so it's **always free by
default** and only optionally uses AI. Add it with `/add-feature chatbot`.

## Tier 1 — Rule-based FAQ widget (default, $0 forever)
- A self-contained floating chat widget (pure HTML/CSS/JS — **no API, no server, no cost, ever**).
- Answers common questions (hours, location, pricing, booking, ordering, contact) by keyword matching, with
  quick-reply chips, and falls back to "call/use the contact form" for anything it doesn't know.
- Genuinely free and reliable — no hallucinations, nothing to bill. This is the recommended default for most
  local businesses.
- Customize the answers by passing a small FAQ JSON:
  `node packages/addons/src/addons.mjs make chatbot --name "Joe's Plumbing" --phone "(636) 555-0142" --faq '[{"q":["emergency","24"],"a":"Yes, we offer 24/7 emergency service!"}]' --out <html>`

## Tier 2 — AI answers (optional, ~free via Cloudflare Workers AI)
When a client wants natural-language answers, deploy the included Cloudflare Worker and pass its URL:
`... make chatbot --aiEndpoint https://<worker>.workers.dev --out <html>`
- **Cost:** Cloudflare Workers AI free tier = **10,000 Neurons/day** — well beyond a small-business support
  widget's needs; **$0** in practice. Beyond that it's ~$0.011 per 1,000 Neurons (pennies). No credit card for free tier.
- **Model:** Llama 3.1 8B (open-source) at the edge. **Same platform we already host on** (Cloudflare) — no new vendor.
- The widget uses the AI endpoint when set and **automatically falls back** to the free rule-based answers if
  the AI call fails — so it's always at least free and functional.
- Worker code + deploy steps: `packages/addons/chatbot-worker/` (worker.js + README).

## Why this design (from 2026 research)
Rule-based bots are "cheap to build and almost free to run" and never hallucinate — ideal for the predictable
questions most local businesses get. LLM bots are more flexible but cost per token; Cloudflare Workers AI's
free tier makes the AI option effectively free at small-business volume. Offering both lets Marek promise a
chatbot at **no added cost**, and upsell the AI version only when it's wanted.

## Security / trust
- The rule-based widget stores nothing and calls nothing — zero attack surface.
- The AI Worker has a system prompt that forbids inventing prices/hours/policies and points unknowns to the
  contact form. Paste the business's real FAQ into `BUSINESS_INFO` for accurate answers (simple RAG).
- After adding the chatbot, run `/test-site` (it passes the human-like checks) and `/security-gate`.
