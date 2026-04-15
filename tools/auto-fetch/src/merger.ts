import type { Conference, ConferenceSeries, ConferencesData, Milestone } from "utils";

export interface MilestoneDiff {
  type: "add" | "update";
  milestoneType: string;
  old?: Milestone;
  new: Milestone;
}

export interface ConferenceDiff {
  type: "add" | "update";
  conferenceId: string;
  fields: string[];
  milestoneDiffs: MilestoneDiff[];
  callForPaperAdded: boolean;
}

export interface MergeResult {
  data: ConferencesData;
  diffs: ConferenceDiff[];
}

/**
 * Idempotently merges an incoming Conference into the existing data.
 * Rules:
 * - Conference matched by id; add if missing, update fields if present
 * - Milestone matched by (conference_id, type):
 *   - estimated → confirmed: upgrade (replace)
 *   - confirmed → estimated: ignore (no downgrade)
 *   - confirmed → confirmed: update if date or source_url changed
 * - CallForPaper: replace if new source_url found
 */
export function mergeConference(data: ConferencesData, incoming: Conference): MergeResult {
  const diffs: ConferenceDiff[] = [];
  const seriesIndex = data.conference_series.findIndex((s) => s.id === incoming.series_id);

  if (seriesIndex === -1) {
    // Series not found in data; this shouldn't happen in normal flow
    return { data, diffs };
  }

  const series = data.conference_series[seriesIndex]!;
  const existingIndex = series.conferences.findIndex((c) => c.id === incoming.id);

  if (existingIndex === -1) {
    // New conference: add it
    const updatedSeries: ConferenceSeries = {
      ...series,
      conferences: [...series.conferences, incoming],
    };
    const updatedData = replaceSeries(data, seriesIndex, updatedSeries);
    diffs.push({
      type: "add",
      conferenceId: incoming.id,
      fields: Object.keys(incoming),
      milestoneDiffs: incoming.milestones.map((m) => ({
        type: "add",
        milestoneType: m.type,
        new: m,
      })),
      callForPaperAdded: incoming.call_for_paper !== null,
    });
    return { data: updatedData, diffs };
  }

  // Existing conference: merge fields
  const existing = series.conferences[existingIndex]!;
  const { conference: merged, diff } = mergeConferenceFields(existing, incoming);

  if (diff.fields.length > 0 || diff.milestoneDiffs.length > 0 || diff.callForPaperAdded) {
    diffs.push(diff);
    const updatedConferences = [...series.conferences];
    updatedConferences[existingIndex] = merged;
    const updatedSeries: ConferenceSeries = { ...series, conferences: updatedConferences };
    const updatedData = replaceSeries(data, seriesIndex, updatedSeries);
    return { data: updatedData, diffs };
  }

  return { data, diffs };
}

function mergeConferenceFields(
  existing: Conference,
  incoming: Conference,
): { conference: Conference; diff: ConferenceDiff } {
  const updatedFields: string[] = [];
  const milestoneDiffs: MilestoneDiff[] = [];

  // Merge scalar fields: only update if incoming has a value and existing doesn't (or is null)
  let url = existing.url;
  let venue = existing.venue;
  let name = existing.name;
  let start_at_utc = existing.start_at_utc;
  let end_at_utc = existing.end_at_utc;
  let ordinal_no = existing.ordinal_no;

  if (incoming.url && incoming.url !== existing.url) {
    url = incoming.url;
    updatedFields.push("url");
  }
  if (incoming.venue && incoming.venue !== existing.venue) {
    venue = incoming.venue;
    updatedFields.push("venue");
  }
  if (incoming.name && incoming.name !== existing.name) {
    name = incoming.name;
    updatedFields.push("name");
  }
  if (incoming.start_at_utc && incoming.start_at_utc !== existing.start_at_utc) {
    start_at_utc = incoming.start_at_utc;
    updatedFields.push("start_at_utc");
  }
  if (incoming.end_at_utc && incoming.end_at_utc !== existing.end_at_utc) {
    end_at_utc = incoming.end_at_utc;
    updatedFields.push("end_at_utc");
  }
  if (incoming.ordinal_no !== null && incoming.ordinal_no !== existing.ordinal_no) {
    ordinal_no = incoming.ordinal_no;
    updatedFields.push("ordinal_no");
  }

  // Merge milestones
  const mergedMilestones = mergeMilestones(
    existing.milestones,
    incoming.milestones,
    milestoneDiffs,
  );

  // Merge CallForPaper
  let call_for_paper = existing.call_for_paper;
  let callForPaperAdded = false;
  if (incoming.call_for_paper !== null) {
    if (
      existing.call_for_paper === null ||
      incoming.call_for_paper.source_url !== existing.call_for_paper.source_url
    ) {
      call_for_paper = incoming.call_for_paper;
      callForPaperAdded = true;
    }
  }

  const merged: Conference = {
    ...existing,
    url,
    venue,
    name,
    start_at_utc,
    end_at_utc,
    ordinal_no,
    milestones: mergedMilestones,
    call_for_paper,
  };

  return {
    conference: merged,
    diff: {
      type: "update",
      conferenceId: existing.id,
      fields: updatedFields,
      milestoneDiffs,
      callForPaperAdded,
    },
  };
}

function mergeMilestones(
  existing: Milestone[],
  incoming: Milestone[],
  diffs: MilestoneDiff[],
): Milestone[] {
  const result = [...existing];

  for (const inc of incoming) {
    const idx = result.findIndex((m) => m.type === inc.type);

    if (idx === -1) {
      // New milestone type: add it
      result.push(inc);
      diffs.push({ type: "add", milestoneType: inc.type, new: inc });
      continue;
    }

    const ex = result[idx]!;

    // No downgrade: if existing is confirmed and incoming is estimated, skip
    if (!ex.is_estimated && inc.is_estimated) continue;

    // Upgrade: estimated → confirmed
    if (ex.is_estimated && !inc.is_estimated) {
      result[idx] = inc;
      diffs.push({ type: "update", milestoneType: inc.type, old: ex, new: inc });
      continue;
    }

    // Both confirmed: update if date or source_url changed
    if (!ex.is_estimated && !inc.is_estimated) {
      if (ex.at_utc !== inc.at_utc || ex.source_url !== inc.source_url) {
        result[idx] = inc;
        diffs.push({ type: "update", milestoneType: inc.type, old: ex, new: inc });
      }
    }
  }

  return result.sort((a, b) => new Date(a.at_utc).getTime() - new Date(b.at_utc).getTime());
}

function replaceSeries(
  data: ConferencesData,
  index: number,
  series: ConferenceSeries,
): ConferencesData {
  const updated = [...data.conference_series];
  updated[index] = series;
  return { ...data, conference_series: updated };
}

// Utility: check if a conference has any changes worth reporting
export function hasChanges(diffs: ConferenceDiff[]): boolean {
  return diffs.length > 0;
}
