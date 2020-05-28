import crypto from "crypto";
import {
  removeFileDocblock,
  getFileDocblock,
  prependFileDocblock,
} from "./sections/docblock";
import { emptyManualSections } from "./sections/manual";

interface CodelockInfo {
  hash: string;
  manualSectionsAllowed: boolean;
}

/**
 * Get codelock information from a locked source file.
 *
 * @param lockedCode Code in source file, prepended with codelock file docblock.
 */
export function getCodelockInfo(lockedCode: string): CodelockInfo | undefined {
  // TODO: get docblock, and if it exists, retrieve hash
  const docblock = getFileDocblock(lockedCode);
  if (!docblock) {
    return undefined;
  }

  const docblockLines = docblock.split("\n");
  if (docblockLines.length === 0) {
    return undefined;
  }

  // Expect codelock info to be on the last line.
  const lockline = docblockLines[docblockLines.length - 1];

  const editableMatchGroups = /^@generated-editable Codelock<<(?<hash>\S+?)>>$/.exec(
    lockline
  )?.groups;
  if (editableMatchGroups) {
    return {
      hash: editableMatchGroups.hash,
      manualSectionsAllowed: true,
    };
  }

  const uneditableMatchGroups = /^@generated Codelock<<(?<hash>\S+?)>>$/.exec(
    lockline
  )?.groups;
  if (uneditableMatchGroups) {
    return {
      hash: uneditableMatchGroups.hash,
      manualSectionsAllowed: false,
    };
  }

  return undefined;
}

/**
 * Computes the codelock hash for a source file. Will not unlock if locked.
 *
 * @param code Code to be locked.
 * @param shouldEmptyManualSections Whether manual sections should be emptied.
 * Should = whether the file is allowed to have manual sections.
 * @returns Lock hash for `code`.
 */
function computeHash(code: string, shouldEmptyManualSections: boolean): string {
  const hashableCode = (shouldEmptyManualSections
    ? emptyManualSections(code)
    : code
  ).trim();
  return crypto
    .createHash("shake128", { outputLength: 24 })
    .update(hashableCode)
    .digest("base64");
}

/**
 * Computes the hash for the source code, and prepends a codelock file
 * docblock. Will **NOT** unlock if locked, in case the first thing in the file
 * is an unrelated docblock.
 *
 * @param code Code to be locked.
 * @param manualSectionsAllowed Whether generated code can contain manual sections.
 * @returns Locked code, i.e. code with prepended codelock file docblock.
 */
export function lockCode(code: string, manualSectionsAllowed: boolean): string {
  const hash = computeHash(code, manualSectionsAllowed);

  let docblockContent;

  if (manualSectionsAllowed) {
    docblockContent = `This file is generated with manually editable sections. Only make
modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
designators.

@generated-editable Codelock<<${hash}>>`;
  } else {
    docblockContent = `This file is generated. Do not modify it manually.

@generated Codelock<<${hash}>>`;
  }

  return prependFileDocblock(code, docblockContent);
}

/**
 * Verify that the codelock in the source file is valid.
 *
 * @param lockedCode Locked code to be verified.
 * @returns `true` if lock is found and verified. `false` otherwise.
 */
export function verifyLock(lockedCode: string): boolean {
  const codeblockInfo = getCodelockInfo(lockedCode);
  if (!codeblockInfo) {
    return false;
  }
  return (
    codeblockInfo.hash ===
    computeHash(
      removeFileDocblock(lockedCode),
      codeblockInfo.manualSectionsAllowed
    )
  );
}
