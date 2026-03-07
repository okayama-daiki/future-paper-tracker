import { useEffect, useMemo, useRef, useState } from "react";
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
const GITHUB_REPO_URL = "https://github.com/okayama-daiki/future-paper-tracker";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/daikiokayama";
const ROWS_PER_PAGE = 20;

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

function formatEventType(eventType: string): string {
	return eventType
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
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

function isDeadlineEventType(eventType: string): boolean {
	return deadlinePriority(eventType) !== Number.POSITIVE_INFINITY;
}

function isPastUtc(iso: string, now: number): boolean {
	const timestamp = new Date(iso).getTime();
	if (Number.isNaN(timestamp)) {
		return false;
	}
	return timestamp < now;
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

function buildPaginationItems(
	currentPage: number,
	totalPages: number,
): Array<number | string> {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const pages = new Set<number>([
		1,
		totalPages,
		currentPage - 1,
		currentPage,
		currentPage + 1,
	]);
	const sortedPages = [...pages]
		.filter((page) => page >= 1 && page <= totalPages)
		.sort((a, b) => a - b);

	const items: Array<number | string> = [];
	let previousPage: number | null = null;

	for (const page of sortedPages) {
		if (previousPage !== null && page - previousPage > 1) {
			items.push(`ellipsis-${previousPage}-${page}`);
		}
		items.push(page);
		previousPage = page;
	}

	return items;
}

function SiteFooter() {
	const year = new Date().getUTCFullYear();

	return (
		<footer className="siteFooter">
			<p className="siteFooterCopyright">© {year} Daiki Okayama</p>
			<nav className="siteFooterLinks" aria-label="Project links">
				<a
					className="siteFooterLink"
					href={GITHUB_REPO_URL}
					target="_blank"
					rel="noreferrer"
				>
					GitHub
				</a>
				<a
					className="siteFooterLink"
					href={BUY_ME_A_COFFEE_URL}
					target="_blank"
					rel="noreferrer"
				>
					Buy Me a Coffee
				</a>
			</nav>
		</footer>
	);
}

function App() {
	const [query, setQuery] = useState("");
	const [selectedConferenceId, setSelectedConferenceId] = useState<
		string | null
	>(() => readConferenceIdFromUrl());
	const [now, setNow] = useState(() => Date.now());
	const [currentPage, setCurrentPage] = useState(1);
	const tableSectionRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const onPopState = () => {
			setSelectedConferenceId(readConferenceIdFromUrl());
		};
		window.addEventListener("popstate", onPopState);
		return () => {
			window.removeEventListener("popstate", onPopState);
		};
	}, []);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNow(Date.now());
		}, 60_000);

		return () => {
			window.clearInterval(intervalId);
		};
	}, []);

	const conferenceEntries = useMemo(() => buildConferenceEntries(data), []);
	const trackedSeriesCount = data.conferences.length;
	const trackedEditionCount = conferenceEntries.length;
	const pendingCount = data.pending_conference_keys.length;

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

	const totalPages = Math.max(
		1,
		Math.ceil(filteredRows.length / ROWS_PER_PAGE),
	);
	const visiblePage = Math.min(currentPage, totalPages);

	const paginatedRows = useMemo(() => {
		const startIndex = (visiblePage - 1) * ROWS_PER_PAGE;
		return filteredRows.slice(startIndex, startIndex + ROWS_PER_PAGE);
	}, [filteredRows, visiblePage]);

	const pageStart =
		filteredRows.length === 0 ? 0 : (visiblePage - 1) * ROWS_PER_PAGE + 1;
	const pageEnd = Math.min(visiblePage * ROWS_PER_PAGE, filteredRows.length);
	const paginationItems = useMemo(
		() => buildPaginationItems(visiblePage, totalPages),
		[visiblePage, totalPages],
	);

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

	const goToPage = (page: number) => {
		const nextPage = Math.max(1, Math.min(page, totalPages));
		if (nextPage === visiblePage) {
			return;
		}
		setCurrentPage(nextPage);
		tableSectionRef.current?.scrollIntoView({
			block: "start",
			behavior: "smooth",
		});
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
				<header className="hero heroDetail">
					<div className="heroActions">
						<button className="backButton" type="button" onClick={backToList}>
							Back to list
						</button>
						<a
							className="heroLink"
							href={selectedConference.editionOfficialSite}
							target="_blank"
							rel="noreferrer"
						>
							Open edition site
						</a>
					</div>
					<p className="eyebrow">{selectedConference.conferenceKey} edition</p>
					<h1>{selectedConference.displayKey}</h1>
					<p className="heroText">{selectedConference.conferenceName}</p>
					<div className="heroMeta">
						<span className="metaChip">
							Generated {formatUtc(data.generated_at)}
						</span>
						<span className="metaChip">
							{selectedConference.events.length} tracked events
						</span>
						<span
							className={`metaChip ${
								selectedConference.cfpPublished
									? "metaChipLive"
									: "metaChipMuted"
							}`}
						>
							CfP{" "}
							{selectedConference.cfpPublished ? "published" : "not published"}
						</span>
					</div>
				</header>

				<div className="detailGrid">
					<section className="detailCard panel">
						<div className="sectionHeading">
							<div>
								<p className="sectionEyebrow">Overview</p>
								<h2>Metadata</h2>
							</div>
						</div>
						<ul className="detailList">
							<li>
								<span className="detailLabel">Series official site</span>
								<a
									href={selectedConference.seriesOfficialSite}
									target="_blank"
									rel="noreferrer"
								>
									{selectedConference.seriesOfficialSite}
								</a>
							</li>
							<li>
								<span className="detailLabel">Edition official site</span>
								<a
									href={selectedConference.editionOfficialSite}
									target="_blank"
									rel="noreferrer"
								>
									{selectedConference.editionOfficialSite}
								</a>
							</li>
							<li>
								<span className="detailLabel">CfP published</span>
								<span>{selectedConference.cfpPublished ? "Yes" : "No"}</span>
							</li>
						</ul>
					</section>

					<section className="detailCard panel">
						<div className="sectionHeading">
							<div>
								<p className="sectionEyebrow">Traceability</p>
								<h2>Source pages</h2>
							</div>
						</div>
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

					<section className="detailCard panel">
						<div className="sectionHeading">
							<div>
								<p className="sectionEyebrow">History</p>
								<h2>Past conference records</h2>
							</div>
						</div>
						{pastConferenceEntries.length === 0 ? (
							<p className="emptyState">
								No past records for this series in the app yet.
							</p>
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
				</div>

				<section className="detailCard detailCardWide panel">
					<div className="sectionHeading">
						<div>
							<p className="sectionEyebrow">Timeline</p>
							<h2>Events</h2>
						</div>
					</div>
					<div className="tableScroller">
						<table className="dataTable">
							<thead>
								<tr>
									<th>Event</th>
									<th>Time (UTC)</th>
									<th>Source</th>
								</tr>
							</thead>
							<tbody>
								{selectedConference.events.map((event) => {
									const isPastDeadline =
										isDeadlineEventType(event.event_type) &&
										isPastUtc(event.start_at_utc, now);

									return (
										<tr
											key={`${event.event_type}-${event.start_at_utc}-${event.source_url}`}
											className={isPastDeadline ? "expiredRow" : undefined}
										>
											<td>
												<div className="eventTitle">
													<span className="eventLabel">
														{formatEventType(event.event_type)}
													</span>
													<code className="eventCode">{event.event_type}</code>
												</div>
											</td>
											<td>
												<span className="dateValue">
													{formatUtc(event.start_at_utc)}
												</span>
												{event.end_at_utc ? (
													<div className="dateRange">
														to {formatUtc(event.end_at_utc)}
													</div>
												) : null}
											</td>
											<td>
												<a
													className="sourceLink"
													href={event.source_url}
													target="_blank"
													rel="noreferrer"
												>
													Open source
												</a>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>
				<SiteFooter />
			</main>
		);
	}

	return (
		<main className="page">
			<header className="hero">
				<p className="eyebrow">Curated deadline index</p>
				<h1>Future Paper Tracker</h1>
				<p className="heroText">
					Deadlines and conference dates across algorithms, optimization, and
					theory, curated for Japanese researchers.
				</p>
				<div className="heroStats">
					<div className="statCard">
						<span className="statLabel">Visible deadlines</span>
						<strong className="statValue">{filteredRows.length}</strong>
					</div>
					<div className="statCard">
						<span className="statLabel">Tracked editions</span>
						<strong className="statValue">{trackedEditionCount}</strong>
					</div>
					<div className="statCard">
						<span className="statLabel">Tracked series</span>
						<strong className="statValue">{trackedSeriesCount}</strong>
					</div>
					<div className="statCard">
						<span className="statLabel">Pending keys</span>
						<strong className="statValue">{pendingCount}</strong>
					</div>
				</div>
				<div className="heroMeta">
					<span className="metaChip">
						Generated {formatUtc(data.generated_at)}
					</span>
				</div>
			</header>

			<section className="controls panel">
				<div className="sectionHeading">
					<div>
						<p className="sectionEyebrow">Filter</p>
						<h2>Primary submission deadlines</h2>
					</div>
					<p className="sectionHint">Sorted by the latest primary deadline.</p>
				</div>
				<label className="searchField">
					<span>Search</span>
					<input
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setCurrentPage(1);
						}}
						placeholder="conference name / abbreviation"
					/>
				</label>
			</section>

			<section ref={tableSectionRef} className="tableWrap panel">
				<div className="sectionHeading sectionHeadingTight">
					<div>
						<p className="sectionEyebrow">Queue</p>
						<h2>Deadline board</h2>
					</div>
					<p className="sectionHint">
						{filteredRows.length === 0
							? "No visible deadlines."
							: `Showing ${pageStart}-${pageEnd} of ${filteredRows.length}.`}
					</p>
				</div>
				<div className="tableScroller">
					<table className="dataTable">
						<thead>
							<tr>
								<th>Conference</th>
								<th>Deadline</th>
								<th>Source</th>
							</tr>
						</thead>
						<tbody>
							{filteredRows.length === 0 ? (
								<tr>
									<td colSpan={3}>
										<div className="emptyState">
											No conferences matched the current search.
										</div>
									</td>
								</tr>
							) : (
								paginatedRows.map((row) => {
									const tag = deadlineTag(row.eventType);
									const isPastDeadline = isPastUtc(row.startAtUtc, now);
									return (
										<tr
											key={`${row.conferenceId}-${row.eventType}-${row.startAtUtc}`}
											className={isPastDeadline ? "expiredRow" : undefined}
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
											</td>
											<td>
												<span className="dateValue">
													{formatUtc(row.startAtUtc)}
												</span>
												{row.endAtUtc ? (
													<div className="dateRange">
														to {formatUtc(row.endAtUtc)}
													</div>
												) : null}
												<div className="deadlineMeta">
													<span className={`tag ${tag.tone}`}>{tag.label}</span>
												</div>
											</td>
											<td>
												<a
													className="sourceLink"
													href={row.sourceUrl}
													target="_blank"
													rel="noreferrer"
												>
													Open source
												</a>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
				{totalPages > 1 ? (
					<nav className="pagination" aria-label="Deadline pages">
						<button
							type="button"
							className="paginationButton"
							onClick={() => goToPage(visiblePage - 1)}
							disabled={visiblePage === 1}
						>
							Previous
						</button>
						<div className="paginationNumbers">
							{paginationItems.map((item) =>
								typeof item === "number" ? (
									<button
										key={item}
										type="button"
										className={`paginationButton paginationNumber ${
											item === visiblePage ? "paginationButtonActive" : ""
										}`}
										onClick={() => goToPage(item)}
										disabled={item === visiblePage}
										aria-current={item === visiblePage ? "page" : undefined}
									>
										{item}
									</button>
								) : (
									<span
										key={item}
										className="paginationEllipsis"
										aria-hidden="true"
									>
										...
									</span>
								),
							)}
						</div>
						<button
							type="button"
							className="paginationButton"
							onClick={() => goToPage(visiblePage + 1)}
							disabled={visiblePage === totalPages}
						>
							Next
						</button>
					</nav>
				) : null}
			</section>
			<footer className="footer panel">
				<div className="sectionHeading sectionHeadingTight">
					<div>
						<p className="sectionEyebrow">Backlog</p>
						<h2>Pending conference keys</h2>
					</div>
				</div>
				{data.pending_conference_keys.length === 0 ? (
					<p className="emptyState">No pending conference keys.</p>
				) : (
					<div className="pendingList">
						{data.pending_conference_keys.map((conferenceKey) => (
							<span key={conferenceKey} className="pendingChip">
								{conferenceKey}
							</span>
						))}
					</div>
				)}
			</footer>
			<SiteFooter />
		</main>
	);
}

export default App;
