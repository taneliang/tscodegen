export type ManualSectionMap = { [sectionKey: string]: string };

// If you change this, be sure to update all the match indices!
const sectionMatchRegExp = /\/\* BEGIN MANUAL SECTION (\S+) \*\/((.|\n)+?|)\/\* END MANUAL SECTION \*\//gm;

export function createManualSection(sectionKey: string, sectionCode: string): string {
  // Ensure section key is non-empty and contains no whitespaces
  if (sectionKey.length === 0 || /\s/.test(sectionKey)) {
    throw new Error(
      `Manual section keys should not be empty or contain whitespaces. Received "${sectionKey}".`,
    );
  }

  let processedSectionCode = sectionCode.trim();
  processedSectionCode = processedSectionCode.length > 0 ? `\n${processedSectionCode}\n` : '\n';

  return `/* BEGIN MANUAL SECTION ${sectionKey} */${processedSectionCode}/* END MANUAL SECTION */`;
}

export function extractManualSections(code: string): ManualSectionMap {
  const allMatches = code.matchAll(sectionMatchRegExp);
  const manualSections: ManualSectionMap = {};
  Array.from(allMatches).forEach((match: RegExpMatchArray) => {
    manualSections[match[1]] = match[2].trim();
  });
  return manualSections;
}

/**
 * Removes all code between manual section designators.
 *
 * @param code Source code, potentially containing manual sections.
 */
export function emptyManualSections(code: string): string {
  return code.replace(sectionMatchRegExp, (matchedString, key, code) =>
    createManualSection(key, ''),
  );
}
