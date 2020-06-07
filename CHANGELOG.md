# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CodeFile.lock`, a new manual lock step that allows you to customize the
  lock docstring.

### Changed

- **BREAKNG:** `CodeFile.build` no longer locks the file automatically. Call
  `CodeFile.lock` after calling `build` to get the old behavior.
