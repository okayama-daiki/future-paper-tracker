export type {
  MilestoneType,
  Milestone,
  CallForPaper,
  Conference,
  ConferenceSeries,
  ConferencesData,
} from "utils";

import type { Conference, Milestone, MilestoneType } from "utils";

export interface DeadlineRow {
  seriesId: string;
  seriesName: string;
  conference: Conference;
  milestone: Milestone;
}

export type SortKey = "deadline" | "series" | "conference";
export type ViewFilter = "upcoming" | "all" | "past";
export type MilestoneFilter = Set<MilestoneType>;
