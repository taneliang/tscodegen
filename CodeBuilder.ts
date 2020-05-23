import prettier from 'prettier';
import { createManualSection } from './sections/manual';
import type { ManualSectionMap } from './types/ManualSectionMap';

export class CodeBuilder {
  #gennedCode = '';
  #hasManualSections = false;

  readonly #existingManualSections: ManualSectionMap;

  constructor(manualSections: ManualSectionMap) {
    this.#existingManualSections = manualSections;
  }

  insertCode(code: string): this {
    this.#gennedCode += code;
    return this;
  }

  addManualSection(
    sectionKey: string,
    sectionBuilder: (manualSectionBuilder: CodeBuilder) => CodeBuilder,
  ) {
    let sectionContent: string;
    if (this.#existingManualSections[sectionKey]) {
      sectionContent = this.#existingManualSections[sectionKey];
    } else {
      sectionContent = sectionBuilder(new CodeBuilder(this.#existingManualSections)).toString();
    }
    this.#gennedCode += `\n${createManualSection(sectionKey, sectionContent)}\n`;
    this.#hasManualSections = true;
    return this;
  }

  format(): this {
    this.#gennedCode = prettier.format(this.#gennedCode, { parser: 'typescript' });
    return this;
  }

  toString(): string {
    return this.#gennedCode;
  }

  hasManualSections(): boolean {
    return this.#hasManualSections;
  }
}
