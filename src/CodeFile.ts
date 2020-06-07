import fs from "fs";
import { CodeBuilder } from "./CodeBuilder";
import { verifyLock, lockCode } from "./codelock";
import { extractManualSections } from "./sections/manual";

/**
 * Represents and manipulates a generated code file.
 */
export class CodeFile {
  readonly #sourceFilePath: string;
  #originalFileContents = "";
  #fileContents = "";

  constructor(sourceFilePath: string) {
    this.#sourceFilePath = sourceFilePath;
    if (fs.existsSync(sourceFilePath)) {
      this.#originalFileContents = fs.readFileSync(sourceFilePath, "utf-8");
      this.#fileContents = this.#originalFileContents;
    }
  }

  /**
   * Verifies that the codelock in the generated file is present and valid.
   */
  verify(): boolean {
    return verifyLock(this.#fileContents);
  }

  /**
   * Replace the file's code (this class's in-memory representation at least)
   * with the code returned by the `CodeBuilder` instance.
   *
   * @param builderBuilder A builder that builds a replacement source.
   */
  build(builderBuilder: (builder: CodeBuilder) => CodeBuilder): this {
    const builder = builderBuilder(
      new CodeBuilder(extractManualSections(this.#fileContents))
    );
    const builtCode = builder.toString();
    this.#fileContents = lockCode(builtCode, builder.hasManualSections());
    return this;
  }

  /**
   * Returns the in-memory representation of the file's source code.
   */
  toString(): string {
    return this.#fileContents;
  }

  /**
   * Save to `sourceFilePath` if the in-memory representation of the code has
   * been changed since the file was read.
   *
   * @param force If true, will write to disk even if there are no pending
   * changes.
   */
  saveToFile(force = false): void {
    if (force || this.#originalFileContents !== this.#fileContents) {
      fs.writeFileSync(this.#sourceFilePath, this.#fileContents, "utf-8");
      this.#originalFileContents = this.#fileContents;
    }
  }
}
