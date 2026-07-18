import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildAutomationPrIdentity, findDuplicateOpenPr } from "./pr-guard.ts";
import {
  buildBranchName,
  loadConferenceConfig,
  loadConferenceData,
  resolveAutomationTarget,
} from "./shared.ts";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const targetInput = args.find((arg) => !arg.startsWith("--"));
const format = args.includes("--markdown") ? "markdown" : "json";

if (!targetInput) {
  console.error(
    "Usage: vp run automation:check-open-pr -- <SERIES_ID_OR_CONFERENCE_ID> [--markdown]",
  );
  process.exit(1);
}

const configSeries = await loadConferenceConfig();
const conferenceData = await loadConferenceData();
const resolved = resolveAutomationTarget(configSeries, conferenceData, targetInput);

if (!resolved) {
  console.error(`Unknown automation target: ${targetInput}`);
  process.exit(1);
}

const conferenceId = resolved.target.conference?.id ?? null;
const branch = buildBranchName(resolved.series.id, conferenceId ?? "bootstrap");
const identity = buildAutomationPrIdentity(resolved.series.id, conferenceId, branch);

let stdout: string;
try {
  const result = await execFileAsync(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "open",
      "--limit",
      "1000",
      "--json",
      "number,url,title,headRefName,body",
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  stdout = result.stdout;
} catch (error) {
  console.error(
    `Unable to verify open pull requests; refusing to continue: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

const pullRequests = JSON.parse(stdout) as Parameters<typeof findDuplicateOpenPr>[0];
const duplicate = findDuplicateOpenPr(pullRequests, identity);
const payload = {
  allowed: duplicate == null,
  target: identity.key,
  branch: identity.branch,
  marker: identity.marker,
  existingPullRequest: duplicate,
};

if (format === "markdown") {
  if (duplicate) {
    console.log(`# BLOCKED: ${identity.key}`);
    console.log("");
    console.log(`- Existing PR: #${duplicate.number} ${duplicate.url}`);
    console.log(`- Existing branch: ${duplicate.headRefName}`);
    console.log("- Action: update or review the existing PR; do not create another PR.");
  } else {
    console.log(`# PR guard passed: ${identity.key}`);
    console.log("");
    console.log(`- Stable branch: ${identity.branch}`);
    console.log(`- Required PR body marker: \`${identity.marker}\``);
  }
} else {
  console.log(JSON.stringify(payload, null, 2));
}

if (duplicate) {
  process.exitCode = 2;
}
