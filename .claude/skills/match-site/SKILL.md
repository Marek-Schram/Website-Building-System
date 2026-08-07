---
name: match-site
description: Given the URL (or HTML) of a business's CURRENT website, capture its visual style and all functionality, then build a new site that matches the look, preserves every feature, and improves quality — cheaper. Use when replacing/rebuilding an existing site or when Marek provides an old site URL.
---
# Match Site (rebuild it cheaper without losing anything)

Goal: the new site keeps the OLD site's look + every feature, and adds improvements (speed, security, mobile),
at a lower cost.

## Step 1 — Capture the current site
`node packages/parity/src/capture.mjs <old-url-or-html> --slug <slug>` → writes parity/<slug>/:
- baseline.json (style, structure, functionality+providers, contact)
- baseline.md (a share-worthy parity brief)
- brand.seed.json (a brand.config.json starter with the OLD colors/fonts/contact/addons)

## Step 2 — Build to match
1. `/new-client "<slug>"`; copy parity/<slug>/brand.seed.json into the client's brand/brand.config.json.
2. `/build-site <slug>` + `/add-feature <id>` for EACH item in the brief's "Functionality to preserve"
   (use the noted provider). Add improvements the old site lacked (click-to-call, HTTPS, security headers, WhatsApp).

## Step 3 — Prove parity
`node packages/parity/src/parity-check.mjs <slug> <new-url-or-html>` (or invoke the `parity-reviewer` agent).
Reports ✅ preserved / ❌ MISSING (regression) / ✨ added + style/contact/page parity. Exit 1 on any regression.
Loop with qa-debugger until zero regressions, then `/test-site` + `/security-gate`.

Pair with `/find-opportunities` (fix the weak points too). Boundary: only capture sites the business owns/authorizes; public HTML/CSS only.
