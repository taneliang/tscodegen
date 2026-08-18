// End-to-end perf benchmarks for tscodegen.
// Run with: node bench/bench.mjs
import { performance } from "node:perf_hooks";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { CodeFile } from "../dist/index.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tscodegen-bench-"));
const repeat = (n, fn) => {
  // warmup
  for (let i = 0; i < Math.min(3, n); i++) fn(i);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn(i);
  const t1 = performance.now();
  return (t1 - t0) / n;
};

function fmt(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const cases = [];

function bench(name, n, fn) {
  const ms = repeat(n, fn);
  cases.push({ name, n, ms });
  console.log(`${name.padEnd(60)}  n=${String(n).padStart(5)}  ${fmt(ms)}/op`);
}

// 1. tiny file, no format, no lock
bench("tiny: addLine x5, no format, no lock", 1000, (i) => {
  const p = path.join(TMP, `tiny-${i}.ts`);
  new CodeFile(p)
    .build((b) => b.addLine("const a = 1;").addLine("const b = 2;").addLine("const c = 3;").addLine("const d = 4;").addLine("const e = 5;"))
    .saveToFile();
});

// 2. tiny file, no format, lock
bench("tiny: addLine x5, no format, lock", 1000, (i) => {
  const p = path.join(TMP, `tiny-lock-${i}.ts`);
  new CodeFile(p)
    .build((b) => b.addLine("const a = 1;").addLine("const b = 2;").addLine("const c = 3;").addLine("const d = 4;").addLine("const e = 5;"))
    .lock()
    .saveToFile();
});

// 3. tiny file with prettier .format()
bench("tiny: addLine x5, format, lock", 200, (i) => {
  const p = path.join(TMP, `tiny-fmt-${i}.ts`);
  new CodeFile(p)
    .build((b) =>
      b
        .addLine("const a=1;").addLine("const b=2;").addLine("const c=3;").addLine("const d=4;").addLine("const e=5;")
        .format(),
    )
    .lock()
    .saveToFile();
});

// 4. medium file (100 lines) no format
bench("medium: 100 lines, no format, lock", 500, (i) => {
  const p = path.join(TMP, `med-${i}.ts`);
  new CodeFile(p)
    .build((b) => {
      for (let j = 0; j < 100; j++) b.addLine(`const x${j} = ${j};`);
      return b;
    })
    .lock()
    .saveToFile();
});

// 5. medium file (100 lines) WITH format
bench("medium: 100 lines, format, lock", 100, (i) => {
  const p = path.join(TMP, `med-fmt-${i}.ts`);
  new CodeFile(p)
    .build((b) => {
      for (let j = 0; j < 100; j++) b.addLine(`const x${j}=${j};`);
      return b.format();
    })
    .lock()
    .saveToFile();
});

// 6. large file (1000 lines), no format
bench("large: 1000 lines, no format, lock", 100, (i) => {
  const p = path.join(TMP, `lg-${i}.ts`);
  new CodeFile(p)
    .build((b) => {
      for (let j = 0; j < 1000; j++) b.addLine(`const x${j} = ${j};`);
      return b;
    })
    .lock()
    .saveToFile();
});

// 7. large file (1000 lines) WITH format
bench("large: 1000 lines, format, lock", 30, (i) => {
  const p = path.join(TMP, `lg-fmt-${i}.ts`);
  new CodeFile(p)
    .build((b) => {
      for (let j = 0; j < 1000; j++) b.addLine(`const x${j}=${j};`);
      return b.format();
    })
    .lock()
    .saveToFile();
});

// 8. manual section extraction on a file with many sections
{
  // Build a file with 50 manual sections then re-read it
  const seedPath = path.join(TMP, `seed-manual.ts`);
  new CodeFile(seedPath)
    .build((b) => {
      for (let j = 0; j < 50; j++) {
        b.addLine(`const x${j} = ${j};`).addManualSection(`s${j}`, (mb) =>
          mb.addLine(`/* user edit ${j} */`),
        );
      }
      return b;
    })
    .lock()
    .saveToFile();
  bench("regen: read file w/ 50 manual sections, regen, lock", 200, (i) => {
    new CodeFile(seedPath)
      .build((b) => {
        for (let j = 0; j < 50; j++) {
          b.addLine(`const x${j} = ${j};`).addManualSection(`s${j}`, (mb) =>
            mb.addLine(`/* default ${j} */`),
          );
        }
        return b;
      })
      .lock()
      .saveToFile();
  });
}

// 9. micro: just CodeBuilder (no fs, no format, no lock)
import { CodeBuilder } from "../dist/CodeBuilder.js";
bench("micro: CodeBuilder 1000 addLine", 1000, () => {
  const b = new CodeBuilder({});
  for (let j = 0; j < 1000; j++) b.addLine(`const x${j} = ${j};`);
  b.toString();
});

// 10. micro: hash (codelock) on 1000-line content
import { lockCode, verifyLock } from "../dist/codelock.js";
{
  let code = "";
  for (let j = 0; j < 1000; j++) code += `const x${j} = ${j};\n`;
  bench("micro: lockCode (1000 lines)", 1000, () => {
    lockCode(code, false);
  });
  const locked = lockCode(code, false);
  bench("micro: verifyLock (1000 lines)", 1000, () => {
    verifyLock(locked);
  });
}

// 11. micro: prettier alone (1000 lines)
import syncPrettier from "@prettier/sync";
{
  let code = "";
  for (let j = 0; j < 1000; j++) code += `const x${j}=${j};\n`;
  bench("micro: prettier format (1000 lines)", 30, () => {
    syncPrettier.format(code, { parser: "typescript" });
  });
}

// Write a JSON summary
const out = path.join(process.cwd(), "bench/results.json");
fs.writeFileSync(out, JSON.stringify(cases, null, 2));
console.log(`\nWrote ${out}`);
