import { describe, expect, test } from "vite-plus/test";
import conferenceJson from "../public/conferences.json?raw";
import { ALL_GENRES, filterByGenre, getAvailableGenres, getSeriesGenres } from "./genres.ts";
import type { ConferencesData, DeadlineRow, MilestoneType } from "./types.ts";
import { buildRows } from "./utils.ts";

const data = JSON.parse(conferenceJson) as ConferencesData;
const sample = buildRows(data)[0];

function row(
  seriesId: string,
  type: MilestoneType = "full_paper_submission_deadline",
): DeadlineRow {
  return {
    ...sample,
    seriesId,
    conference: { ...sample.conference, id: `${seriesId}-2027`, series_id: seriesId },
    milestone: { ...sample.milestone, type },
  };
}

describe("conference genres", () => {
  test("offers the four agreed research genres for the current data", () => {
    expect(getAvailableGenres(buildRows(data))).toEqual([
      "geometry",
      "distributed",
      "algorithms",
      "or_ai",
    ]);
    expect(getSeriesGenres("ISSAC")).toEqual(["algorithms"]);
    expect(getSeriesGenres("CPAIOR")).toEqual(["or_ai"]);
    expect(getSeriesGenres("AAAI")).toEqual(["or_ai"]);
  });

  test("classifies every currently enabled series", () => {
    for (const series of data.conference_series.filter((series) => series.enabled)) {
      expect(getSeriesGenres(series.id), series.id).not.toContain("unclassified");
    }
  });

  test("preserves all deadlines when every available genre is selected, including new series", () => {
    const rows = [row("STOC"), row("NEW-SERIES"), row("IPCO")];
    expect(filterByGenre(rows, new Set(getAvailableGenres(rows)))).toEqual(rows);
    expect(filterByGenre(rows, new Set(ALL_GENRES))).toEqual(rows);
  });

  test("shows no deadlines when every genre is unchecked", () => {
    expect(filterByGenre([row("STOC"), row("NEW-SERIES"), row("IPCO")], new Set())).toEqual([]);
  });

  test("matches any selected genre without duplicating milestones from overlapping genres", () => {
    const abstract = row("SoCG", "abstract_submission_deadline");
    const fullPaper = row("SoCG");
    const theory = row("STOC");
    const geometry = row("CCCG");
    const rows = [theory, abstract, row("AAAI"), geometry, fullPaper];

    expect(filterByGenre(rows, new Set(["geometry", "algorithms"]))).toEqual([
      theory,
      abstract,
      geometry,
      fullPaper,
    ]);
  });

  test("keeps unclassified series discoverable and filterable", () => {
    const unclassified = row("NEW-SERIES");
    const rows = [row("STOC"), unclassified];

    expect(getAvailableGenres(rows)).toEqual(["algorithms", "unclassified"]);
    expect(filterByGenre(rows, new Set(["unclassified"]))).toEqual([unclassified]);
  });
});
