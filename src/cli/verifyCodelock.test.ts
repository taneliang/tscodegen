import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Writable } from "stream";
import { CodeFile } from "../CodeFile";
import {
  HELP_TEXT,
  main,
  parseArgs,
  resolveFiles,
  run,
  verifyFile,
} from "./verifyCodelock";

/**
 * Collects everything written to a stream into an in-memory string. Satisfies
 * the `NodeJS.WritableStream` subset of `process.stdout` / `process.stderr`
 * that the CLI actually uses (`.write(chunk)`).
 */
class StringStream extends Writable {
  chunks: string[] = [];
  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(
      typeof chunk === "string" ? chunk : chunk.toString("utf-8"),
    );
    callback();
  }
  get value(): string {
    return this.chunks.join("");
  }
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "verify-codelock-"));
}

function writeEditableTsFile(filePath: string): void {
  new CodeFile(filePath)
    .build((b) =>
      b
        .addLine("export const foo = 1;")
        .addManualSection("m", (m) => m.addLine("// custom")),
    )
    .lock()
    .saveToFile();
}

function writeLineCommentGitattributes(filePath: string): void {
  new CodeFile(filePath, {
    commentSyntax: { kind: "line", prefix: "# " },
  })
    .build((b) => b.addLine("path/to/generated.ts linguist-generated=true"))
    .lock()
    .saveToFile();
}

describe(parseArgs, () => {
  test("collects positional patterns", () => {
    const parsed = parseArgs(["src/**/*.ts", "packages/**/*.graphql"]);
    expect(parsed.patterns).toEqual(["src/**/*.ts", "packages/**/*.graphql"]);
    expect(parsed.error).toBeUndefined();
  });

  test("parses --ignore with space and equals forms", () => {
    const parsed = parseArgs([
      "--ignore",
      "**/dist/**",
      "--ignore=**/build/**",
      "src/**/*.ts",
    ]);
    expect(parsed.ignore).toEqual(["**/dist/**", "**/build/**"]);
    expect(parsed.patterns).toEqual(["src/**/*.ts"]);
  });

  test("reports an error when --ignore is missing its argument", () => {
    const parsed = parseArgs(["--ignore"]);
    expect(parsed.error).toContain("--ignore");
  });

  test("parses boolean flags", () => {
    const parsed = parseArgs([
      "--quiet",
      "--verbose",
      "--no-color",
      "-h",
      "-v",
      "src/**",
    ]);
    expect(parsed.quiet).toBe(true);
    expect(parsed.verbose).toBe(true);
    expect(parsed.noColor).toBe(true);
    expect(parsed.help).toBe(true);
    expect(parsed.version).toBe(true);
  });

  test("rejects unknown options", () => {
    const parsed = parseArgs(["--unknown"]);
    expect(parsed.error).toContain("unknown option");
  });

  test("treats everything after `--` as a pattern", () => {
    const parsed = parseArgs(["--", "--looks-like-flag", "src/**"]);
    expect(parsed.patterns).toEqual(["--looks-like-flag", "src/**"]);
  });
});

