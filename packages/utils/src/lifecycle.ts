import type { Conference, ConferenceSeries } from "./types.js";

export type LifecycleState = "unregistered" | "estimated" | "partial" | "confirmed" | "archived";

export const SUBMISSION_DEADLINE_TYPES = new Set([
  "abstract_submission_deadline",
  "full_paper_submission_deadline",
  "submission_deadline",
]);

/**
 * A conference is considered actionable (future) as long as at least one
 * submission deadline is in the future. If no submission deadlines exist,
 * falls back to end_at_utc.
 */
export function isActionable(conf: Conference, now: Date): boolean {
  const deadlines = conf.milestones.filter((m) => SUBMISSION_DEADLINE_TYPES.has(m.type));
  if (deadlines.length > 0) {
    return deadlines.some((m) => new Date(m.at_utc) > now);
  }
  const end = conf.end_at_utc ? new Date(conf.end_at_utc) : null;
  return end === null || end > now;
}

/**
 * Derives the lifecycle state of the next upcoming Conference for a series.
 * Returns the state of the earliest actionable Conference,
 * or "unregistered" if none exists.
 */
export function deriveLifecycleState(
  series: ConferenceSeries,
  now: Date = new Date(),
): LifecycleState {
  const futureConferences = series.conferences.filter((c) => isActionable(c, now));

  if (futureConferences.length === 0) {
    // Check if there's a past conference that needs archiving
    const pastConfirmed = series.conferences.find((c) => {
      if (c.milestones.length === 0) return false;
      const allConfirmed = c.milestones.every((m) => !m.is_estimated);
      const end = c.end_at_utc ? new Date(c.end_at_utc) : null;
      return allConfirmed && end !== null && end <= now;
    });
    if (pastConfirmed) return "archived";
    return "unregistered";
  }

  // Sort by start_at_utc ascending, put nulls last
  const sorted = futureConferences.sort((a, b) => {
    if (!a.start_at_utc && !b.start_at_utc) return 0;
    if (!a.start_at_utc) return 1;
    if (!b.start_at_utc) return -1;
    return new Date(a.start_at_utc).getTime() - new Date(b.start_at_utc).getTime();
  });

  return deriveConferenceState(sorted[0]!);
}

export function deriveConferenceState(conference: Conference): LifecycleState {
  const milestones = conference.milestones;

  if (milestones.length === 0) return "unregistered";

  const allEstimated = milestones.every((m) => m.is_estimated);
  const allConfirmed = milestones.every((m) => !m.is_estimated);

  if (allEstimated) return "estimated";
  if (allConfirmed) return "confirmed";
  return "partial";
}
