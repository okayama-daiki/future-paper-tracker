import { useMemo, useRef, useState } from "react";
import "./App.css";
import { ConferenceDetailPage } from "./components/ConferenceDetailPage";
import { ConferenceListPage } from "./components/ConferenceListPage";
import { conferencesData } from "./data/conferencesData";
import { useConferenceSelection } from "./hooks/useConferenceSelection";
import { useCurrentTime } from "./hooks/useCurrentTime";
import {
	buildConferenceEntries,
	buildConferenceEntryMap,
	buildDeadlineRows,
} from "./lib/conference-data";

function App() {
	const [query, setQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const tableSectionRef = useRef<HTMLElement | null>(null);
	const now = useCurrentTime();
	const { selectedConferenceId, openConference, backToList } =
		useConferenceSelection();

	const conferenceEntries = useMemo(
		() => buildConferenceEntries(conferencesData),
		[],
	);
	const conferenceEntryMap = useMemo(
		() => buildConferenceEntryMap(conferenceEntries),
		[conferenceEntries],
	);
	const deadlineRows = useMemo(
		() => buildDeadlineRows(conferenceEntries),
		[conferenceEntries],
	);

	const selectedConference = selectedConferenceId
		? (conferenceEntryMap.get(selectedConferenceId) ?? null)
		: null;

	const handleQueryChange = (nextQuery: string) => {
		setQuery(nextQuery);
		setCurrentPage(1);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		tableSectionRef.current?.scrollIntoView({
			block: "start",
			behavior: "smooth",
		});
	};

	if (selectedConference) {
		return (
			<ConferenceDetailPage
				conference={selectedConference}
				allConferences={conferenceEntries}
				generatedAt={conferencesData.generated_at}
				now={now}
				onBack={backToList}
				onOpenConference={openConference}
			/>
		);
	}

	return (
		<ConferenceListPage
			generatedAt={conferencesData.generated_at}
			rows={deadlineRows}
			trackedSeriesCount={conferencesData.conferences.length}
			trackedEditionCount={conferenceEntries.length}
			pendingConferenceKeys={conferencesData.pending_conference_keys}
			query={query}
			currentPage={currentPage}
			now={now}
			tableSectionRef={tableSectionRef}
			onQueryChange={handleQueryChange}
			onOpenConference={openConference}
			onGoToPage={handlePageChange}
		/>
	);
}

export default App;
