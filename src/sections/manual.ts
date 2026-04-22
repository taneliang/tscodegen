import type { ManualSectionMap } from "../types/ManualSectionMap";
import { CommentSyntax, DEFAULT_COMMENT_SYNTAX } from "../types/CommentSyntax";

/**
 * JSDoc manual-section markers. Each marker must be on its own line (leading
 * and trailing whitespace only); the BEGIN marker's leading whitespace is
 * captured as `indent` and the END marker is required to share it via the
 * named backreference, so the lazy `code` capture cannot straddle a
 * differently-indented END marker.
 */
const jsdocSectionMatchRegExp =
  /^(?<indent>[ \t]*)\/\* BEGIN MANUAL SECTION (?<key>\S+) \*\/[ \t]*$\n(?<code>[\s\S]*?)^\k<indent>\/\* END MANUAL SECTION \*\/[ \t]*$/gm;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLineSectionMatchRegExp(prefix: string): RegExp {
  const escapedPrefix = escapeRegExp(prefix);
  return new RegExp(
    `^(?<indent>[ \\t]*)${escapedPrefix}BEGIN MANUAL SECTION (?<key>\\S+)[ \\t]*$\\n(?<code>[\\s\\S]*?)^\\k<indent>${escapedPrefix}END MANUAL SECTION[ \\t]*$`,
    "gm",
  );
}

function getSectionMatchRegExp(syntax: CommentSyntax): RegExp {
  if (syntax.kind === "jsdoc") {
    return new RegExp(
      jsdocSectionMatchRegExp.source,
      jsdocSectionMatchRegExp.flags,
    );
  }
  return buildLineSectionMatchRegExp(syntax.prefix);
}

function validateSectionKey(sectionKey: string): void {
  if (sectionKey.length === 0 || /\s/.test(sectionKey)) {
    throw new Error(
      `Manual section keys should not be empty or contain whitespaces. Received "${sectionKey}".`,
    );
  }
}

/**
 * Strip `indent` from each line of `code`.
 *
 * Lines that do not start with `indent` are left untouched — if a user
 * hand-edits a manual section and mangles the leading whitespace on a line,
 * we preserve that edit verbatim rather than silently reshifting it.
 */
function dedent(code: string, indent: string): string {
  if (indent.length === 0) {
    return code;
  }
  return code
    .split("\n")
    .map((line) =>
      line.startsWith(indent) ? line.substring(indent.length) : line,
    )
    .join("\n");
}

/**
 * Prepend `indent` to each non-empty line of `code`. Empty lines are left
 * as-is so we never emit trailing whitespace.
 */
function applyIndent(code: string, indent: string): string {
  if (indent.length === 0) {
    return code;
  }
  return code
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${indent}${line}`))
    .join("\n");
}

/**
 * Emit a manual section.
 *
 * @param sectionKey Non-empty, whitespace-free identifier for this section.
 * @param sectionCode Section body. Pass as _semantic_ content (i.e. at
 * column 0); any ambient indent should be supplied via `indent`, not baked
 * into the body. The body is trimmed of leading/trailing whitespace.
 * @param syntax Comment syntax. Defaults to JSDoc.
 * @param indent Whitespace prepended to every emitted line (both markers and
 * each body line). Defaults to empty string.
 */
export function createManualSection(
  sectionKey: string,
  sectionCode: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
  indent = "",
): string {
  validateSectionKey(sectionKey);

  let processedSectionCode = sectionCode.trim();
  processedSectionCode =
    processedSectionCode.length > 0 ? `${processedSectionCode}\n` : "";

  let rawBlock: string;
  if (syntax.kind === "jsdoc") {
    rawBlock = `/* BEGIN MANUAL SECTION ${sectionKey} */\n${processedSectionCode}/* END MANUAL SECTION */`;
  } else {
    const { prefix } = syntax;
    rawBlock = `${prefix}BEGIN MANUAL SECTION ${sectionKey}\n${processedSectionCode}${prefix}END MANUAL SECTION`;
  }

  return applyIndent(rawBlock, indent);
}

/**
 * Extract manual sections from `code`.
 *
 * Each section's body is returned as _semantic content_: any common leading
 * whitespace shared by the BEGIN marker and the body lines is stripped, so
 * the returned string is what the author conceptually wrote inside the
 * section, independent of where the section lives in the file.
 *
 * The regenerating code is expected to reapply an appropriate indent when
 * re-emitting the section — typically by scoping the builder with
 * `CodeBuilder.indent()` so the original BEGIN column is restored
 * automatically.
 */
export function extractManualSections(
  code: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): ManualSectionMap {
  const regExp = getSectionMatchRegExp(syntax);
  const allMatches = code.matchAll(regExp);
  const manualSections: ManualSectionMap = {};
  [...allMatches].forEach((match: RegExpMatchArray) => {
    if (!match.groups) {
      return;
    }
    const { key, code: body, indent = "" } = match.groups;
    manualSections[key] = dedent(body, indent).trim();
  });
  return manualSections;
}

/**
 * Remove all code between manual section designators.
 *
 * Each section is replaced by its empty form, preserving the BEGIN marker's
 * indent so the surrounding file shape is unchanged. This is what the
 * codelock hash is computed over, so its output is a stable normalized form
 * given a particular input.
 *
 * @param code Source code, potentially containing manual sections.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 */
export function emptyManualSections(
  code: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  const regExp = getSectionMatchRegExp(syntax);
  return code.replace(regExp, (...args) => {
    const groups = args[args.length - 1] as
      | { key: string; indent?: string }
      | undefined;
    if (!groups) {
      return args[0] as string;
    }
    return createManualSection(groups.key, "", syntax, groups.indent ?? "");
  });
}
