import { describe, expect, test } from "vite-plus/test";

import {
  decodeResponseBody,
  extractSignals,
  hasUsefulSignals,
  htmlToText,
  narrowToAliases,
  normalizeSourceText,
} from "./source-check.ts";
import { loadConferenceConfig } from "./shared.ts";
import {
  loadSourceRegistry,
  resolveSeriesSources,
  validateSourceRegistry,
} from "./source-registry.ts";

describe("source registry", () => {
  test("gives every configured series a source and maps 27 series to tcs-conf", async () => {
    const [registry, configuredSeries] = await Promise.all([
      loadSourceRegistry(),
      loadConferenceConfig(),
    ]);
    const configuredIds = new Set(configuredSeries.map((series) => series.id));
    const tcsConf = registry.sources.find((source) => source.id === "tcs-conf");

    expect(tcsConf?.series_ids).toHaveLength(27);
    expect(
      registry.sources.flatMap((source) => source.series_ids).every((id) => configuredIds.has(id)),
    ).toBe(true);
    for (const series of configuredSeries) {
      expect(resolveSeriesSources(registry, series, null)).not.toHaveLength(0);
    }
  });

  test("resolves year templates and adds precise official fallbacks", () => {
    const registry = validateSourceRegistry({
      version: 1,
      sources: [
        {
          id: "annual",
          kind: "static_html",
          role: "official",
          url_template: "https://example.com/${year}/",
          series_ids: ["EXAMPLE"],
        },
      ],
    });
    const config = {
      id: "EXAMPLE",
      name: "Example Conference",
      url: "https://example.com/",
      enabled: true,
    };
    const conference = {
      id: "EXAMPLE-2027",
      series_id: "EXAMPLE",
      name: "Example 2027",
      year: 2027,
      ordinal_no: null,
      url: "https://example.com/events/2027",
      venue: null,
      start_at_utc: null,
      end_at_utc: null,
      milestones: [],
      call_for_paper: null,
    };

    const sources = resolveSeriesSources(registry, config, conference);

    expect(sources.map((source) => source.url)).toEqual([
      "https://example.com/2027/",
      "https://example.com/events/2027",
      "https://example.com/",
    ]);
  });
});

describe("source text extraction", () => {
  test("turns HTML and WordPress JSON into readable lines", () => {
    const wordpressJson = JSON.stringify([
      {
        title: { rendered: "2026年度年会" },
        content: {
          rendered: "<p>開催日：2026年9月15日～17日</p><p>講演申込締切：2026年7月16日</p>",
        },
      },
    ]);

    const text = normalizeSourceText(wordpressJson, "wordpress_rest", "application/json");

    expect(text).toContain("開催日：2026年9月15日～17日");
    expect(text).toContain("講演申込締切：2026年7月16日");
    expect(text).not.toContain("2025-10-25T14:23:24");
  });

  test("decodes legacy Shift_JIS pages from their meta charset", () => {
    const asciiPrefix = new TextEncoder().encode('<meta charset="Shift_JIS"><p>');
    const asciiSuffix = new TextEncoder().encode("</p>");
    const bytes = new Uint8Array([
      ...asciiPrefix,
      0x8a,
      0x4a,
      0x8d,
      0xc3,
      0x93,
      0xfa,
      ...asciiSuffix,
    ]);

    expect(decodeResponseBody(bytes, "text/html")).toContain("開催日");
  });

  test("requires a signal for the target conference year", () => {
    const result = {
      id: "history",
      kind: "static_html" as const,
      role: "official" as const,
      url: "https://example.com",
      ok: true,
      status: 200,
      contentHash: "hash",
      signals: {
        dateLines: ["日程：2026年11月19日、20日"],
        deadlineLines: [],
        venueLines: [],
      },
      error: null,
    };

    expect(hasUsefulSignals(result, 2026)).toBe(true);
    expect(hasUsefulSignals(result, 2027)).toBe(false);
  });

  test("extracts deterministic date, deadline, and venue signals", () => {
    const text = htmlToText(`
      <h1>RAMP 2026</h1>
      <p>日程：2026年11月19日、20日</p>
      <p>講演申込締切：2026年8月7日</p>
      <p>会場：金沢商工会議所</p>
    `);

    const signals = extractSignals(text);

    expect(signals.dateLines).toHaveLength(2);
    expect(signals.deadlineLines).toEqual(["講演申込締切：2026年8月7日"]);
    expect(signals.venueLines).toEqual(["会場：金沢商工会議所"]);
  });

  test("narrows aggregator text to the requested conference", () => {
    const text = [
      "STOC Symposium on Theory of Computing",
      "Deadline 12 November 2026",
      "FOCS Foundations of Computer Science",
      "Deadline 20 December 2026",
    ].join("\n");

    expect(narrowToAliases(text, ["FOCS"])).toBe(
      [
        "Deadline 12 November 2026",
        "FOCS Foundations of Computer Science",
        "Deadline 20 December 2026",
      ].join("\n"),
    );
  });
});
