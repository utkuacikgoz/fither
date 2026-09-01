import { defineConfig } from "vitest/config";

// Keep this nested repository isolated from any Vite configuration in its
// parent checkout. CI normally checks FITHER out at the filesystem root, while
// local development may place it inside another Vite project.
export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
  },
});
