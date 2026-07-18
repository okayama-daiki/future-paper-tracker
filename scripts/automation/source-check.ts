import { createHash } from "node:crypto";

import type { ResolvedSource } from "./source-registry.ts";

export interface SourceSignals {
  dateLines: string[];
  deadlineLines: string[];
  venueLines: string[];
}

export interface SourceCheckResult {
  id: string;
  kind: ResolvedSource["kind"];
  role: ResolvedSource["role"];
  url: string;
  ok: boolean;
  status: number | null;
  contentHash: string | null;
  signals: SourceSignals;
  error: string | null;
}

export type FetchSource = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const datePattern = new RegExp(
  [
    "20\\d{2}\\s*(?:年|[-/.])\\s*\\d{1,2}\\s*(?:月|[-/.])\\s*\\d{1,2}\\s*日?",
    "\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日",
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+20\\d{2})?",
    "\\d{1,2}\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\\s+20\\d{2})?",
  ].join("|"),
  "i",
);
const deadlinePattern =
  /締切|〆切|期限|deadline|submission|abstract|paper registration|発表申込|講演申込|原稿|参加申込/i;
const venuePattern = /会場|開催場所|場所|venue|location|city|開催地/i;

export async function checkSource(
  source: ResolvedSource,
  fetchSource: FetchSource = fetch,
): Promise<SourceCheckResult> {
  try {
    const response = await fetchSource(source.url, {
      headers: {
        accept: "text/html,application/json,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "future-paper-tracker/1.0 (+conference metadata checker)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return failedResult(source, response.status, `HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const raw = decodeResponseBody(new Uint8Array(await response.arrayBuffer()), contentType);
    const text = normalizeSourceText(raw, source.kind, contentType);
    const shouldNarrow =
      source.role === "discovery" || source.kind === "github_pages" || source.kind === "tcs_conf";
    const relevantText = narrowToAliases(text, source.aliases, shouldNarrow);
    const signals = extractSignals(relevantText);

    return {
      id: source.id,
      kind: source.kind,
      role: source.role,
      url: response.url || source.url,
      ok: true,
      status: response.status,
      contentHash: createHash("sha256").update(relevantText).digest("hex").slice(0, 16),
      signals,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failedResult(source, null, message);
  }
}

export function normalizeSourceText(
  raw: string,
  kind: ResolvedSource["kind"],
  contentType = "",
): string {
  if (kind === "wordpress_rest" || contentType.includes("application/json")) {
    try {
      return htmlToText(collectJsonStrings(JSON.parse(raw) as unknown).join("\n"));
    } catch {
      // Some WordPress installations return HTML for an unavailable REST route.
    }
  }

  return htmlToText(raw);
}

export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:address|article|div|dd|dt|h[1-6]|li|p|section|td|th|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function narrowToAliases(text: string, aliases: string[], shouldNarrow = true): string {
  if (!shouldNarrow || aliases.length === 0) {
    return text;
  }

  const lines = text.split("\n");
  const matchedIndexes = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = lines[index].toLocaleLowerCase("en");
    if (aliases.some((alias) => normalizedLine.includes(alias.toLocaleLowerCase("en")))) {
      for (
        let contextIndex = Math.max(0, index - 1);
        contextIndex <= index + 2;
        contextIndex += 1
      ) {
        if (contextIndex < lines.length) {
          matchedIndexes.add(contextIndex);
        }
      }
    }
  }

  if (matchedIndexes.size === 0) {
    return text;
  }

  return [...matchedIndexes]
    .sort((left, right) => left - right)
    .map((index) => lines[index])
    .join("\n");
}

export function extractSignals(text: string): SourceSignals {
  const lines = uniqueLines(text);
  return {
    dateLines: lines.filter((line) => datePattern.test(line)).slice(0, 24),
    deadlineLines: lines
      .filter((line) => deadlinePattern.test(line) && datePattern.test(line))
      .slice(0, 24),
    venueLines: lines.filter((line) => venuePattern.test(line)).slice(0, 12),
  };
}

export function hasUsefulSignals(result: SourceCheckResult, targetYear?: number): boolean {
  if (!result.ok) {
    return false;
  }

  const lines = [...result.signals.dateLines, ...result.signals.deadlineLines];
  return targetYear == null
    ? lines.length > 0
    : lines.some((line) => line.includes(String(targetYear)));
}

export function decodeResponseBody(bytes: Uint8Array, contentType: string): string {
  const asciiPreview = new TextDecoder("ascii").decode(bytes.slice(0, 4096));
  const declaredCharset =
    contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] ??
    asciiPreview.match(/<meta[^>]+charset\s*=\s*["']?([^;"'\s/>]+)/i)?.[1] ??
    asciiPreview.match(/<meta[^>]+content=["'][^"']*charset=([^;"'\s]+)/i)?.[1] ??
    "utf-8";
  const charset = /^(?:shift[_-]?jis|sjis|windows-31j)$/i.test(declaredCharset)
    ? "shift_jis"
    : declaredCharset;

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function failedResult(
  source: ResolvedSource,
  status: number | null,
  error: string,
): SourceCheckResult {
  return {
    id: source.id,
    kind: source.kind,
    role: source.role,
    url: source.url,
    ok: false,
    status,
    contentHash: null,
    signals: { dateLines: [], deadlineLines: [], venueLines: [] },
    error,
  };
}

function collectJsonStrings(value: unknown, key = "root"): string[] {
  if (typeof value === "string") {
    return key === "rendered" || key === "description" ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectJsonStrings(item, key));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .filter(([childKey]) =>
        ["content", "description", "excerpt", "rendered", "title"].includes(childKey),
      )
      .flatMap(([childKey, childValue]) => collectJsonStrings(childValue, childKey));
  }
  return [];
}

function uniqueLines(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim().slice(0, 500);
    if (line && !seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  return lines;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#")) {
      const radix = key[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? key.slice(2) : key.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }
    return namedEntities[key.toLowerCase()] ?? entity;
  });
}
