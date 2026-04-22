import crypto from "crypto";
import {
  removeFileDocblock,
  getFileDocblock,
  prependFileDocblock,
} from "./sections/docblock";
import { emptyManualSections } from "./sections/manual";
import { CommentSyntax, DEFAULT_COMMENT_SYNTAX } from "./types/CommentSyntax";

interface CodelockInfo {
  hash: string;
  manualSectionsAllowed: boolean;
}

/**
 * Get codelock information from a locked source file.
 *
 * @param lockedCode Code in source file, prepended with codelock file docblock.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 */
export function getCodelockInfo(
  lockedCode: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): CodelockInfo | undefined {
  const docblock = getFileDocblock(lockedCode, syntax);
  if (!docblock) {
    return undefined;
  }

  const docblockLines = docblock.split("\n");
  if (docblockLines.length === 0) {
    return undefined;
  }

  const lockline = docblockLines[docblockLines.length - 1];

  const editableMatchGroups =
    /^@generated-editable Codelock<<(?<hash>\S+?)>>$/.exec(lockline)?.groups;
  if (editableMatchGroups) {
    return {
      hash: editableMatchGroups.hash,
      manualSectionsAllowed: true,
    };
  }

  const uneditableMatchGroups = /^@generated Codelock<<(?<hash>\S+?)>>$/.exec(
    lockline,
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
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 * @returns Lock hash for `code`.
 */
function computeHash(
  code: string,
  shouldEmptyManualSections: boolean,
  syntax: CommentSyntax,
): string {
  const hashableCode = (
    shouldEmptyManualSections ? emptyManualSections(code, syntax) : code
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
 * @param customContent A custom comment to insert into the docblock.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 * @returns Locked code, i.e. code with prepended codelock file docblock.
 */
export function lockCode(
  code: string,
  manualSectionsAllowed: boolean,
  customContent = "",
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): string {
  const hash = computeHash(code, manualSectionsAllowed, syntax);

  let docblockContent;

  if (manualSectionsAllowed) {
    docblockContent = `This file is generated with manually editable sections. Only make
modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
designators.
${customContent}
@generated-editable Codelock<<${hash}>>`;
  } else {
    docblockContent = `This file is generated. Do not modify it manually.
${customContent}
@generated Codelock<<${hash}>>`;
  }

  return prependFileDocblock(code, docblockContent, syntax);
}

/**
 * Verify that the codelock in the source file is valid.
 *
 * @param lockedCode Locked code to be verified.
 * @param syntax Comment syntax used in the file. Defaults to JSDoc.
 * @returns `true` if lock is found and verified. `false` otherwise.
 */
export function verifyLock(
  lockedCode: string,
  syntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
): boolean {
  const codeblockInfo = getCodelockInfo(lockedCode, syntax);
  if (!codeblockInfo) {
    return false;
  }
  return (
    codeblockInfo.hash ===
    computeHash(
      removeFileDocblock(lockedCode, syntax),
      codeblockInfo.manualSectionsAllowed,
      syntax,
    )
  );
}
