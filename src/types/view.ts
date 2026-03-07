import type { EventRecord } from "./conferences";

export type DeadlineTone = "full" | "submission" | "abstract";

export type ConferenceEntry = {
	id: string;
	conferenceKey: string;
	conferenceName: string;
	displayKey: string;
	conferenceYear: number | null;
	seriesOfficialSite: string;
	editionOfficialSite: string;
	cfpPublished: boolean;
	venue?: string;
	venueSourceUrl?: string;
	events: EventRecord[];
};

export type DeadlineRow = {
	conferenceId: string;
	displayKey: string;
	conferenceKey: string;
	conferenceName: string;
	editionOfficialSite: string;
	venue?: string;
	eventType: string;
	startAtUtc: string;
	endAtUtc?: string;
	estimated: boolean;
	estimatedFromYear?: number;
};
