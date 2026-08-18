---
name: memory-log
description: Persist context to the memory vault (decisions, bugs, leads, add-ons, parity + opportunity findings).
---
# Memory Log
Every skill in this system ends with a memory write — not optional, not "if notable." `memory/` is the
Obsidian vault (see docs/MEMORY.md); write plain markdown files there directly (Write/Edit tools, or the
`obsidian` MCP `vault_write`/`vault_append` tools if connected — either lands in the same folder).

## Where each type goes
| type | file | 
|---|---|
| lead (find-leads/find-booking-leads scan) | `memory/leads/<niche>-<city>.md` (lodging: `memory/leads/lodging-<city>.md`) |
| opportunity/audit scan on a prospect | append a line to the matching `memory/leads/<niche>-<city>.md` row, or `memory/leads/<slug>.md` if scanned standalone |
| client (new-client onward) | `memory/clients/<slug>.md` |
| proposal/listing (lodging) | append to `memory/clients/<slug>.md` under a `## Lodging` heading |
| decision (architecture/scope choice) | append dated bullet to `memory/decisions-log.md` |
| bug/root-cause found + fixed | append dated `symptom → root cause → fix` bullet to `memory/lessons-learned.md` |
| reusable snippet/pattern | `memory/snippets/<name>.md` |
| deploy | append live URL + date to `memory/clients/<slug>.md` |

## Format
Per-item files (lead/client/snippet) get frontmatter — see `memory/conventions.md` for the schema (type,
date, tags, status). Running logs (decisions-log.md, lessons-learned.md) stay plain dated bullets, no
frontmatter, one file per log. Short and dated, always. Never write secrets (keys, tokens) into memory —
reference ".env" instead.

## Start-of-task reads
Read `memory/conventions.md` + the relevant `memory/clients/<slug>.md` or `memory/leads/<niche>-<city>.md`
before starting work on that client/niche, so decisions stay consistent with what's already been tried.
