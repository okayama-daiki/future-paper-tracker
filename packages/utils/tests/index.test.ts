import { expect, test, describe } from "vite-plus/test";
import { deriveLifecycleState, parseConferencesCSV } from "../src";
import type { ConferenceSeries } from "../src";

function makeSeries(overrides: Partial<ConferenceSeries> = {}): ConferenceSeries {
  return {
    id: "TEST",
    name: "Test Conference",
    url: "https://example.com",
    enabled: true,
    conferences: [],
    ...overrides,
  };
}

describe("deriveLifecycleState", () => {
  const now = new Date("2026-04-01T00:00:00Z");

  test("unregistered when no future conferences", () => {
    const series = makeSeries();
    expect(deriveLifecycleState(series, now)).toBe("unregistered");
  });

  test("estimated when all milestones are estimated", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2026",
          series_id: "TEST",
          name: "Test 2026",
          year: 2026,
          ordinal_no: null,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2026-07-01T00:00:00Z",
          end_at_utc: "2026-07-03T23:59:59Z",
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2026-02-01T00:00:00Z",
              source_url: "https://example.com",
              is_estimated: true,
            },
          ],
          call_for_paper: null,
        },
      ],
    });
    expect(deriveLifecycleState(series, now)).toBe("estimated");
  });

  test("partial when some milestones are estimated", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2026",
          series_id: "TEST",
          name: "Test 2026",
          year: 2026,
          ordinal_no: null,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2026-07-01T00:00:00Z",
          end_at_utc: "2026-07-03T23:59:59Z",
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2026-02-01T00:00:00Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
            {
              type: "notification",
              at_utc: "2026-04-15T00:00:00Z",
              source_url: "https://example.com",
              is_estimated: true,
            },
          ],
          call_for_paper: null,
        },
      ],
    });
    expect(deriveLifecycleState(series, now)).toBe("partial");
  });

  test("confirmed when all milestones are confirmed", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2026",
          series_id: "TEST",
          name: "Test 2026",
          year: 2026,
          ordinal_no: null,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2026-07-01T00:00:00Z",
          end_at_utc: "2026-07-03T23:59:59Z",
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2026-02-01T00:00:00Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
          ],
          call_for_paper: null,
        },
      ],
    });
    expect(deriveLifecycleState(series, now)).toBe("confirmed");
  });
});

describe("parseConferencesCSV", () => {
  test("parses basic CSV", () => {
    const csv = `id,name,url,enabled
STOC,ACM Symposium on Theory of Computing,https://acm-stoc.org,true
FOCS,The IEEE Symposium on Foundations of Computer Science,https://focs.computer.org/,false`;

    const result = parseConferencesCSV(csv);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("STOC");
    expect(result[0]!.enabled).toBe(true);
    expect(result[1]!.id).toBe("FOCS");
    expect(result[1]!.enabled).toBe(false);
  });

  test("parses quoted fields", () => {
    const csv = `id,name,url,enabled
APPROX,"International Conference on Approximation Algorithms, Problems",https://approx.com,true`;

    const result = parseConferencesCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("International Conference on Approximation Algorithms, Problems");
  });
});
