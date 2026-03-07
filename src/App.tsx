import { useEffect, useMemo, useState } from "react";
import "./App.css";
import rawData from "../data/conferences.json";
import type { ConferencesDataFile, EventRecord } from "./types/conferences";

type ConferenceEntry = {
	id: string;
	conferenceKey: string;
	conferenceName: string;
	displayKey: string;
	conferenceYear: number | null;
	seriesOfficialSite: string;
	editionOfficialSite: string;
	cfpPublished: boolean;
	events: EventRecord[];
};

type DisplayRow = {
	conferenceId: string;
	displayKey: string;
	conferenceKey: string;
	conferenceName: string;
	eventType: string;
	startAtUtc: string;
	endAtUtc?: string;
	sourceUrl: string;
};

const data = rawData as ConferencesDataFile;

function readConferenceIdFromUrl(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	const params = new URLSearchParams(window.location.search);
	return params.get("conference");
}

function updateConferenceInUrl(
	conferenceId: string | null,
	mode: "push" | "replace" = "push",
): void {
	if (typeof window === "undefined") {
		return;
	}
	const url = new URL(window.location.href);
	if (conferenceId) {
		url.searchParams.set("conference", conferenceId);
	} else {
		url.searchParams.delete("conference");
	}
	const nextUrl = `${url.pathname}${url.search}${url.hash}`;
	if (mode === "replace") {
		window.history.replaceState(null, "", nextUrl);
		return;
	}
	window.history.pushState(null, "", nextUrl);
}

