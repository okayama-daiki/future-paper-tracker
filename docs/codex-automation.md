# Codex Automation Workflow

This repository is set up for conference-by-conference automation.

## Goal

The unattended path refreshes all enabled conference series once a week using deterministic source adapters only. Safe changes are committed directly to `main` in one batch and the website is deployed. No LLM or paid API is used.

The conference-by-conference agent/PR flow remains available for ambiguous sources and manual research, but it is not invoked automatically by the weekly job.

## Weekly Unattended Flow

`.github/workflows/conference-source-check.yml` runs every Monday at 06:17 JST and can also be dispatched manually.

1. Check out the latest `main`.
2. Fetch configured public API, feed, and official HTML sources.
3. Apply only unambiguous official-source evidence.
4. Refuse the whole update if validation fails or more than 25 field changes are proposed.
5. Run `vp check`, `vp test`, and the production website build.
6. Commit both conference JSON files directly to `main` when there is a diff.
7. Deploy the verified build to GitHub Pages in the same workflow.

The updater never deletes a conference, never overwrites an existing conference date range, and never changes a confirmed milestone to a conflicting date. It may fill missing dates, confirm an estimated milestone, add a missing unambiguous milestone, or replace a source link with the exact official edition page. Source failures and ambiguous lines are skipped.

GitHub Actions uses its repository-scoped `GITHUB_TOKEN`; no project API key or model key is required. A run with no data diff creates no commit, but still verifies and deploys the current site so a failed Pages deployment can be retried.

## Constraints

- Open at most one PR per conference edition. An existing open PR for the same conference ID must
  be updated or reviewed instead of creating another one.
- Use the stable suggested branch (`automation/<series>/<conference-id>`). Do not add a date or
  weekly-run suffix.
- Update `data/conferences.json` only. `apps/website/public/conferences.json` is a hard link to the same file.
- Keep each child agent focused on one series. Do not mix multiple conference series in one PR.
- If there is no data diff after verification, stop without creating a PR.

## Target Resolution

`automation:describe-target` accepts either a conference ID, a series ID, or an exact series name.

- Conference ID, such as `PODC-2027`, resolves directly to that conference.
- Series ID, such as `PODC`, resolves to the conference in that series that should be checked next.
- Exact series name, such as `ACM Symposium on Principles of Distributed Computing`, behaves the same as the series ID.

## Parent Agent Flow

1. Run `vp run automation:list-targets -- --markdown`.
2. Select the targets you want to process.
3. Run each target's `automation:check-open-pr` command and skip targets with an existing PR.
4. Spawn one child agent per remaining target conference series.
5. Pass the output of `vp run automation:describe-target -- <SERIES_ID_OR_NAME> --markdown` to each child agent.
6. Review only the child agents that produced a diff.

## Child Agent Flow

1. Read the series brief from `vp run automation:describe-target -- <SERIES_ID_OR_NAME> --markdown`.
2. Run `vp run automation:check-open-pr -- <SERIES_ID_OR_CONFERENCE_ID> --markdown`. If it exits
   with an existing PR, stop and use that PR instead.
3. Create the suggested stable branch without a timestamp suffix.
4. Run `vp run automation:check-sources -- <SERIES_ID_OR_CONFERENCE_ID> --markdown`.
5. Use the extracted official-source evidence directly when it is sufficient.
6. Use web search or an LLM only when the report says `AI fallback: needed`, a source failed, or sources conflict.
7. Verify any proposed change against an official conference or CfP source.
8. Edit only the resolved conference inside `data/conferences.json`.
9. If nothing changed, exit without commit or PR.
10. If something changed, run `vp run automation:refresh-generated-at`.
11. Run `vp check` and `vp test`.
12. Immediately before PR creation, run `automation:check-open-pr` again. The check fails closed if
    GitHub cannot be queried and exits with code 2 if a matching open PR exists.
13. Commit the data change and open one draft PR from the suggested branch. Include the marker from
    `automation:describe-target` in the PR body.

The stable branch is the concurrency backstop: even if two agents pass the preflight check at the
same time, both use the same head branch, so GitHub cannot keep two open PRs for different weekly
branches. The PR body marker supports future branch-name changes, and the guard also recognizes the
older timestamped branch format.

## Deterministic Source Layer

`config/conference-sources.json` selects adapters by conference series. Every enabled series also gets its configured official URL as a fallback.

Supported source kinds are:

- `tcs_conf` for the community-maintained theoretical-computer-science list
- `wordpress_rest` and `rss` for society sites that expose feeds
- `ieice_ken` for the IEICE research-meeting system
- `github_pages` for repositories such as the LA Symposium site
- `static_html` for stable official year pages

The checker decodes UTF-8 and legacy Shift_JIS pages, removes markup, narrows aggregator/feed content to conference aliases, and extracts date, deadline, and venue evidence. It does not mutate `data/conferences.json`.

Examples:

```sh
vp run automation:check-sources -- COMP --markdown
vp run automation:check-sources -- JSIAM-2026 --markdown
vp run automation:check-sources -- --all --output=source-report.json
```

`automation:check-sources` is the read-only diagnostic command. `automation:update-conferences` uses the same source layer and applies only the safe subset described above. The scheduled workflow stores its machine-readable update report as an artifact for 30 days.

## Helper Commands

- `vp run automation:list-targets`
- `vp run automation:list-targets -- --markdown`
- `vp run automation:describe-target -- PODC --markdown`
- `vp run automation:describe-target -- "ACM Symposium on Principles of Distributed Computing" --markdown`
- `vp run automation:describe-target -- PODC-2027 --markdown`
- `vp run automation:check-open-pr -- PODC-2027 --markdown`
- `vp run automation:check-sources -- PODC-2027 --markdown`
- `vp run automation:check-sources -- --all --output=source-report.json`
- `vp run automation:update-conferences -- --dry-run --output=update-report.json`
- `vp run automation:update-conferences -- --output=update-report.json`
- `vp run automation:refresh-generated-at`

## Suggested PR Body

Use this body when a child agent opens a draft PR.

```md
## Summary

<!-- conference-automation-target: PODC-2027 -->

- update one resolved conference in `data/conferences.json`
- verify dates, URLs, venue, and CfP metadata against official sources

## Validation

- `vp check`
- `vp test`
```
