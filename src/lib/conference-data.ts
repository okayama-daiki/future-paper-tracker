import type {
	ConferencesDataFile,
	MilestoneRecord,
} from "../types/conferences";
import type { ConferenceEntry, DeadlineRow, DeadlineTone } from "../types/view";

const FULL_PAPER_MILESTONE_TYPES = new Set([
	"full_paper_submission",
	"full_paper_submission_deadline",
]);

export function formatMilestoneType(milestoneType: string): string {
	return milestoneType
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function deadlineTag(milestoneType: string): {
	label: string;
	tone: DeadlineTone;
} {
	if (FULL_PAPER_MILESTONE_TYPES.has(milestoneType)) {
		return { label: "FULL PAPER", tone: "full" };
	}

	switch (milestoneType) {
		case "submission_deadline":
			return { label: "SUBMISSION", tone: "submission" };
		case "abstract_submission_deadline":
			return { label: "ABSTRACT", tone: "abstract" };
		default:
			return { label: "UNKNOWN", tone: "abstract" };
	}
}

export function deadlinePriority(milestoneType: string): number {
	if (FULL_PAPER_MILESTONE_TYPES.has(milestoneType)) {
		return 0;
	}

	switch (milestoneType) {
		case "submission_deadline":
			return 1;
		case "abstract_submission_deadline":
			return 2;
		default:
			return Number.POSITIVE_INFINITY;
	}
}

export function isDeadlineMilestoneType(milestoneType: string): boolean {
	return deadlinePriority(milestoneType) !== Number.POSITIVE_INFINITY;
}

export function buildConferenceEntries(
	dataFile: ConferencesDataFile,
): ConferenceEntry[] {
	return dataFile.conference_series.flatMap((series) =>
		series.conferences.map((conf) => ({
			id: conf.id,
			conferenceId: conf.id,
			seriesId: series.id,
			conferenceName: conf.name,
			displayKey: `${series.id} ${conf.year}`,
			conferenceYear: conf.year,
			seriesUrl: series.url,
			conferenceUrl: conf.url,
			venue: conf.venue,
			startAtUtc: conf.start_at_utc,
			endAtUtc: conf.end_at_utc,
			milestones: conf.milestones,
			hasCallForPaper: conf.call_for_paper !== null,
		})),
	);
}

export function buildConferenceEntryMap(
	conferenceEntries: ConferenceEntry[],
): Map<string, ConferenceEntry> {
	return new Map(conferenceEntries.map((entry) => [entry.id, entry]));
}

function sortMilestonesChronologically(
	milestones: MilestoneRecord[],
): MilestoneRecord[] {
	return [...milestones].sort(
		(a, b) => new Date(a.at_utc).getTime() - new Date(b.at_utc).getTime(),
	);
}

function sortDeadlineCandidates(
	milestones: MilestoneRecord[],
): MilestoneRecord[] {
	return [...milestones].sort((a, b) => {
		const priorityComparison =
			deadlinePriority(a.type) - deadlinePriority(b.type);
		if (priorityComparison !== 0) {
			return priorityComparison;
		}

		return new Date(a.at_utc).getTime() - new Date(b.at_utc).getTime();
	});
}

function findPrimaryDeadlineMilestone(
	milestones: MilestoneRecord[],
): MilestoneRecord | null {
	const candidates = milestones.filter(
		(m) => isDeadlineMilestoneType(m.type) && !m.is_estimated,
	);

	if (candidates.length === 0) {
		return null;
	}

	return sortDeadlineCandidates(candidates)[0];
}

function findEstimatedPrimaryDeadlineMilestone(
	milestones: MilestoneRecord[],
): MilestoneRecord | null {
	const candidates = milestones.filter(
		(m) => isDeadlineMilestoneType(m.type) && m.is_estimated,
	);

	if (candidates.length === 0) {
		return null;
	}

	return sortDeadlineCandidates(candidates)[0];
}

function buildEstimatedPrimaryDeadline(
	conference: ConferenceEntry,
	allEntries: ConferenceEntry[],
): MilestoneRecord | null {
	const existingEstimated = findEstimatedPrimaryDeadlineMilestone(
		conference.milestones,
	);
	if (existingEstimated) {
		return existingEstimated;
	}

	if (conference.hasCallForPaper) {
		return null;
	}
	const currentYear = conference.conferenceYear;

	const previousEdition = allEntries
		.filter(
			(entry) =>
				entry.seriesId === conference.seriesId &&
				entry.id !== conference.id &&
				entry.conferenceYear < currentYear,
		)
		.sort((a, b) => b.conferenceYear - a.conferenceYear)
		.find((entry) => findPrimaryDeadlineMilestone(entry.milestones) !== null);

	if (!previousEdition) {
		return null;
	}

	const previousPrimary = findPrimaryDeadlineMilestone(
		previousEdition.milestones,
	);
	if (!previousPrimary) {
		return null;
	}

	const editionYearOffset = currentYear - previousEdition.conferenceYear;
	const shiftedDate = new Date(previousPrimary.at_utc);
	shiftedDate.setUTCFullYear(shiftedDate.getUTCFullYear() + editionYearOffset);

	return {
		type: previousPrimary.type,
		at_utc: shiftedDate.toISOString().replace(".000Z", "Z"),
		source_url: previousPrimary.source_url,
		is_estimated: true,
	};
}

export function buildDisplayMilestones(
	conference: ConferenceEntry,
	allEntries: ConferenceEntry[],
): MilestoneRecord[] {
	const milestones = [...conference.milestones];
	if (findPrimaryDeadlineMilestone(milestones) === null) {
		const estimated = buildEstimatedPrimaryDeadline(conference, allEntries);
		if (estimated) {
			milestones.push(estimated);
		}
	}

	return sortMilestonesChronologically(milestones);
}

export function buildDeadlineRows(
	conferenceEntries: ConferenceEntry[],
): DeadlineRow[] {
	const rows = conferenceEntries.map<DeadlineRow | null>((conference) => {
		const selected =
			findPrimaryDeadlineMilestone(conference.milestones) ??
			buildEstimatedPrimaryDeadline(conference, conferenceEntries);
		if (!selected) {
			return null;
		}

		const row: DeadlineRow = {
			conferenceEntryId: conference.id,
			displayKey: conference.displayKey,
			seriesId: conference.seriesId,
			conferenceName: conference.conferenceName,
			conferenceUrl: conference.conferenceUrl,
			venue: conference.venue,
			startAtUtc: conference.startAtUtc,
			endAtUtc: conference.endAtUtc,
			milestoneType: selected.type,
			milestoneAtUtc: selected.at_utc,
			estimated: selected.is_estimated,
		};
		return row;
	});
	const definedRows = rows.filter((row): row is DeadlineRow => row !== null);

	return definedRows.sort((a, b) => {
		const dateComparison =
			new Date(b.milestoneAtUtc).getTime() -
			new Date(a.milestoneAtUtc).getTime();
		if (dateComparison !== 0) {
			return dateComparison;
		}
		return a.displayKey.localeCompare(b.displayKey);
	});
}

export function filterDeadlineRows(
	rows: DeadlineRow[],
	query: string,
): DeadlineRow[] {
	const lower = query.trim().toLowerCase();
	if (!lower) {
		return rows;
	}

	return rows.filter((row) => {
		return (
			row.displayKey.toLowerCase().includes(lower) ||
			row.seriesId.toLowerCase().includes(lower) ||
			row.conferenceName.toLowerCase().includes(lower)
		);
	});
}

export function getPastConferenceEntries(
	current: ConferenceEntry,
	allEntries: ConferenceEntry[],
): ConferenceEntry[] {
	const currentYear = current.conferenceYear;

	return allEntries
		.filter(
			(entry) =>
				entry.id !== current.id &&
				entry.seriesId === current.seriesId &&
				entry.conferenceYear < currentYear,
		)
		.sort((a, b) => b.conferenceYear - a.conferenceYear);
}
