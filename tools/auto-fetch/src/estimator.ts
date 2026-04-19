import type { Conference, ConferenceSeries, Milestone, MilestoneType } from "utils";

const TWELVE_MONTHS_MS = 12 * 30 * 24 * 60 * 60 * 1000;

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** Milestone types considered "submission deadlines" — used as the anchor. */
const DEADLINE_TYPES = new Set<MilestoneType>([
  "abstract_submission_deadline",
  "full_paper_submission_deadline",
  "submission_deadline",
  "phase1_notification",
]);

export interface EstimationResult {
  conference: Conference;
  confidence: number;
}

/**
 * Returns the earliest deadline milestone in a conference, or null if none exists.
 */
function earliestDeadline(conference: Conference): Milestone | null {
  const deadlines = conference.milestones.filter((m) => DEADLINE_TYPES.has(m.type));
  if (deadlines.length === 0) return null;
  return deadlines.reduce((a, b) =>
    new Date(a.at_utc).getTime() < new Date(b.at_utc).getTime() ? a : b,
  );
}

/**
 * Generates an estimated next Conference for a series based on historical deadline patterns.
 *
 * Anchor: the earliest deadline milestone of each past conference.
 * - Gaps between consecutive anchors determine cadence.
 * - All other milestones (including conference start/end) are estimated as
 *   offsets relative to the anchor.
 * - The 12-month window is checked against the predicted anchor date.
 *
 * Returns null when:
 *   - no past conferences have deadline milestones (caller should crawl directly)
 *   - predicted anchor is more than 12 months away
 */
export function generateEstimated(
  series: ConferenceSeries,
  now: Date = new Date(),
): EstimationResult | null {
  // Only use conferences that have at least one deadline milestone as anchor
  const past = series.conferences
    .filter((c) => earliestDeadline(c) !== null)
    .sort(
      (a, b) =>
        new Date(earliestDeadline(a)!.at_utc).getTime() -
        new Date(earliestDeadline(b)!.at_utc).getTime(),
    );

  if (past.length === 0) return null;

  const predictedAnchor = predictNextAnchor(past, now);
  if (predictedAnchor === null) return null;

  // Only generate if the predicted deadline is within 12 months
  if (predictedAnchor.getTime() - now.getTime() > TWELVE_MONTHS_MS) return null;

  const milestones = estimateMilestones(past, predictedAnchor, series.url);
  const startAtUtc = estimateStartDate(past, predictedAnchor);

  const lastConf = past[past.length - 1]!;
  const year = startAtUtc ? startAtUtc.getFullYear() : predictedAnchor.getFullYear();
  const ordinal_no = lastConf.ordinal_no !== null ? lastConf.ordinal_no + 1 : null;
  const name =
    ordinal_no !== null
      ? `The ${ordinal_no}${ordinalSuffix(ordinal_no)} ${series.name.replace(/^The /, "")}`
      : `${series.name} ${year}`;

  const conference: Conference = {
    id: `${series.id}-${year}`,
    series_id: series.id,
    name,
    year,
    ordinal_no,
    url: series.url,
    venue: null,
    start_at_utc: startAtUtc ? startAtUtc.toISOString() : null,
    end_at_utc: null,
    milestones,
    call_for_paper: null,
  };

  // Confidence based on number of past data points
  const confidence = Math.min(0.5 + past.length * 0.05, 0.8);

  return { conference, confidence };
}

/**
 * Predicts the next anchor (earliest deadline) date based on gaps between past anchors.
 */
function predictNextAnchor(past: Conference[], now: Date): Date | null {
  const anchors = past.map((c) => new Date(earliestDeadline(c)!.at_utc));

  if (anchors.length === 1) {
    const last = anchors[0]!;
    const next = new Date(last);
    next.setFullYear(last.getFullYear() + 1);
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  const gaps: number[] = [];
  for (let i = 1; i < anchors.length; i++) {
    gaps.push(anchors[i]!.getTime() - anchors[i - 1]!.getTime());
  }
  const avgGapMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  let next = new Date(anchors[anchors.length - 1]!.getTime() + avgGapMs);
  while (next <= now) next = new Date(next.getTime() + avgGapMs);

  return next;
}

/**
 * Estimates the conference start date as an offset from the predicted anchor.
 */
function estimateStartDate(past: Conference[], predictedAnchor: Date): Date | null {
  const offsets: number[] = [];

  for (const conf of past) {
    if (!conf.start_at_utc) continue;
    const anchor = earliestDeadline(conf);
    if (!anchor) continue;
    offsets.push(new Date(conf.start_at_utc).getTime() - new Date(anchor.at_utc).getTime());
  }

  if (offsets.length === 0) return null;
  const avgOffsetMs = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  return new Date(predictedAnchor.getTime() + avgOffsetMs);
}

/**
 * Estimates all milestone dates as offsets relative to the predicted anchor deadline.
 */
function estimateMilestones(
  past: Conference[],
  predictedAnchor: Date,
  sourceUrl: string,
): Milestone[] {
  const typeOffsets = new Map<MilestoneType, number[]>();

  for (const conf of past) {
    const anchor = earliestDeadline(conf);
    if (!anchor) continue;
    const anchorMs = new Date(anchor.at_utc).getTime();

    for (const m of conf.milestones) {
      const offsetMs = new Date(m.at_utc).getTime() - anchorMs;
      const existing = typeOffsets.get(m.type) ?? [];
      existing.push(offsetMs);
      typeOffsets.set(m.type, existing);
    }
  }

  const milestones: Milestone[] = [];

  for (const [type, offsets] of typeOffsets) {
    const avgOffsetMs = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    milestones.push({
      type,
      at_utc: new Date(predictedAnchor.getTime() + avgOffsetMs).toISOString(),
      source_url: sourceUrl,
      is_estimated: true,
    });
  }

  return milestones.sort((a, b) => new Date(a.at_utc).getTime() - new Date(b.at_utc).getTime());
}
