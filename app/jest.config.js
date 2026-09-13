/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    // @fither/engine uses ESM-style ".js" specifiers that resolve to .ts
    // sources; jest needs the extension stripped to find them.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["./jest-setup.ts"],
  // The first test in a suite pays for the whole module graph. On a machine
  // that is also running an Xcode archive that cold start alone can outrun
  // the 5s default, which fails a green test for being unlucky.
  testTimeout: 20000,
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  clearMocks: true,
};
