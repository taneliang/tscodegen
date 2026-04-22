import { describe, test, expect } from "vitest";
import {
  getFileDocblock,
  removeFileDocblock,
  prependFileDocblock,
  createDocblock,
} from "./docblock";

/* eslint vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectRemoveFileDocblockToPassthrough"] }] */

describe(getFileDocblock, () => {
  test("should return undefined if code does not contain docblock", () => {
    expect(getFileDocblock("")).toBeUndefined();
    expect(
      getFileDocblock(
        `
function add(a, b) {
  return a + b;
}
        `.trim(),
      ),
    ).toBeUndefined();
  });

  test("should return undefined if code does not start with docblock", () => {
    expect(
      getFileDocblock(`
/**
 * File docblock with a newline above it
 */
      `),
    ).toBeUndefined();
  });

  test("should return undefined if docblock is malformed", () => {
    expect(
      getFileDocblock(
        `
/*
 * File "docblock" without the second star in the first line
 */
        `.trim(),
      ),
    ).toBeUndefined();
    expect(
      getFileDocblock(
        `
/**
 File "docblock" without the leading star in a line
 */
        `.trim(),
      ),
    ).toBeUndefined();
  });

  test("should return docblock without leading stars", () => {
    expect(
      getFileDocblock(
        `
/**
 * File docblock
 * 
 * More info
 * 
 * @partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
 */

/**
 * Another docblock that should be ignored
 */
function add(a, b) {
  return a + b;
}
        `.trim(),
      ),
    ).toBe(
      `
File docblock

More info

@partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
      `.trim(),
    );
  });
});

describe(removeFileDocblock, () => {
  function expectRemoveFileDocblockToPassthrough(code: string) {
    expect(removeFileDocblock(code)).toBe(code);
  }

  test("should passthrough files without docblocks", () => {
    expectRemoveFileDocblockToPassthrough("");
    expectRemoveFileDocblockToPassthrough(
      `
function add(a, b) {
  return a + b;
}
      `.trim(),
    );
  });

  test("should passthrough files that does not start with docblock", () => {
    expectRemoveFileDocblockToPassthrough(`
/**
 * File docblock with a newline above it
 */
    `);
  });

  test("should passthrough files with malformed docblocks", () => {
    expectRemoveFileDocblockToPassthrough(
      `
/*
 * File "docblock" without the second star in the first line
 */
      `.trim(),
    );

    expectRemoveFileDocblockToPassthrough(
      `
/**
 File "docblock" without the leading star in a line
 */
      `.trim(),
    );
  });

  test("should return code without docblock", () => {
    expect(
      removeFileDocblock(
        `
/**
 * File docblock
 * 
 * More info
 * 
 * @partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
 */

/**
 * Another docblock that should be ignored
 */
function add(a, b) {
  return a + b;
}
        `.trim() + "\n", // Append newline to ensure we don't trim end
      ),
    ).toBe(
      `
/**
 * Another docblock that should be ignored
 */
function add(a, b) {
  return a + b;
}
`,
    );
  });
});

describe(createDocblock, () => {
  test("should create docblock correctly", () => {
    expect(
      createDocblock(
        `
File docblock

More info

@partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
        `.trim(),
      ),
    ).toBe(
      `
/**
 * File docblock
 *
 * More info
 *
 * @partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
 */
      `.trim(),
    );
  });
});

describe(prependFileDocblock, () => {
  test("should prepend docblock correctly", () => {
    const code =
      `
/**
 * Another docblock that should be ignored
 */
function add(a, b) {
  return a + b;
}
    `.trim() + "\n";

    const docblockContent = `
File docblock

More info

@partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
    `.trim();

    const result = prependFileDocblock(code, docblockContent);
    expect(result.indexOf(createDocblock(docblockContent))).toBe(0);
    expect(result).toContain(code);
  });
});

describe("reversibility", () => {
  const docblockContent = `
File docblock

More info

@partially-generated: Codelock<<aoaoreu9aoeu89aoe7u9ao7eu97oaoe98uaoe897u89>>
  `.trim();

  const code = `
/**
 * Another docblock that should be ignored
 */
function add(a, b) {
  return a + b;
}
`;

  test("prepend -> get should return same docblock content", () => {
    expect(getFileDocblock(prependFileDocblock(code, docblockContent))).toBe(
      docblockContent,
    );
  });

  test("prepend -> remove should return original code", () => {
    expect(removeFileDocblock(prependFileDocblock(code, docblockContent))).toBe(
      code,
    );
  });
});

describe("line comment syntax", () => {
  const syntax = { kind: "line", prefix: "# " } as const;

  describe(getFileDocblock, () => {
    test("should return undefined if code does not start with a prefixed line", () => {
      expect(getFileDocblock("", syntax)).toBeUndefined();
      expect(
        getFileDocblock("path linguist-generated=true\n", syntax),
      ).toBeUndefined();
    });

    test("should return docblock lines without prefix", () => {
      expect(
        getFileDocblock(
          `# File docblock
#
# More info
#
# @generated Codelock<<somehash>>

path/to/file linguist-generated=true
`,
          syntax,
        ),
      ).toBe(
        `
File docblock

More info

@generated Codelock<<somehash>>
        `.trim(),
      );
    });
  });

  describe(removeFileDocblock, () => {
    test("should passthrough files that do not start with the prefix", () => {
      expect(removeFileDocblock("", syntax)).toBe("");
      const code = "path linguist-generated=true\n";
      expect(removeFileDocblock(code, syntax)).toBe(code);
    });

    test("should strip the docblock lines", () => {
      expect(
        removeFileDocblock(
          `# File docblock
#
# @generated Codelock<<x>>

path/to/file linguist-generated=true
`,
          syntax,
        ),
      ).toBe(`
path/to/file linguist-generated=true
`);
    });
  });

  describe(createDocblock, () => {
    test("should emit one prefixed line per content line with blank lines as bare prefix", () => {
      expect(
        createDocblock(
          `File docblock

More info

@generated Codelock<<abc>>`,
          syntax,
        ),
      ).toBe(`# File docblock
#
# More info
#
# @generated Codelock<<abc>>`);
    });
  });

  describe(prependFileDocblock, () => {
    test("should prepend docblock lines before existing code", () => {
      const result = prependFileDocblock(
        "path/to/file linguist-generated=true\n",
        "@generated Codelock<<abc>>",
        syntax,
      );
      expect(result).toBe(`# @generated Codelock<<abc>>

path/to/file linguist-generated=true
`);
    });
  });

  describe("reversibility", () => {
    const docblockContent = `File docblock

More info

@partially-generated: Codelock<<abc123>>`;

    const code = `
path/to/generated.ts linguist-generated=true
`;

    test("prepend -> get should return the same content", () => {
      expect(
        getFileDocblock(
          prependFileDocblock(code, docblockContent, syntax),
          syntax,
        ),
      ).toBe(docblockContent);
    });

    test("prepend -> remove should return the original code", () => {
      expect(
        removeFileDocblock(
          prependFileDocblock(code, docblockContent, syntax),
          syntax,
        ),
      ).toBe(code);
    });
  });
});
