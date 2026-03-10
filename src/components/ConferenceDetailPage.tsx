import { useMemo } from "react";
import type { ConferenceEntry } from "../types/view";
import {
	buildDisplayMilestones,
	formatMilestoneType,
	getPastConferenceEntries,
	isDeadlineMilestoneType,
} from "../lib/conference-data";
import { formatUtc, isPastUtc } from "../lib/date";
import { SiteFooter } from "./SiteFooter";

type ConferenceDetailPageProps = {
	conference: ConferenceEntry;
	allConferences: ConferenceEntry[];
	generatedAt: string;
	now: number;
	onBack: () => void;
	onOpenConference: (conferenceId: string) => void;
};

function formatConferenceDates(conference: ConferenceEntry): string | null {
	if (!conference.startAtUtc) return null;
	const start = new Date(conference.startAtUtc);
	if (Number.isNaN(start.getTime())) return null;

	const y = start.getUTCFullYear();
	const m = String(start.getUTCMonth() + 1).padStart(2, "0");
	const d = String(start.getUTCDate()).padStart(2, "0");
	let dateStr = `${y}-${m}-${d}`;

	if (conference.endAtUtc) {
		const end = new Date(conference.endAtUtc);
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

	if (conference.venue) {
		return `${dateStr} @ ${conference.venue}`;
	}
	return dateStr;
}

export function ConferenceDetailPage({
	conference,
	allConferences,
	generatedAt,
	now,
	onBack,
	onOpenConference,
}: ConferenceDetailPageProps) {
	const displayMilestones = useMemo(
		() => buildDisplayMilestones(conference, allConferences),
		[conference, allConferences],
	);
	const sourceLinks = useMemo(
		() =>
			Array.from(
				new Set(displayMilestones.map((milestone) => milestone.source_url)),
			),
		[displayMilestones],
	);
	const pastConferenceEntries = useMemo(
		() => getPastConferenceEntries(conference, allConferences),
		[conference, allConferences],
	);

	const dateAtVenue = formatConferenceDates(conference);

	return (
		<main className="page">
			<header className="hero heroDetail">
				<div className="heroActions">
					<button className="backButton" type="button" onClick={onBack}>
						Back to list
					</button>
					<a
						className="heroLink"
						href={conference.conferenceUrl}
						target="_blank"
						rel="noreferrer"
					>
						Open site
					</a>
				</div>
				<p className="eyebrow">{conference.seriesId} edition</p>
				<h1>{conference.displayKey}</h1>
				<p className="heroText">{conference.conferenceName}</p>
				{dateAtVenue ? <p className="heroText">{dateAtVenue}</p> : null}
				<div className="heroMeta">
					<span className="metaChip">Generated {formatUtc(generatedAt)}</span>
					<span className="metaChip">
						{displayMilestones.length} tracked milestones
					</span>
					<span
						className={`metaChip ${
							conference.hasCallForPaper ? "metaChipLive" : "metaChipMuted"
						}`}
					>
						CfP {conference.hasCallForPaper ? "published" : "not published"}
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
							<a href={conference.seriesUrl} target="_blank" rel="noreferrer">
								{conference.seriesUrl}
							</a>
						</li>
						<li>
							<span className="detailLabel">Edition official site</span>
							<a
								href={conference.conferenceUrl}
								target="_blank"
								rel="noreferrer"
							>
								{conference.conferenceUrl}
							</a>
						</li>
						{conference.venue ? (
							<li>
								<span className="detailLabel">Venue</span>
								<span>{conference.venue}</span>
							</li>
						) : null}
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
										onClick={() => onOpenConference(entry.id)}
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
						<h2>Milestones</h2>
					</div>
				</div>
				<div className="tableScroller">
					<table className="dataTable">
						<thead>
							<tr>
								<th>Milestone</th>
								<th>Time (UTC)</th>
								<th>Source</th>
							</tr>
						</thead>
						<tbody>
							{displayMilestones.map((milestone) => {
								const isPastDeadline =
									isDeadlineMilestoneType(milestone.type) &&
									isPastUtc(milestone.at_utc, now);

								return (
									<tr
										key={`${milestone.type}-${milestone.at_utc}-${milestone.source_url}`}
										className={isPastDeadline ? "expiredRow" : undefined}
									>
										<td>
											<div className="eventTitle">
												<span className="eventLabel">
													{formatMilestoneType(milestone.type)}
												</span>
												<code className="eventCode">{milestone.type}</code>
												{milestone.is_estimated ? (
													<div className="eventNote">Estimated</div>
												) : null}
											</div>
										</td>
										<td>
											<span className="dateValue">
												{formatUtc(milestone.at_utc)}
												{milestone.is_estimated ? " ?" : ""}
											</span>
										</td>
										<td>
											<a
												className="sourceLink"
												href={milestone.source_url}
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
