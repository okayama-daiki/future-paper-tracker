export type MilestoneRecord = {
	type: string;
	at_utc: string;
	source_url: string;
	is_estimated: boolean;
};

export type CallForPaperRecord = {
	source_url: string;
	page_count: number | null;
};

export type ConferenceRecord = {
	id: string;
	series_id: string;
	name: string;
	year: number;
	ordinal_no: number | null;
	url: string;
	venue: string | null;
	start_at_utc: string | null;
	end_at_utc: string | null;
	milestones: MilestoneRecord[];
	call_for_paper: CallForPaperRecord | null;
};

export type ConferenceSeriesRecord = {
	id: string;
	name: string;
	url: string;
	enabled: boolean;
	conferences: ConferenceRecord[];
};

export type ConferencesDataFile = {
	generated_at: string;
	conference_series: ConferenceSeriesRecord[];
};
