# Codex Automation Workflow

This repository is set up for conference-by-conference automation.

## Goal

The main agent chooses target conference series, spawns one child agent per series, and each child agent decides whether `data/conferences.json` should change. A child agent opens a PR only when it has a real data diff.

## Constraints

- Open at most one PR per conference series update.
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
3. Spawn one child agent per target conference series.
4. Pass the output of `vp run automation:describe-target -- <SERIES_ID_OR_NAME> --markdown` to each child agent.
5. Review only the child agents that produced a diff.

## Child Agent Flow

1. Read the series brief from `vp run automation:describe-target -- <SERIES_ID_OR_NAME> --markdown`.
2. Create the suggested branch.
3. Verify official conference and CfP sources.
4. Edit only the resolved conference inside `data/conferences.json`.
5. If nothing changed, exit without commit or PR.
6. If something changed, run `vp run automation:refresh-generated-at`.
7. Run `vp check`.
8. Run `vp test`.
9. Commit the data change.
10. Open a draft PR with the suggested title from the series brief.

## Helper Commands

- `vp run automation:list-targets`
- `vp run automation:list-targets -- --markdown`
- `vp run automation:describe-target -- PODC --markdown`
- `vp run automation:describe-target -- "ACM Symposium on Principles of Distributed Computing" --markdown`
- `vp run automation:describe-target -- PODC-2027 --markdown`
- `vp run automation:refresh-generated-at`

## Suggested PR Body

Use this body when a child agent opens a draft PR.

```md
## Summary

- update one resolved conference in `data/conferences.json`
- verify dates, URLs, venue, and CfP metadata against official sources

## Validation

- `vp check`
- `vp test`
```
