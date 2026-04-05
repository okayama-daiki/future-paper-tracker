import type { ConferencesData, DeadlineRow, MilestoneFilter, MilestoneType } from "./types.ts";

export const MILESTONE_LABELS: Record<MilestoneType, string> = {
  abstract_submission_deadline: "Abstract",
  full_paper_submission_deadline: "Full Paper",
  submission_deadline: "Submission",
  notification: "Notification",
  phase1_notification: "Phase 1",
  camera_ready: "Camera Ready",
  registration_deadline: "Registration",
};

export const MILESTONE_ABBR: Record<MilestoneType, string> = {
  abstract_submission_deadline: "A",
  full_paper_submission_deadline: "F",
  submission_deadline: "S",
  notification: "N",
  phase1_notification: "P",
  camera_ready: "C",
  registration_deadline: "R",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const eOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", sOpts)}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", sOpts)} – ${e.toLocaleDateString("en-US", eOpts)}`;
}

export function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  return `${days}d`;
}

export type DeadlineStatus = "urgent" | "soon" | "future" | "past";

export function deadlineStatus(days: number): DeadlineStatus {
  if (days < 0) return "past";
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "future";
}

/** Default: submission-related types only. */
export const DEFAULT_MILESTONE_FILTER: MilestoneFilter = new Set<MilestoneType>([
  "abstract_submission_deadline",
  "full_paper_submission_deadline",
  "submission_deadline",
]);

export function formatVenueCompact(venue: string | null): string {
  if (!venue) return "TBA";
  const parts = venue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[parts.length - 3]}, ${parts[parts.length - 1]}`;
  }
  return venue;
}

export function buildRows(data: ConferencesData): DeadlineRow[] {
  const rows: DeadlineRow[] = [];
  for (const series of data.conference_series) {
    if (!series.enabled) continue;
    for (const conf of series.conferences) {
      for (const ms of conf.milestones) {
        rows.push({
          seriesId: series.id,
          seriesName: series.name,
          conference: conf,
          milestone: ms,
        });
      }
    }
  }
  rows.sort(
    (a, b) => new Date(a.milestone.at_utc).getTime() - new Date(b.milestone.at_utc).getTime(),
  );
  return rows;
}
