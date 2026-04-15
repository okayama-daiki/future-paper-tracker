import { generateText, stepCountIs, tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Conference, ConferenceSeries } from "utils";
import type { LLMConfig } from "./llm-parse.js";
import { ExtractedConferenceSchema } from "./llm-parse.js";
import { crawl } from "./crawl.js";
import { searchDuckDuckGo } from "./search.js";

export interface AgentResult {
  conference: Partial<Conference>;
  confidence: number;
  /** URLs the agent fetched (used for confidence scoring) */
  sourcesVisited: string[];
}

/**
 * Runs an agentic loop that searches, crawls, and extracts conference data.
 * Replaces the manual search → crawl → llm-parse loop in the orchestrator.
 */
export async function runAgent(
  series: ConferenceSeries,
  targetConf: Conference,
  llmConfig: LLMConfig,
): Promise<AgentResult | null> {
  const model = createModel(llmConfig);
  if (!model) return null;

  const sourcesVisited: string[] = [];
  let submittedConference: Partial<Conference> | null = null;
  let llmConfidence = 0;

  await generateText({
    model,
    stopWhen: stepCountIs(10),
    system: [
      `You are a research assistant gathering call-for-papers information for "${series.name}".`,
      `Your goal is to find confirmed dates for the ${targetConf.year} edition.`,
      `Conference series URL: ${series.url}`,
      "",
      "Steps:",
      "1. Search for the call for papers page using search_web.",
      "2. Fetch the most relevant pages using fetch_page.",
      "3. Once you have enough information, call submit_conference_data with the extracted data.",
      "4. If a field is not found in the pages, omit it.",
      "5. Set confidence to how certain you are (0.0–1.0).",
    ].join("\n"),
    prompt: `Find call for papers information for ${series.name} ${targetConf.year}.`,
    tools: {
      search_web: tool({
        description: "Search the web for conference information",
        inputSchema: z.object({
          query: z.string().describe("The search query"),
        }),
        execute: async (input) => {
          const results = await searchDuckDuckGo(input.query);
          return results.map((r) => ({ url: r.url, title: r.title, snippet: r.snippet }));
        },
      }),

      fetch_page: tool({
        description: "Fetch and extract the readable text content of a web page",
        inputSchema: z.object({
          url: z.string().url().describe("The URL to fetch"),
        }),
        execute: async (input) => {
          sourcesVisited.push(input.url);
          const result = await crawl(input.url);
          if (!result) return "Failed to fetch the page.";
          return result.textContent.slice(0, 8000);
        },
      }),

      submit_conference_data: tool({
        description:
          "Submit the extracted conference data. Call this once you have gathered enough information.",
        inputSchema: ExtractedConferenceSchema,
        execute: async (data) => {
          const { confidence, ...fields } = data;
          llmConfidence = confidence;
          submittedConference = {
            ...(fields.name && { name: fields.name }),
            ...(fields.year && { year: fields.year }),
            ...(fields.ordinal_no !== undefined && { ordinal_no: fields.ordinal_no }),
            ...(fields.url && { url: fields.url }),
            ...(fields.venue !== undefined && { venue: fields.venue }),
            ...(fields.start_at_utc !== undefined && { start_at_utc: fields.start_at_utc }),
            ...(fields.end_at_utc !== undefined && { end_at_utc: fields.end_at_utc }),
            ...(fields.milestones && {
              milestones: fields.milestones.map((m) => ({ ...m, is_estimated: false })),
            }),
            ...(fields.call_for_paper !== undefined && { call_for_paper: fields.call_for_paper }),
          };
          return "Data submitted successfully.";
        },
      }),
    },
  });

  if (!submittedConference) return null;
  return { conference: submittedConference, confidence: llmConfidence, sourcesVisited };
}

function createModel(config: LLMConfig): Parameters<typeof generateText>[0]["model"] | null {
  const { provider, model, apiKey, baseUrl } = config;

  switch (provider) {
    case "anthropic": {
      if (!apiKey) throw new Error("LLM_API_KEY is required for Anthropic provider");
      return createAnthropic({ apiKey })(model);
    }
    case "openai": {
      if (!apiKey) throw new Error("LLM_API_KEY is required for OpenAI provider");
      return createOpenAI({ apiKey, ...(baseUrl && { baseURL: baseUrl }) })(model);
    }
    case "ollama": {
      return createOpenAI({
        baseURL: (baseUrl ?? "http://localhost:11434") + "/v1",
        apiKey: "ollama",
      })(model);
    }
    default:
      return null;
  }
}
