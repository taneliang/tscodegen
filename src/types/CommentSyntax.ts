/**
 * Describes the comment flavour that should be used when parsing and emitting
 * file docblocks, manual sections, and codelocks.
 *
 * - `{ kind: "jsdoc" }` is the default and preserves the historical
 *   JSDoc/C-style behaviour (`/** ... *\/` docblocks and
 *   `/* BEGIN MANUAL SECTION ... *\/` markers).
 * - `{ kind: "line"; prefix }` is intended for file formats that only support
 *   line comments. `prefix` is prepended to every emitted line (e.g. `"# "`
 *   for `.gitattributes`, `"// "` for a non-locked TypeScript file).
 */
export type CommentSyntax =
  | { kind: "jsdoc" }
  | { kind: "line"; prefix: string };

export const DEFAULT_COMMENT_SYNTAX: CommentSyntax = { kind: "jsdoc" };
