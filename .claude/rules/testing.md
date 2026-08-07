---
description: Constraints for tests, QA harness, parity/opportunity tools, CI test config.
globs: ["**/packages/testing/**","**/packages/parity/**","**/packages/opportunities/**","**/*.spec.mjs","**/*.test.mjs","**/playwright.config.*","**/vitest.config.*","**/knip.json"]
---
# Testing & Analysis Rules
- Never weaken a test to pass; fix the test if wrong. A fix isn't done until /test-site is green.
- E2E/human/parity/opportunity tools only target sites in this repo or a URL Marek owns/is-pitching (public HTML).
- blind-reviewer READ-ONLY. parity-check must show ZERO regressions before a rebuild launches.
- Opportunity reports must be accurate + fair (a strong site → short list). Frame as help, not criticism. No invented numbers.
