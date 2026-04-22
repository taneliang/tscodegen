import { describe, test, expect } from "vitest";
import { lockCode } from "./codelock";
import { detectCommentSyntax } from "./detectCommentSyntax";

describe(detectCommentSyntax, () => {
  test("returns undefined for the empty string", () => {
    expect(detectCommentSyntax("")).toBeUndefined();
  });

  test("returns undefined for a plain source file without a codelock", () => {
    expect(detectCommentSyntax(`export const answer = 42;\n`)).toBeUndefined();
  });

  test("returns undefined for a file with a JSDoc docblock that isn't a codelock", () => {
    const code = `/**
 * A plain docblock that happens to start the file.
 */

export const foo = 1;
`;
    expect(detectCommentSyntax(code)).toBeUndefined();
  });

  test("detects JSDoc syntax on an editable codelock", () => {
    const locked = lockCode("export const foo = 1;\n", true);
    expect(detectCommentSyntax(locked)).toEqual({ kind: "jsdoc" });
  });

  test("detects JSDoc syntax on an uneditable codelock", () => {
    const locked = lockCode("export const foo = 1;\n", false);
    expect(detectCommentSyntax(locked)).toEqual({ kind: "jsdoc" });
  });

  test("detects '# ' line syntax on a gitattributes-style locked file", () => {
    const body = `path/to/generated.ts linguist-generated=true\n`;
    const locked = lockCode(body, false, "", { kind: "line", prefix: "# " });
    expect(detectCommentSyntax(locked)).toEqual({
      kind: "line",
      prefix: "# ",
    });
  });

  test("detects '// ' line syntax on a locked .ts file", () => {
    const locked = lockCode(
      "export const apiBaseUrl = 'https://api.example.com';\n",
      true,
      "",
      { kind: "line", prefix: "// " },
    );
    expect(detectCommentSyntax(locked)).toEqual({
      kind: "line",
      prefix: "// ",
    });
  });

  test("ignores a non-codelock `@generated` line in the body of a file", () => {
    const code = `import x from "./x";

// @generated Codelock<<somehash>> but not really, I'm just a comment below code

export const y = 1;
`;
    expect(detectCommentSyntax(code)).toBeUndefined();
  });

  test("skipped files are not falsely detected when the hash would be invalid", () => {
    const locked = lockCode("export const foo = 1;\n", true);
    const corrupted = `${locked}\nconst extra = true;\n`;
    expect(detectCommentSyntax(corrupted)).toEqual({ kind: "jsdoc" });
  });
});
