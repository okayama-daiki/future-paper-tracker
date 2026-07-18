import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Conference, ConferenceSeriesConfig } from "./shared.ts";
import { repoRoot } from "./shared.ts";

export type SourceKind =
  | "github_pages"
  | "ieice_ken"
  | "rss"
  | "static_html"
  | "tcs_conf"
  | "wordpress_rest";

export type SourceRole = "discovery" | "official";

export interface SourceDefinition {
  id: string;
  kind: SourceKind;
  role: SourceRole;
  url_template: string;
  series_ids: string[];
  aliases?: string[];
}

export interface SourceRegistry {
  version: number;
  sources: SourceDefinition[];
}

export interface ResolvedSource {
  id: string;
  kind: SourceKind;
  role: SourceRole;
  url: string;
  aliases: string[];
}

export const sourceRegistryPath = path.join(repoRoot, "config", "conference-sources.json");

export async function loadSourceRegistry(): Promise<SourceRegistry> {
  const raw = await readFile(sourceRegistryPath, "utf8");
  return validateSourceRegistry(JSON.parse(raw) as unknown);
}

export function validateSourceRegistry(value: unknown): SourceRegistry {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.sources)) {
    throw new Error("config/conference-sources.json must contain version 1 and a sources array.");
  }

  const ids = new Set<string>();
  const sources = value.sources.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`Source at index ${index} must be an object.`);
    }

    const source = candidate as Partial<SourceDefinition>;
    if (
      typeof source.id !== "string" ||
      !isSourceKind(source.kind) ||
      !isSourceRole(source.role) ||
      typeof source.url_template !== "string" ||
      !Array.isArray(source.series_ids) ||
      !source.series_ids.every((seriesId) => typeof seriesId === "string") ||
      (source.aliases != null &&
        (!Array.isArray(source.aliases) ||
          !source.aliases.every((alias) => typeof alias === "string")))
    ) {
      throw new Error(`Source at index ${index} has an invalid shape.`);
    }

    if (ids.has(source.id)) {
      throw new Error(`Duplicate source id: ${source.id}`);
    }
    ids.add(source.id);

    return source as SourceDefinition;
  });

  return { version: 1, sources };
}

export function resolveSeriesSources(
  registry: SourceRegistry,
  config: ConferenceSeriesConfig,
  conference: Conference | null,
  now = new Date(),
): ResolvedSource[] {
  const year = conference?.year ?? now.getUTCFullYear();
  const templateVariables = { year: String(year), series_id: config.id };
  const resolved = registry.sources
    .filter((source) => source.series_ids.includes(config.id))
    .map((source) => ({
      id: source.id,
      kind: source.kind,
      role: source.role,
      url: interpolate(source.url_template, templateVariables),
      aliases: (source.aliases ?? [config.id]).map((alias) =>
        interpolate(alias, templateVariables),
      ),
    }));

  if (conference?.url) {
    addOfficialFallback(resolved, "conference-page", conference.url, [config.id, conference.name]);
  }
  addOfficialFallback(resolved, "series-home", config.url, [config.id, config.name]);

  return resolved;
}

function addOfficialFallback(
  sources: ResolvedSource[],
  id: string,
  url: string,
  aliases: string[],
): void {
  if (!url || sources.some((source) => normalizeUrl(source.url) === normalizeUrl(url))) {
    return;
  }

  sources.push({ id, kind: "static_html", role: "official", url, aliases });
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\$\{([a-z_]+)\}/g, (match, key: string) => values[key] ?? match);
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSourceKind(value: unknown): value is SourceKind {
  return (
    value === "github_pages" ||
    value === "ieice_ken" ||
    value === "rss" ||
    value === "static_html" ||
    value === "tcs_conf" ||
    value === "wordpress_rest"
  );
}

function isSourceRole(value: unknown): value is SourceRole {
  return value === "discovery" || value === "official";
}
