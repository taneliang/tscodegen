# ts-codegen

ts-codegen is a minimal port of [Facebook's Hack Codegen](https://hhvm.github.io/hack-codegen)
with a focus on generating and managing editable files and preventing edits
in generated code. We sidestep dealing with an AST (e.g. with ts-morph or the
TypeScript compiler API) pure string manipulation in order for the API to be
minimal, and to be able to use comments to designate editable sections.
