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
      "automation:refresh-generated-at": {
        command: "node scripts/automation/refresh-generated-at.ts",
        cache: false,
      },
    },
  },
});
