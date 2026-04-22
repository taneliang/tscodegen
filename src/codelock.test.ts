import { describe, test, expect } from "vitest";
import { getCodelockInfo, lockCode, verifyLock } from "./codelock";

const codeWithoutDocblock = `
interface CodelockInfo {
  hash: string;
  manualSectionsAllowed: boolean;
  /* BEGIN MANUAL SECTION custom_fields */
  /* END MANUAL SECTION */
}
`.trim();

describe(getCodelockInfo, () => {
  test("should return undefined if code has no docblock", () => {
    expect(getCodelockInfo("")).toBeUndefined();
    expect(getCodelockInfo(codeWithoutDocblock)).toBeUndefined();
  });

  test("should return undefined if file has some non-codelock docblock", () => {
    const code = `
/**
 * I swear, this file is generated. Believe me. Please don't edit!
 *
 * @totally-generated Codelock<<fakehash>>
 */

interface CodelockInfo {
  hash: string;
  manualSectionsAllowed: boolean;
}
`;
    expect(getCodelockInfo(code)).toBeUndefined();
  });

  test("should return codelock info for editable files", () => {
    const lockedEditableCode = `
/**
 * This file is generated with manually editable sections. Only make
 * modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
 * designators.
 *
 * @generated-editable Codelock<<somehash>>
 */

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
  /* BEGIN MANUAL SECTION manual */
  console.log("some manual code");
  /* END MANUAL SECTION */
}
`.trim();

    expect(getCodelockInfo(lockedEditableCode)).toEqual({
      hash: "somehash",
      manualSectionsAllowed: true,
    });
  });

  test("should return codelock info for uneditable files", () => {
    const lockedUneditableCode = `
/**
 * This file is generated. Do not modify it manually.
 *
 * @generated Codelock<<somehash>>
 */

interface CodelockInfo {
  hash: string;
  manualSectionsAllowed: boolean;
}

/**
 * Get codelock information from a locked source file.
 *
 * @param lockedCode Code in source file, prepended with codelock file docblock.
 */
export function getCodelockInfo(lockedCode: string): CodelockInfo | undefined {}
`.trim();

    expect(getCodelockInfo(lockedUneditableCode)).toEqual({
      hash: "somehash",
      manualSectionsAllowed: false,
    });
  });
});

describe(lockCode, () => {
  describe("editable files", () => {
    test("should prepend file docblock with consistent hash", () => {
      const lockedCode = lockCode(codeWithoutDocblock, true);
      expect(lockedCode).toContain("@generated-editable Codelock<<");
      expect(lockedCode).toMatchSnapshot();
    });

    test("should interpolate provided content", () => {
      const customLine1 = "CUSTOM LINE 1";
      const customLine2 = "CUSTOM LINE 2";
      const lockedCode = lockCode(
        codeWithoutDocblock,
        true,
        `${customLine1}\n${customLine2}`,
      );
      expect(lockedCode).toContain("@generated-editable Codelock<<");
      expect(lockedCode).toContain(customLine1);
      expect(lockedCode).toContain(customLine2);
      expect(lockedCode).toMatchSnapshot();
    });
  });

  describe("uneditable files", () => {
    test("should prepend file docblock with consistent hash", () => {
      const lockedCode = lockCode(codeWithoutDocblock, false);
      expect(lockedCode).toContain("@generated Codelock<<");
      expect(lockedCode).toMatchSnapshot();
    });

    test("should interpolate provided content", () => {
      const customLine1 = "CUSTOM LINE 1";
      const customLine2 = "CUSTOM LINE 2";
      const lockedCode = lockCode(
        codeWithoutDocblock,
        false,
        `${customLine1}\n${customLine2}`,
      );
      expect(lockedCode).toContain("@generated Codelock<<");
      expect(lockedCode).toContain(customLine1);
      expect(lockedCode).toContain(customLine2);
      expect(lockedCode).toMatchSnapshot();
    });
  });
});

describe(verifyLock, () => {
  test("should return false if file does not have docblock", () => {
    expect(verifyLock("")).toBe(false);
    expect(verifyLock(codeWithoutDocblock)).toBe(false);
  });

  test("should return true if file has not been modified after locking", () => {
    expect(verifyLock(lockCode(codeWithoutDocblock, true))).toBe(true);
    expect(verifyLock(lockCode(codeWithoutDocblock, false))).toBe(true);
  });

  test("should return false if file has been modified outside manual sections after locking", () => {
    expect(verifyLock(lockCode(codeWithoutDocblock, true) + "\naaaaaa")).toBe(
      false,
    );
    expect(verifyLock(lockCode(codeWithoutDocblock, false) + "\naaaaaa")).toBe(
      false,
    );
    expect(
      verifyLock(
        lockCode(codeWithoutDocblock, true).replace(
          "MANUAL SECTION custom_fields",
          "MANUAL SECTION a_bit_too_custom",
        ),
      ),
    ).toBe(false);
  });

  describe("editable files", () => {
    test("should return true if file has been modified in manual sections after locking", () => {
      expect(
        verifyLock(
          lockCode(codeWithoutDocblock, true).replace(
            "/* BEGIN MANUAL SECTION custom_fields */\n",
            "/* BEGIN MANUAL SECTION custom_fields */\nconsole.log('Custom code');\n",
          ),
        ),
      ).toBe(true);
    });
  });

  describe("uneditable files", () => {
    test('should return false if file has been modified in "manual" sections after locking', () => {
      expect(
        verifyLock(
          lockCode(codeWithoutDocblock, false).replace(
            "/* BEGIN MANUAL SECTION custom_fields */\n",
            "/* BEGIN MANUAL SECTION custom_fields */\nconsole.log('Custom code in uneditable file');\n",
          ),
        ),
      ).toBe(false);
    });
  });
});

