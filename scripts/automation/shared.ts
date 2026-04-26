import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Milestone {
  type: string;
  at_utc: string;
  source_url: string;
  is_estimated: boolean;
}

export interface CallForPaper {
  source_url: string;
  page_count: number | null;
}

export interface Conference {
  id: string;
  series_id: string;
  name: string;
  year: number;
  ordinal_no: number | null;
  url: string;
  venue: string | null;
  start_at_utc: string | null;
  end_at_utc: string | null;
  milestones: Milestone[];
  call_for_paper: CallForPaper | null;
}

export interface ConferenceSeries {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  conferences: Conference[];
}

export interface ConferenceSeriesConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface ConferencesData {
  generated_at: string;
  conference_series: ConferenceSeries[];
}

export type TargetStatus =
  | "estimated_conference"
  | "missing_series_in_data"
  | "no_action"
  | "partial_conference"
  | "upcoming_conference_check";

export type ConferenceState =
  | "confirmed"
  | "estimated"
  | "ongoing"
  | "partial"
  | "past"
  | "upcoming";

export interface ConferenceSummary {
  state: ConferenceState;
  hasEstimatedMilestone: boolean;
  hasMissingCoreFields: boolean;
  isFutureOrOngoing: boolean;
  sortTime: number;
}

export interface SeriesTarget {
  status: TargetStatus;
  reason: string;
  conference: Conference | null;
}

export interface ConferenceLookupResult {
  series: ConferenceSeries;
  conference: Conference;
}

export interface AutomationTarget {
  inputKind: "conference" | "series";
  series: ConferenceSeries;
  target: SeriesTarget;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..", "..");
export const conferencesDataPath = path.join(repoRoot, "data", "conferences.json");
export const conferencesConfigPath = path.join(repoRoot, "config", "conferences.csv");

export function isoNowWithoutMilliseconds(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function branchTimestamp(date = new Date()): string {
  return isoNowWithoutMilliseconds(date)
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/g, "")
    .replace("Z", "z");
}

export async function loadConferenceData(): Promise<ConferencesData> {
  const raw = await readFile(conferencesDataPath, "utf8");
  return JSON.parse(raw) as ConferencesData;
}

export async function loadConferenceConfig(): Promise<ConferenceSeriesConfig[]> {
  const raw = await readFile(conferencesConfigPath, "utf8");
  const rows = parseCsv(raw);
  const [header, ...records] = rows;

  if (!header) {
    return [];
  }

  return records
    .filter((record) => record.some((value) => value.length > 0))
    .map((record) => recordToObject(header, record))
    .map((record) => ({
      id: record.id,
      name: record.name,
      url: record.url,
      enabled: record.enabled === "true",
    }));
}

export function summarizeConference(conference: Conference, now = new Date()): ConferenceSummary {
  const nowTime = now.getTime();
  const startTime = parseDateValue(conference.start_at_utc);
  const endTime = parseDateValue(conference.end_at_utc);
  const hasEstimatedMilestone = conference.milestones.some((milestone) => milestone.is_estimated);
  const hasMissingCoreFields =
    conference.venue == null ||
    conference.start_at_utc == null ||
    conference.end_at_utc == null ||
    conference.call_for_paper == null ||
    conference.milestones.length === 0;
  const isFutureOrOngoing =
    endTime == null ? conference.year >= now.getUTCFullYear() : endTime >= nowTime;

  let state: ConferenceState = "confirmed";
  if (hasEstimatedMilestone) {
    state = "estimated";
  } else if (hasMissingCoreFields) {
    state = "partial";
  } else if (endTime != null && endTime < nowTime) {
    state = "past";
  } else if (startTime != null && startTime > nowTime) {
    state = "upcoming";
  } else if (startTime != null && endTime != null && startTime <= nowTime && endTime >= nowTime) {
    state = "ongoing";
  }

  return {
    state,
    hasEstimatedMilestone,
    hasMissingCoreFields,
    isFutureOrOngoing,
    sortTime: startTime ?? endTime ?? Date.UTC(conference.year, 0, 1),
  };
}

export function selectSeriesTarget(
  _configSeries: ConferenceSeriesConfig,
  dataSeries: ConferenceSeries | null | undefined,
  now = new Date(),
): SeriesTarget {
  if (!dataSeries) {
    return {
      status: "missing_series_in_data",
      reason: "Series exists in config/conferences.csv but has no entry in data/conferences.json.",
      conference: null,
    };
  }

  const ranked = dataSeries.conferences
    .map((conference) => {
      const summary = summarizeConference(conference, now);
      const priority = getConferencePriority(summary);
      return { conference, summary, priority };
    })
    .filter(
      (
        target,
      ): target is {
        conference: Conference;
        summary: ConferenceSummary;
        priority: number;
      } => target.priority != null,
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.summary.sortTime - right.summary.sortTime;
    });

