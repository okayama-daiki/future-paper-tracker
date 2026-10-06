import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { loadFilterPreferences, saveFilterPreferences } from "./filterPreferences.ts";
import type { FilterPreferences } from "./filterPreferences.ts";
import { ALL_GENRES } from "./genres.ts";

function cookie(value: unknown): string {
  return `fpt_filters=${encodeURIComponent(JSON.stringify(value))}`;
}

function expectDefaults() {
  const preferences = loadFilterPreferences();
  expect(preferences.genreFilter).toEqual(new Set(ALL_GENRES));
  expect(preferences.milestoneFilter).toEqual(
    new Set([
      "abstract_submission_deadline",
      "full_paper_submission_deadline",
      "submission_deadline",
    ]),
  );
}

describe("filter preferences", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("window", { location: { protocol: "http:" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("defaults to every genre and Abstract, Full Paper, Submission without a saved cookie", () => {
    expectDefaults();
  });

  test("restores both selections from the named cookie among other cookies", () => {
    document.cookie = `other=value; fpt_filters_old=ignored; ${cookie({
      version: 2,
      genres: ["geometry", "or_ai"],
      types: ["full_paper_submission_deadline", "notification"],
    })}`;
    const preferences = loadFilterPreferences();
    expect(preferences.genreFilter).toEqual(new Set(["geometry", "or_ai"]));
    expect(preferences.milestoneFilter).toEqual(
      new Set(["full_paper_submission_deadline", "notification"]),
    );
  });

  test("round-trips cleared selections instead of replacing them with defaults", () => {
    const cleared: FilterPreferences = { genreFilter: new Set(), milestoneFilter: new Set() };
    saveFilterPreferences(cleared);
    expect(loadFilterPreferences()).toEqual(cleared);
    expect(document.cookie).toContain("; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(document.cookie).not.toContain("Secure");
  });

  test("migrates the previous taxonomy while preserving milestone choices", () => {
    document.cookie = cookie({
      version: 1,
      genres: ["optimization", "ai", "symbolic", "distributed"],
      types: ["notification"],
    });
    const preferences = loadFilterPreferences();
    expect(preferences.genreFilter).toEqual(new Set(["distributed", "algorithms", "or_ai"]));
    expect(preferences.milestoneFilter).toEqual(new Set(["notification"]));
    saveFilterPreferences(preferences);
    expect(loadFilterPreferences()).toEqual(preferences);
    const value = document.cookie.split(";")[0].slice("fpt_filters=".length);
    expect(JSON.parse(decodeURIComponent(value)).version).toBe(2);
  });

  test("maps applied mathematics to theory and OR / AI", () => {
    document.cookie = cookie({ version: 1, genres: ["applied_math"], types: [] });
    expect(loadFilterPreferences().genreFilter).toEqual(new Set(["algorithms", "or_ai"]));
  });

  test("keeps the general information science selection inclusive", () => {
    document.cookie = cookie({ version: 1, genres: ["general"], types: [] });
    expect(loadFilterPreferences().genreFilter).toEqual(new Set(ALL_GENRES));
  });

  test("preserves clear-all selections from the previous cookie version", () => {
    document.cookie = cookie({ version: 1, genres: [], types: [] });
    expect(loadFilterPreferences()).toEqual({ genreFilter: new Set(), milestoneFilter: new Set() });
  });

  test.each([
    "fpt_filters=%invalid",
    "fpt_filters=invalid-json",
    cookie(null),
    cookie({ version: 3, genres: [], types: [] }),
    cookie({ version: 2, genres: "all", types: [null] }),
  ])("uses defaults for an unreadable or incompatible cookie: %s", (value) => {
    document.cookie = value;
    expectDefaults();
  });

  test("ignores obsolete options and uses defaults if a nonempty selection is entirely invalid", () => {
    document.cookie = cookie({
      version: 2,
      genres: ["or_ai", "obsolete-genre"],
      types: ["obsolete-type"],
    });
    const preferences = loadFilterPreferences();
    expect(preferences.genreFilter).toEqual(new Set(["or_ai"]));
    expect(preferences.milestoneFilter).toEqual(
      new Set([
        "abstract_submission_deadline",
        "full_paper_submission_deadline",
        "submission_deadline",
      ]),
    );
  });

  test("uses secure partitioned cookies for HTTPS iframe preferences", () => {
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    const preferences = loadFilterPreferences();
    saveFilterPreferences(preferences);
    expect(document.cookie).toContain("; SameSite=None; Secure; Partitioned");
    expect(loadFilterPreferences()).toEqual(preferences);
  });

  test("keeps the app usable when cookie reads or writes are blocked", () => {
    vi.stubGlobal("document", {
      get cookie(): string {
        throw new Error("Cookie access blocked");
      },
      set cookie(_value: string) {
        throw new Error("Cookie access blocked");
      },
    });
    expectDefaults();
    expect(() => saveFilterPreferences(loadFilterPreferences())).not.toThrow();
  });
});
