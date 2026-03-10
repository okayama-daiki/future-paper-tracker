export function formatUtc(iso: string): string {
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

export function isPastUtc(iso: string, now: number): boolean {
	const timestamp = new Date(iso).getTime();
	if (Number.isNaN(timestamp)) {
		return false;
	}
	return timestamp < now;
}
