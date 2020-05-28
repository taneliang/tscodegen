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
  });

  describe("uneditable files", () => {
    test("should prepend file docblock with consistent hash", () => {
      const lockedCode = lockCode(codeWithoutDocblock, false);
      expect(lockedCode).toContain("@generated Codelock<<");
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
      false
    );
    expect(verifyLock(lockCode(codeWithoutDocblock, false) + "\naaaaaa")).toBe(
      false
    );
    expect(
      verifyLock(
        lockCode(codeWithoutDocblock, true).replace(
          "MANUAL SECTION custom_fields",
          "MANUAL SECTION a_bit_too_custom"
        )
      )
    ).toBe(false);
  });

  describe("editable files", () => {
    test("should return true if file has been modified in manual sections after locking", () => {
      expect(
        verifyLock(
          lockCode(codeWithoutDocblock, true).replace(
            "/* BEGIN MANUAL SECTION custom_fields */\n",
            "/* BEGIN MANUAL SECTION custom_fields */\nconsole.log('Custom code');\n"
          )
        )
      ).toBe(true);
    });
  });

  describe("uneditable files", () => {
    test('should return false if file has been modified in "manual" sections after locking', () => {
      expect(
        verifyLock(
          lockCode(codeWithoutDocblock, false).replace(
            "/* BEGIN MANUAL SECTION custom_fields */\n",
            "/* BEGIN MANUAL SECTION custom_fields */\nconsole.log('Custom code in uneditable file');\n"
          )
        )
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
      }
    );
  });
});
