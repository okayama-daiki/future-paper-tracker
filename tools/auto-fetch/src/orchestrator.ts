import {
  deriveLifecycleState,
  isActionable,
  readConferencesData,
  writeConferencesData,
} from "utils";
import type { ConferenceSeries } from "utils";
import type { Config } from "./config.js";
import { computeConfidence } from "./confidence.js";
import { generateEstimated } from "./estimator.js";
import { publishChanges } from "./git-pr.js";
import { hasChanges, mergeConference } from "./merger.js";
import type { ConferenceDiff } from "./merger.js";
import { crawl } from "./stages/crawl.js";
import { createLLMParser } from "./stages/llm-parse.js";
import { runAgent } from "./stages/agent.js";
import { resolve } from "node:path";

export interface RunResult {
  processed: number;
  changes: number;
  prsCreated: number;
  errors: string[];
}

export async function run(config: Config, filterSeries?: string): Promise<RunResult> {
  const data = await readConferencesData(config.dataFile);
  const llmParser = createLLMParser(config.llm);
  const now = new Date();
  const result: RunResult = { processed: 0, changes: 0, prsCreated: 0, errors: [] };

  const repoRoot = resolve(config.dataFile, "../../..");

  let currentData = data;

  for (const series of data.conference_series) {
    if (!series.enabled) continue;
    if (filterSeries && series.id !== filterSeries) continue;

    result.processed++;

    try {
      const state = deriveLifecycleState(series, now);

      if (state === "confirmed") {
        if (config.verbose) {
          console.log(`[orchestrator] ${series.id}: state=confirmed (skipped)`);
        }
        continue;
      }

      console.log(`[orchestrator] ${series.id}: state=${state}`);

      const diffs: ConferenceDiff[] = [];
      let confidence = 0;

      if (state === "unregistered" || state === "archived") {
        const estimation = generateEstimated(series, now);

        if (estimation === null) {
          if (!config.dryRun && !config.skipSearch) {
            // No past data: attempt direct crawl of series.url
            if (config.verbose) console.log(`[crawl] ${series.url}`);
            const crawled = await crawl(series.url);
            if (crawled) {
              const parsed = await llmParser.parse(crawled.textContent, series);
              if (parsed?.conference) {
                const incoming = buildConference(parsed.conference, series);
                const mergeResult = mergeConference(currentData, incoming);
                if (hasChanges(mergeResult.diffs)) {
                  confidence = computeConfidence({
                    sourceUrl: series.url,
                    seriesUrl: series.url,
                    extracted: parsed.conference,
                    llmSelfConfidence: parsed.confidence,
                  });
                  currentData = mergeResult.data;
                  diffs.push(...mergeResult.diffs);
                }
              }
            }
          } else {
            console.log(`[dry-run] ${series.id}: no past data, would crawl ${series.url}`);
          }
        } else {
          // Use estimated data
          confidence = estimation.confidence;
          const mergeResult = mergeConference(currentData, estimation.conference);
          if (hasChanges(mergeResult.diffs)) {
            currentData = mergeResult.data;
            diffs.push(...mergeResult.diffs);
          }
        }
      } else if (state === "estimated" || state === "partial") {
        // Find the target conference (the first actionable estimated/partial one)
        const targetConf = series.conferences.find((c) => isActionable(c, now));

        if (!targetConf) continue;

        if (!config.dryRun && !config.skipSearch) {
          if (config.verbose) {
            console.log(`[agent] searching for ${series.name} ${targetConf.year} call for papers`);
          }
          const agentResult = await runAgent(series, targetConf, config.llm);
          if (agentResult) {
            if (config.verbose) {
              console.log(`[agent] visited ${agentResult.sourcesVisited.length} page(s)`);
            }
            const incoming = buildConference(agentResult.conference, series, targetConf);
            const mergeResult = mergeConference(currentData, incoming);
            if (hasChanges(mergeResult.diffs)) {
              const primarySource = agentResult.sourcesVisited[0] ?? series.url;
              confidence = computeConfidence({
                sourceUrl: primarySource,
                seriesUrl: series.url,
                extracted: agentResult.conference,
                llmSelfConfidence: agentResult.confidence,
                agreementCount: agentResult.sourcesVisited.length,
              });
              currentData = mergeResult.data;
              diffs.push(...mergeResult.diffs);
            }
          }
        } else {
          console.log(
            `[dry-run] ${series.id}: would search for "${series.name} ${targetConf.year} call for papers"`,
          );
        }
      }

      if (diffs.length > 0) {
        result.changes++;
        const conferenceId = diffs[0]!.conferenceId;

        // Update generated_at
        currentData = { ...currentData, generated_at: new Date().toISOString() };

        if (!config.dryRun) {
          await writeConferencesData(config.dataFile, currentData);
          if (config.local) {
            console.log(
              `[local] ${series.id}: wrote ${diffs.length} change(s) to ${config.dataFile}`,
            );
          } else {
            await publishChanges({
              conferenceId,
              dataFilePath: config.dataFile,
              repoRoot,
              confidence,
              autoMergeThreshold: config.autoMergeThreshold,
              diffs,
              dryRun: false,
            });
            result.prsCreated++;
          }
        } else {
          console.log(
            `[dry-run] ${series.id}: ${diffs.length} change(s), confidence=${confidence.toFixed(2)}`,
          );
          for (const d of diffs) {
            console.log(`  - ${d.conferenceId} (${d.type}): fields=[${d.fields.join(",")}]`);
          }
        }
      }
    } catch (err) {
      const msg = `${series.id}: ${String(err)}`;
      console.error(`[orchestrator] Error processing ${msg}`);
      result.errors.push(msg);
    }
  }

  return result;
}

import type { Conference } from "utils";

function buildConference(
  partial: Partial<Conference>,
  series: ConferenceSeries,
  existing?: Conference,
): Conference {
  const base = existing ?? {
    id: `${series.id}-${partial.year ?? new Date().getFullYear()}`,
    series_id: series.id,
    name: `${series.name} ${partial.year ?? ""}`.trim(),
    year: partial.year ?? new Date().getFullYear(),
    ordinal_no: null,
    url: series.url,
    venue: null,
    start_at_utc: null,
    end_at_utc: null,
    milestones: [],
    call_for_paper: null,
  };

  return {
    ...base,
    ...partial,
    id: base.id,
    series_id: base.series_id,
    milestones: partial.milestones ?? base.milestones,
  };
}
