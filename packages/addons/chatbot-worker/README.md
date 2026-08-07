# Chatbot AI upgrade (optional, ~free via Cloudflare Workers AI)

The chatbot add-on ships **free and rule-based** by default (no API, no cost — answers common FAQ questions).
When a client wants natural-language answers, deploy this Worker and pass its URL to the add-on.

- **Cost:** Cloudflare Workers AI free tier = **10,000 Neurons/day** (well beyond a small-business support
  widget's needs). Beyond that it's ~$0.011 per 1,000 Neurons — pennies. No credit card for the free tier.
- **Model:** Llama 3.1 8B (open-source), runs at the edge on Cloudflare's GPUs.
- **Why it fits:** we already host on Cloudflare Pages, so this is the same platform — one dashboard, no new vendor.

## Deploy (5 min)
1. `npm create cloudflare@latest chatbot-ai -- --type=hello-world` (choose JavaScript).
2. Replace `src/index.js` with `worker.js` from this folder.
3. In `wrangler.jsonc` add the AI binding: `"ai": { "binding": "AI" }`.
4. `npx wrangler deploy` → copy the `https://<name>.workers.dev` URL.
5. Regenerate the chatbot with the endpoint:
   `node packages/addons/src/addons.mjs make chatbot --name "Biz" --aiEndpoint https://<name>.workers.dev --out clients/<slug>/... `
6. Paste the business's real FAQ/info into `BUSINESS_INFO` in the Worker for accurate answers (simple RAG).

The widget automatically uses the AI endpoint when set; if the AI call fails, it falls back to the free
rule-based answers and the contact form. So it's always at least free and functional.
