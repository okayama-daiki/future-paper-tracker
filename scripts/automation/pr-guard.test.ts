import { describe, expect, test } from "vite-plus/test";

import { buildAutomationPrIdentity, findDuplicateOpenPr } from "./pr-guard.ts";

const identity = buildAutomationPrIdentity("PODC", "PODC-2027", "automation/podc/podc-2027");

describe("findDuplicateOpenPr", () => {
  test("matches the stable branch for the same conference", () => {
    const duplicate = findDuplicateOpenPr(
      [
        {
          number: 21,
          url: "https://github.com/example/repo/pull/21",
          title: "refresh conference data",
          headRefName: "automation/podc/podc-2027",
          body: "",
        },
      ],
      identity,
    );

    expect(duplicate?.number).toBe(21);
  });

  test("matches timestamped legacy branches from earlier weeks", () => {
    const duplicate = findDuplicateOpenPr(
      [
        {
          number: 15,
          url: "https://github.com/example/repo/pull/15",
          title: "verify conference data",
          headRefName: "automation/podc/podc-2027-20260426T170920z",
          body: "",
        },
      ],
      identity,
    );

    expect(duplicate?.number).toBe(15);
  });

  test("matches the durable PR body marker even if the branch differs", () => {
    const duplicate = findDuplicateOpenPr(
      [
        {
          number: 34,
          url: "https://github.com/example/repo/pull/34",
          title: "verify conference data",
          headRefName: "manual/fix-podc",
          body: `Summary\n\n${identity.marker}`,
        },
      ],
      identity,
    );

    expect(duplicate?.number).toBe(34);
  });

  test("matches an older manually named branch by conference ID in the title", () => {
    const duplicate = findDuplicateOpenPr(
      [
        {
          number: 40,
          url: "https://github.com/example/repo/pull/40",
          title: "chore(data): verify PODC-2027 estimated conference data",
          headRefName: "manual/conference-refresh",
          body: "",
        },
      ],
      identity,
    );

    expect(duplicate?.number).toBe(40);
  });

  test("does not block a different conference in the same series", () => {
    const duplicate = findDuplicateOpenPr(
      [
        {
          number: 55,
          url: "https://github.com/example/repo/pull/55",
          title: "refresh PODC-2026",
          headRefName: "automation/podc/podc-2026",
          body: "<!-- conference-automation-target: PODC-2026 -->",
        },
      ],
      identity,
    );

    expect(duplicate).toBeNull();
  });
});
