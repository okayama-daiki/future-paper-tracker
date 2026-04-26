---
name: update-conference-by-id
description: Update or audit a single conference entry in the future-paper-tracker repository by conference ID, using current official conference or CFP sources. Use when working in this project and the user asks to check or fix one conference in data/conferences.json, especially dates, venue, milestones, call_for_paper.source_url, or whether the entry should remain estimated versus confirmed.
---

# Update Conference By Id

## Overview

Update one conference entry in `data/conferences.json` using official sources and keep the record consistent with this repository's conventions. Use the bundled script to inspect and validate the target record before and after edits.

## Inputs

- Require a `conference-id` such as `PODC-2027` or `WAOA-2026`.
- Work from the repository root.
- Edit only `data/conferences.json`. `apps/website/public/conferences.json` is hardlinked and should not be edited separately.

## Workflow

### 1. Inspect the current record

Run:

```bash
node .agents/skills/update-conference-by-id/scripts/conference-json-tool.js show PODC-2027
```

This prints the containing series plus the target conference entry so the current assumptions are explicit.

### 2. Gather current official sources

- Browse the web for current official information because dates, venues, and CFP pages are time-sensitive.
- Prefer, in order:
  1. The current-year conference page
  2. The official CFP page
  3. The official series page
  4. Official submission systems such as EasyChair or HotCRP
- Avoid third-party mirrors unless no official source exists.

### 3. Decide whether each field is confirmed or estimated

- Treat a field as confirmed only when the current-year official source explicitly states it.
- Treat a field as estimated when it is projected from a previous confirmed edition or a stable historical pattern.
- If the current-year page exists but omits a field, set that field to `null` rather than copying old data forward.

### 4. Apply project-specific rules

- Keep `id`, `year`, `name`, and dates aligned. If the discovered source is clearly for another year, rename the record instead of stuffing 2027 data into a 2026 record.
- For sub-conferences and workshops, do not infer dates or venue from the umbrella event unless the sub-event page explicitly says so.
  Example: do not fill `WAOA` from general `ALGO` dates.
- For estimated milestones, set `is_estimated: true` and point `source_url` to the previous confirmed CFP or the nearest official source used as the estimate basis.
- Remove obviously wrong confirmed values instead of preserving them. Use `null` for unknown `venue`, `start_at_utc`, `end_at_utc`, or `call_for_paper`.
- Update `generated_at` to the current UTC timestamp whenever `data/conferences.json` changes.

### 5. Validate after editing

Run:

```bash
node .agents/skills/update-conference-by-id/scripts/conference-json-tool.js validate PODC-2027
vp check
```

`vp test` is optional. If the repository still has no test files, report that plainly instead of treating it as a failure in the data update itself.

## Commands

Show one conference:

```bash
node .agents/skills/update-conference-by-id/scripts/conference-json-tool.js show <conference-id>
```

Validate one conference:

```bash
node .agents/skills/update-conference-by-id/scripts/conference-json-tool.js validate <conference-id>
```

Validate the whole file:

```bash
node .agents/skills/update-conference-by-id/scripts/conference-json-tool.js validate
```

## Sanity Checklist

- `start_at_utc` and `end_at_utc` belong to the conference year when present.
- `end_at_utc` is not earlier than `start_at_utc`.
- Milestones do not occur after conference start.
- `call_for_paper.source_url` matches the actual source used.
- Estimated entries clearly point back to the source used for estimation.
