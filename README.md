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
            builder.addLine("this.boil();")
          )
          .addLine()
          .addBlock("boil()", (b) =>
            b.addManualSection("boil_body", (builder) =>
              builder.add("this.temp = 100;")
            )
          )
      )
      .format()
  )
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
