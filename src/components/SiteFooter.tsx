import {
	BUY_ME_A_COFFEE_URL,
	GITHUB_REPO_URL,
} from "../constants/site";

export function SiteFooter() {
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
