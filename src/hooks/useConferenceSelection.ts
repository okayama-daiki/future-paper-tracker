import { useCallback, useEffect, useState } from "react";
import {
	readConferenceIdFromUrl,
	updateConferenceInUrl,
} from "../lib/conference-routing";

export function useConferenceSelection() {
	const [selectedConferenceId, setSelectedConferenceId] = useState<string | null>(
		() => readConferenceIdFromUrl(),
	);

	useEffect(() => {
		const onPopState = () => {
			setSelectedConferenceId(readConferenceIdFromUrl());
		};

		window.addEventListener("popstate", onPopState);
		return () => {
			window.removeEventListener("popstate", onPopState);
		};
	}, []);

	const openConference = useCallback((conferenceId: string) => {
		updateConferenceInUrl(conferenceId, "push");
		setSelectedConferenceId(conferenceId);
	}, []);

	const backToList = useCallback(() => {
		if (readConferenceIdFromUrl() !== null && window.history.length > 1) {
			window.history.back();
			return;
		}

		updateConferenceInUrl(null, "replace");
		setSelectedConferenceId(null);
	}, []);

	return {
		selectedConferenceId,
		openConference,
		backToList,
	};
}
