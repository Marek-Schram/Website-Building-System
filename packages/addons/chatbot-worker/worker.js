/**
 * Optional AI upgrade for the SiteWright chatbot add-on.
 * Deploy on Cloudflare Workers (FREE tier: 10,000 Neurons/day — plenty for a small-business support widget).
 * The chatbot widget posts {message} here; this replies {reply} using Llama 3 (open-source model).
 *
 * Deploy:
 *   1. npm create cloudflare@latest chatbot-ai -- --type=hello-world   (choose JavaScript)
 *   2. Replace src/index.js with this file. In wrangler.jsonc add:  "ai": { "binding": "AI" }
 *   3. npx wrangler deploy
 *   4. Put the resulting URL into the chatbot add-on: --aiEndpoint https://<your-worker>.workers.dev
 *
 * Cost: $0 within the free 10k Neurons/day. Beyond that, ~$0.011 per 1,000 Neurons (pennies).
 */
export default {
  async fetch(request, env) {
    // CORS so the website widget can call this Worker.
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

    let message = '';
    try { ({ message } = await request.json()); } catch { /* ignore */ }
    if (!message) return Response.json({ reply: 'Ask me anything about the business!' }, { headers: cors });

    // A short system prompt keeps the bot on-brand and prevents rambling.
    // TODO: paste the business's real FAQ/info into BUSINESS_INFO for accurate answers (simple RAG).
    const BUSINESS_INFO = 'This is a local small business. Be friendly and concise. If you do not know, ' +
      'tell the visitor to call or use the contact form. Do not make up prices, hours, or policies.';

    try {
      const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: 'You are a helpful assistant for a small business website. ' + BUSINESS_INFO },
          { role: 'user', content: String(message).slice(0, 500) },
        ],
        max_tokens: 200,
      });
      const reply = (res && (res.response || res.reply)) || 'Please call or use the contact form and we\u2019ll help right away.';
      return Response.json({ reply }, { headers: cors });
    } catch (e) {
      return Response.json({ reply: 'Sorry, I had trouble answering — please use the contact form and we\u2019ll get back to you fast.' }, { headers: cors });
    }
  },
};
