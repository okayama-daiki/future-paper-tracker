import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Conference, ConferenceSeries } from "utils";

// ---------------------------------------------------------------------------
// Zod schema for extracted Conference data (partial — all fields optional)
// ---------------------------------------------------------------------------

export const MilestoneSchema = z.object({
  type: z.enum([
    "abstract_submission_deadline",
    "full_paper_submission_deadline",
    "submission_deadline",
    "notification",
    "phase1_notification",
    "camera_ready",
    "registration_deadline",
  ]),
  at_utc: z.string().describe("ISO 8601 UTC datetime, e.g. 2026-02-17T11:59:59Z"),
  source_url: z.string().url(),
});

export const CallForPaperSchema = z.object({
  source_url: z.string().url(),
  page_count: z.number().int().positive().nullable(),
});

export const ExtractedConferenceSchema = z.object({
  name: z.string().optional(),
  year: z.number().int().optional(),
  ordinal_no: z.number().int().nullable().optional(),
  url: z.string().url().optional(),
  venue: z.string().nullable().optional(),
  start_at_utc: z.string().nullable().optional(),
  end_at_utc: z.string().nullable().optional(),
  milestones: z.array(MilestoneSchema).optional(),
  call_for_paper: CallForPaperSchema.nullable().optional(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Your confidence in the accuracy of the extracted data (0.0–1.0)"),
});

type ExtractedConference = z.infer<typeof ExtractedConferenceSchema>;

// ---------------------------------------------------------------------------
// LLMParser interface
// ---------------------------------------------------------------------------

export interface ParsedConference {
  conference: Partial<Conference>;
  confidence: number;
}

export interface LLMParser {
  parse(
    text: string,
    series: ConferenceSeries,
    existing?: Conference,
  ): Promise<ParsedConference | null>;
}

// ---------------------------------------------------------------------------
// Vercel AI SDK implementation
// ---------------------------------------------------------------------------

export class AISdkLLMParser implements LLMParser {
  private readonly model: Parameters<typeof generateObject>[0]["model"];

  constructor(model: Parameters<typeof generateObject>[0]["model"]) {
    this.model = model;
  }

  async parse(
    text: string,
    series: ConferenceSeries,
    existing?: Conference,
  ): Promise<ParsedConference | null> {
    const prompt = buildPrompt(text, series, existing);

    let extracted: ExtractedConference;
    try {
      const result = await generateObject({
        model: this.model,
        schema: ExtractedConferenceSchema,
        prompt,
      });
      extracted = result.object;
    } catch (err) {
      console.warn(`[llm-parse] generateObject failed: ${String(err)}`);
      return null;
    }

    const { confidence, ...fields } = extracted;

    const conference: Partial<Conference> = {
      ...(fields.name && { name: fields.name }),
      ...(fields.year && { year: fields.year }),
      ...(fields.ordinal_no !== undefined && { ordinal_no: fields.ordinal_no }),
      ...(fields.url && { url: fields.url }),
      ...(fields.venue !== undefined && { venue: fields.venue }),
      ...(fields.start_at_utc !== undefined && { start_at_utc: fields.start_at_utc }),
      ...(fields.end_at_utc !== undefined && { end_at_utc: fields.end_at_utc }),
      ...(fields.milestones && {
        milestones: fields.milestones.map((m) => ({
          ...m,
          is_estimated: false,
        })),
      }),
      ...(fields.call_for_paper !== undefined && { call_for_paper: fields.call_for_paper }),
    };

    return { conference, confidence };
  }
}

function buildPrompt(text: string, series: ConferenceSeries, existing?: Conference): string {
  const lines: string[] = [
    `You are extracting structured conference information for "${series.name}" from the following web page content.`,
    `Conference series URL: ${series.url}`,
    "",
    "Extract all available information: conference name, year, ordinal number (e.g. 45th),",
    "venue, conference dates, submission deadlines, notification dates, camera-ready deadlines,",
    "registration deadlines, and call-for-papers URL.",
    "",
    "For dates, use ISO 8601 UTC format (e.g. 2026-02-17T11:59:59Z).",
    "If a field is not present in the text, omit it.",
    "Set confidence to how certain you are about the accuracy of your extraction (0.0–1.0).",
  ];

  if (existing) {
    lines.push("", "Existing known data for reference (update/confirm if you find newer info):");
    lines.push(JSON.stringify(existing, null, 2));
  }

  lines.push("", "--- Page Content ---", text.slice(0, 8000));

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface LLMConfig {
  provider: "ollama" | "anthropic" | "openai" | null;
  model: string;
  apiKey?: string | null;
  baseUrl?: string | null;
}

export function createLLMParser(config: LLMConfig): LLMParser {
  const { provider, model, apiKey, baseUrl } = config;

  switch (provider) {
    case "ollama": {
      // Ollama exposes an OpenAI-compatible API at /v1
      const ollamaProvider = createOpenAI({
        baseURL: (baseUrl ?? "http://localhost:11434") + "/v1",
        apiKey: "ollama",
      });
      return new AISdkLLMParser(ollamaProvider(model));
    }

    case "anthropic": {
      if (!apiKey) throw new Error("LLM_API_KEY is required for Anthropic provider");
      const anthropicProvider = createAnthropic({ apiKey });
      return new AISdkLLMParser(anthropicProvider(model));
    }

    case "openai": {
      if (!apiKey) throw new Error("LLM_API_KEY is required for OpenAI provider");
      const openaiProvider = createOpenAI({
        apiKey,
        ...(baseUrl && { baseURL: baseUrl }),
      });
      return new AISdkLLMParser(openaiProvider(model));
    }

    case null:
    default:
      console.warn("[llm-parse] No LLM provider configured. Set LLM_PROVIDER.");
      return new PlaceholderLLMParser();
  }
}

// ---------------------------------------------------------------------------
// No-op placeholder
// ---------------------------------------------------------------------------

class PlaceholderLLMParser implements LLMParser {
  async parse(): Promise<ParsedConference | null> {
    return null;
  }
}
