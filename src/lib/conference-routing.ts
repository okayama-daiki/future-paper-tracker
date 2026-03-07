export type HistoryMode = "push" | "replace";

export function readConferenceIdFromUrl(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	const params = new URLSearchParams(window.location.search);
	return params.get("conference");
}

export function updateConferenceInUrl(
	conferenceId: string | null,
	mode: HistoryMode = "push",
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
