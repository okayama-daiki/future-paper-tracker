import type { ConferencesDataFile, EventRecord } from "../types/conferences";
import type { ConferenceEntry, DeadlineRow, DeadlineTone } from "../types/view";
import { shiftUtcByEditionYears } from "./date";

const FULL_PAPER_EVENT_TYPES = new Set([
	"full_paper_submission",
	"full_paper_submission_deadline",
]);

export function formatEventType(eventType: string): string {
	return eventType
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function deadlineTag(eventType: string): {
	label: string;
	tone: DeadlineTone;
} {
	if (FULL_PAPER_EVENT_TYPES.has(eventType)) {
		return { label: "FULL PAPER", tone: "full" };
	}

	switch (eventType) {
		case "submission_deadline":
			return { label: "SUBMISSION", tone: "submission" };
		case "abstract_submission_deadline":
			return { label: "ABSTRACT", tone: "abstract" };
		default:
			return { label: "UNKNOWN", tone: "abstract" };
	}
}

export function deadlinePriority(eventType: string): number {
	if (FULL_PAPER_EVENT_TYPES.has(eventType)) {
		return 0;
	}

	switch (eventType) {
		case "submission_deadline":
			return 1;
		case "abstract_submission_deadline":
			return 2;
		default:
			return Number.POSITIVE_INFINITY;
	}
}

export function isDeadlineEventType(eventType: string): boolean {
	return deadlinePriority(eventType) !== Number.POSITIVE_INFINITY;
}

export function buildConferenceEntries(
	dataFile: ConferencesDataFile,
): ConferenceEntry[] {
	return dataFile.conferences.flatMap((series) =>
		series.editions.map((edition, editionIndex) => ({
			id: `${series.conference_key}::${edition.year}::${editionIndex}`,
			conferenceKey: series.conference_key,
			conferenceName: series.conference_name,
			displayKey: `${series.conference_key} ${edition.year}`,
			conferenceYear: edition.year,
			seriesOfficialSite: series.series_official_url,
			editionOfficialSite: edition.official_site,
			cfpPublished: edition.cfp_published,
			venue: edition.venue,
			venueSourceUrl: edition.venue_source_url,
			events: edition.events,
		})),
	);
}

export function buildConferenceEntryMap(
	conferenceEntries: ConferenceEntry[],
): Map<string, ConferenceEntry> {
	return new Map(conferenceEntries.map((entry) => [entry.id, entry]));
}

function sortEventsChronologically(events: EventRecord[]): EventRecord[] {
	return [...events].sort(
		(a, b) =>
			new Date(a.start_at_utc).getTime() - new Date(b.start_at_utc).getTime(),
	);
}

function sortDeadlineCandidates(events: EventRecord[]): EventRecord[] {
	return [...events].sort((a, b) => {
		const priorityComparison =
			deadlinePriority(a.event_type) - deadlinePriority(b.event_type);
		if (priorityComparison !== 0) {
			return priorityComparison;
		}

		return (
			new Date(a.start_at_utc).getTime() - new Date(b.start_at_utc).getTime()
		);
	});
}

function findPrimaryDeadlineEvent(events: EventRecord[]): EventRecord | null {
	const candidates = events.filter(
		(event) => isDeadlineEventType(event.event_type) && !event.estimated,
	);

	if (candidates.length === 0) {
		return null;
	}

	return sortDeadlineCandidates(candidates)[0];
}

function findEstimatedPrimaryDeadlineEvent(
	events: EventRecord[],
): EventRecord | null {
	const candidates = events.filter(
		(event) => isDeadlineEventType(event.event_type) && event.estimated,
	);

	if (candidates.length === 0) {
		return null;
	}

	return sortDeadlineCandidates(candidates)[0];
}

function buildEstimatedPrimaryDeadline(
	conference: ConferenceEntry,
	allEntries: ConferenceEntry[],
): EventRecord | null {
	const existingEstimatedPrimaryDeadline = findEstimatedPrimaryDeadlineEvent(
		conference.events,
	);
	if (existingEstimatedPrimaryDeadline) {
		return existingEstimatedPrimaryDeadline;
	}

	if (conference.cfpPublished || conference.conferenceYear === null) {
		return null;
	}
	const currentYear = conference.conferenceYear;

	const previousEdition = allEntries
		.filter(
			(entry) =>
				entry.conferenceKey === conference.conferenceKey &&
				entry.id !== conference.id &&
				entry.conferenceYear !== null &&
				entry.conferenceYear < currentYear,
		)
		.sort((a, b) => (b.conferenceYear ?? 0) - (a.conferenceYear ?? 0))
		.find((entry) => findPrimaryDeadlineEvent(entry.events) !== null);

	if (!previousEdition || previousEdition.conferenceYear === null) {
		return null;
	}

	const previousPrimaryDeadline = findPrimaryDeadlineEvent(
		previousEdition.events,
	);
	if (!previousPrimaryDeadline) {
		return null;
	}

	const editionYearOffset = currentYear - previousEdition.conferenceYear;

	return {
		event_type: previousPrimaryDeadline.event_type,
		start_at_utc: shiftUtcByEditionYears(
			previousPrimaryDeadline.start_at_utc,
			editionYearOffset,
		),
		end_at_utc: previousPrimaryDeadline.end_at_utc
			? shiftUtcByEditionYears(
					previousPrimaryDeadline.end_at_utc,
					editionYearOffset,
				)
			: undefined,
		source_url: previousPrimaryDeadline.source_url,
		estimated: true,
		estimated_from_year: previousEdition.conferenceYear,
	};
}

export function buildDisplayEvents(
	conference: ConferenceEntry,
	allEntries: ConferenceEntry[],
): EventRecord[] {
	const events = [...conference.events];
	if (findPrimaryDeadlineEvent(events) === null) {
		const estimatedPrimaryDeadline = buildEstimatedPrimaryDeadline(
			conference,
			allEntries,
		);
		if (estimatedPrimaryDeadline) {
			events.push(estimatedPrimaryDeadline);
		}
	}

	return sortEventsChronologically(events);
}

export function buildDeadlineRows(
	conferenceEntries: ConferenceEntry[],
): DeadlineRow[] {
	const rows = conferenceEntries.map<DeadlineRow | null>((conference) => {
		const selected =
			findPrimaryDeadlineEvent(conference.events) ??
			buildEstimatedPrimaryDeadline(conference, conferenceEntries);
		if (!selected) {
			return null;
		}

		const row: DeadlineRow = {
			conferenceId: conference.id,
			displayKey: conference.displayKey,
			conferenceKey: conference.conferenceKey,
			conferenceName: conference.conferenceName,
			editionOfficialSite: conference.editionOfficialSite,
			venue: conference.venue,
			eventType: selected.event_type,
			startAtUtc: selected.start_at_utc,
			endAtUtc: selected.end_at_utc,
			estimated: selected.estimated ?? false,
			estimatedFromYear: selected.estimated_from_year,
		};
		return row;
	});
	const definedRows = rows.filter((row): row is DeadlineRow => row !== null);

	return definedRows.sort((a, b) => {
		const dateComparison =
			new Date(b.startAtUtc).getTime() - new Date(a.startAtUtc).getTime();
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
			row.conferenceKey.toLowerCase().includes(lower) ||
			row.conferenceName.toLowerCase().includes(lower)
		);
	});
}

export function getPastConferenceEntries(
	current: ConferenceEntry,
	allEntries: ConferenceEntry[],
): ConferenceEntry[] {
	const currentYear = current.conferenceYear;
	if (currentYear === null) {
		return [];
	}

	return allEntries
		.filter(
			(entry) =>
				entry.id !== current.id &&
				entry.conferenceKey === current.conferenceKey &&
				entry.conferenceYear !== null &&
				entry.conferenceYear < currentYear,
		)
		.sort((a, b) => (b.conferenceYear ?? 0) - (a.conferenceYear ?? 0));
}
