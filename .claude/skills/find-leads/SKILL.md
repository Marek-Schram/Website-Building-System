---
name: find-leads
description: Find local businesses that need a website or a better one, scored by opportunity.
---
# Find Leads
node packages/prospecting/src/find-leads.mjs "<niche>" "<city>" [--audit --csv|--json --max N]. Needs GOOGLE_PLACES_API_KEY (+PAGESPEED for --audit). HOT/WARM/COOL. Then run /find-opportunities on each site. Official API; CAN-SPAM.
Log the full scan to `memory/leads/<niche>-<city>.md` (memory-log convention) — every run, not just notable ones.
