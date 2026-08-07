# TESTING — hand debugging to agents
run-all.mjs <html-or-url> [--url] (or /test-site). Layers: human-like (zero-dep), E2E (Playwright+axe), unit
(Vitest), dead-code (Knip). Agents: qa-debugger (fixes), blind-reviewer (cleanup, read-only). CI: tests.yml.
