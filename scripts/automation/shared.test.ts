import { describe, expect, test } from "vite-plus/test";

import { buildBranchName, resolveAutomationTarget, selectSeriesTarget } from "./shared.ts";

const configSeries = [
  {
    id: "PODC",
    name: "ACM Symposium on Principles of Distributed Computing",
    url: "https://example.com",
    enabled: true,
  },
];

const conferenceData = {
  generated_at: "2026-04-26T00:00:00Z",
  conference_series: [
    {
      id: "PODC",
      name: "ACM Symposium on Principles of Distributed Computing",
      url: "https://example.com",
      enabled: true,
      conferences: [
        {
          id: "PODC-2027",
          series_id: "PODC",
          name: "PODC 2027",
          year: 2027,
          ordinal_no: 46,
          url: "https://example.com/podc-2027",
          venue: null,
          start_at_utc: "2027-07-06T00:00:00Z",
          end_at_utc: null,
          milestones: [
            {
              type: "full_paper_submission_deadline",
              at_utc: "2027-02-17T11:59:59Z",
              source_url: "https://example.com/cfp",
              is_estimated: true,
            },
          ],
          call_for_paper: null,
        },
        {
          id: "PODC-2026",
          series_id: "PODC",
          name: "PODC 2026",
          year: 2026,
          ordinal_no: 45,
          url: "https://example.com/podc-2026",
          venue: "London",
          start_at_utc: "2026-07-06T00:00:00Z",
          end_at_utc: "2026-07-10T23:59:59Z",
          milestones: [],
          call_for_paper: {
            source_url: "https://example.com/cfp",
            page_count: null,
          },
        },
      ],
    },
  ],
};

describe("selectSeriesTarget", () => {
  test("returns missing_series_in_data when series is missing from the JSON data", () => {
    const target = selectSeriesTarget(
      {
        id: "PODC",
        name: "PODC",
        url: "https://example.com",
        enabled: true,
      },
      null,
      new Date("2026-04-26T00:00:00Z"),
    );

    expect(target.status).toBe("missing_series_in_data");
    expect(target.conference).toBeNull();
  });

  test("prefers estimated conferences over other candidates", () => {
    const target = selectSeriesTarget(
      {
        id: "PODC",
        name: "PODC",
        url: "https://example.com",
        enabled: true,
      },
      {
        id: "PODC",
        name: "PODC",
        url: "https://example.com",
        enabled: true,
        conferences: [
          {
            id: "PODC-2027",
            series_id: "PODC",
            name: "PODC 2027",
            year: 2027,
            ordinal_no: 46,
            url: "https://example.com/podc-2027",
            venue: null,
            start_at_utc: "2027-07-06T00:00:00Z",
            end_at_utc: null,
            milestones: [
              {
                type: "full_paper_submission_deadline",
                at_utc: "2027-02-17T11:59:59Z",
                source_url: "https://example.com/cfp",
                is_estimated: true,
              },
            ],
            call_for_paper: null,
          },
          {
            id: "PODC-2026",
            series_id: "PODC",
            name: "PODC 2026",
            year: 2026,
            ordinal_no: 45,
            url: "https://example.com/podc-2026",
            venue: "London",
            start_at_utc: "2026-07-06T00:00:00Z",
            end_at_utc: "2026-07-10T23:59:59Z",
            milestones: [],
            call_for_paper: {
              source_url: "https://example.com/cfp",
              page_count: null,
            },
          },
        ],
      },
      new Date("2026-04-26T00:00:00Z"),
    );

    expect(target.status).toBe("estimated_conference");
    expect(target.conference?.id).toBe("PODC-2027");
  });
});

describe("buildBranchName", () => {
  test("builds a stable branch name from series, conference, and timestamp", () => {
    const branchName = buildBranchName("PODC", "PODC-2027", new Date("2026-04-26T08:57:50Z"));

    expect(branchName).toBe("automation/podc/podc-2027-20260426T085750z");
  });
});

describe("resolveAutomationTarget", () => {
  test("resolves a series id to that series' selected conference target", () => {
    const resolved = resolveAutomationTarget(configSeries, conferenceData, "PODC");

    expect(resolved?.inputKind).toBe("series");
    expect(resolved?.series.id).toBe("PODC");
    expect(resolved?.target.conference?.id).toBe("PODC-2027");
  });

  test("resolves a full series name to that series' selected conference target", () => {
    const resolved = resolveAutomationTarget(
      configSeries,
      conferenceData,
      "ACM Symposium on Principles of Distributed Computing",
    );

    expect(resolved?.inputKind).toBe("series");
    expect(resolved?.target.conference?.id).toBe("PODC-2027");
  });

  test("resolves a conference id directly", () => {
    const resolved = resolveAutomationTarget(configSeries, conferenceData, "PODC-2026");

    expect(resolved?.inputKind).toBe("conference");
    expect(resolved?.series.id).toBe("PODC");
    expect(resolved?.target.conference?.id).toBe("PODC-2026");
  });
});
