import { useMemo, type RefObject } from "react";
import { ROWS_PER_PAGE } from "../constants/site";
import { filterDeadlineRows, deadlineTag } from "../lib/conference-data";
import { formatUtc, isPastUtc } from "../lib/date";
import { buildPaginationItems } from "../lib/pagination";
import type { DeadlineRow } from "../types/view";
import { SiteFooter } from "./SiteFooter";

type ConferenceListPageProps = {
	generatedAt: string;
	rows: DeadlineRow[];
	trackedSeriesCount: number;
	trackedEditionCount: number;
	query: string;
	currentPage: number;
	now: number;
	tableSectionRef: RefObject<HTMLElement | null>;
	onQueryChange: (query: string) => void;
	onOpenConference: (conferenceId: string) => void;
	onGoToPage: (page: number) => void;
};

function SummaryCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="statCard">
			<span className="statLabel">{label}</span>
			<strong className="statValue">{value}</strong>
		</div>
	);
}

function formatDateAtVenue(row: DeadlineRow): string | null {
	const parts: string[] = [];
	if (row.startAtUtc) {
		const start = new Date(row.startAtUtc);
		if (!Number.isNaN(start.getTime())) {
			const y = start.getUTCFullYear();
			const m = String(start.getUTCMonth() + 1).padStart(2, "0");
			const d = String(start.getUTCDate()).padStart(2, "0");
			let dateStr = `${y}-${m}-${d}`;
			if (row.endAtUtc) {
				const end = new Date(row.endAtUtc);
				if (!Number.isNaN(end.getTime())) {
					const em = String(end.getUTCMonth() + 1).padStart(2, "0");
					const ed = String(end.getUTCDate()).padStart(2, "0");
					if (end.getUTCFullYear() === y) {
						dateStr = `${y}-${m}-${d} – ${em}-${ed}`;
					} else {
						dateStr = `${y}-${m}-${d} – ${end.getUTCFullYear()}-${em}-${ed}`;
					}
				}
			}
			parts.push(dateStr);
		}
	}
	if (row.venue) {
		parts.push(row.venue);
	}
	return parts.length > 0 ? parts.join(" @ ") : null;
}

export function ConferenceListPage({
	generatedAt,
	rows,
	trackedSeriesCount,
	trackedEditionCount,
	query,
	currentPage,
	now,
	tableSectionRef,
	onQueryChange,
	onOpenConference,
	onGoToPage,
}: ConferenceListPageProps) {
	const filteredRows = useMemo(
		() => filterDeadlineRows(rows, query),
		[rows, query],
	);
	const openConferenceCount = useMemo(
		() =>
			filteredRows.filter((row) => !isPastUtc(row.milestoneAtUtc, now)).length,
		[filteredRows, now],
	);
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

	return (
		<main className="page">
			<header className="hero">
				<p className="eyebrow">Conference deadline tracker</p>
				<h1>Future Paper Tracker</h1>
				<p className="heroText">
					Deadlines and conference dates across algorithms, optimization, and
					theory, curated for Japanese researchers.
				</p>
				<div className="heroStats">
					<SummaryCard label="Open conferences" value={openConferenceCount} />
					<SummaryCard label="Tracked editions" value={trackedEditionCount} />
					<SummaryCard label="Tracked series" value={trackedSeriesCount} />
				</div>
				<div className="heroMeta">
					<span className="metaChip">Generated {formatUtc(generatedAt)}</span>
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
						onChange={(event) => onQueryChange(event.target.value)}
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
								<th>Conference site</th>
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
									const tag = deadlineTag(row.milestoneType);
									const isPastDeadline = isPastUtc(row.milestoneAtUtc, now);
									const dateAtVenue = formatDateAtVenue(row);

									return (
										<tr
											key={`${row.conferenceEntryId}-${row.milestoneType}-${row.milestoneAtUtc}`}
											className={isPastDeadline ? "expiredRow" : undefined}
										>
											<td>
												<button
													type="button"
													className="conferenceLink"
													onClick={() =>
														onOpenConference(row.conferenceEntryId)
													}
												>
													<strong>{row.displayKey}</strong>
												</button>
												<div className="sub">{row.conferenceName}</div>
												{dateAtVenue ? (
													<div className="sub subMuted">{dateAtVenue}</div>
												) : null}
											</td>
											<td>
												<span className="dateValue">
													{formatUtc(row.milestoneAtUtc)}
													{row.estimated ? " ?" : ""}
												</span>
												<div className="deadlineMeta">
													<span className={`tag ${tag.tone}`}>{tag.label}</span>
													{row.estimated ? (
														<span className="tag estimated">ESTIMATED</span>
													) : null}
												</div>
											</td>
											<td>
												<a
													className="sourceLink"
													href={row.conferenceUrl}
													target="_blank"
													rel="noreferrer"
												>
													Open site
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
							onClick={() => onGoToPage(Math.max(1, visiblePage - 1))}
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
										onClick={() => onGoToPage(item)}
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
							onClick={() => onGoToPage(Math.min(totalPages, visiblePage + 1))}
							disabled={visiblePage === totalPages}
						>
							Next
						</button>
					</nav>
				) : null}
			</section>

			<SiteFooter />
		</main>
	);
}
