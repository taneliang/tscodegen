import { CodeBuilder } from './CodeBuilder';

describe(CodeBuilder, () => {
  describe(CodeBuilder.prototype.add, () => {
    test('should add code verbatim', () => {
      const code = 'const hello = "world";';
      expect(new CodeBuilder({}).add(code).add(code).toString()).toBe(code + code);
    });
  });

  describe(CodeBuilder.prototype.addLine, () => {
    test('should add code with appended newline', () => {
      const code = 'const hello = "world";';
      expect(new CodeBuilder({}).addLine(code).addLine(code).toString()).toBe(`${code}\n${code}\n`);
    });
  });

  describe(CodeBuilder.prototype.addDocblock, () => {
    test('should add single line docblock with appended newline', () => {
      const docblock = 'Only the wisest, non-binary hominids can see the code below.';
      expect(new CodeBuilder({}).addDocblock(docblock).toString()).toMatchSnapshot();
    });

    test('should add multiline docblock with appended newline', () => {
      const docblock = `
Add a block of code, i.e. code with braces around them.
   
@param codeBeforeBlock Code before the block's "{", e.g. "if (a === b)"
@param blockBuilder A function that uses \`blockBuilder\` to build the code
in the block.
      `.trim();
      expect(new CodeBuilder({}).addDocblock(docblock).toString()).toMatchSnapshot();
    });
  });

  describe(CodeBuilder.prototype.addBlock, () => {
    test('should generate block using a new builder', () => {
      const mockBuiltCode = 'console.log("New block content section");';
      const codeBeforeBlock = 'function cancel(culture: Culture)';

      const mockBuilder = jest.fn().mockImplementation(() => ({
        toString: () => mockBuiltCode,
        hasManualSections: () => false,
      }));
      const builder = new CodeBuilder({});
      builder.addBlock(codeBeforeBlock, mockBuilder);

      expect(mockBuilder).toBeCalledTimes(1);

      // Expect block to be built correctly, i.e. with content of block builder,
      // with the provided section name and valid demarcations.
      expect(builder.toString().indexOf(`${codeBeforeBlock} {\n`)).toBe(0);
      expect(builder.toString()).toContain(mockBuiltCode);
      expect(builder.toString()).toMatchSnapshot();
      expect(builder.hasManualSections()).toBe(builder.hasManualSections());
    });

    test('should set hasManualSections to true if added section has a manual section', () => {
      const mockBuilderWithManualSections = jest.fn().mockImplementation(() => ({
        toString: () => '',
        hasManualSections: () => true,
      }));
      const mockBuilderWithoutManualSections = jest.fn().mockImplementation(() => ({
        toString: () => '',
        hasManualSections: () => false,
      }));

      const builder = new CodeBuilder({});

      // Sanity check: expect blank builder to not have any manual sections
      expect(builder.hasManualSections()).toBe(false);

      // Expect no change if added block has no manual sections
      builder.addBlock('', mockBuilderWithoutManualSections);
      expect(builder.hasManualSections()).toBe(false);

      // Expect change to true if added block has manual sections
      builder.addBlock('', mockBuilderWithManualSections);
      expect(builder.hasManualSections()).toBe(true);

      // Expect no change if the builder already has manual sections
      builder.addBlock('', mockBuilderWithoutManualSections);
      expect(builder.hasManualSections()).toBe(true);
      builder.addBlock('', mockBuilderWithManualSections);
      expect(builder.hasManualSections()).toBe(true);
    });
  });

  describe(CodeBuilder.prototype.addManualSection, () => {
    test('should generate manual section using a new builder', () => {
      const mockSectionBuilder = jest.fn().mockImplementation(() => ({
        toString: () => 'console.log("New manual section");',
      }));
      const builder = new CodeBuilder({
        someOtherManualSectionKey: 'ANOTHER EXISTING MANUAL SECTION; SHOULD NOT APPEAR',
      });
      builder.addManualSection('mansec', mockSectionBuilder);
      expect(mockSectionBuilder).toBeCalledTimes(1);

      // Expect manual section to be built correctly, i.e. with content of
      // section builder, with the provided section name and valid demarcations.
      expect(builder.toString()).toMatchSnapshot();
      expect(builder.hasManualSections()).toBe(true);
    });

    test('should retain existing manual section content if present', () => {
      const mockSectionBuilder = jest.fn().mockImplementation(() => ({
        toString: () => 'NEW MANUAL SECTION; SHOULD NOT APPEAR',
      }));
      const builder = new CodeBuilder({
        mansec: 'console.log("Existing manual section");',
      });
      builder.addManualSection('mansec', mockSectionBuilder);
      expect(builder.toString()).toMatchSnapshot();
      expect(mockSectionBuilder).not.toBeCalled();
    });
  });

  test('should work', () => {
    expect(
      new CodeBuilder({
        boil_body: 'new God().magic();',
      })
        .addLine("import path from 'path';")
        .addLine("import fs from 'fs'")
        .addLine()
        .addManualSection('custom_imports', (builder) => builder)
        .addLine()
        .addBlock('class Steam extends Water', (b) =>
          b
            .addBlock('constructor()', (b) => b.addLine('this.boil();'))
            .addLine()
            .addBlock('boil()', (b) =>
              b.addManualSection('boil_body', (builder) => builder.add('this.temp = 100;')),
            ),
        )
        .format()
        .toString(),
    ).toMatchSnapshot();
  });
});
