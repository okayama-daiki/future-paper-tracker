import { parseHTML } from "linkedom";

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

/**
 * Searches DuckDuckGo directly without an external search proxy.
 */
export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const searchUrl = new URL("https://html.duckduckgo.com/html/");
  searchUrl.searchParams.set("q", query);

  let response: Response;
  try {
    response = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; future-paper-tracker/1.0; +https://github.com/okayama-daiki/future-paper-tracker)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const html = await response.text();
  const { document } = parseHTML(html);
  const results: SearchResult[] = [];

  const anchors = document.querySelectorAll("a.result__a");
  const snippets = document.querySelectorAll("a.result__snippet");

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    if (!anchor) continue;
    const href = anchor.getAttribute("href") ?? "";
    const targetUrl = extractUrl(href);
    if (!targetUrl) continue;
    results.push({
      url: targetUrl,
      title: anchor.textContent?.trim() ?? "",
      snippet: snippets[i]?.textContent?.trim() ?? "",
    });
  }

  return results.slice(0, 10);
}

function extractUrl(href: string): string | null {
  try {
    const base = href.startsWith("//") ? "https:" + href : href;
    const parsed = new URL(base);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (href.startsWith("http")) return href;
    return null;
  } catch {
    return null;
  }
}
