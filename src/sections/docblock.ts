import { CommentSyntax, DEFAULT_COMMENT_SYNTAX } from "../types/CommentSyntax";

const docblockMatchRegExp = /^\/\*\*\n(?<contents>( \*.*\n)*?) \*\/\n/;

function emptyLinePrefix(prefix: string): string {
  return prefix.replace(/\s+$/, "");
}

function isLineInLineDocblock(line: string, prefix: string): boolean {
  return line.startsWith(prefix) || line === emptyLinePrefix(prefix);
}

function stripLinePrefix(line: string, prefix: string): string {
  if (line.startsWith(prefix)) {
    return line.substring(prefix.length);
  }
  return "";
}

function countLeadingDocblockLines(code: string, prefix: string): number {
  const lines = code.split("\n");
  let count = 0;
  for (const line of lines) {
    if (isLineInLineDocblock(line, prefix)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Get file docblock from `code`, the contents of a source file.
 *
 * Assumes that any docblock that starts from the 0th character in `code` is
 * the file docblock.
 *
 * @param code Code from a source file.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 * @returns Docblock if it exists, else returns undefined.
 */
export function getFileDocblock(
  code: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string | undefined {
  if (syntax.kind === "jsdoc") {
    const rawDocblockMatchGroups = docblockMatchRegExp.exec(code)?.groups;
    if (!rawDocblockMatchGroups) {
      return undefined;
    }

    const rawContents = rawDocblockMatchGroups.contents;
    return rawContents
      .split("\n")
      .map((line) => line.substring(" *".length).trim())
      .join("\n")
      .trim();
  }

  const { prefix } = syntax;
  const leadingCount = countLeadingDocblockLines(code, prefix);
  if (leadingCount === 0) {
    return undefined;
  }
  const lines = code.split("\n").slice(0, leadingCount);
  return lines
    .map((line) => stripLinePrefix(line, prefix))
    .join("\n")
    .trim();
}

/**
 * Removes the file docblock from the start of a file.
 *
 * Assumes that any docblock that starts from the 0th character in `code` is
 * the file docblock.
 *
 * @param code Code from a source file.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 */
export function removeFileDocblock(
  code: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  if (syntax.kind === "jsdoc") {
    if (!docblockMatchRegExp.exec(code)) {
      return code;
    }
    return code.replace(docblockMatchRegExp, "");
  }

  const { prefix } = syntax;
  const leadingCount = countLeadingDocblockLines(code, prefix);
  if (leadingCount === 0) {
    return code;
  }
  // Consume the leading docblock lines together with their trailing newlines.
  // The JSDoc variant similarly consumes the final `*/\n` but leaves any
  // additional blank separator intact.
  const lines = code.split("\n");
  return lines.slice(leadingCount).join("\n");
}

/**
 * Creates a docblock from `docblockContent`.
 *
 * @param docblockContent Plain docblock content (i.e. without "*"s at the start of each line)
 * @param syntax Comment syntax to use when emitting the docblock.
 */
export function createDocblock(
  docblockContent: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  if (syntax.kind === "jsdoc") {
    const docblockContentWithLeadingStars = docblockContent
      .split("\n")
      .map((line) => ` ${`* ${line}`.trim()}`)
      .join("\n");
    return `/**\n${docblockContentWithLeadingStars}\n */`;
  }

  const { prefix } = syntax;
  const emptyPrefix = emptyLinePrefix(prefix);
  return docblockContent
    .split("\n")
    .map((line) => (line.length === 0 ? emptyPrefix : `${prefix}${line}`))
    .join("\n");
}

/**
 * Prepends `code` with `docblockContent`. Assumes `code` does not already have
 * a file docblock.
 *
 * @param code Code from a source file.
 * @param docblockContent Plain docblock content (i.e. without "*"s at the start of each line)
 * @param syntax Comment syntax to use when emitting the docblock.
 */
export function prependFileDocblock(
  code: string,
  docblockContent: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  return `${createDocblock(docblockContent, syntax)}\n\n${code.trimStart()}`;
}
