import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_rlcaijtqfidfzyoxrrxh",
  runtime: "node",
  dirs: ["./src/trigger"],
  maxDuration: 300,
  retries: {
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      randomize: true,
    },
  },
});
