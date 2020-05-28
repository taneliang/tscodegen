import {
  createManualSection,
  extractManualSections,
  emptyManualSections,
} from "./manual";

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
