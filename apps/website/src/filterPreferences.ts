import { ALL_GENRES } from "./genres.ts";
import type { GenreFilter, MilestoneFilter, MilestoneType } from "./types.ts";
import { DEFAULT_MILESTONE_FILTER, MILESTONE_LABELS } from "./utils.ts";

export interface FilterPreferences {
  genreFilter: GenreFilter;
  milestoneFilter: MilestoneFilter;
}

const COOKIE_NAME = "fpt_filters";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const ALL_TYPES = Object.keys(MILESTONE_LABELS) as MilestoneType[];

function defaultPreferences(): FilterPreferences {
  return {
    genreFilter: new Set(ALL_GENRES),
    milestoneFilter: new Set(DEFAULT_MILESTONE_FILTER),
  };
}

function restoreSelection<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: ReadonlySet<T>,
): Set<T> {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return new Set(fallback);
  }
  const selected = options.filter((option) => value.includes(option));
  // An explicit empty array is a saved "clear all" selection.
  if (value.length > 0 && selected.length === 0) return new Set(fallback);
  return new Set(selected);
}

function migrateGenres(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.flatMap((genre: unknown): unknown[] => {
    switch (genre) {
      case "optimization":
      case "ai":
        return ["or_ai"];
      case "symbolic":
        return ["algorithms"];
      case "applied_math":
        return ["algorithms", "or_ai"];
      case "general":
        return ALL_GENRES;
      default:
        return [genre];
    }
  });
}

export function loadFilterPreferences(): FilterPreferences {
  const defaults = defaultPreferences();
  try {
    const entry = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
    if (!entry) return defaults;

    const parsed: unknown = JSON.parse(decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)));
    if (typeof parsed !== "object" || parsed === null) return defaults;
    const saved = parsed as Record<string, unknown>;
    if (saved.version !== 1 && saved.version !== 2) return defaults;
    const genres = saved.version === 1 ? migrateGenres(saved.genres) : saved.genres;

    return {
      genreFilter: restoreSelection(genres, ALL_GENRES, defaults.genreFilter),
      milestoneFilter: restoreSelection(saved.types, ALL_TYPES, defaults.milestoneFilter),
    };
  } catch {
    return defaults;
  }
}

export function saveFilterPreferences(preferences: FilterPreferences): void {
  try {
    const value = encodeURIComponent(
      JSON.stringify({
        version: 2,
        genres: [...preferences.genreFilter],
        types: [...preferences.milestoneFilter],
      }),
    );
    // Partitioned cookies retain iframe preferences separately for each embedding site.
    const attributes =
      window.location.protocol === "https:"
        ? "; SameSite=None; Secure; Partitioned"
        : "; SameSite=Lax";
    document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}${attributes}`;
  } catch {
    // Cookie restrictions must not prevent changing the filters on the current page.
  }
}
