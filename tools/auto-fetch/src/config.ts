import { resolve } from "node:path";
import type { LLMConfig } from "./stages/llm-parse.js";

export interface Config {
  llm: LLMConfig;
  autoMergeThreshold: number;
  dataFile: string;
  csvFile: string;
  dryRun: boolean;
  local: boolean;
  skipSearch: boolean;
  verbose: boolean;
}

const repoRoot = resolve(import.meta.dirname, "../../..");

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const provider = (process.env["LLM_PROVIDER"] ?? null) as LLMConfig["provider"];
  const defaultModel =
    provider === "ollama"
      ? "llama3.2"
      : provider === "anthropic"
        ? "claude-haiku-4-5-20251001"
        : "gpt-4o-mini";

  return {
    llm: {
      provider,
      model: process.env["LLM_MODEL"] ?? defaultModel,
      apiKey: process.env["LLM_API_KEY"] ?? null,
      baseUrl: process.env["LLM_BASE_URL"] ?? null,
    },
    autoMergeThreshold: Number(process.env["AUTO_MERGE_THRESHOLD"] ?? "1.0"),
    dataFile: resolve(repoRoot, "apps/website/public/conferences.json"),
    csvFile: resolve(repoRoot, "config/conferences.csv"),
    dryRun: false,
    local: false,
    skipSearch: false,
    verbose: false,
    ...overrides,
  };
}
