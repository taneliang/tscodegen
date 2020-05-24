const docblockMatchRegExp = /^\/\*\*\n(?<contents>( \*.*\n)*?) \*\/\n/;

/**
 * Get file docblock from `code`, the contents of a source file.
 *
 * Assumes that any docblock that starts from the 0th character in `code` is
 * the file docblock.
 *
 * @param code Code from a source file.
 * @returns Docblock if it exists, else returns undefined.
 */
export function getFileDocblock(code: string): string | undefined {
  const rawDocblockMatch = code.match(docblockMatchRegExp);
  if (!rawDocblockMatch) {
    return undefined;
  }

  const rawContents = rawDocblockMatch.groups!.contents;
  return (
    rawContents
      // Remove each line's leading " *"
      .split('\n')
      .map((line) => line.substring(' *'.length).trim())
      .join('\n')
      // Remove trailing \n
      .trim()
  );
}

/**
 * Removes the file docblock from the start of a file.
 *
 * Assumes that any docblock that starts from the 0th character in `code` is
 * the file docblock.
 *
 * @param code Code from a source file.
 */
export function removeFileDocblock(code: string): string {
  if (!code.match(docblockMatchRegExp)) {
    return code;
  }
  return code.replace(docblockMatchRegExp, '');
}

/**
 * Creates a docblock from `docblockContent`.
 *
 * @param docblockContent Plain docblock content (i.e. without "*"s at the start of each line)
 */
export function createDocblock(docblockContent: string): string {
  const docblockContentWithLeadingStars = docblockContent
    .split('\n')
    .map((line) => ` ${`* ${line}`.trim()}`) // " *" for empty lines, ` * ${line}` otherwise
    .join('\n');
  const docblock = `/**\n${docblockContentWithLeadingStars}\n */`;
  return docblock;
}

/**
 * Prepends `code` with `dockblockContent`. Assumes `code` does not already
 * have a file docblock.
 *
 * @param code Code from a source file.
 * @param docblockContent Plain docblock content (i.e. without "*"s at the start of each line)
 */
export function prependFileDocblock(code: string, docblockContent: string): string {
  return `${createDocblock(docblockContent)}\n\n${code.trimStart()}`;
}
