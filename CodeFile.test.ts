import fs from 'fs';
import mockFs from 'mock-fs';
import { CodeFile } from './CodeFile';
import { CodeBuilder } from './CodeBuilder';

jest.mock('./CodeBuilder', () => ({
  CodeBuilder: jest.fn().mockReturnValue({
    toString: () => 'BUILT CODE',
    hasManualSections: () => true,
  }),
}));

const mockCode = `
/**
 * This file is generated with manually editable sections. Only make
 * modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
 * designators.
 *
 * @generated-editable Codelock<<badlock>>
 */

interface CodelockInfo {
  hash: string;
  manualSectionsAllowed: boolean;
  /* BEGIN MANUAL SECTION custom_fields */
  customField: number;
  /* END MANUAL SECTION */
}
`.trim();

describe(CodeFile, () => {
  const CODE_PATH = 'src/schemas/SchemaSchema.ts';

  beforeEach(() => {
    mockFs({
      [CODE_PATH]: mockCode,
    });
  });

  afterEach(() => {
    mockFs.restore();
    (CodeBuilder as jest.MockedClass<typeof CodeBuilder>).mockClear();
  });

  describe(CodeFile.prototype.constructor, () => {
    test('should read file contents when constructed if file exists', () => {
      expect(new CodeFile(CODE_PATH).toString()).toBe(mockCode);
    });

    test('should initialize to empty string if file does not exist', () => {
      expect(new CodeFile('/non-existent.ts').toString()).toBe('');
    });
  });

  describe(CodeFile.prototype.verify, () => {
    test('should return false for loaded invalid locked file from disk', () => {
      expect(new CodeFile(CODE_PATH).verify()).toBe(false);
    });

    test('should return true for newly built file', () => {
      const mockBuilderBuilder = jest.fn().mockImplementation((b) => b);
      const builtFile = new CodeFile(CODE_PATH).build(mockBuilderBuilder);
      expect(builtFile.verify()).toBe(true);
    });
  });

  describe(CodeFile.prototype.build, () => {
    test('should build and lock new code', () => {
      const mockBuilderBuilder = jest.fn().mockImplementation((b) => b);
      const builtFile = new CodeFile(CODE_PATH).build(mockBuilderBuilder);
      // Expect new CodeBuilder to have been used
      expect(CodeBuilder.prototype.constructor).toHaveBeenCalledTimes(1);
      // Expect codelock to be present
      expect(builtFile.toString()).toContain('@generated-editable');
      // Expect built code to be present
      expect(builtFile.toString()).toContain('BUILT CODE');
    });
  });

  describe(CodeFile.prototype.saveToFile, () => {
    test('should save file contents to path passed at construction', () => {
      const mockBuilderBuilder = jest.fn().mockImplementation((b) => b);
      const builtFile = new CodeFile(CODE_PATH).build(mockBuilderBuilder);
      builtFile.saveToFile();
      expect(fs.readFileSync(CODE_PATH, 'utf-8')).toBe(builtFile.toString());
    });
  });
});
