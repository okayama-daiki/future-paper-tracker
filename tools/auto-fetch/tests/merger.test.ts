import { expect, test, describe } from "vite-plus/test";
import { mergeConference, hasChanges } from "../src/merger.js";
import type { ConferencesData, Conference } from "utils";

function makeData(conferences: Conference[] = []): ConferencesData {
  return {
    generated_at: "2026-01-01T00:00:00Z",
    conference_series: [
      {
        id: "TEST",
        name: "Test Conference",
        url: "https://example.com",
        enabled: true,
        conferences,
      },
    ],
  };
}

function makeConference(overrides: Partial<Conference> = {}): Conference {
  return {
    id: "TEST-2026",
    series_id: "TEST",
    name: "Test Conference 2026",
    year: 2026,
    ordinal_no: null,
    url: "https://example.com/2026",
    venue: "Tokyo",
    start_at_utc: "2026-07-01T00:00:00Z",
    end_at_utc: "2026-07-03T23:59:59Z",
    milestones: [],
    call_for_paper: null,
    ...overrides,
  };
}

describe("mergeConference", () => {
  test("adds new conference when id not found", () => {
    const data = makeData();
    const incoming = makeConference();
    const { data: result, diffs } = mergeConference(data, incoming);

    expect(result.conference_series[0]!.conferences).toHaveLength(1);
    expect(diffs[0]!.type).toBe("add");
    expect(hasChanges(diffs)).toBe(true);
  });

  test("updates existing conference fields", () => {
    const data = makeData([makeConference({ venue: null })]);
    const incoming = makeConference({ venue: "Osaka" });
    const { data: result, diffs } = mergeConference(data, incoming);

    expect(result.conference_series[0]!.conferences[0]!.venue).toBe("Osaka");
    expect(diffs[0]!.fields).toContain("venue");
  });

  test("upgrades estimated milestone to confirmed", () => {
    const existing = makeConference({
      milestones: [
        {
          type: "submission_deadline",
          at_utc: "2026-02-01T00:00:00Z",
          source_url: "https://example.com",
          is_estimated: true,
        },
      ],
    });
    const data = makeData([existing]);
    const incoming = makeConference({
      milestones: [
        {
          type: "submission_deadline",
          at_utc: "2026-02-15T00:00:00Z",
          source_url: "https://example.com/cfp",
          is_estimated: false,
        },
      ],
    });

    const { data: result, diffs } = mergeConference(data, incoming);
    const milestone = result.conference_series[0]!.conferences[0]!.milestones[0]!;

    expect(milestone.is_estimated).toBe(false);
    expect(milestone.at_utc).toBe("2026-02-15T00:00:00Z");
    expect(diffs[0]!.milestoneDiffs[0]!.type).toBe("update");
  });

  test("does not downgrade confirmed milestone to estimated", () => {
    const existing = makeConference({
      milestones: [
        {
          type: "submission_deadline",
          at_utc: "2026-02-15T00:00:00Z",
          source_url: "https://example.com/cfp",
          is_estimated: false,
        },
      ],
    });
    const data = makeData([existing]);
    const incoming = makeConference({
      milestones: [
        {
          type: "submission_deadline",
          at_utc: "2026-02-01T00:00:00Z",
          source_url: "https://example.com",
          is_estimated: true,
        },
      ],
    });

    const { data: result } = mergeConference(data, incoming);
    const milestone = result.conference_series[0]!.conferences[0]!.milestones[0]!;

    // Should remain confirmed
    expect(milestone.is_estimated).toBe(false);
    expect(milestone.at_utc).toBe("2026-02-15T00:00:00Z");
  });

  test("returns no diffs when nothing changed", () => {
    const conference = makeConference();
    const data = makeData([conference]);
    const { diffs } = mergeConference(data, { ...conference });

    expect(hasChanges(diffs)).toBe(false);
  });

  test("adds call_for_paper when new source_url found", () => {
    const data = makeData([makeConference({ call_for_paper: null })]);
    const incoming = makeConference({
      call_for_paper: { source_url: "https://example.com/cfp", page_count: 12 },
    });

    const { data: result, diffs } = mergeConference(data, incoming);
    expect(result.conference_series[0]!.conferences[0]!.call_for_paper).not.toBeNull();
    expect(diffs[0]!.callForPaperAdded).toBe(true);
  });
});
