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

  test("Python module with manual section inside a function body", () => {
    const filePath = path.join(tmpDir, "compute.py");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addLine("from typing import Iterable")
          .addLine()
          .addLine("DEFAULT_FACTOR = 1.5")
          .addLine()
          .addLine("def compute(values: Iterable[float]) -> float:")
          .indent("    ", (fn) =>
            fn
              .addLine('"""Compute a weighted sum of values."""')
              .addLine("total = sum(values) * DEFAULT_FACTOR")
              .addManualSection("postprocess", (m) =>
                m
                  .addLine("# Project-specific adjustments go here.")
                  .addLine("if total > 1000:")
                  .indent("    ", (branch) =>
                    branch.addLine("total = round(total, 2)"),
                  )
                  .addLine("return total"),
              ),
          ),
      )
      .lock("\nRegenerate with: python -m tools.codegen compute\n")
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("Python class with manual sections at two indentation levels", () => {
    const filePath = path.join(tmpDir, "user.py");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addLine("from dataclasses import dataclass")
          .addLine()
          .addManualSection("custom_imports", (m) => m)
          .addLine()
          .addLine("@dataclass")
          .addLine("class User:")
          .indent("    ", (cls) =>
            cls
              .addLine("id: str")
              .addLine("email: str")
              .addLine()
              .addLine("def greet(self) -> str:")
              .indent("    ", (fn) =>
                fn.addManualSection("greet_body", (m) =>
                  m.addLine('return f"Hello, {self.email}!"'),
                ),
              ),
          ),
      )
      .lock()
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("Python: regenerating preserves an indented manual section when a human adds lines", () => {
    const filePath = path.join(tmpDir, "compute.py");
    const syntax = { kind: "line" as const, prefix: "# " };

    const writeInitial = () =>
      new CodeFile(filePath, { commentSyntax: syntax })
        .build((b) =>
          b
            .addLine("def compute(x: int) -> int:")
            .indent("    ", (fn) =>
              fn
                .addLine("result = x + 1")
                .addManualSection("postprocess", (m) =>
                  m.addLine("return result"),
                ),
            ),
        )
        .lock()
        .saveToFile();

    writeInitial();

    // Human edits inside the manual section, matching the Python indent.
    const initial = fs.readFileSync(filePath, "utf-8");
    const edited = initial.replace(
      "    return result",
      "    if result > 100:\n        raise ValueError(result)\n    return result",
    );
    fs.writeFileSync(filePath, edited, "utf-8");

    // Regenerate with the same builder.
    writeInitial();

    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("YAML docker-compose fragment with manual section inside a nested mapping", () => {
    const filePath = path.join(tmpDir, "docker-compose.yml");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addLine("version: '3.9'")
          .addLine()
          .addLine("services:")
          .indent("  ", (services) =>
            services
              .addLine("web:")
              .indent("  ", (web) =>
                web
                  .addLine("image: myapp:latest")
                  .addLine("ports:")
                  .indent("  ", (ports) => ports.addLine("- '8080:8080'"))
                  .addManualSection("web-env", (m) =>
                    m
                      .addLine("environment:")
                      .indent("  ", (env) =>
                        env
                          .addLine("- NODE_ENV=production")
                          .addLine("- FEATURE_FLAG=off"),
                      ),
                  ),
              )
              .addLine("db:")
              .indent("  ", (db) =>
                db
                  .addLine("image: postgres:15")
                  .addManualSection("db-env", (m) => m),
              ),
          ),
      )
      .lock()
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("Terraform main.tf with manual sections inside nested HCL blocks", () => {
    const filePath = path.join(tmpDir, "main.tf");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addLine("terraform {")
          .indent("  ", (tf) =>
            tf
              .addLine('required_version = ">= 1.6.0"')
              .addLine("required_providers {")
              .indent("  ", (rp) =>
                rp
                  .addLine("aws = {")
                  .indent("  ", (aws) =>
                    aws
                      .addLine('source  = "hashicorp/aws"')
                      .addLine('version = "~> 5.0"'),
                  )
                  .addLine("}"),
              )
              .addLine("}"),
          )
          .addLine("}")
          .addLine()
          .addLine('resource "aws_s3_bucket" "logs" {')
          .indent("  ", (res) =>
            res
              .addLine('bucket = "acme-app-logs-${var.environment}"')
              .addLine()
              .addLine("lifecycle_rule {")
              .indent("  ", (lc) =>
                lc
                  .addLine("enabled = true")
                  .addLine("expiration {")
                  .indent("  ", (exp) => exp.addLine("days = 90"))
                  .addLine("}"),
              )
              .addLine("}")
              .addLine()
              .addLine("tags = {")
              .indent("  ", (tags) =>
                tags
                  .addLine('Name        = "acme-app-logs"')
                  .addLine("Environment = var.environment")
                  .addManualSection("extra_tags", (m) =>
                    m
                      .addLine(
                        "# Add team-specific tags below; they survive regeneration.",
                      )
                      .addLine('Team        = "platform"')
                      .addLine('CostCenter  = "eng-infra-42"'),
                  ),
              )
              .addLine("}"),
          )
          .addLine("}")
          .addLine()
          .addManualSection("extra_resources", (m) =>
            m.addLine(
              "# Define additional resources here. They are preserved across regenerations.",
            ),
          ),
      )
      .lock("\nRegenerate with: npm run generate:terraform\n")
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("Terraform: regenerating preserves an indented manual section when a human adds tags", () => {
    const filePath = path.join(tmpDir, "main.tf");
    const syntax = { kind: "line" as const, prefix: "# " };

    const writeInitial = () =>
      new CodeFile(filePath, { commentSyntax: syntax })
        .build((b) =>
          b
            .addLine('resource "aws_s3_bucket" "logs" {')
            .indent("  ", (res) =>
              res
                .addLine('bucket = "logs"')
                .addLine("tags = {")
                .indent("  ", (tags) =>
                  tags
                    .addLine('Name = "logs"')
                    .addManualSection("extra_tags", (m) =>
                      m.addLine('Team = "platform"'),
                    ),
                )
                .addLine("}"),
            )
            .addLine("}"),
        )
        .lock()
        .saveToFile();

    writeInitial();

    // Human edits inside the manual section at the matching (4-space) indent.
    const initial = fs.readFileSync(filePath, "utf-8");
    const edited = initial.replace(
      '    Team = "platform"',
      [
        '    Team        = "platform"',
        '    CostCenter  = "eng-infra-42"',
        "    ManagedBy   = terraform.workspace",
      ].join("\n"),
    );
    fs.writeFileSync(filePath, edited, "utf-8");

    // Regenerate with the same builder.
    writeInitial();

    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("SQL schema with manual section inside a CREATE TABLE column list", () => {
    const filePath = path.join(tmpDir, "users.sql");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "-- " },
    })
      .build((b) =>
        b
          .addLine("CREATE TABLE users (")
          .indent("  ", (cols) =>
            cols
              .addLine("id          UUID PRIMARY KEY,")
              .addLine("email       TEXT NOT NULL,")
              .addLine("created_at  TIMESTAMP DEFAULT now(),")
              .addManualSection("extra_columns", (m) =>
                m
                  .addLine("-- Project-specific columns go below. They survive")
                  .addLine("-- regeneration.")
                  .addLine("team_id     INTEGER REFERENCES teams(id),")
                  .addLine("last_login  TIMESTAMP"),
              ),
          )
          .addLine(");")
          .addLine()
          .addLine("CREATE INDEX users_email_idx ON users (email);"),
      )
      .lock()
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });

  test("Makefile with tab-indented recipe and a manual section", () => {
    const filePath = path.join(tmpDir, "Makefile");
    new CodeFile(filePath, {
      commentSyntax: { kind: "line", prefix: "# " },
    })
      .build((b) =>
        b
          .addLine(".PHONY: build test")
          .addLine()
          .addLine("build:")
          .indent("\t", (recipe) =>
            recipe
              .addLine("yarn install")
              .addLine("yarn build")
              .addManualSection("build_postprocess", (m) =>
                m.addLine("@echo 'customize your build steps here'"),
              ),
          ),
      )
      .lock()
      .saveToFile();
    expect(fs.readFileSync(filePath, "utf-8")).toMatchSnapshot();
  });
});
