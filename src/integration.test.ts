import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { CodeFile } from "./CodeFile";

/**
 * End-to-end integration tests that exercise the public API (`CodeFile`,
 * `CodeBuilder`) and snapshot the final on-disk output of representative
 * generated files. Read the committed snapshot file alongside this test to
 * see what generated files produced by tscodegen look like in practice.
 */

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tscodegen-integration-"));
}

function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("integration: generated file examples", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    removeDir(tmpDir);
  });

  /**
   * Build a file, lock it, save it to disk, and return the bytes that ended
   * up on disk. Using `fs.readFileSync` here (rather than
   * `CodeFile.toString`) makes the snapshots a faithful representation of
   * what consumers of tscodegen actually get on disk.
   */
  function buildAndSave(
    fileName: string,
    configure: (file: CodeFile) => CodeFile,
  ): string {
    const filePath = path.join(tmpDir, fileName);
    configure(new CodeFile(filePath)).saveToFile();
    return fs.readFileSync(filePath, "utf-8");
  }

  test("editable TypeScript class with manual sections and Prettier formatting", () => {
    const output = buildAndSave("Steam.ts", (file) =>
      file
        .build((b) =>
          b
            .addLine("import path from 'path';")
            .addLine("import fs from 'fs'")
            .addLine()
            .addManualSection("custom_imports", (builder) => builder)
            .addLine()
            .addBlock("class Steam extends Water", (builder) =>
              builder
                .addBlock("constructor()", (c) => c.addLine("this.boil();"))
                .addLine()
                .addBlock("boil()", (bb) =>
                  bb.addManualSection("boil_body", (m) =>
                    m.add("this.temp = 100;"),
                  ),
                ),
            )
            .format(),
        )
        .lock(),
    );
    expect(output).toMatchSnapshot();
  });

  test("uneditable TypeScript constants file", () => {
    const output = buildAndSave("Colors.ts", (file) =>
      file
        .build((b) =>
          b
            .addLine("export const Colors = {")
            .addLine("  RED: '#ff0000',")
            .addLine("  GREEN: '#00ff00',")
            .addLine("  BLUE: '#0000ff',")
            .addLine("} as const;")
            .format(),
        )
        .lock(),
    );
    expect(output).toMatchSnapshot();
  });

  test("TypeScript file with a custom lock comment (regeneration instructions)", () => {
    const output = buildAndSave("UserSchema.ts", (file) =>
      file
        .build((b) =>
          b
            .addDocblock("User schema, generated from the canonical model.")
            .addLine("export interface User {")
            .addLine("  id: string;")
            .addLine("  email: string;")
            .addLine("}")
            .format(),
        )
        .lock(
          "\nRegenerate this file by running:\n`npx gentgen generate src/schemas/UserSchema.ts`\n",
        ),
    );
    expect(output).toMatchSnapshot();
  });

  test("regenerating an editable file preserves existing manual section content", () => {
    const filePath = path.join(tmpDir, "Greeter.ts");

    // First generation: produce and save the initial file.
    new CodeFile(filePath)
      .build((b) =>
        b
          .addBlock("export class Greeter", (cls) =>
            cls.addBlock("greet(name: string)", (fn) =>
              fn.addManualSection("greet_body", (m) =>
                m.addLine("return `Hello, ${name}!`;"),
              ),
            ),
          )
          .format(),
      )
      .lock()
      .saveToFile();

    // Simulate a user editing the manual section on disk.
    const initialContents = fs.readFileSync(filePath, "utf-8");
    const editedContents = initialContents.replace(
      "return `Hello, ${name}!`;",
      [
        "if (name.length === 0) {",
        '  return "Hello, stranger!";',
        "}",
        "return `Hello, ${name.toUpperCase()}!`;",
      ].join("\n"),
    );
    fs.writeFileSync(filePath, editedContents, "utf-8");

    // Second generation: identical builder, but the manual section content
    // should be preserved from disk rather than re-emitted.
    const regenerated = buildAndSave("Greeter.ts", (file) =>
      file
        .build((b) =>
          b
            .addBlock("export class Greeter", (cls) =>
              cls.addBlock("greet(name: string)", (fn) =>
                fn.addManualSection("greet_body", (m) =>
                  m.addLine("return `Hello, ${name}!`;"),
                ),
              ),
            )
            .format(),
        )
        .lock(),
    );
    expect(regenerated).toMatchSnapshot();
  });

  test("line syntax: .gitattributes with editable manual section", () => {
    const filePath = path.join(tmpDir, ".gitattributes");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addManualSection("manual", (m) =>
            m.addLine("# add custom rules here"),
          )
          .addLine("path/to/generated.ts linguist-generated=true")
          .addLine("**/*.snap linguist-generated=true"),
      )
      .lock("\nTo update this file, run: npm run generate:gitattributes\n")
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("line syntax: uneditable shell script with '# ' prefix", () => {
    const filePath = path.join(tmpDir, "deploy.sh");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addLine("#!/usr/bin/env bash")
          .addLine("set -euo pipefail")
          .addLine()
          .addLine("echo 'Deploying version 1.2.3'")
          .addLine("./scripts/deploy.sh --version 1.2.3"),
      )
      .lock()
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("line syntax: TypeScript file with '// ' prefix and an editable manual section", () => {
    const filePath = path.join(tmpDir, "generated-config.ts");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "// " },
    })
      .build((b) =>
        b
          .addLine("export const apiBaseUrl = 'https://api.example.com';")
          .addLine()
          .addManualSection("overrides", (m) =>
            m.addLine("// Override config here if needed."),
          ),
      )
      .lock()
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("line syntax: regenerating preserves manual section content", () => {
    const filePath = path.join(tmpDir, ".gitattributes");
    const syntax = { kind: "line" as const, prefix: "# " };

    new CodeFile(filePath, { commentSyntax: syntax })
      .build((b) =>
        b
          .addManualSection("manual", (m) =>
            m.addLine("# add custom rules here"),
          )
          .addLine("path/to/generated.ts linguist-generated=true"),
      )
      .lock()
      .saveToFile();

    // Simulate a human adding a custom rule inside the manual section.
    const initial = fs.readFileSync(filePath, "utf-8");
    fs.writeFileSync(
      filePath,
      initial.replace(
        "# add custom rules here",
        "# add custom rules here\nmy/secret/lockfile.json linguist-vendored",
      ),
      "utf-8",
    );

    new CodeFile(filePath, { commentSyntax: syntax })
      .build((b) =>
        b
          .addManualSection("manual", (m) =>
            m.addLine("# add custom rules here"),
          )
          .addLine("path/to/generated.ts linguist-generated=true"),
      )
      .lock()
      .saveToFile();

    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });
});
