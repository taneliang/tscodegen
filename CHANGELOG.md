# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CommentSyntax` option plumbed through `CodeFile`, `CodeBuilder`, the
  docblock helpers, the manual-section helpers, and the codelock helpers.
  Construct `new CodeFile(path, { commentSyntax: { kind: "line", prefix: "# " } })`
  to generate files whose only comment form is a line prefix (e.g.
  `.gitattributes`). The default remains `{ kind: "jsdoc" }`, preserving the
  existing JSDoc/C-style output byte-for-byte.
- `CommentSyntax` is re-exported from the package root.
- **`CodeBuilder.indent(amount, fn)`** for generating
  indentation-sensitive languages (Python, YAML, Makefile, …). Opens a
  nested builder scope whose ambient indent is the current indent plus
  `amount`; every emitted line — including manual-section markers and
  bodies — is prefixed accordingly. Indent scopes compose additively and
  accept any string (spaces, tabs, mixed).
- `createManualSection` accepts a new optional `indent` argument for
  callers who use the helper directly.

### Changed

- **Manual sections are now stored as semantic (column-0) content.**
  `extractManualSections` auto-detects each section's indent from the
  BEGIN marker and dedents every body line uniformly, so round-tripping
  works cleanly regardless of where a section lives in the file. As part
  of this:
  - The previous behaviour was subtly buggy: `.trim()` on the whole
    captured body only dedented line 1. Multi-line bodies kept the
    original indent on lines 2+, which surfaced visibly for any consumer
    that didn't re-run Prettier after extraction. This is now correct.
  - Manual-section markers must each appear on their own line. The
    historical regex also matched the single-line pathological form
    `/* BEGIN MANUAL SECTION k */body/* END MANUAL SECTION */`, which is
    never emitted by `createManualSection` and is now ignored.

### Breaking

- **Codelock hashes produced prior to this release are no longer valid.**
  The normalized form consumed by `emptyManualSections` — which is the
  input to the codelock hash — now preserves the BEGIN marker's indent,
  and `createManualSection`'s output for non-trivial manual-section
  inputs also changed (see above). Files locked by earlier versions will
  fail `verify()` against this release and need to be regenerated.
- `CodeBuilder` has a new optional third constructor parameter, `indent`.
  The constructor remains source-compatible for all existing call sites;
  the default is `""` (no ambient indent).

- **Migrated test runner from Jest to Vitest.** Simpler setup, no `ts-jest` transformer required, and faster runs.
- Bumped dev dependencies to latest: TypeScript 6.x, ESLint 10.x, `typescript-eslint` 8.x, Prettier 3.8.x, Vitest 4.x, and related tooling.
- ESLint flat config simplified to use `typescript-eslint`'s config helpers and `@vitest/eslint-plugin` in place of `eslint-plugin-jest`.
- TypeScript target updated from ES2018 to ES2022 to match the current supported Node versions.
- Dropped the deprecated `codecov` npm uploader; CI now uploads coverage to Codecov via the official `codecov/codecov@5` CircleCI orb, using the `lcov.info` produced by Vitest's v8 coverage.
- Dropped `@eslint/eslintrc` compat layer.
- Raised minimum Node.js version to `>=20.18.0`.

## [0.4.0] - 2026-03-02

### Breaking

- `CodeBuilder.format` no longer accepts a `prettierOptions` argument.

### Changed

- `CodeBuilder.format` now resolves Prettier config from the project config file (when present) and falls back to Prettier defaults if config resolution fails.

## [0.3.0] - 2026-03-02

### Added

- `CodeBuilder.format` now accepts an optional `prettierOptions` parameter to customize Prettier formatting without resolving config from disk.

### Breaking

- **Prettier 3 only:** `peerDependencies.prettier` is now `3.x` (was `2.x || 3.x`).
- Added `@prettier/sync` as a runtime dependency for Prettier 3 compatibility.

### Changed

- Bumped dev dependencies to latest: TypeScript 5.x, ESLint 10.x, Jest 30.x, Prettier 3.x, and related tooling.
- TypeScript target updated from ES2015 to ES2018.
- Migrated ESLint to flat config (`eslint.config.mjs`).

## [0.2.0] - 2020-06-08

### Added

- `CodeFile.lock`, a new manual lock step that allows you to customize the
  lock docstring.

### Changed

- **BREAKNG:** `CodeFile.build` no longer locks the file automatically. Call
  `CodeFile.lock` after calling `build` to get the old behavior.
