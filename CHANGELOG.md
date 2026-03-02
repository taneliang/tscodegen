# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
