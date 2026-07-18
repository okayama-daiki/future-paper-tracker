import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  run: {
    tasks: {
      "automation:describe-target": {
        command: "node scripts/automation/describe-target.ts",
        cache: false,
      },
      "automation:list-targets": {
        command: "node scripts/automation/list-targets.ts",
        cache: false,
      },
      "automation:check-open-pr": {
        command: "node scripts/automation/check-open-pr.ts",
        cache: false,
      },
      "automation:check-sources": {
        command: "node scripts/automation/check-sources.ts",
        cache: false,
      },
      "automation:update-conferences": {
        command: "node scripts/automation/update-conferences.ts",
        cache: false,
      },
      "automation:refresh-generated-at": {
        command: "node scripts/automation/refresh-generated-at.ts",
        cache: false,
      },
    },
  },
});
