#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { run } from "./orchestrator.js";

function parseArgs(argv: string[]): {
  dryRun: boolean;
  local: boolean;
  series?: string;
  skipSearch: boolean;
  threshold?: number;
  dataFile?: string;
  csvFile?: string;
  verbose: boolean;
} {
  const args = argv.slice(2);
  const result = { dryRun: false, local: false, skipSearch: false, verbose: false } as ReturnType<
    typeof parseArgs
  >;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--local":
        result.local = true;
        break;
      case "--verbose":
      case "-v":
        result.verbose = true;
        break;
      case "--skip-search":
        result.skipSearch = true;
        break;
      case "--series":
        result.series = args[++i];
        break;
      case "--threshold":
        result.threshold = Number(args[++i]);
        break;
      case "--data-file":
        result.dataFile = args[++i];
        break;
      case "--csv-file":
        result.csvFile = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: auto-fetch [options]

Options:
  --dry-run           Compute changes but do not write files or create PRs
  --local             Write changes directly to local file without git/PR
  --series <id>       Process only the specified series (e.g. PODC)
  --skip-search       Skip search/crawl/LLM stages (estimation only)
  --threshold <n>     Override AUTO_MERGE_THRESHOLD (0.0–1.0)
  --data-file <path>  Path to conferences.json
  --csv-file <path>   Path to conferences.csv
  -v, --verbose       Show state for all series including skipped ones
  -h, --help          Show this help message
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const config = loadConfig({
    dryRun: args.dryRun,
    local: args.local,
    skipSearch: args.skipSearch,
    verbose: args.verbose,
    ...(args.threshold !== undefined && { autoMergeThreshold: args.threshold }),
    ...(args.dataFile && { dataFile: args.dataFile }),
    ...(args.csvFile && { csvFile: args.csvFile }),
  });

  if (args.skipSearch) {
    console.log("[cli] --skip-search: search/crawl/LLM stages will be skipped");
  }

  console.log(
    `[cli] Starting auto-fetch (dry-run=${config.dryRun}, threshold=${config.autoMergeThreshold})`,
  );

  try {
    const result = await run(config, args.series);
    console.log(`\n[cli] Done.`);
    console.log(`  Processed series: ${result.processed}`);
    console.log(`  Series with changes: ${result.changes}`);
    console.log(`  PRs created: ${result.prsCreated}`);
    if (result.errors.length > 0) {
      console.error(`  Errors (${result.errors.length}):`);
      for (const e of result.errors) {
        console.error(`    - ${e}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error("[cli] Fatal error:", err);
    process.exit(1);
  }
}

await main();