  if (ranked.length === 0) {
    return {
      status: "no_action",
      reason: "No upcoming, estimated, or partial conference requires attention.",
      conference: null,
    };
  }

  const { conference, summary } = ranked[0];
  const status = getTargetStatus(summary);

  return {
    status,
    reason: getTargetReason(status),
    conference,
  };
}

export function findConferenceById(
  data: ConferencesData,
  conferenceId: string,
): ConferenceLookupResult | null {
  for (const series of data.conference_series) {
    const conference = series.conferences.find((candidate) => candidate.id === conferenceId);
    if (conference) {
      return { series, conference };
    }
  }

  return null;
}

export function resolveAutomationTarget(
  configSeries: ConferenceSeriesConfig[],
  data: ConferencesData,
  input: string,
): AutomationTarget | null {
  const conferenceLookup = findConferenceById(data, input);
  if (conferenceLookup) {
    return {
      inputKind: "conference",
      series: conferenceLookup.series,
      target: describeConference(conferenceLookup.conference),
    };
  }

  const config = findSeriesConfig(configSeries, input);
  if (!config) {
    return null;
  }

  const dataSeries = data.conference_series.find((series) => series.id === config.id) ?? null;
  if (!dataSeries) {
    return null;
  }

  return {
    inputKind: "series",
    series: dataSeries,
    target: selectSeriesTarget(config, dataSeries),
  };
}

export function describeConference(conference: Conference, now = new Date()): SeriesTarget {
  const summary = summarizeConference(conference, now);
  const status = getTargetStatus(summary);

  return {
    status,
    reason: getTargetReason(status),
    conference,
  };
}

export function buildBranchName(
  seriesId: string,
  conferenceId = "bootstrap",
  now = new Date(),
): string {
  return `automation/${seriesId.toLowerCase()}/${conferenceId.toLowerCase()}-${branchTimestamp(now)}`;
}

export function buildPrTitle(
  seriesId: string,
  conferenceId: string | null,
  status: TargetStatus,
): string {
  if (!conferenceId) {
    return `chore(data): add ${seriesId} conference data`;
  }

  if (status === "estimated_conference") {
    return `chore(data): verify ${conferenceId} estimated conference data`;
  }

  if (status === "partial_conference") {
    return `chore(data): complete ${conferenceId} conference data`;
  }

  return `chore(data): refresh ${conferenceId} conference data`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function recordToObject(header: string[], record: string[]): Record<string, string> {
  return Object.fromEntries(header.map((key, index) => [key, record[index] ?? ""]));
}

function findSeriesConfig(
  configSeries: ConferenceSeriesConfig[],
  input: string,
): ConferenceSeriesConfig | null {
  const normalizedInput = normalizeIdentifier(input);
  return (
    configSeries.find(
      (series) =>
        normalizeIdentifier(series.id) === normalizedInput ||
        normalizeIdentifier(series.name) === normalizedInput,
    ) ?? null
  );
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function getConferencePriority(summary: ConferenceSummary): number | null {
  if (summary.hasEstimatedMilestone) {
    return 0;
  }

  if (summary.hasMissingCoreFields && summary.isFutureOrOngoing) {
    return 1;
  }

  if (summary.state === "upcoming" || summary.state === "ongoing") {
    return 2;
  }

  return null;
}

function getTargetStatus(summary: ConferenceSummary): TargetStatus {
  if (summary.hasEstimatedMilestone) {
    return "estimated_conference";
  }

  if (summary.hasMissingCoreFields) {
    return "partial_conference";
  }

  if (summary.state === "upcoming" || summary.state === "ongoing") {
    return "upcoming_conference_check";
  }

  return "no_action";
}

function getTargetReason(status: TargetStatus): string {
  if (status === "estimated_conference") {
    return "Conference has estimated milestones that should be checked against official sources.";
  }

  if (status === "partial_conference") {
    return "Conference is missing core fields or CfP metadata and should be completed.";
  }

  if (status === "upcoming_conference_check") {
    return "Conference is upcoming and worth a freshness check before deadlines drift.";
  }

  if (status === "missing_series_in_data") {
    return "Series exists in config/conferences.csv but has no entry in data/conferences.json.";
  }

  return "No upcoming, estimated, or partial conference requires attention.";
}

function parseDateValue(value: string | null): number | null {
  if (value == null) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}
