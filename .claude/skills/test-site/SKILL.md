---
name: test-site
description: Run the full test suite (human-like + E2E + unit + dead-code) then hand failures to qa-debugger.
---
# Test Site
node packages/testing/harness/run-all.mjs <html-or-url> [--url <live>]. On failure → qa-debugger. Owned sites only.
