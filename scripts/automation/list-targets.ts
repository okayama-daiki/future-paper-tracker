import {
  buildBranchName,
  buildPrTitle,
  loadConferenceConfig,
  loadConferenceData,
  selectSeriesTarget,
} from "./shared.ts";

const args = new Set(process.argv.slice(2));
const format = args.has("--format=markdown") || args.has("--markdown") ? "markdown" : "json";
const includeNoAction = args.has("--include-no-action");

const configSeries = await loadConferenceConfig();
const conferenceData = await loadConferenceData();
const conferenceSeriesById = new Map(
  conferenceData.conference_series.map((series) => [series.id, series]),
);

const targets = configSeries
  .filter((series) => series.enabled)
  .map((series) => {
    const target = selectSeriesTarget(series, conferenceSeriesById.get(series.id));
    const conferenceId = target.conference?.id ?? null;

    return {
      seriesId: series.id,
      seriesName: series.name,
      status: target.status,
      reason: target.reason,
      conferenceId,
      command: `vp run automation:describe-target -- ${series.id} --markdown`,
      branch: buildBranchName(series.id, conferenceId ?? "bootstrap"),
      prTitle: buildPrTitle(series.id, conferenceId, target.status),
      dataPath: "data/conferences.json",
    };
  })
  .filter((target) => includeNoAction || target.status !== "no_action");

if (format === "markdown") {
  if (targets.length === 0) {
    console.log("No automation targets found.");
    process.exit(0);
  }

  console.log("# Codex Automation Targets");
  console.log("");

  for (const target of targets) {
    console.log(`## ${target.seriesId}`);
    console.log(`- Series: ${target.seriesName}`);
    console.log(`- Status: ${target.status}`);
    console.log(`- Conference: ${target.conferenceId ?? "n/a"}`);
    console.log(`- Command: ${target.command}`);
    console.log(`- Suggested branch: ${target.branch}`);
    console.log(`- PR title: ${target.prTitle}`);
    console.log(`- Reason: ${target.reason}`);
    console.log("");
  }
} else {
  console.log(JSON.stringify(targets, null, 2));
}