function formatUtc(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	const hour = String(date.getUTCHours()).padStart(2, "0");
	const minute = String(date.getUTCMinutes()).padStart(2, "0");
	return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

function deadlineTag(eventType: string): {
	label: string;
	tone: "full" | "submission" | "abstract";
} {
	switch (eventType) {
		case "full_paper_submission":
		case "full_paper_submission_deadline":
			return { label: "FULL PAPER", tone: "full" };
		case "submission_deadline":
			return { label: "SUBMISSION", tone: "submission" };
		case "abstract_submission_deadline":
			return { label: "ABSTRACT", tone: "abstract" };
		default:
			return { label: "UNKNOWN", tone: "abstract" };
	}
}

function deadlinePriority(eventType: string): number {
	switch (eventType) {
		case "full_paper_submission":
		case "full_paper_submission_deadline":
			return 0;
		case "submission_deadline":
			return 1;
		case "abstract_submission_deadline":
			return 2;
		default:
			return Number.POSITIVE_INFINITY;
	}
}

function buildConferenceEntries(
	dataFile: ConferencesDataFile,
): ConferenceEntry[] {
	const entries: ConferenceEntry[] = [];

	dataFile.conferences.forEach((series) => {
		series.editions.forEach((edition, editionIndex) => {
			const conferenceYear = edition.year;
			entries.push({
				id: `${series.conference_key}::${conferenceYear}::${editionIndex}`,
				conferenceKey: series.conference_key,
				conferenceName: series.conference_name,
				displayKey: `${series.conference_key} ${conferenceYear}`,
				conferenceYear,
				seriesOfficialSite: series.series_official_url,
				editionOfficialSite: edition.official_site,
				cfpPublished: edition.cfp_published,
				events: edition.events,
			});
		});
	});

	return entries;
}

function selectPrimaryDeadline(conference: ConferenceEntry): DisplayRow | null {
	const candidates = conference.events.filter(
		(event) => deadlinePriority(event.event_type) !== Number.POSITIVE_INFINITY,
	);
	if (candidates.length === 0) {
		return null;
	}

	const selected = [...candidates].sort((a, b) => {
		const priorityComparison =
			deadlinePriority(a.event_type) - deadlinePriority(b.event_type);
		if (priorityComparison !== 0) {
			return priorityComparison;
		}
		return (
			new Date(a.start_at_utc).getTime() - new Date(b.start_at_utc).getTime()
		);
	})[0];

	return {
		conferenceId: conference.id,
		displayKey: conference.displayKey,
		conferenceKey: conference.conferenceKey,
		conferenceName: conference.conferenceName,
		eventType: selected.event_type,
		startAtUtc: selected.start_at_utc,
		endAtUtc: selected.end_at_utc,
		sourceUrl: selected.source_url,
	};
}

function getPastConferenceEntries(
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

function App() {
	const [query, setQuery] = useState("");
	const [selectedConferenceId, setSelectedConferenceId] = useState<
		string | null
	>(() => readConferenceIdFromUrl());

	useEffect(() => {
		const onPopState = () => {
			setSelectedConferenceId(readConferenceIdFromUrl());
		};
		window.addEventListener("popstate", onPopState);
		return () => {
			window.removeEventListener("popstate", onPopState);
		};
	}, []);

	const conferenceEntries = useMemo(() => buildConferenceEntries(data), []);

	const conferenceEntryMap = useMemo(() => {
		return new Map(conferenceEntries.map((entry) => [entry.id, entry]));
	}, [conferenceEntries]);

	const rows = useMemo<DisplayRow[]>(() => {
		return conferenceEntries
			.map((conference) => selectPrimaryDeadline(conference))
			.filter((row): row is DisplayRow => row !== null)
			.sort((a, b) => {
				const dateComparison =
					new Date(b.startAtUtc).getTime() - new Date(a.startAtUtc).getTime();
				if (dateComparison !== 0) {
					return dateComparison;
				}
				return a.displayKey.localeCompare(b.displayKey);
			});
	}, [conferenceEntries]);

	const filteredRows = useMemo(() => {
		const lower = query.trim().toLowerCase();
		return rows.filter((row) => {
			if (!lower) {
				return true;
			}
			return (
				row.displayKey.toLowerCase().includes(lower) ||
				row.conferenceKey.toLowerCase().includes(lower) ||
				row.conferenceName.toLowerCase().includes(lower)
			);
		});
	}, [rows, query]);

	const selectedConference = selectedConferenceId
		? (conferenceEntryMap.get(selectedConferenceId) ?? null)
		: null;

	const openConference = (conferenceId: string) => {
		updateConferenceInUrl(conferenceId, "push");
		setSelectedConferenceId(conferenceId);
	};

	const backToList = () => {
		if (readConferenceIdFromUrl() !== null && window.history.length > 1) {
			window.history.back();
			return;
		}
		updateConferenceInUrl(null, "replace");
		setSelectedConferenceId(null);
	};

	if (selectedConference) {
		const sourceLinks = Array.from(
			new Set(selectedConference.events.map((event) => event.source_url)),
		);
		const pastConferenceEntries = getPastConferenceEntries(
			selectedConference,
			conferenceEntries,
		);

		return (
			<main className="page">
				<header className="header">
					<button className="backButton" type="button" onClick={backToList}>
						Back to list
					</button>
					<h1>
						{selectedConference.displayKey} -{" "}
						{selectedConference.conferenceName}
					</h1>
					<p>Generated: {formatUtc(data.generated_at)}</p>
				</header>

				<section className="detailCard">
					<h2>Metadata</h2>
					<ul className="detailList">
						<li>
							<strong>Series official site:</strong>{" "}
							<a
								href={selectedConference.seriesOfficialSite}
								target="_blank"
								rel="noreferrer"
							>
								{selectedConference.seriesOfficialSite}
							</a>
						</li>
						<li>
							<strong>Edition official site:</strong>{" "}
							<a
								href={selectedConference.editionOfficialSite}
								target="_blank"
								rel="noreferrer"
							>
								{selectedConference.editionOfficialSite}
							</a>
						</li>
						<li>
							<strong>CfP published:</strong>{" "}
							{selectedConference.cfpPublished ? "yes" : "no"}
						</li>
					</ul>
				</section>

				<section className="detailCard">
					<h2>Source pages (CfP / related)</h2>
					<ul className="detailList">
						{sourceLinks.map((url) => (
							<li key={url}>
								<a href={url} target="_blank" rel="noreferrer">
									{url}
								</a>
							</li>
						))}
					</ul>
				</section>

				<section className="detailCard">
					<h2>Past conference records</h2>
					{pastConferenceEntries.length === 0 ? (
						<p className="sub">No past records in this app yet.</p>
					) : (
						<ul className="detailList">
							{pastConferenceEntries.map((entry) => (
								<li key={entry.id}>
									<button
										type="button"
										className="inlineLink"
										onClick={() => openConference(entry.id)}
									>
										{entry.displayKey}
									</button>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="detailCard">
					<h2>Events</h2>
					<table>
						<thead>
							<tr>
								<th>Event</th>
								<th>UTC</th>
								<th>Source</th>
							</tr>
						</thead>
						<tbody>
							{selectedConference.events.map((event) => (
								<tr
									key={`${event.event_type}-${event.start_at_utc}-${event.source_url}`}
								>
									<td>
										<code>{event.event_type}</code>
									</td>
									<td>
										{formatUtc(event.start_at_utc)}
										{event.end_at_utc ? (
											<div className="sub">
												to {formatUtc(event.end_at_utc)}
											</div>
										) : null}
									</td>
									<td>
										<a href={event.source_url} target="_blank" rel="noreferrer">
											link
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			</main>
		);
	}

	return (
		<main className="page">
			<header className="header">
				<h1>Future Paper Tracker</h1>
				<p>Generated: {formatUtc(data.generated_at)}</p>
			</header>

			<section className="controls">
				<label>
					Search
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="conference key+year / name"
					/>
				</label>
			</section>

			<section className="meta">
				<span>Rows: {filteredRows.length}</span>
				<span>Pending: {data.pending_conference_keys.length}</span>
			</section>

			<section className="tableWrap">
				<table>
					<thead>
						<tr>
							<th>Conference</th>
							<th>UTC</th>
							<th>Source</th>
						</tr>
					</thead>
					<tbody>
						{filteredRows.map((row) => {
							const tag = deadlineTag(row.eventType);
							return (
								<tr
									key={`${row.conferenceId}-${row.eventType}-${row.startAtUtc}`}
								>
									<td>
										<button
											type="button"
											className="conferenceLink"
											onClick={() => openConference(row.conferenceId)}
										>
											<strong>{row.displayKey}</strong>
										</button>
										<div className="sub">{row.conferenceName}</div>
										<div className="sub">
											<span className={`tag ${tag.tone}`}>{tag.label}</span>
										</div>
									</td>
									<td>
										{formatUtc(row.startAtUtc)}
										{row.endAtUtc ? (
											<div className="sub">to {formatUtc(row.endAtUtc)}</div>
										) : null}
									</td>
									<td>
										<a href={row.sourceUrl} target="_blank" rel="noreferrer">
											link
										</a>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</section>
			<footer className="footer">
				<h2>Pending conference keys</h2>
				<p>{data.pending_conference_keys.join(", ")}</p>
			</footer>
		</main>
	);
}

export default App;
