import type { SourceCheckResult } from "./source-check.ts";
import type { Conference, Milestone } from "./shared.ts";

export interface ConferenceChange {
  conferenceId: string;
  field: string;
  before: unknown;
  after: unknown;
  sourceUrl: string;
}

export interface DeterministicConferenceUpdate {
  conference: Conference;
  changes: ConferenceChange[];
}

interface DatePoint {
  year: number;
  month: number;
  day: number;
}

interface DateRange {
  start: DatePoint;
  end: DatePoint;
}

const monthNumbers = new Map<string, number>([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

const englishMonth =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

export function applyDeterministicConferenceUpdate(
  inputConference: Conference,
  sourceResults: SourceCheckResult[],
): DeterministicConferenceUpdate {
  const conference = structuredClone(inputConference);
  const changes: ConferenceChange[] = [];
  const trustedSources = sourceResults.filter(
    (source) => source.ok && source.role === "official" && source.id !== "series-home",
  );

  const yearSpecificSource = trustedSources.find(
    (source) =>
      source.kind !== "wordpress_rest" &&
      source.url.includes(String(conference.year)) &&
      sourceHasTargetConferenceDate(source, conference.year),
  );
  if (
    yearSpecificSource &&
    !conference.url.includes(String(conference.year)) &&
    conference.url !== yearSpecificSource.url
  ) {
    recordChange(
      changes,
      conference,
      "url",
      conference.url,
      yearSpecificSource.url,
      yearSpecificSource.url,
    );
    conference.url = yearSpecificSource.url;
  }

  const rangeCandidate = findConferenceRange(conference, trustedSources);
  if (rangeCandidate) {
    const start = datePointToIso(rangeCandidate.range.start, false);
    const end = datePointToIso(rangeCandidate.range.end, true);
    if (conference.start_at_utc == null) {
      recordChange(
        changes,
        conference,
        "start_at_utc",
        conference.start_at_utc,
        start,
        rangeCandidate.source.url,
      );
      conference.start_at_utc = start;
    }
    if (conference.end_at_utc == null) {
      recordChange(
        changes,
        conference,
        "end_at_utc",
        conference.end_at_utc,
        end,
        rangeCandidate.source.url,
      );
      conference.end_at_utc = end;
    }
  }

  for (const source of trustedSources) {
    for (const line of source.signals.deadlineLines) {
      const milestoneType = classifyMilestone(line, conference);
      if (!milestoneType) {
        continue;
      }

      const points = extractDatePoints(line, conference, source.url).filter((point) =>
        isAllowedMilestoneYear(point.year, conference),
      );
      if (points.length !== 1) {
        continue;
      }

      const atUtc = deadlineToIso(points[0], line, milestoneType);
      const sameType = conference.milestones.filter(
        (milestone) => milestone.type === milestoneType,
      );
      const exact = sameType.find((milestone) => milestone.at_utc === atUtc);
      if (exact) {
        confirmMilestone(conference, exact, source.url, changes);
        continue;
      }

      if (sameType.length === 1) {
        const existing = sameType[0];
        if (!existing.is_estimated && sameCalendarDate(existing.at_utc, atUtc)) {
          confirmMilestone(conference, existing, source.url, changes);
          continue;
        }
        if (!existing.is_estimated) {
          continue;
        }
        const replacement: Milestone = {
          type: milestoneType,
          at_utc: atUtc,
          source_url: source.url,
          is_estimated: false,
        };
        const index = conference.milestones.indexOf(existing);
        recordChange(
          changes,
          conference,
          `milestones.${milestoneType}`,
          existing,
          replacement,
          source.url,
        );
        conference.milestones[index] = replacement;
        continue;
      }

      if (sameType.length === 0) {
        const milestone: Milestone = {
          type: milestoneType,
          at_utc: atUtc,
          source_url: source.url,
          is_estimated: false,
        };
        recordChange(
          changes,
          conference,
          `milestones.${milestoneType}`,
          null,
          milestone,
          source.url,
        );
        conference.milestones.push(milestone);
      }
    }
  }

  conference.milestones.sort((left, right) => Date.parse(left.at_utc) - Date.parse(right.at_utc));

  return { conference, changes };
}

export function validateConferenceData(conferences: Conference[]): void {
  const ids = new Set<string>();
  for (const conference of conferences) {
    if (ids.has(conference.id)) {
      throw new Error(`Duplicate conference id: ${conference.id}`);
    }
    ids.add(conference.id);

    if (!/^https?:\/\//.test(conference.url)) {
      throw new Error(`Invalid conference URL for ${conference.id}: ${conference.url}`);
    }

    const start = conference.start_at_utc == null ? null : Date.parse(conference.start_at_utc);
    const end = conference.end_at_utc == null ? null : Date.parse(conference.end_at_utc);
    if (start != null && Number.isNaN(start)) {
      throw new Error(`Invalid start date for ${conference.id}`);
    }
    if (end != null && Number.isNaN(end)) {
      throw new Error(`Invalid end date for ${conference.id}`);
    }
    if (start != null && end != null && start > end) {
      throw new Error(`Conference starts after it ends: ${conference.id}`);
    }

    for (const milestone of conference.milestones) {
      const milestoneTime = Date.parse(milestone.at_utc);
      if (Number.isNaN(milestoneTime)) {
        throw new Error(`Invalid milestone date for ${conference.id}: ${milestone.type}`);
      }
      const milestoneYear = new Date(milestoneTime).getUTCFullYear();
      if (milestoneYear < conference.year - 1 || milestoneYear > conference.year) {
        throw new Error(
          `Milestone year is outside the safe window for ${conference.id}: ${milestone.type}`,
        );
      }
    }
  }
}

function sourceHasTargetConferenceDate(source: SourceCheckResult, year: number): boolean {
  return source.signals.dateLines.some((line) => line.includes(String(year)));
}

function isAllowedMilestoneYear(year: number, conference: Conference): boolean {
  if (year === conference.year) {
    return true;
  }
  if (year !== conference.year - 1 || conference.start_at_utc == null) {
    return false;
  }
  return new Date(conference.start_at_utc).getUTCMonth() + 1 <= 6;
}

function findConferenceRange(
  conference: Conference,
  sources: SourceCheckResult[],
): { range: DateRange; source: SourceCheckResult } | null {
  for (const source of sources) {
    for (const line of source.signals.dateLines) {
      if (!looksLikeConferenceRange(line, conference)) {
        continue;
      }
      const range = extractDateRange(line, conference, source.url);
      if (
        range &&
        range.start.year === conference.year &&
        range.end.year === conference.year &&
        differenceInDays(range.start, range.end) <= 14
      ) {
        return { range, source };
      }
    }
  }
  return null;
}

function looksLikeConferenceRange(line: string, conference: Conference): boolean {
  const normalized = line.toLocaleLowerCase("en");
  return (
    normalized.includes(conference.id.toLocaleLowerCase("en")) ||
    /conference|symposium|workshop|will be held|event will be held|会期|日程|開催期間/.test(
      normalized,
    )
  );
}

function classifyMilestone(line: string, conference: Conference): string | null {
  const normalized = line.toLocaleLowerCase("en");
  if (
    !/deadline|due|締切|submission|registration|notification|camera|原稿提出|発表申込/.test(
      normalized,
    )
  ) {
    return null;
  }
  if (/camera|final version|原稿提出/.test(normalized)) {
    return "camera_ready";
  }
  if (/notification|acceptance|採否|結果通知/.test(normalized)) {
    return "notification";
  }
  if (/abstract registration|abstract submission|アブストラクト/.test(normalized)) {
    return "abstract_submission_deadline";
  }
  if (/registration|参加申込/.test(normalized)) {
    return "registration_deadline";
  }
  if (/full paper|paper submission/.test(normalized)) {
    return conference.milestones.some(
      (milestone) => milestone.type === "full_paper_submission_deadline",
    )
      ? "full_paper_submission_deadline"
      : "submission_deadline";
  }
  if (/submission|発表申込/.test(normalized)) {
    return conference.milestones.some(
      (milestone) => milestone.type === "full_paper_submission_deadline",
    )
      ? "full_paper_submission_deadline"
      : "submission_deadline";
  }
  return null;
}

function extractDatePoints(line: string, conference: Conference, sourceUrl: string): DatePoint[] {
  const points: DatePoint[] = [];
  const japanesePattern = /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  for (const match of line.matchAll(japanesePattern)) {
    points.push(toDatePoint(match[1], match[2], match[3]));
  }

  const numericPattern = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/g;
  for (const match of line.matchAll(numericPattern)) {
    points.push(toDatePoint(match[1], match[2], match[3]));
  }

  const monthFirstPattern = new RegExp(
    `\\b(${englishMonth})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?`,
    "gi",
  );
  for (const match of line.matchAll(monthFirstPattern)) {
    const month = parseMonth(match[1]);
    const explicitYear = match[3] == null ? null : Number(match[3]);
    const year = explicitYear ?? inferImplicitYear(month, conference, sourceUrl);
    if (year != null) {
      points.push({ year, month, day: Number(match[2]) });
    }
  }

  const dayFirstPattern = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${englishMonth})(?:,?\\s+(20\\d{2}))?`,
    "gi",
  );
  for (const match of line.matchAll(dayFirstPattern)) {
    const month = parseMonth(match[2]);
    const explicitYear = match[3] == null ? null : Number(match[3]);
    const year = explicitYear ?? inferImplicitYear(month, conference, sourceUrl);
    if (year != null) {
      points.push({ year, month, day: Number(match[1]) });
    }
  }

  return uniqueDatePoints(points.filter(isValidDatePoint));
}

function extractDateRange(
  line: string,
  conference: Conference,
  sourceUrl: string,
): DateRange | null {
  const englishPattern = new RegExp(
    `(${englishMonth})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|—|to)\\s*(?:(${englishMonth})\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?`,
    "i",
  );
  const english = line.match(englishPattern);
  if (english) {
    const startMonth = parseMonth(english[1]);
    const endMonth = english[3] ? parseMonth(english[3]) : startMonth;
    const year = english[5]
      ? Number(english[5])
      : inferImplicitYear(startMonth, conference, sourceUrl);
    if (year != null) {
      const start = { year, month: startMonth, day: Number(english[2]) };
      const endYear = endMonth < startMonth ? year + 1 : year;
      const end = { year: endYear, month: endMonth, day: Number(english[4]) };
      if (isValidDatePoint(start) && isValidDatePoint(end)) {
        return { start, end };
      }
    }
  }

  const japanesePattern =
    /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\d]{0,16}(?:-|–|—|〜|～)[^\d]{0,16}(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*日/;
  const japanese = line.match(japanesePattern);
  if (japanese) {
    const year = Number(japanese[1]);
    const startMonth = Number(japanese[2]);
    const endMonth = japanese[4] ? Number(japanese[4]) : startMonth;
    const start = { year, month: startMonth, day: Number(japanese[3]) };
    const end = { year, month: endMonth, day: Number(japanese[5]) };
    if (isValidDatePoint(start) && isValidDatePoint(end)) {
      return { start, end };
    }
  }

  return null;
}

function inferImplicitYear(
  month: number,
  conference: Conference,
  sourceUrl: string,
): number | null {
  if (!sourceUrl.includes(String(conference.year))) {
    return null;
  }
  const conferenceMonth = conference.start_at_utc
    ? new Date(conference.start_at_utc).getUTCMonth() + 1
    : null;
  return conferenceMonth != null && conferenceMonth <= 3 && month >= 6
    ? conference.year - 1
    : conference.year;
}

function deadlineToIso(point: DatePoint, line: string, milestoneType: string): string {
  if (/\bAoE\b|anywhere on earth/i.test(line)) {
    return new Date(Date.UTC(point.year, point.month - 1, point.day + 1, 11, 59, 59)).toISOString();
  }
  if (/JST|KST|日本時間/i.test(line)) {
    return new Date(Date.UTC(point.year, point.month - 1, point.day, 14, 59, 59)).toISOString();
  }
  const isDeadline = /submission|registration|締切|発表申込/.test(
    `${milestoneType} ${line}`.toLocaleLowerCase("en"),
  );
  return new Date(
    Date.UTC(
      point.year,
      point.month - 1,
      point.day,
      isDeadline ? 23 : 0,
      isDeadline ? 59 : 0,
      isDeadline ? 59 : 0,
    ),
  ).toISOString();
}

function confirmMilestone(
  conference: Conference,
  milestone: Milestone,
  sourceUrl: string,
  changes: ConferenceChange[],
): void {
  if (!milestone.is_estimated && equivalentUrl(milestone.source_url, sourceUrl)) {
    return;
  }
  const confirmed = { ...milestone, source_url: sourceUrl, is_estimated: false };
  recordChange(
    changes,
    conference,
    `milestones.${milestone.type}`,
    milestone,
    confirmed,
    sourceUrl,
  );
  Object.assign(milestone, confirmed);
}

function equivalentUrl(left: string, right: string): boolean {
  return left.replace(/\/$/, "") === right.replace(/\/$/, "");
}

function recordChange(
  changes: ConferenceChange[],
  conference: Conference,
  field: string,
  before: unknown,
  after: unknown,
  sourceUrl: string,
): void {
  changes.push({
    conferenceId: conference.id,
    field,
    before: structuredClone(before),
    after: structuredClone(after),
    sourceUrl,
  });
}

function parseMonth(value: string): number {
  return monthNumbers.get(value.toLocaleLowerCase("en")) ?? 0;
}

function toDatePoint(year: string, month: string, day: string): DatePoint {
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function isValidDatePoint(point: DatePoint): boolean {
  const date = new Date(Date.UTC(point.year, point.month - 1, point.day));
  return (
    date.getUTCFullYear() === point.year &&
    date.getUTCMonth() + 1 === point.month &&
    date.getUTCDate() === point.day
  );
}

function uniqueDatePoints(points: DatePoint[]): DatePoint[] {
  const byKey = new Map<string, DatePoint>();
  for (const point of points) {
    byKey.set(`${point.year}-${point.month}-${point.day}`, point);
  }
  return [...byKey.values()];
}

function datePointToIso(point: DatePoint, endOfDay: boolean): string {
  return new Date(
    Date.UTC(
      point.year,
      point.month - 1,
      point.day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
    ),
  ).toISOString();
}

function differenceInDays(start: DatePoint, end: DatePoint): number {
  const startTime = Date.UTC(start.year, start.month - 1, start.day);
  const endTime = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endTime - startTime) / 86_400_000);
}

function sameCalendarDate(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}
