import { defineConfig } from "vitest/config";

const isCI = !!process.env.CI;

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: isCI ? ["default", "junit"] : ["default"],
    outputFile: {
      junit: "./test-reports/junit/junit.xml",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts"],
      reporter: isCI ? ["text", "json", "lcov"] : ["text"],
    },
  },
});
