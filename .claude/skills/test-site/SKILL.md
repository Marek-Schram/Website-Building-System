---
name: test-site
description: Run the full test suite (human-like + E2E + unit + dead-code) then hand failures to qa-debugger.
---
# Test Site
node packages/testing/harness/run-all.mjs <html-or-url> [--url <live>]. On failure → qa-debugger. Owned sites only.
If qa-debugger fixes a real bug, log symptom → root cause → fix to `memory/lessons-learned.md` — memory-log convention.
