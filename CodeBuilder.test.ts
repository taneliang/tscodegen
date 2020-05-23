import { CodeBuilder } from './CodeBuilder';

describe(CodeBuilder, () => {
  describe(CodeBuilder.prototype.insertCode, () => {
    test('should insert code', () => {
      expect(new CodeBuilder({}).insertCode('const hello = "world";').toString()).toBe(
        'const hello = "world";',
      );
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

      // Expect manual section to be built correctly, i.e. with content of
      // section builder, with the provided section name and valid demarcations.
      expect(builder.toString()).toMatchSnapshot();

      // Expect a new builder to be used for manual section.
      expect(mockSectionBuilder).toBeCalledTimes(1);
      expect(mockSectionBuilder).not.toBeCalledWith(builder);
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
        .insertCode("import path from 'path';")
        .insertCode("import fs from 'fs'")
        .addManualSection('custom_imports', (builder) => builder)
        .insertCode(
          `class Steam extends Water {
              constructor() {
                this.boil();
              }

              boil() {`,
        )
        .addManualSection('boil_body', (builder) => builder.insertCode('this.temp = 100;'))
        .insertCode(`}`)
        .insertCode(`}`)
        .format()
        .toString(),
    ).toMatchSnapshot();
  });
});
