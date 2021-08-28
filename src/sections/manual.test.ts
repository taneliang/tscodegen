import { createManualSection, extractManualSections, emptyManualSections } from "./manual"

import * as manual from "./manual"
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectEmptyManualSectionsToPassthrough"] }] */

describe(createManualSection, () => {
  test("should throw if section key is empty or has whitespaces", () => {
    expect(() => createManualSection("", "CODE")).toThrow();
    expect(() => createManualSection("a ", "CODE")).toThrow();
    expect(() => createManualSection("a b", "CODE")).toThrow();
    expect(() => createManualSection("a\nb", "CODE")).toThrow();
  });

  test("should generate manual section with key and code", () => {
    const contents = `console.log("Multiline section content");
    // Define undefined to undefined
    undefined = "undefined";`;
    const key = "SomeSection_冠状病毒-<>{}()[]!@#$%^&*etc🦠";
    const generatedCode = createManualSection(key, contents);

    // Expect generated code to contain everything we expect
    expect(generatedCode).toContain(`BEGIN MANUAL SECTION ${key}`);
    expect(generatedCode).toContain(contents);
    expect(generatedCode).toContain("END MANUAL SECTION");

    // A code sample for sanity checks
    expect(generatedCode).toMatchSnapshot();
  });

  test("should insert code on its own line", () => {
    expect(createManualSection("key", "magic();\nmoreMagic();"))
      .toBe(`/* BEGIN MANUAL SECTION key */
magic();
moreMagic();
/* END MANUAL SECTION */`);
  });

  test("should remove blank lines surrounding code", () => {
    expect(createManualSection("key", "")).toBe(`/* BEGIN MANUAL SECTION key */
/* END MANUAL SECTION */`);

    expect(
      createManualSection(
        "key",
        `
          magic();
          moreMagic();
        `
      )
    ).toBe(`/* BEGIN MANUAL SECTION key */
magic();
          moreMagic();
/* END MANUAL SECTION */`);
  });
});

describe(extractManualSections, () => {
  test("should ignore code that does not have any manual sections", () => {
    expect(extractManualSections("")).toEqual({});
    expect(
      extractManualSections(`
        class One extends Zero {
          constructor() {
            this.value = 1;
          }
        }
      `)
    ).toEqual({});
  });

  test("should ignore malformed manual sections", () => {
    expect(
      extractManualSections(
        "/* BEGIN MANUAL SECTION *//* END MANUAL SECTION */"
      )
    ).toEqual({});
    expect(
      extractManualSections(
        "/* BEGIN MANUAL SECTION no_end_designator *//* END */"
      )
    ).toEqual({});
    expect(
      extractManualSections(
        "/* BEGIN MANUAL SECTION key with whitespace *//* END MANUAL SECTION */"
      )
    ).toEqual({});
  });

  test("should extract single line manual section", () => {
    expect(
      extractManualSections(
        '/* BEGIN MANUAL SECTION key */console.log("code");/* END MANUAL SECTION */'
      )
    ).toEqual({
      key: 'console.log("code");',
    });
  });

  test("should extract multiline manual section", () => {
    expect(
      extractManualSections(`
        class One extends Zero {
          constructor() {
            this.value = 1;
            /* BEGIN MANUAL SECTION key */
            console.log("line one"); // Comment
            console.log("line two");
            /* END MANUAL SECTION */
          }
        }
      `)
    ).toEqual({
      key: `console.log("line one"); // Comment
            console.log("line two");`,
    });
  });

  test("should extract multiple manual sections", () => {
    expect(
      extractManualSections(`
        /* BEGIN MANUAL SECTION custom-imports_empty_section */
        /* END MANUAL SECTION */

        class One extends Zero {
          constructor() {
            this.value = 1;
            /* BEGIN MANUAL SECTION One-constructor_with_code */
            console.log("custom constructor");
            /* BEGIN some other thing */
            console.log("more custom constructing");
            /* END some other thing */
            /* END MANUAL SECTION */
          }

          /* BEGIN MANUAL SECTION custom-methods_blank_line_section */
          
          /* END MANUAL SECTION */
        }
      `)
    ).toEqual({
      "custom-imports_empty_section": "",
      "One-constructor_with_code": `console.log("custom constructor");
            /* BEGIN some other thing */
            console.log("more custom constructing");
            /* END some other thing */`,
      "custom-methods_blank_line_section": "",
    });
  });
});

