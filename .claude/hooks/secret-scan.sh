#!/usr/bin/env bash
h="$(grep -REn 'sk_live_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_\-]{30,}' --include='*.mjs' --include='*.json' clients packages 2>/dev/null|head -5)"; [ -n "$h" ] && { echo "⚠️  secret?:"; echo "$h"; }; exit 0
