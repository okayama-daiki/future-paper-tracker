#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(
    [
      "Usage:",
      "  conference-json-tool.js show <conference-id> [json-path]",
      "  conference-json-tool.js validate [conference-id] [json-path]",
    ].join("\n"),
  );
  process.exit(1);
}

function resolveJsonPath(candidate) {
  if (candidate) return path.resolve(candidate);
  return path.resolve(process.cwd(), "data/conferences.json");
}

function loadData(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw);
}

function findConference(data, conferenceId) {
  for (const series of data.conference_series) {
    for (const conference of series.conferences) {
      if (conference.id === conferenceId) {
        return { series, conference };
      }
    }
  }
  return null;
}

function printShow(data, conferenceId) {
  const match = findConference(data, conferenceId);
  if (!match) {
    console.error(`Conference not found: ${conferenceId}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        generated_at: data.generated_at,
        series: {
          id: match.series.id,
          name: match.series.name,
          url: match.series.url,
          enabled: match.series.enabled,
        },
        conference: match.conference,
      },
      null,
      2,
    ),
  );
}

function validateConference(conference) {
  const issues = [];
  const start = conference.start_at_utc ? new Date(conference.start_at_utc) : null;
  const end = conference.end_at_utc ? new Date(conference.end_at_utc) : null;

  if (start && Number.isNaN(start.getTime())) {
    issues.push({ type: "invalid_start_at_utc", value: conference.start_at_utc });
  }

  if (end && Number.isNaN(end.getTime())) {
    issues.push({ type: "invalid_end_at_utc", value: conference.end_at_utc });
  }

  if (start && start.getUTCFullYear() !== conference.year) {
    issues.push({
      type: "start_year_mismatch",
      year: conference.year,
      start_at_utc: conference.start_at_utc,
    });
  }

  if (end && end.getUTCFullYear() !== conference.year) {
    issues.push({
      type: "end_year_mismatch",
      year: conference.year,
      end_at_utc: conference.end_at_utc,
    });
  }

  if (start && end && end < start) {
    issues.push({
      type: "end_before_start",
      start_at_utc: conference.start_at_utc,
      end_at_utc: conference.end_at_utc,
    });
  }

  for (const milestone of conference.milestones || []) {
    const at = new Date(milestone.at_utc);
    if (Number.isNaN(at.getTime())) {
      issues.push({
        type: "invalid_milestone_at_utc",
        milestone: milestone.type,
        at_utc: milestone.at_utc,
      });
      continue;
    }
    if (start && at > start) {
      issues.push({
        type: "milestone_after_start",
        milestone: milestone.type,
        at_utc: milestone.at_utc,
        start_at_utc: conference.start_at_utc,
      });
    }
  }

  return issues;
}

function printValidate(data, conferenceId) {
  const results = [];

  if (conferenceId) {
    const match = findConference(data, conferenceId);
    if (!match) {
      console.error(`Conference not found: ${conferenceId}`);
      process.exit(1);
    }
    results.push({
      conference_id: conferenceId,
      issues: validateConference(match.conference),
    });
  } else {
    for (const series of data.conference_series) {
      for (const conference of series.conferences) {
        results.push({
          conference_id: conference.id,
          issues: validateConference(conference),
        });
      }
    }
  }

  const failing = results.filter((result) => result.issues.length > 0);
  if (failing.length > 0) {
    console.log(JSON.stringify(failing, null, 2));
    process.exit(1);
  }

  console.log("OK");
}

function main() {
  const [, , command, arg1, arg2] = process.argv;
  if (!command) usage();

  if (command === "show") {
    if (!arg1) usage();
    const jsonPath = resolveJsonPath(arg2);
    printShow(loadData(jsonPath), arg1);
    return;
  }

  if (command === "validate") {
    let conferenceId = null;
    let jsonPath = null;

    if (arg1) {
      if (arg1.endsWith(".json")) {
        jsonPath = arg1;
      } else {
        conferenceId = arg1;
        jsonPath = arg2;
      }
    }

    printValidate(loadData(resolveJsonPath(jsonPath)), conferenceId);
    return;
  }

  usage();
}

main();
