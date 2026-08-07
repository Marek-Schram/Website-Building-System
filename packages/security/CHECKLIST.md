# Security Checklist — OWASP-anchored
Tier1 (every site): HTTPS+redirect+HSTS · headers(CSP,X-Content-Type-Options,X-Frame-Options,Referrer-Policy,Permissions-Policy) · no secrets · server version hidden · npm audit clean · contact+privacy · Lighthouse 90+
Tier2 (form/newsletter): server validation+sanitize · Turnstile/honeypot · rate limit · no PII logged
Tier3 (booking/login): server authz deny-by-default · no cross-user data via URL ID · secure cookies · MFA
Tier4 (payments/ordering/store): provider script direct(PCI) · secret keys server-env · webhooks verify sig · CSP only provider origin
Outer wall (Cloudflare free): DDoS · WAF/OWASP · bot mgmt+rate limit · auto-SSL
