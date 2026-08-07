#!/usr/bin/env bash
set -uo pipefail; fail=0
grep -REn 'sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY-----' --include='*.mjs' --include='*.js' --include='*.json' --include='*.html' clients packages 2>/dev/null && { echo "::error::secret"; fail=1; } || echo "no secrets OK"
for d in clients/*/; do s="$(basename "$d")"; [ "$s" = "_template" ] && continue; h="$d/public/_headers"; [ ! -f "$h" ] && { echo "::warning::$s no _headers"; continue; }; for x in Strict-Transport-Security Content-Security-Policy X-Content-Type-Options X-Frame-Options; do grep -q "$x" "$h" || { echo "::error::$s missing $x"; fail=1; }; done; done
[ "$fail" -ne 0 ] && { echo FAILED; exit 1; }; echo "passed"
