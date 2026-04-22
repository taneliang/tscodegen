import type { ManualSectionMap } from "../types/ManualSectionMap";
import { CommentSyntax, DEFAULT_COMMENT_SYNTAX } from "../types/CommentSyntax";

const jsdocSectionMatchRegExp =
  /\/\* BEGIN MANUAL SECTION (?<key>\S+) \*\/(?<code>(.|\n)+?|)\/\* END MANUAL SECTION \*\//gm;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLineSectionMatchRegExp(prefix: string): RegExp {
  const escapedPrefix = escapeRegExp(prefix);
  // Anchor both markers to a line start (via the `m` flag) so that the lazy
  // `code` capture does not greedily swallow an intervening END marker.
  return new RegExp(
    `^${escapedPrefix}BEGIN MANUAL SECTION (?<key>\\S+)$\\n(?<code>[\\s\\S]*?)^${escapedPrefix}END MANUAL SECTION$`,
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

export function createManualSection(
  sectionKey: string,
  sectionCode: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  validateSectionKey(sectionKey);

  let processedSectionCode = sectionCode.trim();
  processedSectionCode =
    processedSectionCode.length > 0 ? `${processedSectionCode}\n` : "";

  if (syntax.kind === "jsdoc") {
    return `/* BEGIN MANUAL SECTION ${sectionKey} */\n${processedSectionCode}/* END MANUAL SECTION */`;
  }

  const { prefix } = syntax;
  return `${prefix}BEGIN MANUAL SECTION ${sectionKey}\n${processedSectionCode}${prefix}END MANUAL SECTION`;
}

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
    manualSections[match.groups.key] = match.groups.code.trim();
  });
  return manualSections;
}

/**
 * Removes all code between manual section designators.
 *
 * @param code Source code, potentially containing manual sections.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 */
export function emptyManualSections(
  code: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  const regExp = getSectionMatchRegExp(syntax);
  return code.replace(regExp, (_matchedString, sectionKey) =>
    createManualSection(sectionKey, "", syntax),
  );
}
