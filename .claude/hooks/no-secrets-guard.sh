#!/usr/bin/env bash
i="$(cat)"; echo "$i"|grep -qE 'sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY-----' && { echo "BLOCKED: secret. Use .env." >&2; exit 2; }; exit 0