describe(emptyManualSections, () => {
  function expectEmptyManualSectionsToPassthrough(code: string) {
    expect(emptyManualSections(code)).toBe(code);
  }

  test("should passthrough code that does not have any manual sections", () => {
    expectEmptyManualSectionsToPassthrough("");
    expectEmptyManualSectionsToPassthrough(`
      class One extends Zero {
        constructor() {
          this.value = 1;
        }
      }
    `);
  });

  test("should passthrough code that has malformed manual sections", () => {
    expectEmptyManualSectionsToPassthrough(
      "/* BEGIN MANUAL SECTION *//* END MANUAL SECTION */"
    );
    expectEmptyManualSectionsToPassthrough(
      "/* BEGIN MANUAL SECTION no_end_designator *//* END */"
    );
    expectEmptyManualSectionsToPassthrough(
      "/* BEGIN MANUAL SECTION key with whitespace *//* END MANUAL SECTION */"
    );
  });

  function expectedEmptySectionForSectionKey(key: string) {
    return `/* BEGIN MANUAL SECTION ${key} */
/* END MANUAL SECTION */`;
  }

  test("should reset an empty manual section", () => {
    expect(
      emptyManualSections(
        "/* BEGIN MANUAL SECTION key *//* END MANUAL SECTION */"
      )
    ).toBe(expectedEmptySectionForSectionKey("key"));
    expect(
      emptyManualSections(
        "/* BEGIN MANUAL SECTION key */\n/* END MANUAL SECTION */"
      )
    ).toBe(expectedEmptySectionForSectionKey("key"));
    expect(
      emptyManualSections(
        "/* BEGIN MANUAL SECTION key */\n\n\n/* END MANUAL SECTION */"
      )
    ).toBe(expectedEmptySectionForSectionKey("key"));
  });

  test("should empty single line manual section", () => {
    expect(
      emptyManualSections(
        '/* BEGIN MANUAL SECTION key */console.log("code");/* END MANUAL SECTION */'
      )
    ).toBe(expectedEmptySectionForSectionKey("key"));
  });

  test("should empty multiline manual section", () => {
    expect(
      emptyManualSections(
        '/* BEGIN MANUAL SECTION key */\nconsole.log("one");\nconsole.log("two");/* END MANUAL SECTION */'
      )
    ).toBe(expectedEmptySectionForSectionKey("key"));
  });

  test("should empty multiple manual sections", () => {
    expect(
      emptyManualSections(`
        /* BEGIN MANUAL SECTION custom-imports_empty_section */
        /* END MANUAL SECTION */

        class One extends Zero {
          constructor() {
            this.value = 1;
            /* BEGIN MANUAL SECTION One-constructor_with_code */
            console.log("custom constructor");
            /* BEGIN some other thing */
            console.log("more custom constructing");
            /* END some other thing */
            /* END MANUAL SECTION */
          }

          /* BEGIN MANUAL SECTION custom-methods_blank_line_section */
          
          /* END MANUAL SECTION */
        }
      `)
    ).toBe(`
        /* BEGIN MANUAL SECTION custom-imports_empty_section */
/* END MANUAL SECTION */

        class One extends Zero {
          constructor() {
            this.value = 1;
            /* BEGIN MANUAL SECTION One-constructor_with_code */
/* END MANUAL SECTION */
          }

          /* BEGIN MANUAL SECTION custom-methods_blank_line_section */
/* END MANUAL SECTION */
        }
      `);
  });
});

// TODO: Ensure nuke and create reverse each other

