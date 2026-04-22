import { getCodelockInfo } from "./codelock";
import { CommentSyntax } from "./types/CommentSyntax";

const codelockLineRegExp =
  /^(?<prefix>.*?)@generated(?:-editable)? Codelock<<\S+?>>\s*$/;

const DETECTION_LINE_LOOKAHEAD = 200;

/**
 * Attempt to detect the {@link CommentSyntax} used when tscodegen locked this
 * file.
 *
 * Returns `undefined` if the file does not appear to be a tscodegen-locked
 * file — i.e. there is no `@generated Codelock<<...>>` or
 * `@generated-editable Codelock<<...>>` marker near the top of the file that
 * parses as a valid docblock. In that case, callers should treat the file as
 * "not a tscodegen file" and skip it.
 *
 * Detection strategy:
 *
 * 1. If the file starts with a `/**`-style docblock, assume JSDoc syntax.
 * 2. Otherwise, scan the first few lines for a line-comment codelock marker
 *    (e.g. `# @generated-editable Codelock<<...>>` or
 *    `// @generated Codelock<<...>>`) and use its leading prefix as the
 *    line-comment prefix.
 *
 * In both cases, detection is only considered successful if {@link
 * getCodelockInfo} also returns a match for the detected syntax, so
 * false-positive prefixes (e.g. ordinary source lines that happen to mention
 * `@generated`) do not masquerade as tscodegen files.
 */
export function detectCommentSyntax(code: string): CommentSyntax | undefined {
  if (code.startsWith("/**\n")) {
    if (getCodelockInfo(code, { kind: "jsdoc" })) {
      return { kind: "jsdoc" };
    }
    return undefined;
  }

  const lines = code.split("\n", DETECTION_LINE_LOOKAHEAD);
  for (const line of lines) {
    const match = codelockLineRegExp.exec(line);
    if (!match?.groups) {
      continue;
    }
    const syntax: CommentSyntax = {
      kind: "line",
      prefix: match.groups.prefix,
    };
    if (getCodelockInfo(code, syntax)) {
      return syntax;
    }
  }

  return undefined;
}
