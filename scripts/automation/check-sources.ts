import { writeFile } from "node:fs/promises";
import path from "node:path";

import { checkSource, hasUsefulSignals } from "./source-check.ts";
import { loadSourceRegistry, resolveSeriesSources } from "./source-registry.ts";
import {
  isoNowWithoutMilliseconds,
  loadConferenceConfig,
  loadConferenceData,
  repoRoot,
  resolveAutomationTarget,
  selectSeriesTarget,
  type Conference,
  type ConferenceSeriesConfig,
} from "./shared.ts";

interface SeriesSourceReport {
  seriesId: string;
  conferenceId: string | null;
  checkedAt: string;
  needsAiFallback: boolean;
  sources: Awaited<ReturnType<typeof checkSource>>[];
}

const args = process.argv.slice(2);
const positionalInput = args.find((argument) => !argument.startsWith("--"));
const checkAll = args.includes("--all");
const markdown = args.includes("--markdown");
const outputArgument = args.find((argument) => argument.startsWith("--output="));

if (!checkAll && !positionalInput) {
  console.error(
    "Usage: vp run automation:check-sources -- <SERIES_ID_OR_CONFERENCE_ID> [--markdown] [--output=PATH]\n" +
      "       vp run automation:check-sources -- --all [--markdown] [--output=PATH]",
  );
  process.exit(1);
}

const [configSeries, conferenceData, sourceRegistry] = await Promise.all([
  loadConferenceConfig(),
  loadConferenceData(),
  loadSourceRegistry(),
]);
const configById = new Map(configSeries.map((series) => [series.id, series]));

const targets: Array<{ config: ConferenceSeriesConfig; conference: Conference | null }> = [];
if (checkAll) {
  const dataById = new Map(conferenceData.conference_series.map((series) => [series.id, series]));
  for (const config of configSeries.filter((series) => series.enabled)) {
    const target = selectSeriesTarget(config, dataById.get(config.id));
    targets.push({ config, conference: target.conference });
  }
} else if (positionalInput) {
  const resolved = resolveAutomationTarget(configSeries, conferenceData, positionalInput);
  if (!resolved) {
    console.error(`Unknown automation target: ${positionalInput}`);
    process.exit(1);
  }
  const config = configById.get(resolved.series.id);
  if (!config) {
    throw new Error(`Missing config for ${resolved.series.id}`);
  }
  targets.push({ config, conference: resolved.target.conference });
}

const reports = await mapWithConcurrency(targets, 4, async ({ config, conference }) => {
  const sources = resolveSeriesSources(sourceRegistry, config, conference);
  const results = await mapWithConcurrency(sources, 3, (source) => checkSource(source));
  const targetYear = conference?.year ?? new Date().getUTCFullYear();
  return {
    seriesId: config.id,
    conferenceId: conference?.id ?? null,
    checkedAt: isoNowWithoutMilliseconds(),
    needsAiFallback: !results.some((result) => hasUsefulSignals(result, targetYear)),
    sources: results,
  } satisfies SeriesSourceReport;
});

const payload = {
  generatedAt: isoNowWithoutMilliseconds(),
  reports,
};

if (outputArgument) {
  const outputPath = path.resolve(repoRoot, outputArgument.slice("--output=".length));
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

if (markdown) {
  printMarkdown(reports);
} else if (outputArgument) {
  console.log(
    `Wrote ${reports.length} source reports to ${outputArgument.slice("--output=".length)}`,
  );
} else {
  console.log(JSON.stringify(payload, null, 2));
}

function printMarkdown(reportsToPrint: SeriesSourceReport[]): void {
  const deterministicCount = reportsToPrint.filter((report) => !report.needsAiFallback).length;
  console.log("# Conference source check");
  console.log("");
  console.log(`- Deterministic evidence found: ${deterministicCount}/${reportsToPrint.length}`);
  console.log(
    `- Fallback needed: ${reportsToPrint.length - deterministicCount}/${reportsToPrint.length}`,
  );
  console.log("");
  for (const report of reportsToPrint) {
    console.log(`## ${report.conferenceId ?? report.seriesId}`);
    console.log(`- AI fallback: ${report.needsAiFallback ? "needed" : "not needed"}`);
    for (const source of report.sources) {
      const status = source.ok ? `HTTP ${source.status}` : `failed: ${source.error}`;
      console.log(`- ${source.id} (${source.kind}, ${source.role}): ${status}`);
      for (const line of source.signals.deadlineLines.slice(0, 3)) {
        console.log(`  - Deadline: ${line}`);
      }
      for (const line of source.signals.dateLines
        .filter((candidate) => !source.signals.deadlineLines.includes(candidate))
        .slice(0, 3)) {
        console.log(`  - Date: ${line}`);
      }
    }
    console.log("");
  }
}

async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  concurrency: number,
  operation: (input: Input) => Promise<Output>,
): Promise<Output[]> {
  const output: Output[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await operation(inputs[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
  return output;
}
