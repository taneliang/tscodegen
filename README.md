# tscodegen

[![CircleCI](https://circleci.com/gh/taneliang/tscodegen.svg?style=svg)](https://circleci.com/gh/taneliang/tscodegen)
[![codecov](https://codecov.io/gh/taneliang/tscodegen/branch/master/graph/badge.svg)](https://codecov.io/gh/taneliang/tscodegen)
[![Maintainability](https://api.codeclimate.com/v1/badges/bbc025c3c4e1ce23b002/maintainability)](https://codeclimate.com/github/taneliang/tscodegen/maintainability)

[tscodegen](https://www.npmjs.com/package/@elg/tscodegen) is a minimal
TypeScript port of [Facebook's Hack
Codegen](https://hhvm.github.io/hack-codegen). It provides a fluent API that
allows you to build human-readable TypeScript source files from strings of
code, with optional manually editable sections and tamper detection.

## Key Features

- Manually editable sections within generated files. This behavior is nearly
  identical to Hack Codegen's amazing [partially generated
  files](https://hhvm.github.io/hack-codegen/docs/overview/partially-generated-files/).
  Unlike most other code generation tools, tscodegen (and Hack Codegen) is
  able to produce editable files, allowing your codegen output to be easily
  customized and extended without monkeypatching or subclassing. These edits
  will be preserved when the code is regenerated.

- String-based code generation. We sidestep dealing with an AST (e.g. with
  ts-morph or the TypeScript compiler API) in favor of string manipulation.
  This lets you write your generated code naturally, without having to know
  the details of TypeScript's AST.

- Codelock tamper detection. A hash is added to the docblock of every
  generated file to make it easy to detect if a file has been changed outside
  the generated manual sections. The [bundled `verify-codelock`
  CLI](#verifying-codelocks-in-ci-and-pre-commit-hooks) enforces this for you
  across TypeScript _and_ non-TypeScript generated files.

- No template files. tscodegen uses [template
  literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
  and TypeScript method calls, allowing you to use loops and conditionals
  without having to learn another templating language.

- Auto formatting with Prettier, using your project's Prettier config.
  Generated code has rarely been so readable.

- Clean, fluent, minimal API.

## Installation

```sh
npm install @elg/tscodegen prettier # NPM
yarn add @elg/tscodegen prettier # Yarn
```

## Usage

1. `import { CodeFile } from '@elg/tscodegen';`
1. Instantiate `CodeFile`.
1. Call `build` to build the file with a `CodeBuilder` instance.
1. Write the built file to disk with `saveToFile`.

## Sample

### Codegen script

```typescript
new CodeFile("./file.ts")
  .build((builder) =>
    builder
      .addLine("import path from 'path';")
      .addLine("import fs from 'fs'")
      .addLine()
      .addManualSection("custom_imports", (builder) => builder)
      .addLine()
      .addBlock("class Steam extends Water", (builder) =>
        builder
          .addBlock("constructor()", (builder) =>
            builder.addLine("this.boil();"),
          )
          .addLine()
          .addBlock("boil()", (b) =>
            b.addManualSection("boil_body", (builder) =>
              builder.add("this.temp = 100;"),
            ),
          ),
      )
      .format(),
  )
  .lock()
  .saveToFile();
```

### Output

```typescript
/**
 * This file is generated with manually editable sections. Only make
 * modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
 * designators.
 *
 * @generated-editable Codelock<<jF8gPj9IVq16NXBAtEzJj0rrD9HR7Q6V>>
 */

import path from "path";
import fs from "fs";

/* BEGIN MANUAL SECTION custom_imports */
/* END MANUAL SECTION */

class Steam extends Water {
  constructor() {
    this.boil();
  }

  boil() {
    /* BEGIN MANUAL SECTION boil_body */
    new Magician().magic(); // This line was retrieved from the original file.ts
    /* END MANUAL SECTION */
  }
}
```

## Generating non-TypeScript files

By default, `CodeFile` emits JSDoc/C-style docblocks and manual section
markers. Pass a `commentSyntax` option to target file formats that only
support line comments (e.g. `.gitattributes` with `#` comments, shell scripts,
or a `.ts` file where you prefer `//` docblocks):

```typescript
export type CommentSyntax =
  | { kind: "jsdoc" } // default — JSDoc/C-style
  | { kind: "line"; prefix: string }; // e.g. "# " or "// "
```

Example `.gitattributes` generator:

```typescript
new CodeFile(".gitattributes", {
  commentSyntax: { kind: "line", prefix: "# " },
})
  .build((b) =>
    b
      .addManualSection("manual", (m) => m.addLine("# add custom rules here"))
      .addLine("path/to/generated.ts linguist-generated=true"),
  )
  .lock("\nTo update this file, run: npm run generate:gitattributes\n")
  .saveToFile();
```

Sample output:

```
# This file is generated with manually editable sections. Only make
# modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
# designators.
#
# To update this file, run: npm run generate:gitattributes
#
# @generated-editable Codelock<<...>>

# BEGIN MANUAL SECTION manual
# add custom rules here
# END MANUAL SECTION
path/to/generated.ts linguist-generated=true
```

Everything else works the same: `verify()` detects tampering outside the
manual sections, `lock()` adds the hash, and `saveToFile()` writes the
result. Manual-section keys still must be non-empty and whitespace-free.

## Verifying codelocks in CI and pre-commit hooks

tscodegen ships with a `verify-codelock` CLI that walks a set of files and
confirms that every tscodegen-generated file still has a valid codelock hash.
It accepts eslint- / prettier-style glob patterns and automatically detects
the comment syntax of each file (JSDoc for `.ts`, line comments for
`.gitattributes`, etc.), so a single invocation covers both TypeScript and
non-TypeScript generated output.

Files that are _not_ tscodegen-generated (i.e. do not contain an
`@generated Codelock<<...>>` or `@generated-editable Codelock<<...>>` marker)
are silently skipped, so it's safe to point `verify-codelock` at a broad
glob like `**/*` without having to maintain a separate allowlist.

### Usage

Run it through `npx` without installing anything:

```sh
npx -p @elg/tscodegen verify-codelock 'src/**' 'packages/**/*.gen.ts'
```

Or install tscodegen as a dev dependency and call it from a script:

```json
{
  "scripts": {
    "verify:codegen": "verify-codelock 'src/**' '.gitattributes'"
  }
}
```

### CLI reference

```
verify-codelock [options] <pattern> [<pattern>...]

Options:
  --ignore <pattern>    Exclude files matching <pattern>. May be repeated.
  --quiet, -q           Suppress per-file output and the summary line.
  --verbose             Log the status of every file, including skipped ones.
  --no-color            Disable colored output.
  --help, -h            Print help and exit.
  --version, -v         Print the installed tscodegen version and exit.

Exit codes:
  0   All matched tscodegen-generated files have valid codelocks.
  1   One or more files were tampered with, matched no files, or could not be
      read.
  2   Invalid invocation (e.g. missing patterns, unknown option).
```

### Example: CI check

```yaml
- run: npx -p @elg/tscodegen verify-codelock '**/*' --ignore '**/node_modules/**' --ignore '**/dist/**'
```

### Example: pre-commit hook

With [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/okonet/lint-staged):

```json
{
  "lint-staged": {
    "*": "verify-codelock"
  }
}
```

`lint-staged` passes the staged file paths as positional arguments, and
`verify-codelock` will skip any non-generated files automatically.
