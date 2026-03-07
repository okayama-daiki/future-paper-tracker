export type EventRecord = {
	event_type: string;
	start_at_utc: string;
	end_at_utc?: string;
	source_url: string;
	estimated?: boolean;
	estimated_from_year?: number;
};

export type EditionRecord = {
	year: number;
	official_site: string;
	cfp_published: boolean;
	events: EventRecord[];
};

export type ConferenceSeriesRecord = {
	conference_key: string;
	conference_name: string;
	series_official_url: string;
	editions: EditionRecord[];
};

export type ConferencesDataFile = {
	generated_at: string;
	mode: string;
	conferences: ConferenceSeriesRecord[];
	pending_conference_keys: string[];
};
