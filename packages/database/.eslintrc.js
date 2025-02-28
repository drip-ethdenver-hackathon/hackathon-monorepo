/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["@drip-rewards/eslint-config/library.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
