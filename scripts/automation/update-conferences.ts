import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  applyDeterministicConferenceUpdate,
  type ConferenceChange,
  validateConferenceData,
} from "./deterministic-update.ts";
import { checkSource } from "./source-check.ts";
import { loadSourceRegistry, resolveSeriesSources } from "./source-registry.ts";
import {
  conferencesDataPath,
  conferencesPublicPath,
  isoNowWithoutMilliseconds,
  loadConferenceConfig,
  loadConferenceData,
  repoRoot,
  selectSeriesTarget,
} from "./shared.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const outputArgument = args.find((argument) => argument.startsWith("--output="));
const maxChangesArgument = args.find((argument) => argument.startsWith("--max-changes="));
const maxChanges = Number(maxChangesArgument?.slice("--max-changes=".length) ?? "25");

if (!Number.isInteger(maxChanges) || maxChanges < 1) {
  throw new Error("--max-changes must be a positive integer.");
}

const [configSeries, conferenceData, sourceRegistry] = await Promise.all([
  loadConferenceConfig(),
  loadConferenceData(),
  loadSourceRegistry(),
]);
const dataById = new Map(conferenceData.conference_series.map((series) => [series.id, series]));
const allChanges: ConferenceChange[] = [];
const reports: Array<{
  seriesId: string;
  conferenceId: string | null;
  checkedSources: number;
  failedSources: number;
  changes: ConferenceChange[];
}> = [];

for (const config of configSeries.filter((series) => series.enabled)) {
  const dataSeries = dataById.get(config.id);
  const target = selectSeriesTarget(config, dataSeries);
  const conference = target.conference;
  if (!conference || !dataSeries) {
    reports.push({
      seriesId: config.id,
      conferenceId: null,
      checkedSources: 0,
      failedSources: 0,
      changes: [],
    });
    continue;
  }

  const sources = resolveSeriesSources(sourceRegistry, config, conference);
  const sourceResults = await mapWithConcurrency(sources, 3, (source) => checkSource(source));
  const update = applyDeterministicConferenceUpdate(conference, sourceResults);
  const conferenceIndex = dataSeries.conferences.findIndex(
    (candidate) => candidate.id === conference.id,
  );
  dataSeries.conferences[conferenceIndex] = update.conference;
  allChanges.push(...update.changes);
  reports.push({
    seriesId: config.id,
    conferenceId: conference.id,
    checkedSources: sourceResults.length,
    failedSources: sourceResults.filter((source) => !source.ok).length,
    changes: update.changes,
  });
}

if (allChanges.length > maxChanges) {
  throw new Error(
    `Refusing to apply ${allChanges.length} changes because the safety limit is ${maxChanges}.`,
  );
}

validateConferenceData(conferenceData.conference_series.flatMap((series) => series.conferences));

if (allChanges.length > 0 && !dryRun) {
  conferenceData.generated_at = isoNowWithoutMilliseconds();
  const serialized = `${JSON.stringify(conferenceData, null, 2)}\n`;
  await writeFile(conferencesDataPath, serialized, "utf8");
  await writeFile(conferencesPublicPath, serialized, "utf8");
}

const payload = {
  generatedAt: isoNowWithoutMilliseconds(),
  dryRun,
  changed: allChanges.length > 0,
  changeCount: allChanges.length,
  changes: allChanges,
  reports,
};

if (outputArgument) {
  const outputPath = path.resolve(repoRoot, outputArgument.slice("--output=".length));
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(
  `${dryRun ? "Would apply" : "Applied"} ${allChanges.length} deterministic conference changes.`,
);
for (const change of allChanges) {
  console.log(`- ${change.conferenceId}: ${change.field} (${change.sourceUrl})`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
