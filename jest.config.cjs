/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/agents", "<rootDir>/skill-tests"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.integration.test.ts"],
  collectCoverageFrom: [
    "agents/*/skills/*/{index,utils}.ts",
    "!**/__tests__/**"
  ]
};
