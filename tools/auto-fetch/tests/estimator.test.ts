import { expect, test, describe } from "vite-plus/test";
import { generateEstimated } from "../src/estimator.js";
import type { ConferenceSeries } from "utils";

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

describe("generateEstimated", () => {
  test("returns null when no past conferences have deadline milestones", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2025",
          series_id: "TEST",
          name: "Test 2025",
          year: 2025,
          ordinal_no: null,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2025-07-10T00:00:00Z",
          end_at_utc: "2025-07-12T23:59:59Z",
          milestones: [], // no deadline milestones
          call_for_paper: null,
        },
      ],
    });
    expect(generateEstimated(series)).toBeNull();
  });

  test("predicts next deadline from single past conference (annual +1 year)", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2025",
          series_id: "TEST",
          name: "Test 2025",
          year: 2025,
          ordinal_no: 1,
          url: "https://example.com",
          venue: "Tokyo",
          start_at_utc: "2025-07-10T00:00:00Z",
          end_at_utc: "2025-07-12T23:59:59Z",
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2025-02-01T23:59:59Z",
              source_url: "https://example.com/2025/cfp",
              is_estimated: false,
            },
          ],
          call_for_paper: null,
        },
      ],
    });

    const now = new Date("2025-08-01T00:00:00Z");
    const result = generateEstimated(series, now);

    expect(result).not.toBeNull();
    // Predicted anchor deadline: 2026-02-01 (1 year after 2025-02-01)
    const anchorMilestone = result!.conference.milestones.find(
      (m) => m.type === "submission_deadline",
    );
    expect(anchorMilestone).not.toBeUndefined();
    expect(anchorMilestone!.at_utc).toBe("2026-02-01T23:59:59.000Z");
    expect(anchorMilestone!.is_estimated).toBe(true);
  });

  test("conference start date is derived from deadline offset, not directly", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2025",
          series_id: "TEST",
          name: "Test 2025",
          year: 2025,
          ordinal_no: 5,
          url: "https://example.com",
          venue: null,
          // deadline: Feb 1, start: Jul 10 → offset = ~159 days
          start_at_utc: "2025-07-10T00:00:00Z",
          end_at_utc: "2025-07-12T23:59:59Z",
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2025-02-01T00:00:00Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
          ],
          call_for_paper: null,
        },
      ],
    });

    const now = new Date("2025-08-01T00:00:00Z");
    const result = generateEstimated(series, now);

    expect(result).not.toBeNull();
    // start_at_utc should be ~159 days after the predicted 2026-02-01 deadline
    expect(result!.conference.start_at_utc).not.toBeNull();
    const start = new Date(result!.conference.start_at_utc!);
    const deadline = new Date("2026-02-01T00:00:00Z");
    const offsetDays = (start.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24);
    expect(offsetDays).toBeCloseTo(159, 0);
  });

  test("returns null when predicted deadline is more than 12 months away", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2024",
          series_id: "TEST",
          name: "Test 2024",
          year: 2024,
          ordinal_no: null,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2024-07-01T00:00:00Z",
          end_at_utc: "2024-07-03T23:59:59Z",
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2024-02-01T00:00:00Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
          ],
          call_for_paper: null,
        },
      ],
    });

    // now = 2024-01-15: next deadline = 2025-02-01, more than 12 months away
    const now = new Date("2024-01-15T00:00:00Z");
    const result = generateEstimated(series, now);
    expect(result).toBeNull();
  });

  test("uses abstract_submission_deadline as anchor when present", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2025",
          series_id: "TEST",
          name: "Test 2025",
          year: 2025,
          ordinal_no: null,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2025-07-10T00:00:00Z",
          end_at_utc: null,
          milestones: [
            {
              type: "abstract_submission_deadline",
              at_utc: "2025-01-15T23:59:59Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
            {
              type: "full_paper_submission_deadline",
              at_utc: "2025-01-22T23:59:59Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
          ],
          call_for_paper: null,
        },
      ],
    });

    const now = new Date("2025-08-01T00:00:00Z");
    const result = generateEstimated(series, now);
    expect(result).not.toBeNull();

    // abstract_submission_deadline is earlier → used as anchor
    const abstractMilestone = result!.conference.milestones.find(
      (m) => m.type === "abstract_submission_deadline",
    );
    expect(abstractMilestone).not.toBeUndefined();
    expect(abstractMilestone!.at_utc).toBe("2026-01-15T23:59:59.000Z");
  });

  test("increments ordinal_no", () => {
    const series = makeSeries({
      conferences: [
        {
          id: "TEST-2025",
          series_id: "TEST",
          name: "Test 2025",
          year: 2025,
          ordinal_no: 10,
          url: "https://example.com",
          venue: null,
          start_at_utc: "2025-06-01T00:00:00Z",
          end_at_utc: null,
          milestones: [
            {
              type: "submission_deadline",
              at_utc: "2025-02-01T00:00:00Z",
              source_url: "https://example.com/cfp",
              is_estimated: false,
            },
          ],
          call_for_paper: null,
        },
      ],
    });

    const now = new Date("2025-07-01T00:00:00Z");
    const result = generateEstimated(series, now);
    expect(result).not.toBeNull();
    expect(result!.conference.ordinal_no).toBe(11);
  });
});
