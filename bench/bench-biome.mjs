// Compares end-to-end perf when Biome (WASM, Rust) is used in place of Prettier.
// We replicate the CodeBuilder/CodeFile pipeline but swap the formatter.
import { performance } from "node:perf_hooks";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Biome } from "@biomejs/js-api/nodejs";
import { CodeBuilder } from "../dist/CodeBuilder.js";
import { CodeFile } from "../dist/index.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tscodegen-biome-"));

const biome = new Biome();
const { projectKey } = biome.openProject();

function repeat(n, fn) {
  for (let i = 0; i < Math.min(3, n); i++) fn(i);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn(i);
  return (performance.now() - t0) / n;
}
function fmt(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
function bench(name, n, fn) {
  const ms = repeat(n, fn);
  console.log(`${name.padEnd(60)}  n=${String(n).padStart(5)}  ${fmt(ms)}/op`);
}

// Same shape as bench.mjs but with Biome-format-instead-of-prettier
function biomeFormat(code) {
  return biome.formatContent(projectKey, code, { filePath: "f.ts" }).content;
}

// 3-equiv: tiny format
bench("[biome] tiny: 5 lines, format, lock", 200, (i) => {
  const p = path.join(TMP, `t-${i}.ts`);
  const cf = new CodeFile(p);
  cf.build((b) => {
    for (let j = 0; j < 5; j++) b.add(`const a${j}=${j};\n`);
    // post-process via biome instead of .format()
    const code = b.toString();
    return new CodeBuilder({}).add(biomeFormat(code));
  })
    .lock()
    .saveToFile();
});

bench("[biome] medium: 100 lines, format, lock", 100, (i) => {
  const p = path.join(TMP, `m-${i}.ts`);
  const cf = new CodeFile(p);
  cf.build((b) => {
    for (let j = 0; j < 100; j++) b.add(`const x${j}=${j};\n`);
    const code = b.toString();
    return new CodeBuilder({}).add(biomeFormat(code));
  })
    .lock()
    .saveToFile();
});

bench("[biome] large: 1000 lines, format, lock", 30, (i) => {
  const p = path.join(TMP, `l-${i}.ts`);
  const cf = new CodeFile(p);
  cf.build((b) => {
    for (let j = 0; j < 1000; j++) b.add(`const x${j}=${j};\n`);
    const code = b.toString();
    return new CodeBuilder({}).add(biomeFormat(code));
  })
    .lock()
    .saveToFile();
});

// Pure-format micro
{
  let code = "";
  for (let j = 0; j < 1000; j++) code += `const x${j}=${j};\n`;
  bench("[biome] micro: format(1000 lines)", 30, () => biomeFormat(code));
}