describe("verifyFile / resolveFiles / run", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("verifyFile classifies ok, tampered, skipped, and error", () => {
    const okPath = path.join(tmpDir, "Ok.ts");
    writeEditableTsFile(okPath);
    expect(verifyFile(okPath, "Ok.ts").status).toBe("ok");

    const tamperedPath = path.join(tmpDir, "Tampered.ts");
    writeEditableTsFile(tamperedPath);
    fs.appendFileSync(tamperedPath, "export const evil = true;\n");
    expect(verifyFile(tamperedPath, "Tampered.ts").status).toBe("tampered");

    const plainPath = path.join(tmpDir, "Plain.ts");
    fs.writeFileSync(plainPath, "export const y = 2;\n");
    expect(verifyFile(plainPath, "Plain.ts").status).toBe("skipped");

    const missingPath = path.join(tmpDir, "missing.ts");
    const result = verifyFile(missingPath, "missing.ts");
    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
  });

  test("resolveFiles expands a glob to matched files only", () => {
    writeEditableTsFile(path.join(tmpDir, "a.ts"));
    writeEditableTsFile(path.join(tmpDir, "b.ts"));
    fs.writeFileSync(path.join(tmpDir, "c.md"), "hello\n");

    const files = resolveFiles(["**/*.ts"], { cwd: tmpDir });
    expect(files).toEqual(["a.ts", "b.ts"]);
  });

  test("resolveFiles accepts literal file paths", () => {
    const filePath = path.join(tmpDir, "Explicit.ts");
    writeEditableTsFile(filePath);
    expect(resolveFiles(["Explicit.ts"], { cwd: tmpDir })).toEqual([
      "Explicit.ts",
    ]);
  });

  test("resolveFiles expands a directory argument to its contents", () => {
    const sub = path.join(tmpDir, "gen");
    fs.mkdirSync(sub);
    writeEditableTsFile(path.join(sub, "a.ts"));
    writeEditableTsFile(path.join(sub, "b.ts"));

    const files = resolveFiles(["gen"], { cwd: tmpDir });
    expect(files.sort()).toEqual(["gen/a.ts", "gen/b.ts"]);
  });

  test("resolveFiles honours the --ignore option", () => {
    writeEditableTsFile(path.join(tmpDir, "keep.ts"));
    writeEditableTsFile(path.join(tmpDir, "drop.ts"));

    const files = resolveFiles(["**/*.ts"], {
      cwd: tmpDir,
      ignore: ["**/drop.ts"],
    });
    expect(files).toEqual(["keep.ts"]);
  });

  test("run returns exit code 0 when every matched file is ok or skipped", () => {
    writeEditableTsFile(path.join(tmpDir, "a.ts"));
    writeLineCommentGitattributes(path.join(tmpDir, ".gitattributes"));
    fs.writeFileSync(path.join(tmpDir, "plain.md"), "nothing here\n");

    const stdout = new StringStream();
    const stderr = new StringStream();
    const result = run(["**/*"], {
      cwd: tmpDir,
      stdout,
      stderr,
      noColor: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.okCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.tamperedCount).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("2 ok");
    expect(stdout.value).toContain("1 skipped");
  });

  test("run returns exit code 1 when a matched file is tampered", () => {
    const tamperedPath = path.join(tmpDir, "Tampered.ts");
    writeEditableTsFile(tamperedPath);
    fs.appendFileSync(tamperedPath, "export const evil = true;\n");

    const stdout = new StringStream();
    const stderr = new StringStream();
    const result = run(["**/*.ts"], {
      cwd: tmpDir,
      stdout,
      stderr,
      noColor: true,
    });
    expect(result.exitCode).toBe(1);
    expect(result.tamperedCount).toBe(1);
    expect(stdout.value).toContain("tampered Tampered.ts");
    expect(stderr.value).toContain(
      "tscodegen-generated files have been modified",
    );
  });

  test("run exits non-zero when no files match the patterns", () => {
    const stdout = new StringStream();
    const stderr = new StringStream();
    const result = run(["**/*.nonexistent"], {
      cwd: tmpDir,
      stdout,
      stderr,
      noColor: true,
    });
    expect(result.exitCode).toBe(1);
    expect(stderr.value).toContain("no files matched");
  });

  test("run is quiet about skipped files by default", () => {
    writeEditableTsFile(path.join(tmpDir, "a.ts"));
    fs.writeFileSync(path.join(tmpDir, "plain.md"), "nothing\n");

    const stdout = new StringStream();
    const stderr = new StringStream();
    run(["**/*"], {
      cwd: tmpDir,
      stdout,
      stderr,
      noColor: true,
    });
    expect(stdout.value).not.toContain("a.ts");
    expect(stdout.value).not.toContain("plain.md");
    expect(stdout.value).toContain("1 ok");
    expect(stdout.value).toContain("1 skipped");
  });

  test("--verbose prints every file's status", () => {
    writeEditableTsFile(path.join(tmpDir, "a.ts"));
    fs.writeFileSync(path.join(tmpDir, "plain.md"), "nothing\n");

    const stdout = new StringStream();
    const stderr = new StringStream();
    run(["**/*"], {
      cwd: tmpDir,
      stdout,
      stderr,
      noColor: true,
      verbose: true,
    });
    expect(stdout.value).toContain("ok       a.ts");
    expect(stdout.value).toContain("skipped  plain.md");
  });

  test("--quiet suppresses all non-error output", () => {
    const tamperedPath = path.join(tmpDir, "Tampered.ts");
    writeEditableTsFile(tamperedPath);
    fs.appendFileSync(tamperedPath, "export const evil = true;\n");

    const stdout = new StringStream();
    const stderr = new StringStream();
    const result = run(["**/*.ts"], {
      cwd: tmpDir,
      stdout,
      stderr,
      noColor: true,
      quiet: true,
    });
    expect(result.exitCode).toBe(1);
    expect(stdout.value).toBe("");
    expect(stderr.value).toBe("");
  });
});

describe(main, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("prints help text and exits 0 for --help", () => {
    const stdout = new StringStream();
    const stderr = new StringStream();
    const code = main(["--help"], { stdout, stderr });
    expect(code).toBe(0);
    expect(stdout.value).toBe(HELP_TEXT);
    expect(stderr.value).toBe("");
  });

  test("prints the installed version and exits 0 for --version", () => {
    const stdout = new StringStream();
    const stderr = new StringStream();
    const code = main(["--version"], {
      stdout,
      stderr,
      version: "9.9.9",
    });
    expect(code).toBe(0);
    expect(stdout.value.trim()).toBe("9.9.9");
  });

  test("exits 2 when no patterns are supplied", () => {
    const stdout = new StringStream();
    const stderr = new StringStream();
    const code = main([], { stdout, stderr });
    expect(code).toBe(2);
    expect(stderr.value).toContain("no patterns");
  });

  test("exits 2 on unknown options", () => {
    const stdout = new StringStream();
    const stderr = new StringStream();
    const code = main(["--nope", "src"], { stdout, stderr });
    expect(code).toBe(2);
    expect(stderr.value).toContain("unknown option");
  });

  test("runs end-to-end against a temp directory and returns the exit code", () => {
    writeEditableTsFile(path.join(tmpDir, "a.ts"));
    const tampered = path.join(tmpDir, "b.ts");
    writeEditableTsFile(tampered);
    fs.appendFileSync(tampered, "export const evil = true;\n");
    writeLineCommentGitattributes(path.join(tmpDir, ".gitattributes"));

    const stdout = new StringStream();
    const stderr = new StringStream();
    const code = main(["--no-color", "**/*"], {
      stdout,
      stderr,
      cwd: tmpDir,
    });
    expect(code).toBe(1);
    expect(stdout.value).toContain("tampered b.ts");
    expect(stdout.value).toContain("2 ok");
  });
});
