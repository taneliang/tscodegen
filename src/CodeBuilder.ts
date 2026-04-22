import syncPrettier from "@prettier/sync";
import { createManualSection } from "./sections/manual";
import type { ManualSectionMap } from "./types/ManualSectionMap";
import { createDocblock } from "./sections/docblock";
import { CommentSyntax, DEFAULT_COMMENT_SYNTAX } from "./types/CommentSyntax";

export class CodeBuilder {
  #gennedCode = "";
  #hasManualSections = false;
  /** Whether the next emitted character will land at the start of a line. */
  #atLineStart = true;

  readonly #existingManualSections: ManualSectionMap;
  readonly #commentSyntax: CommentSyntax;
  readonly #indent: string;

  constructor(
    manualSections: ManualSectionMap,
    commentSyntax: CommentSyntax = DEFAULT_COMMENT_SYNTAX,
    indent = "",
  ) {
    this.#existingManualSections = manualSections;
    this.#commentSyntax = commentSyntax;
    this.#indent = indent;
  }

  /**
   * Append `code` verbatim without applying this builder's ambient indent.
   * Used only to splice in output from a child builder whose indent has
   * already been baked in (i.e. children created by `indent()`).
   */
  #appendRaw(code: string): void {
    if (code.length === 0) {
      return;
    }
    this.#gennedCode += code;
    this.#atLineStart = code.endsWith("\n");
  }

  /**
   * Append `code`, applying this builder's ambient indent to every new line.
   *
   * Empty lines are emitted without the indent prefix so we never produce
   * trailing whitespace on blank lines.
   */
  #appendIndented(code: string): void {
    if (this.#indent.length === 0) {
      this.#appendRaw(code);
      return;
    }
    const pieces = code.split("\n");
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const isLast = i === pieces.length - 1;
      if (piece.length > 0) {
        if (this.#atLineStart) {
          this.#gennedCode += this.#indent;
        }
        this.#gennedCode += piece;
        this.#atLineStart = false;
      }
      if (!isLast) {
        this.#gennedCode += "\n";
        this.#atLineStart = true;
      }
    }
  }

  /**
   * Appends `code`, respecting any ambient indent from an enclosing
   * `indent()` scope.
   */
  add(code: string): this {
    this.#appendIndented(code);
    return this;
  }

  /**
   * Appends `code` and a newline. Call without arguments to insert a blank
   * line. Respects any ambient indent from an enclosing `indent()` scope.
   */
  addLine(code = ""): this {
    this.#appendIndented(code + "\n");
    return this;
  }

  /**
   * Creates a docblock from `docblockContent` and appends it, with a trailing
   * newline.
   *
   * @param docblockContent Plain docblock content (i.e. without "*"s at the start of each line)
   */
  addDocblock(docblockContent: string): this {
    return this.addLine(createDocblock(docblockContent, this.#commentSyntax));
  }

  /**
   * Runs `nested` in a child builder whose ambient indent is the current
   * indent plus `amount`. Every line emitted by the child is prefixed with
   * `amount` on top of whatever indent this builder already has.
   *
   * Indent scopes compose: `b.indent("  ", (b) => b.indent("  ", ...))`
   * produces lines indented by four spaces.
   *
   * @param amount Whitespace added to the current indent for the duration of
   * `nested` (typically a run of spaces or tabs, e.g. `"    "` or `"\t"`).
   * @param nested A function that uses the child builder to emit code.
   */
  indent(
    amount: string,
    nested: (indentedBuilder: CodeBuilder) => CodeBuilder,
  ): this {
    const nestedBuilder = nested(
      new CodeBuilder(
        this.#existingManualSections,
        this.#commentSyntax,
        this.#indent + amount,
      ),
    );
    this.#hasManualSections =
      this.#hasManualSections || nestedBuilder.hasManualSections();
    this.#appendRaw(nestedBuilder.toString());
    return this;
  }

  /**
   * Add a block of code, i.e. code with braces around them.
   *
   * The block body is built by a nested builder starting at column 0; the
   * parent's ambient indent is applied uniformly when its output is
   * spliced back in.
   *
   * @param codeBeforeBlock Code before the block's `{`, e.g. `if (a === b)`
   * @param blockBuilder A function that uses `blockBuilder` to build the code
   * in the block.
   */
  addBlock(
    codeBeforeBlock: string,
    blockBuilder: (blockBuilder: CodeBuilder) => CodeBuilder,
  ): this {
    const builtBlockBuilder = blockBuilder(
      new CodeBuilder(this.#existingManualSections, this.#commentSyntax),
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
   * The section body is built by a nested builder at column 0 (so that
   * existing stored section content, which is always semantic, can be
   * spliced in without reshifting). The parent's ambient indent is applied
   * uniformly to both markers and the body at emit time, so manual sections
   * can be placed inside an `indent()` scope and still round-trip cleanly
   * across regenerations.
   *
   * @param sectionKey An identifier for this manual section.
   * @param sectionBuilder A function that uses a child builder to build the
   * code in the block, if no existing manual section with `sectionKey` is
   * stored.
   */
  addManualSection(
    sectionKey: string,
    sectionBuilder: (manualSectionBuilder: CodeBuilder) => CodeBuilder,
  ): this {
    let sectionContent: string;
    if (this.#existingManualSections[sectionKey]) {
      sectionContent = this.#existingManualSections[sectionKey];
    } else {
      sectionContent = sectionBuilder(
        new CodeBuilder(this.#existingManualSections, this.#commentSyntax),
      ).toString();
    }
    this.#hasManualSections = true;
    return this.addLine(
      createManualSection(sectionKey, sectionContent, this.#commentSyntax),
    );
  }

  /**
   * Formats the stored code with Prettier.
   */
  format(): this {
    let options: Parameters<typeof syncPrettier.format>[1] = {};
    try {
      const configFilePath = syncPrettier.resolveConfigFile();
      if (configFilePath) {
        options =
          syncPrettier.resolveConfig(process.cwd(), {
            config: configFilePath,
          }) ?? {};
      }
    } catch {
      // Fall back to Prettier defaults when config resolution fails.
    }
    this.#gennedCode = syncPrettier.format(this.#gennedCode, {
      ...options,
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
