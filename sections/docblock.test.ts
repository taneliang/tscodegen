import {
  getFileDocblock,
  removeFileDocblock,
  prependFileDocblock,
  createDocblock,
} from './docblock';

describe(getFileDocblock, () => {
  test('should return undefined if code does not contain docblock', () => {
    expect(getFileDocblock('')).toBeUndefined();
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

  test('should return undefined if code does not start with docblock', () => {
    expect(
      getFileDocblock(`
/**
 * File docblock with a newline above it
 */
      `),
    ).toBeUndefined();
  });

  test('should return undefined if docblock is malformed', () => {
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

  test('should return docblock without leading stars', () => {
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

  test('should passthrough files without docblocks', () => {
    expectRemoveFileDocblockToPassthrough('');
    expectRemoveFileDocblockToPassthrough(
      `
function add(a, b) {
  return a + b;
}
      `.trim(),
    );
  });

  test('should passthrough files that does not start with docblock', () => {
    expectRemoveFileDocblockToPassthrough(`
/**
 * File docblock with a newline above it
 */
    `);
  });

  test('should passthrough files with malformed docblocks', () => {
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

  test('should return code without docblock', () => {
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
        `.trim() + '\n', // Append newline to ensure we don't trim end
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
  test('should create docblock correctly', () => {
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
  test('should prepend docblock correctly', () => {
    const code =
      `
/**
 * Another docblock that should be ignored
 */
function add(a, b) {
  return a + b;
}
    `.trim() + '\n';

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

describe('reversibility', () => {
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

  test('prepend -> get should return same docblock content', () => {
    expect(getFileDocblock(prependFileDocblock(code, docblockContent))).toBe(docblockContent);
  });

  test('prepend -> remove should return original code', () => {
    expect(removeFileDocblock(prependFileDocblock(code, docblockContent))).toBe(code);
  });
});
