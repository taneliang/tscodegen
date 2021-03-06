import type { ManualSectionMap } from "../types/ManualSectionMap";

const sectionMatchRegExp = /\/\* BEGIN MANUAL SECTION (?<key>\S+) \*\/(?<code>(.|\n)+?|)\/\* END MANUAL SECTION \*\//gm;

export function createManualSection(
  sectionKey: string,
  sectionCode: string
): string {
  // Ensure section key is non-empty and contains no whitespaces
  if (sectionKey.length === 0 || /\s/.test(sectionKey)) {
    throw new Error(
      `Manual section keys should not be empty or contain whitespaces. Received "${sectionKey}".`
    );
  }

  let processedSectionCode = sectionCode.trim();
  processedSectionCode =
    processedSectionCode.length > 0 ? `${processedSectionCode}\n` : "";

  return `/* BEGIN MANUAL SECTION ${sectionKey} */\n${processedSectionCode}/* END MANUAL SECTION */`;
}

export function extractManualSections(code: string): ManualSectionMap {
  const allMatches = code.matchAll(sectionMatchRegExp);
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
 */
export function emptyManualSections(code: string): string {
  return code.replace(sectionMatchRegExp, (matchedString, sectionKey) =>
    createManualSection(sectionKey, "")
  );
}
