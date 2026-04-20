export type MilestoneType =
  | "abstract_submission_deadline"
  | "full_paper_submission_deadline"
  | "submission_deadline"
  | "notification"
  | "phase1_notification"
  | "camera_ready"
  | "registration_deadline";

export interface Milestone {
  type: MilestoneType;
  at_utc: string;
  source_url: string;
  is_estimated: boolean;
}

export interface CallForPaper {
  source_url: string;
  page_count: number | null;
}

export interface Conference {
  id: string;
  series_id: string;
  name: string;
  year: number;
  ordinal_no: number | null;
  url: string;
  venue: string | null;
  start_at_utc: string | null;
  end_at_utc: string | null;
  milestones: Milestone[];
  call_for_paper: CallForPaper | null;
}

export interface ConferenceSeries {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  conferences: Conference[];
}

export interface ConferencesData {
  generated_at: string;
  conference_series: ConferenceSeries[];
}

export interface DeadlineRow {
  seriesId: string;
  seriesName: string;
  conference: Conference;
  milestone: Milestone;
}

export type SortKey = "deadline" | "series" | "conference";
export type ViewFilter = "upcoming" | "all" | "past";
export type MilestoneFilter = Set<MilestoneType>;
