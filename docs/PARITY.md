# PARITY — rebuild a site cheaper without losing anything
capture.mjs <old-url> --slug X → parity/<slug>/{baseline.json, baseline.md, brand.seed.json} (style, functionality
+providers, contact, pages). parity-check.mjs <slug> <new> → ✅ preserved / ❌ regression / ✨ added + style/contact/
page parity; exit 1 on any regression. Flow (/match-site): capture → seed brand.config+add-ons → /build-site +
/add-feature each → parity-check until zero regressions → /test-site + /security-gate. Pair with /find-opportunities:
keep what's good, fix what's weak, for less. Feature detection synced with packages/opportunities. Owned sites only.
