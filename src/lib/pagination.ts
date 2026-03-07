export function buildPaginationItems(
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
