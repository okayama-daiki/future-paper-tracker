export interface OpenPullRequest {
  number: number;
  url: string;
  title: string;
  headRefName: string;
  body: string;
}

export interface AutomationPrIdentity {
  key: string;
  branch: string;
  marker: string;
}

export function buildAutomationPrIdentity(
  seriesId: string,
  conferenceId: string | null,
  branch: string,
): AutomationPrIdentity {
  const key = conferenceId ?? `${seriesId}:bootstrap`;

  return {
    key,
    branch,
    marker: `<!-- conference-automation-target: ${key} -->`,
  };
}

export function findDuplicateOpenPr(
  pullRequests: OpenPullRequest[],
  identity: AutomationPrIdentity,
): OpenPullRequest | null {
  const normalizedBranch = identity.branch.toLowerCase();
  const normalizedMarker = identity.marker.toLowerCase();
  const normalizedKey = identity.key.toLowerCase();
  const legacyBranchPrefix = `${normalizedBranch}-`;

  return (
    pullRequests.find((pullRequest) => {
      const headRefName = pullRequest.headRefName.toLowerCase();
      const body = pullRequest.body.toLowerCase();
      const title = pullRequest.title.toLowerCase();

      return (
        body.includes(normalizedMarker) ||
        headRefName === normalizedBranch ||
        headRefName.startsWith(legacyBranchPrefix) ||
        title.includes(normalizedKey)
      );
    }) ?? null
  );
}
