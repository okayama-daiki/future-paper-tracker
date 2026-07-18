import { describe, expect, test } from "vite-plus/test";

import { applyDeterministicConferenceUpdate } from "./deterministic-update.ts";
import type { SourceCheckResult } from "./source-check.ts";
import type { Conference } from "./shared.ts";

function conference(overrides: Partial<Conference> = {}): Conference {
  return {
    id: "TEST-2027",
    series_id: "TEST",
    name: "Test Conference 2027",
    year: 2027,
    ordinal_no: null,
    url: "https://example.com/conferences",
    venue: null,
    start_at_utc: "2027-07-01T00:00:00Z",
    end_at_utc: null,
    milestones: [],
    call_for_paper: null,
    ...overrides,
  };
}

function source(overrides: Partial<SourceCheckResult> = {}): SourceCheckResult {
  return {
    id: "conference-page",
    kind: "static_html",
    role: "official",
    url: "https://example.com/2027/",
    ok: true,
    status: 200,
    contentHash: "hash",
    signals: { dateLines: [], deadlineLines: [], venueLines: [] },
    error: null,
    ...overrides,
  };
}

describe("applyDeterministicConferenceUpdate", () => {
  test("confirms an estimated AoE deadline from an official year page", () => {
    const input = conference({
      milestones: [
        {
          type: "full_paper_submission_deadline",
          at_utc: "2027-05-10T11:59:59Z",
          source_url: "https://example.com/2026/",
          is_estimated: true,
        },
      ],
    });
    const result = applyDeterministicConferenceUpdate(input, [
      source({
        signals: {
          dateLines: ["Test Conference 2027 will be held July 1-3, 2027."],
          deadlineLines: ["Full paper submission deadline: May 12, 2027 (AoE)"],
          venueLines: [],
        },
      }),
    ]);

    expect(result.conference.milestones[0]).toEqual({
      type: "full_paper_submission_deadline",
      at_utc: "2027-05-13T11:59:59.000Z",
      source_url: "https://example.com/2027/",
      is_estimated: false,
    });
    expect(result.conference.url).toBe("https://example.com/2027/");
    expect(result.conference.end_at_utc).toBe("2027-07-03T23:59:59.000Z");
  });

  test("does not use discovery sources or evidence from another year", () => {
    const input = conference({
      milestones: [
        {
          type: "submission_deadline",
          at_utc: "2027-05-10T23:59:59Z",
          source_url: "https://example.com/2026/",
          is_estimated: true,
        },
      ],
    });
    const result = applyDeterministicConferenceUpdate(input, [
      source({
        id: "discovery",
        role: "discovery",
        signals: {
          dateLines: [],
          deadlineLines: ["Submission deadline: May 12, 2027"],
          venueLines: [],
        },
      }),
      source({
        url: "https://example.com/2026/",
        signals: {
          dateLines: [],
          deadlineLines: ["Submission deadline: May 12, 2026"],
          venueLines: [],
        },
      }),
    ]);

    expect(result.changes).toHaveLength(0);
    expect(result.conference).toEqual(input);
  });

  test("skips ambiguous extended-deadline lines containing two dates", () => {
    const input = conference();
    const result = applyDeterministicConferenceUpdate(input, [
      source({
        signals: {
          dateLines: [],
          deadlineLines: [
            "Paper submission deadline: June 28, 2027, 23:59 AoE July 2, 2027, 23:59 AoE",
          ],
          venueLines: [],
        },
      }),
    ]);

    expect(result.changes).toHaveLength(0);
  });

  test("does not overwrite an existing conference date range", () => {
    const input = conference({
      start_at_utc: "2027-07-02T00:00:00Z",
      end_at_utc: "2027-07-04T23:59:59Z",
    });
    const result = applyDeterministicConferenceUpdate(input, [
      source({
        signals: {
          dateLines: ["Test Conference 2027 will be held July 1-3, 2027."],
          deadlineLines: [],
          venueLines: [],
        },
      }),
    ]);

    expect(result.conference.start_at_utc).toBe(input.start_at_utc);
    expect(result.conference.end_at_utc).toBe(input.end_at_utc);
  });

  test("converts a Japanese deadline without changing the calendar date", () => {
    const input = conference({
      milestones: [
        {
          type: "submission_deadline",
          at_utc: "2027-06-01T00:00:00Z",
          source_url: "https://example.com/2026/",
          is_estimated: true,
        },
      ],
    });
    const result = applyDeterministicConferenceUpdate(input, [
      source({
        signals: {
          dateLines: [],
          deadlineLines: ["発表申込締切：2027年6月12日 23時59分（日本時間）"],
          venueLines: [],
        },
      }),
    ]);

    expect(result.conference.milestones[0].at_utc).toBe("2027-06-12T14:59:59.000Z");
  });
});
