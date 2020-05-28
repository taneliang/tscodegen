import prettier from "prettier";
import { createManualSection } from "./sections/manual";
import type { ManualSectionMap } from "./types/ManualSectionMap";
import { createDocblock } from "./sections/docblock";

export class CodeBuilder {
  #gennedCode = "";
  #hasManualSections = false;

  readonly #existingManualSections: ManualSectionMap;

  constructor(manualSections: ManualSectionMap) {
    this.#existingManualSections = manualSections;
  }

  /**
   * Simply appends `code`.
   */
  add(code: string): this {
    this.#gennedCode += code;
    return this;
  }

  /**
   * Appends `code` and a newline. Call without arguments to insert a newline.
   */
  addLine(code: string = ""): this {
    this.#gennedCode += code + "\n";
    return this;
  }

  /**
   * Creates a docblock from `docblockContent` and appends it, with a trailing
   * newline.
   *
   * @param docblockContent Plain docblock content (i.e. without "*"s at the start of each line)
   */
  addDocblock(docblockContent: string): this {
    return this.addLine(createDocblock(docblockContent));
  }

  /**
   * Add a block of code, i.e. code with braces around them.
   *
   * @param codeBeforeBlock Code before the block's `{`, e.g. `if (a === b)`
   * @param blockBuilder A function that uses `blockBuilder` to build the code
   * in the block.
   */
  addBlock(
    codeBeforeBlock: string,
    blockBuilder: (blockBuilder: CodeBuilder) => CodeBuilder
  ): this {
    const builtBlockBuilder = blockBuilder(
      new CodeBuilder(this.#existingManualSections)
    );
    this.#hasManualSections =
      this.#hasManualSections || builtBlockBuilder.hasManualSections();
    return this.add(codeBeforeBlock)
      .addLine(" {")
      .addLine(builtBlockBuilder.toString())
      .addLine("}");
  }

  /**
   * Add a section of code that can be manually edited. The section will be
   * surrounded by "BEGIN MANUAL SECTION" and "END MANUAL SECTION" designators.
   *
   * @param sectionKey An identifier for this manual section.
   * @param blockBuilder A function that uses `blockBuilder` to build the code
   * in the block, if no existing manual section with `sectionKey` is stored.
   */
  addManualSection(
    sectionKey: string,
    sectionBuilder: (manualSectionBuilder: CodeBuilder) => CodeBuilder
  ): this {
    let sectionContent: string;
    if (this.#existingManualSections[sectionKey]) {
      sectionContent = this.#existingManualSections[sectionKey];
    } else {
      sectionContent = sectionBuilder(
        new CodeBuilder(this.#existingManualSections)
      ).toString();
    }
    this.#hasManualSections = true;
    return this.addLine(createManualSection(sectionKey, sectionContent));
  }

  /**
   * Formats the stored code with Prettier.
   */
  format(): this {
    const prettierOptions = prettier.resolveConfig.sync(process.cwd());
    this.#gennedCode = prettier.format(this.#gennedCode, {
      ...(prettierOptions ?? {}),
      parser: "typescript",
    });
    return this;
  }

  /**
   * Returns the stored code.
   */
  toString(): string {
    return this.#gennedCode;
  }

  /**
   * Whether this built code contains at least one manual section.
   */
  hasManualSections(): boolean {
    return this.#hasManualSections;
  }
}
