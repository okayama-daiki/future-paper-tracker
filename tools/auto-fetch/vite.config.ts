import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {},
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
