/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    // @fither/engine uses ESM-style ".js" specifiers that resolve to .ts
    // sources; jest needs the extension stripped to find them.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["./jest-setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  clearMocks: true,
};
