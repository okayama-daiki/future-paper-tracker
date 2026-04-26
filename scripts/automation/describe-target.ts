import {
  buildBranchName,
  buildPrTitle,
  loadConferenceConfig,
  loadConferenceData,
  resolveAutomationTarget,
} from "./shared.ts";

const args = process.argv.slice(2);
const targetInput = args.find((arg) => !arg.startsWith("--"));

if (!targetInput) {
  console.error(
    "Usage: vp run automation:describe-target -- <SERIES_ID_OR_CONFERENCE_ID> [--markdown]",
  );
  process.exit(1);
}

const format = args.includes("--markdown") ? "markdown" : "json";
const configSeries = await loadConferenceConfig();
const conferenceData = await loadConferenceData();

const resolved = resolveAutomationTarget(configSeries, conferenceData, targetInput);
if (!resolved) {
  console.error(`Unknown automation target: ${targetInput}`);
  process.exit(1);
}

const targetConference = resolved.target.conference;
const conferenceId = targetConference?.id ?? "bootstrap";
const branch = buildBranchName(resolved.series.id, conferenceId);
const prTitle = buildPrTitle(
  resolved.series.id,
  targetConference?.id ?? null,
  resolved.target.status,
);

const payload = {
  series: {
    id: resolved.series.id,
    name: resolved.series.name,
    url: resolved.series.url,
    enabled: resolved.series.enabled,
  },
  target: {
    inputKind: resolved.inputKind,
    status: resolved.target.status,
    reason: resolved.target.reason,
    branch,
    prTitle,
    dataPath: "data/conferences.json",
    conference: targetConference,
  },
};

if (format === "markdown") {
  console.log(`# ${targetConference?.id ?? resolved.series.id}`);
  console.log("");
  console.log(`- Requested target: ${targetInput}`);
  console.log(`- Resolved as: ${resolved.inputKind}`);
  console.log(`- Conference: ${targetConference?.name ?? "n/a"}`);
  console.log(`- Series: ${resolved.series.id} - ${resolved.series.name}`);
  console.log(`- Series URL: ${resolved.series.url}`);
  console.log(`- Status: ${resolved.target.status}`);
  console.log(`- Suggested branch: ${branch}`);
  console.log(`- Suggested PR title: ${prTitle}`);
  console.log(`- Data file: data/conferences.json`);
  console.log(`- Reason: ${resolved.target.reason}`);
  console.log("");
  console.log("## Child Agent Checklist");
  console.log("");
  console.log("- Create the suggested branch.");
  console.log("- Update only this conference inside `data/conferences.json`.");
  console.log("- Verify dates, venue, URL, and CfP fields against official sources.");
  console.log("- If there is no data change, do not open a PR.");
  console.log(
    "- If there is a data change, refresh `generated_at`, run `vp check` and `vp test`, then open a draft PR.",
  );
  console.log("");

  if (targetConference) {
    console.log("## Current Conference Snapshot");
    console.log("");
    console.log("```json");
    console.log(JSON.stringify(targetConference, null, 2));
    console.log("```");
  }
} else {
  console.log(JSON.stringify(payload, null, 2));
}
