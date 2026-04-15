import type { Conference } from "utils";

export interface ConfidenceInput {
  /** URL of the source page */
  sourceUrl: string;
  /** Official URL for the series */
  seriesUrl: string;
  /** The extracted conference data (partial) */
  extracted: Partial<Conference>;
  /** Self-reported confidence from the LLM (0.0–1.0), if available */
  llmSelfConfidence?: number;
  /** Number of independent sources that agreed on the same dates */
  agreementCount?: number;
}

/**
 * Computes a confidence score (0.0–1.0) for an extracted Conference.
 *
 * Weights:
 *   - Source authority (0.3): official domain match
 *   - Data completeness (0.3): how many fields were extracted
 *   - LLM self-assessment (0.2): LLM-reported confidence
 *   - Cross-validation (0.2): agreement across sources
 */
export function computeConfidence(input: ConfidenceInput): number {
  const authority = scoreAuthority(input.sourceUrl, input.seriesUrl);
  const completeness = scoreCompleteness(input.extracted);
  const llmScore = input.llmSelfConfidence ?? 0.5;
  const crossVal = scoreCrossValidation(input.agreementCount ?? 1);

  return authority * 0.3 + completeness * 0.3 + llmScore * 0.2 + crossVal * 0.2;
}

function scoreAuthority(sourceUrl: string, seriesUrl: string): number {
  try {
    const sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const seriesDomain = new URL(seriesUrl).hostname.replace(/^www\./, "");
    if (sourceDomain === seriesDomain || sourceDomain.endsWith(`.${seriesDomain}`)) {
      return 1.0;
    }
    // Known aggregation sites that are somewhat authoritative
    const trustedThirdParty = ["dblp.org", "wikicfp.com", "conf.researchr.org"];
    if (trustedThirdParty.some((d) => sourceDomain.endsWith(d))) return 0.7;
    return 0.4;
  } catch {
    return 0.3;
  }
}

function scoreCompleteness(extracted: Partial<Conference>): number {
  const keyFields: (keyof Conference)[] = [
    "name",
    "year",
    "url",
    "venue",
    "start_at_utc",
    "end_at_utc",
  ];
  const filled = keyFields.filter(
    (f) => extracted[f] !== undefined && extracted[f] !== null,
  ).length;
  const milestonesScore = (extracted.milestones?.length ?? 0) > 0 ? 1 : 0;
  return (filled / keyFields.length + milestonesScore) / 2;
}

function scoreCrossValidation(agreementCount: number): number {
  if (agreementCount >= 3) return 1.0;
  if (agreementCount === 2) return 0.75;
  return 0.5;
}
