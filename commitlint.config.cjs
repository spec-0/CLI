module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Subject case: leave permissive (Sentence case + lowercase both fine).
    "subject-case": [0],
    // Allow longer subjects than the default 72 — public CLI commit subjects often reference command shapes.
    "header-max-length": [2, "always", 100],
    // Body line wrapping is enforced by editors, not the commit hook.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
