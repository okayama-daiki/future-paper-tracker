import { useMemo } from "react";
import type { ConferenceEntry } from "../types/view";
import {
	buildDisplayEvents,
	formatEventType,
	getPastConferenceEntries,
	isDeadlineEventType,
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

export function ConferenceDetailPage({
	conference,
	allConferences,
	generatedAt,
	now,
	onBack,
	onOpenConference,
}: ConferenceDetailPageProps) {
	const displayEvents = useMemo(
		() => buildDisplayEvents(conference, allConferences),
		[conference, allConferences],
	);
	const sourceLinks = useMemo(
		() => Array.from(new Set(displayEvents.map((event) => event.source_url))),
		[displayEvents],
	);
	const pastConferenceEntries = useMemo(
		() => getPastConferenceEntries(conference, allConferences),
		[conference, allConferences],
	);

	return (
		<main className="page">
			<header className="hero heroDetail">
				<div className="heroActions">
					<button className="backButton" type="button" onClick={onBack}>
						Back to list
					</button>
					<a
						className="heroLink"
						href={conference.editionOfficialSite}
						target="_blank"
						rel="noreferrer"
					>
						Open site
					</a>
				</div>
				<p className="eyebrow">{conference.conferenceKey} edition</p>
				<h1>{conference.displayKey}</h1>
				<p className="heroText">{conference.conferenceName}</p>
				<div className="heroMeta">
					<span className="metaChip">Generated {formatUtc(generatedAt)}</span>
					<span className="metaChip">{displayEvents.length} tracked events</span>
					<span
						className={`metaChip ${
							conference.cfpPublished ? "metaChipLive" : "metaChipMuted"
						}`}
					>
						CfP {conference.cfpPublished ? "published" : "not published"}
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
								href={conference.seriesOfficialSite}
								target="_blank"
								rel="noreferrer"
							>
								{conference.seriesOfficialSite}
							</a>
						</li>
						<li>
							<span className="detailLabel">Edition official site</span>
							<a
								href={conference.editionOfficialSite}
								target="_blank"
								rel="noreferrer"
							>
								{conference.editionOfficialSite}
							</a>
						</li>
						<li>
							<span className="detailLabel">CfP published</span>
							<span>{conference.cfpPublished ? "Yes" : "No"}</span>
						</li>
						{conference.venue ? (
							<li>
								<span className="detailLabel">Venue</span>
								{conference.venueSourceUrl ? (
									<a
										href={conference.venueSourceUrl}
										target="_blank"
										rel="noreferrer"
									>
										{conference.venue}
									</a>
								) : (
									<span>{conference.venue}</span>
								)}
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
						<h2>Events</h2>
					</div>
				</div>
				<div className="tableScroller">
					<table className="dataTable">
						<thead>
							<tr>
								<th>Event</th>
								<th>Time (UTC)</th>
								<th>Conference site</th>
							</tr>
						</thead>
						<tbody>
							{displayEvents.map((event) => {
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
												{event.estimated ? (
													<div className="eventNote">
														Estimated from {conference.conferenceKey}{" "}
														{event.estimated_from_year}
													</div>
												) : null}
											</div>
										</td>
										<td>
											<span className="dateValue">
												{formatUtc(event.start_at_utc)}
												{event.estimated ? " ?" : ""}
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
												href={conference.editionOfficialSite}
												target="_blank"
												rel="noreferrer"
											>
												Open site
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
