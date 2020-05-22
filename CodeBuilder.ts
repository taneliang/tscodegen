import prettier from 'prettier';

export class CodeBuilder {
  private gennedCode = '';

  readonly #existingManualSections: { [sectionKey: string]: string };

  constructor(manualSections: { [sectionKey: string]: string }) {
    this.#existingManualSections = manualSections;
  }

  insertCode(code: string): this {
    this.gennedCode += code;
    return this;
  }

  addManualSection(
    sectionKey: string,
    sectionBuilder: (manualSectionBuilder: CodeBuilder) => CodeBuilder,
  ) {
    // Ensure section key contains no whitespaces
    if (/\s/.test(sectionKey)) {
      throw new Error(
        `Manual section keys should not contain whitespaces. Received "${sectionKey}", which does.`,
      );
    }

    this.gennedCode += `\n/* BEGIN MANUAL SECTION ${sectionKey} */\n`;

    if (this.#existingManualSections[sectionKey]) {
      this.gennedCode += this.#existingManualSections[sectionKey];
    } else {
      this.gennedCode += sectionBuilder(new CodeBuilder(this.#existingManualSections)).toString();
    }

    this.gennedCode += `\n/* END MANUAL SECTION */\n`;
    return this;
  }

  format(): this {
    // TODO: Call Prettier
    this.gennedCode = prettier.format(this.gennedCode, { parser: 'typescript' });
    return this;
  }

  toString() {
    return this.gennedCode;
  }
}
