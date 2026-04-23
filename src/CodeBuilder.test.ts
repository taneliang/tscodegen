import { describe, test, expect, vi } from "vitest";
import { CodeBuilder } from "./CodeBuilder";
import fs from "fs";
import os from "os";
import path from "path";

function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe(CodeBuilder, () => {
  describe(CodeBuilder.prototype.add, () => {
    test("should add code verbatim", () => {
      const code = 'const hello = "world";';
      expect(new CodeBuilder({}).add(code).add(code).toString()).toBe(
        code + code,
      );
    });
  });

  describe(CodeBuilder.prototype.addLine, () => {
    test("should add code with appended newline", () => {
      const code = 'const hello = "world";';
      expect(new CodeBuilder({}).addLine(code).addLine(code).toString()).toBe(
        `${code}\n${code}\n`,
      );
    });
  });

  describe(CodeBuilder.prototype.addDocblock, () => {
    test("should add single line docblock with appended newline", () => {
      const docblock =
        "Only the wisest, non-binary hominids can see the code below.";
      expect(
        new CodeBuilder({}).addDocblock(docblock).toString(),
      ).toMatchSnapshot();
    });

    test("should add multiline docblock with appended newline", () => {
      const docblock = `
Add a block of code, i.e. code with braces around them.
   
@param codeBeforeBlock Code before the block's "{", e.g. "if (a === b)"
@param blockBuilder A function that uses \`blockBuilder\` to build the code
in the block.
      `.trim();
      expect(
        new CodeBuilder({}).addDocblock(docblock).toString(),
      ).toMatchSnapshot();
    });
  });

  describe(CodeBuilder.prototype.addBlock, () => {
    test("should generate block using a new builder", () => {
      const mockBuiltCode = 'console.log("New block content section");';
      const codeBeforeBlock = "function cancel(culture: Culture)";

      const mockBuilder = vi.fn().mockImplementation(() => ({
        toString: () => mockBuiltCode,
        hasManualSections: () => false,
      }));
      const builder = new CodeBuilder({});
      builder.addBlock(codeBeforeBlock, mockBuilder);

      expect(mockBuilder).toHaveBeenCalledTimes(1);

      // Expect block to be built correctly, i.e. with content of block builder,
      // with the provided section name and valid demarcations.
      expect(builder.toString().indexOf(`${codeBeforeBlock} {\n`)).toBe(0);
      expect(builder.toString()).toContain(mockBuiltCode);
      expect(builder.toString()).toMatchSnapshot();
      expect(builder.hasManualSections()).toBe(builder.hasManualSections());
    });

    test("should set hasManualSections to true if added section has a manual section", () => {
      const mockBuilderWithManualSections = vi.fn().mockImplementation(() => ({
        toString: () => "",
        hasManualSections: () => true,
      }));
      const mockBuilderWithoutManualSections = vi
        .fn()
        .mockImplementation(() => ({
          toString: () => "",
          hasManualSections: () => false,
        }));

      const builder = new CodeBuilder({});

      // Sanity check: expect blank builder to not have any manual sections
      expect(builder.hasManualSections()).toBe(false);

      // Expect no change if added block has no manual sections
      builder.addBlock("", mockBuilderWithoutManualSections);
      expect(builder.hasManualSections()).toBe(false);

      // Expect change to true if added block has manual sections
      builder.addBlock("", mockBuilderWithManualSections);
      expect(builder.hasManualSections()).toBe(true);

      // Expect no change if the builder already has manual sections
      builder.addBlock("", mockBuilderWithoutManualSections);
      expect(builder.hasManualSections()).toBe(true);
      builder.addBlock("", mockBuilderWithManualSections);
      expect(builder.hasManualSections()).toBe(true);
    });
  });

  describe(CodeBuilder.prototype.addManualSection, () => {
    test("should generate manual section using a new builder", () => {
      const mockSectionBuilder = vi.fn().mockImplementation(() => ({
        toString: () => 'console.log("New manual section");',
      }));
      const builder = new CodeBuilder({
        someOtherManualSectionKey:
          "ANOTHER EXISTING MANUAL SECTION; SHOULD NOT APPEAR",
      });
      builder.addManualSection("mansec", mockSectionBuilder);
      expect(mockSectionBuilder).toHaveBeenCalledTimes(1);

      // Expect manual section to be built correctly, i.e. with content of
      // section builder, with the provided section name and valid demarcations.
      expect(builder.toString()).toMatchSnapshot();
      expect(builder.hasManualSections()).toBe(true);
    });

    test("should retain existing manual section content if present", () => {
      const mockSectionBuilder = vi.fn().mockImplementation(() => ({
        toString: () => "NEW MANUAL SECTION; SHOULD NOT APPEAR",
      }));
      const builder = new CodeBuilder({
        mansec: 'console.log("Existing manual section");',
      });
      builder.addManualSection("mansec", mockSectionBuilder);
      expect(builder.toString()).toMatchSnapshot();
      expect(mockSectionBuilder).not.toHaveBeenCalled();
    });
  });

  describe(CodeBuilder.prototype.indent, () => {
    test("should prefix each line of nested output with the given indent", () => {
      const output = new CodeBuilder({})
        .addLine("class Foo:")
        .indent("    ", (b) => b.addLine("def bar(self):").addLine("    pass"))
        .toString();
      expect(output).toBe(`class Foo:\n    def bar(self):\n        pass\n`);
    });

    test("should leave empty lines unindented (no trailing whitespace)", () => {
      const output = new CodeBuilder({})
        .addLine("header")
        .indent("  ", (b) => b.addLine("first").addLine().addLine("third"))
        .toString();
      expect(output).toBe("header\n  first\n\n  third\n");
    });

    test("should compose nested indent scopes additively", () => {
      const output = new CodeBuilder({})
        .addLine("outer")
        .indent("  ", (b) =>
          b.addLine("depth 1").indent("  ", (bb) => bb.addLine("depth 2")),
        )
        .toString();
      expect(output).toBe("outer\n  depth 1\n    depth 2\n");
    });

    test("should indent manual section markers and body when nested", () => {
      const output = new CodeBuilder({}, { kind: "line", prefix: "# " })
        .addLine("def compute(x):")
        .indent("    ", (b) =>
          b
            .addLine("result = x + 1")
            .addManualSection("postprocess", (m) => m.addLine("return result")),
        )
        .toString();
      expect(output).toBe(
        `def compute(x):\n    result = x + 1\n    # BEGIN MANUAL SECTION postprocess\n    return result\n    # END MANUAL SECTION\n`,
      );
    });

    test("should re-indent an existing manual section body when regenerating inside an indent scope", () => {
      const builder = new CodeBuilder(
        { body: "if x:\n    return 42\nreturn 0" },
        { kind: "line", prefix: "# " },
      );
      const output = builder
        .addLine("def f():")
        .indent("    ", (b) =>
          b.addManualSection("body", (m) => m.addLine("placeholder")),
        )
        .toString();
      expect(output).toBe(
        `def f():\n    # BEGIN MANUAL SECTION body\n    if x:\n        return 42\n    return 0\n    # END MANUAL SECTION\n`,
      );
    });

    test("should propagate hasManualSections out of nested indent scope", () => {
      const builder = new CodeBuilder({});
      expect(builder.hasManualSections()).toBe(false);
      builder.indent("  ", (b) =>
        b.addManualSection("key", (m) => m.addLine("body")),
      );
      expect(builder.hasManualSections()).toBe(true);
    });

    test("should accept tab characters as indent", () => {
      const output = new CodeBuilder({})
        .addLine("root")
        .indent("\t", (b) => b.addLine("child"))
        .toString();
      expect(output).toBe("root\n\tchild\n");
    });

    test("should only apply indent at the start of a line when `add` is called repeatedly mid-line", () => {
      const output = new CodeBuilder({})
        .indent("  ", (b) => b.add("foo").add("bar").addLine(" baz"))
        .toString();
      expect(output).toBe("  foobar baz\n");
    });
  });

  describe(CodeBuilder.prototype.format, () => {
    test("should resolve prettier config from cwd using a ts filepath", () => {
      const originalCwd = process.cwd();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tscodegen-test-"));
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "temp-test-project",
          prettier: { singleQuote: true, semi: false },
        }),
      );

      try {
        process.chdir(tempDir);
        expect(
          new CodeBuilder({})
            .addLine('const hello = "world"')
            .format()
            .toString(),
        ).toBe("const hello = 'world'\n");
      } finally {
        process.chdir(originalCwd);
        removeDir(tempDir);
      }
    });

    test("should continue formatting if config resolution throws", () => {
      const originalCwd = process.cwd();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tscodegen-test-"));
      fs.writeFileSync(path.join(tempDir, ".prettierrc"), "{ invalid json ");

      try {
        process.chdir(tempDir);
        expect(
          new CodeBuilder({})
            .addLine('const hello = "world"')
            .format()
            .toString(),
        ).toBe('const hello = "world";\n');
      } finally {
        process.chdir(originalCwd);
        removeDir(tempDir);
      }
    });

    test("should re-synchronize the at-line-start flag after formatting", () => {
      // Regression test: before the fix, calling format() on a builder
      // with ambient indent left a stale atLineStart from the pre-format
      // state. A subsequent addLine() then skipped or misapplied the
      // ambient indent depending on whether the last pre-format write
      // ended with a newline.
      const output = new CodeBuilder({}, { kind: "jsdoc" }, "  ")
        .add("const x = 1;") // trailing char is ';', atLineStart = false
        .format() // prettier normalizes to "const x = 1;\n"
        .addLine("const y = 2;") // should land indented under ambient
        .toString();
      expect(output).toBe("const x = 1;\n  const y = 2;\n");
    });
  });

  test("should work", () => {
    expect(
      new CodeBuilder({
        boil_body: "new God().magic();",
      })
        .addLine("import path from 'path';")
        .addLine("import fs from 'fs'")
        .addLine()
        .addManualSection("custom_imports", (builder) => builder)
        .addLine()
        .addBlock("class Steam extends Water", (b) =>
          b
            .addBlock("constructor()", (b) => b.addLine("this.boil();"))
            .addLine()
            .addBlock("boil()", (b) =>
              b.addManualSection("boil_body", (builder) =>
                builder.add("this.temp = 100;"),
              ),
            ),
        )
        .format()
        .toString(),
    ).toMatchSnapshot();
  });
});