describe("reversibility", () => {
  test("lock -> getCodelockInfo should return the same manualSectionsAllowed", () => {
    expect(getCodelockInfo(lockCode(codeWithoutDocblock, true))).toMatchObject({
      manualSectionsAllowed: true,
    });
    expect(getCodelockInfo(lockCode(codeWithoutDocblock, false))).toMatchObject(
      {
        manualSectionsAllowed: false,
      },
    );
  });
});

describe("line comment syntax", () => {
  const syntax = { kind: "line", prefix: "# " } as const;

  const gitattributesBody = `
# BEGIN MANUAL SECTION manual
# add custom rules here
# END MANUAL SECTION

path/to/generated.ts linguist-generated=true
`.trim();

  const gitattributesWithoutManualSections = `
path/to/generated.ts linguist-generated=true
`.trim();

  describe(lockCode, () => {
    test("should prepend a line-comment docblock with an editable lock", () => {
      const locked = lockCode(gitattributesBody, true, "", syntax);
      expect(locked).toContain("# @generated-editable Codelock<<");
      expect(locked.startsWith("# This file is generated")).toBe(true);
      expect(locked).toContain(gitattributesBody);
    });

    test("should prepend a line-comment docblock with an uneditable lock", () => {
      const locked = lockCode(
        gitattributesWithoutManualSections,
        false,
        "",
        syntax,
      );
      expect(locked).toContain("# @generated Codelock<<");
      expect(locked).not.toContain("# @generated-editable");
    });

    test("should interpolate provided customContent as line comments", () => {
      const locked = lockCode(
        gitattributesBody,
        true,
        "\nTo update: run codegen\n",
        syntax,
      );
      expect(locked).toContain("# To update: run codegen");
    });
  });

  describe(getCodelockInfo, () => {
    test("returns manualSectionsAllowed: true for editable lock", () => {
      const locked = lockCode(gitattributesBody, true, "", syntax);
      expect(getCodelockInfo(locked, syntax)).toMatchObject({
        manualSectionsAllowed: true,
      });
    });

    test("returns manualSectionsAllowed: false for uneditable lock", () => {
      const locked = lockCode(
        gitattributesWithoutManualSections,
        false,
        "",
        syntax,
      );
      expect(getCodelockInfo(locked, syntax)).toMatchObject({
        manualSectionsAllowed: false,
      });
    });

    test("returns undefined if code has no docblock", () => {
      expect(getCodelockInfo("", syntax)).toBeUndefined();
      expect(getCodelockInfo(gitattributesBody, syntax)).toBeUndefined();
    });
  });

  describe(verifyLock, () => {
    test("returns true after locking", () => {
      expect(
        verifyLock(lockCode(gitattributesBody, true, "", syntax), syntax),
      ).toBe(true);
      expect(
        verifyLock(
          lockCode(gitattributesWithoutManualSections, false, "", syntax),
          syntax,
        ),
      ).toBe(true);
    });

    test("returns false if the body is edited outside of manual sections", () => {
      expect(
        verifyLock(
          lockCode(gitattributesBody, true, "", syntax) +
            "\nextra/file linguist-generated=true\n",
          syntax,
        ),
      ).toBe(false);
      expect(
        verifyLock(
          lockCode(gitattributesWithoutManualSections, false, "", syntax) +
            "\nextra/file linguist-generated=true\n",
          syntax,
        ),
      ).toBe(false);
    });

    test("returns true if only the manual section body is edited in an editable lock", () => {
      const locked = lockCode(gitattributesBody, true, "", syntax);
      const edited = locked.replace(
        "# BEGIN MANUAL SECTION manual\n# add custom rules here\n# END MANUAL SECTION",
        "# BEGIN MANUAL SECTION manual\n# add custom rules here\npath/to/extra lfs\n# END MANUAL SECTION",
      );
      expect(verifyLock(edited, syntax)).toBe(true);
    });

    test("returns false if the manual section body is edited in an uneditable lock", () => {
      const body = `
# BEGIN MANUAL SECTION manual
# END MANUAL SECTION

path/to/generated.ts linguist-generated=true
`.trim();
      const locked = lockCode(body, false, "", syntax);
      const edited = locked.replace(
        "# BEGIN MANUAL SECTION manual\n# END MANUAL SECTION",
        "# BEGIN MANUAL SECTION manual\npath/to/extra lfs\n# END MANUAL SECTION",
      );
      expect(verifyLock(edited, syntax)).toBe(false);
    });
  });
});