// @ponicode
describe("manual.createManualSection", () => {
    test("0", () => {
        let callFunction: any = () => {
            manual.createManualSection(" ", " function log(code) {\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        console.log(utils.tr.apply(null, arguments));\n    }\n")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("1", () => {
        let callFunction: any = () => {
            manual.createManualSection(" ", "function log(code) {\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        console.log(utils.tr.apply(null, arguments));\n    }\n")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("2", () => {
        let callFunction: any = () => {
            manual.createManualSection(" ", "      function log(code) {\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        console.log(utils.tr.apply(null, arguments));\n    }\n")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("3", () => {
        let callFunction: any = () => {
            manual.createManualSection(" ", "function readToken_lt_gt(code) {\n\t      // '<>'\n\t      var next = this.input.charCodeAt(this.state.pos + 1);\n\t      var size = 1;\n\t\n\t      if (next === code) {\n\t        size = code === 62 && this.input.charCodeAt(this.state.pos + 2) === 62 ? 3 : 2;\n\t        if (this.input.charCodeAt(this.state.pos + size) === 61) return this.finishOp(_types.types.assign, size + 1);\n\t        return this.finishOp(_types.types.bitShift, size);\n\t      }\n\t\n\t      if (next === 33 && code === 60 && this.input.charCodeAt(this.state.pos + 2) === 45 && this.input.charCodeAt(this.state.pos + 3) === 45) {\n\t        if (this.inModule) this.unexpected();\n\t        // `<!--`, an XML-style comment that should be interpreted as a line comment\n\t        this.skipLineComment(4);\n\t        this.skipSpace();\n\t        return this.nextToken();\n\t      }\n\t\n\t      if (next === 61) {\n\t        // <= | >=\n\t        size = 2;\n\t      }\n\t\n\t      return this.finishOp(_types.types.relational, size);\n\t    }    ")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("4", () => {
        let callFunction: any = () => {
            manual.createManualSection("commit 380428b6b61b64631d941b27db3e91df27bfff8e\r\nAuthor: Lera Swift <Lela.Lubowitz@yahoo.com>\r\nDate: Wed Jul 28 2021 23:21:29 GMT+0200 (Central European Summer Time)\r\n\r\n    reboot digital application\r\n", "      function log(code) {\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        console.log(utils.tr.apply(null, arguments));\n    }\n")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("5", () => {
        let callFunction: any = () => {
            manual.createManualSection("", "")
        }
    
        expect(callFunction).not.toThrow()
    })
})

// @ponicode
describe("manual.extractManualSections", () => {
    test("0", () => {
        let callFunction: any = () => {
            manual.extractManualSections("function unescape(code) {\n        return code.replace(/\\\\('|\\\\)/g, \"$1\").replace(/[\\r\\t\\n]/g, \" \");\n    }")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("1", () => {
        let callFunction: any = () => {
            manual.extractManualSections("function(code) {\n\t\t\t\treturn I.mode === 'client' || !Basic.arrayDiff(code, [200, 404]);\n\t\t\t}")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("2", () => {
        let callFunction: any = () => {
            manual.extractManualSections("function log(code) {\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        console.log(utils.tr.apply(null, arguments));\n    }\n")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("3", () => {
        let callFunction: any = () => {
            manual.extractManualSections("function readToken_lt_gt(code) {\n\t      // '<>'\n\t      var next = this.input.charCodeAt(this.state.pos + 1);\n\t      var size = 1;\n\t\n\t      if (next === code) {\n\t        size = code === 62 && this.input.charCodeAt(this.state.pos + 2) === 62 ? 3 : 2;\n\t        if (this.input.charCodeAt(this.state.pos + size) === 61) return this.finishOp(_types.types.assign, size + 1);\n\t        return this.finishOp(_types.types.bitShift, size);\n\t      }\n\t\n\t      if (next === 33 && code === 60 && this.input.charCodeAt(this.state.pos + 2) === 45 && this.input.charCodeAt(this.state.pos + 3) === 45) {\n\t        if (this.inModule) this.unexpected();\n\t        // `<!--`, an XML-style comment that should be interpreted as a line comment\n\t        this.skipLineComment(4);\n\t        this.skipSpace();\n\t        return this.nextToken();\n\t      }\n\t\n\t      if (next === 61) {\n\t        // <= | >=\n\t        size = 2;\n\t      }\n\t\n\t      return this.finishOp(_types.types.relational, size);\n\t    }")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("4", () => {
        let callFunction: any = () => {
            manual.extractManualSections("function substr(start, length) {\n        return string_substr.call(\n            this,\n            start < 0 ? ((start = this.length + start) < 0 ? 0 : start) : start,\n            length\n        );\n    }")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("5", () => {
        let callFunction: any = () => {
            manual.extractManualSections("")
        }
    
        expect(callFunction).not.toThrow()
    })
})

// @ponicode
describe("manual.emptyManualSections", () => {
    test("0", () => {
        let callFunction: any = () => {
            manual.emptyManualSections("function(code) {\n\t\t\t\treturn I.mode === 'client' || !Basic.arrayDiff(code, [200, 404]);\n\t\t\t}")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("1", () => {
        let callFunction: any = () => {
            manual.emptyManualSections("function substr(start, length) {\n        return string_substr.call(\n            this,\n            start < 0 ? ((start = this.length + start) < 0 ? 0 : start) : start,\n            length\n        );\n    }")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("2", () => {
        let callFunction: any = () => {
            manual.emptyManualSections("function log(code) {\n        var args = [];\n        for (var _i = 1; _i < arguments.length; _i++) {\n            args[_i - 1] = arguments[_i];\n        }\n        console.log(utils.tr.apply(null, arguments));\n    }\n")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("3", () => {
        let callFunction: any = () => {
            manual.emptyManualSections("function unescape(code) {\n        return code.replace(/\\\\('|\\\\)/g, \"$1\").replace(/[\\r\\t\\n]/g, \" \");\n    }")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("4", () => {
        let callFunction: any = () => {
            manual.emptyManualSections("function readToken_lt_gt(code) {\n\t      // '<>'\n\t      var next = this.input.charCodeAt(this.state.pos + 1);\n\t      var size = 1;\n\t\n\t      if (next === code) {\n\t        size = code === 62 && this.input.charCodeAt(this.state.pos + 2) === 62 ? 3 : 2;\n\t        if (this.input.charCodeAt(this.state.pos + size) === 61) return this.finishOp(_types.types.assign, size + 1);\n\t        return this.finishOp(_types.types.bitShift, size);\n\t      }\n\t\n\t      if (next === 33 && code === 60 && this.input.charCodeAt(this.state.pos + 2) === 45 && this.input.charCodeAt(this.state.pos + 3) === 45) {\n\t        if (this.inModule) this.unexpected();\n\t        // `<!--`, an XML-style comment that should be interpreted as a line comment\n\t        this.skipLineComment(4);\n\t        this.skipSpace();\n\t        return this.nextToken();\n\t      }\n\t\n\t      if (next === 61) {\n\t        // <= | >=\n\t        size = 2;\n\t      }\n\t\n\t      return this.finishOp(_types.types.relational, size);\n\t    }")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("5", () => {
        let callFunction: any = () => {
            manual.emptyManualSections("")
        }
    
        expect(callFunction).not.toThrow()
    })
})
