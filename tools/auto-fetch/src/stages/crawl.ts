import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface CrawlResult {
  url: string;
  title: string;
  textContent: string;
  htmlContent: string;
}

/**
 * Fetches a URL and extracts the main readable content using @mozilla/readability.
 */
export async function crawl(url: string): Promise<CrawlResult | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; future-paper-tracker/1.0; +https://github.com/okayama-daiki/future-paper-tracker)",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.warn(`[crawl] Failed to fetch ${url}: ${String(err)}`);
    return null;
  }

  if (!response.ok) {
    console.warn(`[crawl] ${url} returned ${response.status}`);
    return null;
  }

  const html = await response.text();

  try {
    const { document } = parseHTML(html);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reader = new Readability(document as any);
    const article = reader.parse();

    if (!article) {
      // Readability failed; fall back to raw HTML
      return {
        url,
        title: extractTitle(html),
        textContent: stripHtml(html),
        htmlContent: html,
      };
    }

    return {
      url,
      title: article.title,
      textContent: article.textContent,
      htmlContent: article.content,
    };
  } catch (err) {
    console.warn(`[crawl] Failed to parse ${url}: ${String(err)}`);
    return null;
  }
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match?.[1]?.trim() ?? "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
