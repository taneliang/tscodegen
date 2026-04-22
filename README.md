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
  the generated manual sections. In the future, this can be [enforced with an
  ESLint rule](https://github.com/taneliang/tscodegen/issues/1) (PRs
  welcome!).

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

## Generating indentation-sensitive languages (Python, YAML, Makefile, …)

For languages where indentation is syntactic, use `CodeBuilder.indent(amount, fn)`
to open a nested scope in which every emitted line (including manual-section
markers and bodies) is prefixed with `amount`. Indent scopes compose
additively: `indent("  ", b => b.indent("  ", bb => …))` produces four spaces
of indent.

```typescript
new CodeFile("compute.py", { commentSyntax: { kind: "line", prefix: "# " } })
  .build((b) =>
    b
      .addLine("def compute(x: int) -> int:")
      .indent("    ", (fn) =>
        fn
          .addLine("result = x + 1")
          .addManualSection("postprocess", (m) => m.addLine("return result")),
      ),
  )
  .lock()
  .saveToFile();
```

Output:

```python
# This file is generated with manually editable sections. Only make
# modifications between BEGIN MANUAL SECTION and END MANUAL SECTION
# designators.
#
# @generated-editable Codelock<<...>>

def compute(x: int) -> int:
    result = x + 1
    # BEGIN MANUAL SECTION postprocess
    return result
    # END MANUAL SECTION
```

Manual sections round-trip cleanly across regenerations: the stored body is
_semantic_ (column-0 content), and the builder reapplies the ambient indent
on the way out. So a human who edits the section and adds lines at the
matching indent:

```python
    # BEGIN MANUAL SECTION postprocess
    if result > 100:
        raise ValueError(result)
    return result
    # END MANUAL SECTION
```

will see their edits preserved verbatim after regeneration, with no
re-shifting of nested indents (the `if`/`raise` pair keeps its 4-space
relative indent).

`indent()` accepts any string — typically spaces or `"\t"` — so it also
covers Makefile recipes, YAML mappings, Terraform/HCL blocks, INI-like
formats, or any other layout where column position matters.

### Supported file types by `CommentSyntax`

tscodegen doesn't care what the comment prefix string is, so any
language whose comments fit one of the supported shapes works out of
the box. The table below maps common target file types to the
corresponding `CommentSyntax` config.

| File type                           | `CommentSyntax`                               |
| ----------------------------------- | --------------------------------------------- |
| TypeScript / JavaScript / TSX / JSX | `{ kind: "jsdoc" }` (default)                 |
| Go, Rust, Swift, Kotlin, Dart, Java | `{ kind: "jsdoc" }`                           |
| C, C++, Objective-C                 | `{ kind: "jsdoc" }`                           |
| CSS / SCSS / LESS                   | `{ kind: "jsdoc" }`                           |
| PHP, Groovy, Jenkinsfile, Protobuf  | `{ kind: "jsdoc" }`                           |
| TypeScript (line-comment preferred) | `{ kind: "line", prefix: "// " }`             |
| Python, Ruby, Perl, R, PowerShell   | `{ kind: "line", prefix: "# " }`              |
| Shell / Bash / zsh                  | `{ kind: "line", prefix: "# " }`              |
| YAML, TOML, Dockerfile, `.env`      | `{ kind: "line", prefix: "# " }`              |
| Terraform / HCL, GraphQL            | `{ kind: "line", prefix: "# " }`              |
| Makefile                            | `{ kind: "line", prefix: "# " }` + tab indent |
| `.gitattributes`, `.gitignore`      | `{ kind: "line", prefix: "# " }`              |
| nginx.conf, systemd unit, BUILD     | `{ kind: "line", prefix: "# " }`              |
| SQL, Haskell, Lua, Elm              | `{ kind: "line", prefix: "-- " }`             |
| Lisp / Clojure / Scheme, INI        | `{ kind: "line", prefix: "; " }`              |
| LaTeX, MATLAB, Erlang, Prolog       | `{ kind: "line", prefix: "% " }`              |
| Fortran 90+                         | `{ kind: "line", prefix: "! " }`              |
| Visual Basic / VBA                  | `{ kind: "line", prefix: "' " }`              |

The Python/YAML/Terraform/Makefile/SQL snapshots in
`src/__snapshots__/integration.test.ts.snap` are a living catalogue of
what generated output looks like for each of these.

### Known limitations

- **JSON has no comment syntax**, so it cannot be locked. If you need
  to generate JSON alongside other files, either emit a companion
  metadata file or use JSONC (`{ kind: "line", prefix: "// " }`).
- **XML / HTML / SVG / Markdown / Vue SFCs / MDX** use `<!-- ... -->`
  wrapping comments, which is not yet expressible in `CommentSyntax`.
  This is a planned follow-up (a `{ kind: "wrapped"; open, close }`
  variant).
- **Shebangs must be line 1.** `lock()` prepends its docblock, so a
  locked shell script's `#!/usr/bin/env bash` ends up below the
  docblock. For scripts invoked as executables, either prepend the
  shebang yourself after locking or invoke them via the interpreter
  directly.

Example Terraform fragment (note the manual section buried inside
`tags = { ... }`, which survives regeneration along with whatever the
author adds inside it):

```typescript
new CodeFile("main.tf", { commentSyntax: { kind: "line", prefix: "# " } })
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
```
