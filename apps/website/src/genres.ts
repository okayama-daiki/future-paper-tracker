import type { DeadlineRow, GenreId } from "./types.ts";

export const GENRE_LABELS: Record<GenreId, string> = {
  geometry: "Computational Geometry",
  distributed: "Distributed Computing",
  algorithms: "Algorithms & Theory",
  or_ai: "OR / AI",
  unclassified: "未分類",
};

/** Display categories belong to a series, so they apply to every year and milestone. */
export const SERIES_GENRES: Readonly<Record<string, readonly GenreId[]>> = {
  STOC: ["algorithms"],
  FOCS: ["algorithms"],
  SODA: ["algorithms"],
  ICALP: ["algorithms"],
  ESA: ["algorithms"],
  ISAAC: ["algorithms"],
  SoCG: ["algorithms", "geometry"],
  CCCG: ["algorithms", "geometry"],
  ITCS: ["algorithms"],
  SWAT: ["algorithms"],
  IWOCA: ["algorithms"],
  LATIN: ["algorithms"],
  ISSAC: ["algorithms"],
  WALCOM: ["algorithms"],
  AAAC: ["algorithms"],
  WAAC: ["algorithms"],
  APPROX: ["algorithms", "or_ai"],
  RANDOM: ["algorithms"],
  IPEC: ["algorithms"],
  WAOA: ["algorithms", "or_ai"],
  ACDA: ["algorithms"],
  PODC: ["algorithms", "distributed"],
  DISC: ["algorithms", "distributed"],
  SPAA: ["algorithms", "distributed"],
  SIROCCO: ["algorithms", "distributed"],
  OPODIS: ["algorithms", "distributed"],
  IPCO: ["algorithms", "or_ai"],
  ISMP: ["or_ai"],
  INFORMS: ["or_ai"],
  EURO: ["or_ai"],
  MIP: ["or_ai"],
  MOPTA: ["or_ai"],
  CPAIOR: ["or_ai"],
  IFORS: ["or_ai"],
  ALGO: ["algorithms", "or_ai"],
  SIGAL: ["algorithms"],
  COMP: ["algorithms"],
  JCDCGGG: ["algorithms", "geometry"],
  "LA-summer": ["algorithms"],
  "LA-winter": ["algorithms"],
  FIT: ["geometry", "distributed", "algorithms", "or_ai"],
  COSS: ["algorithms", "or_ai"],
  JSIAM: ["algorithms", "or_ai"],
  "ORSJ-spring": ["or_ai"],
  "ORSJ-autumn": ["or_ai"],
  RAMP: ["or_ai"],
  TSUKUBA: ["algorithms", "or_ai"],
  AAAI: ["or_ai"],
  IJCAI: ["or_ai"],
  ICAPS: ["or_ai"],
  CP: ["algorithms", "or_ai"],
};

export const ALL_GENRES = Object.keys(GENRE_LABELS) as GenreId[];
const UNCLASSIFIED: readonly GenreId[] = ["unclassified"];

export function getSeriesGenres(seriesId: string): readonly GenreId[] {
  return SERIES_GENRES[seriesId] ?? UNCLASSIFIED;
}

export function getAvailableGenres(rows: DeadlineRow[]): GenreId[] {
  const present = new Set(rows.flatMap((row) => getSeriesGenres(row.seriesId)));
  return ALL_GENRES.filter((genre) => present.has(genre));
}

/** Multiple selections match any chosen genre; no selection shows no deadlines. */
export function filterByGenre(rows: DeadlineRow[], selected: ReadonlySet<GenreId>): DeadlineRow[] {
  return rows.filter((row) => getSeriesGenres(row.seriesId).some((genre) => selected.has(genre)));
}
