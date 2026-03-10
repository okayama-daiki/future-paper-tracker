import type { MilestoneRecord } from "./conferences";

export type DeadlineTone = "full" | "submission" | "abstract";

export type ConferenceEntry = {
	id: string;
	conferenceId: string;
	seriesId: string;
	conferenceName: string;
	displayKey: string;
	conferenceYear: number;
	seriesUrl: string;
	conferenceUrl: string;
	venue: string | null;
	startAtUtc: string | null;
	endAtUtc: string | null;
	milestones: MilestoneRecord[];
	hasCallForPaper: boolean;
};

export type DeadlineRow = {
	conferenceEntryId: string;
	displayKey: string;
	seriesId: string;
	conferenceName: string;
	conferenceUrl: string;
	venue: string | null;
	startAtUtc: string | null;
	endAtUtc: string | null;
	milestoneType: string;
	milestoneAtUtc: string;
	estimated: boolean;
};
