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
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getFullYear() === e.getFullYear()) {
    const endLabel = e.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
    return `${formatDate(start)} – ${endLabel}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} 日前`;
  if (days === 0) return "今日";
  return `あと ${days} 日`;
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
